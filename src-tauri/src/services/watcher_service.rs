use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, UNIX_EPOCH};

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

use crate::models::Note;
use crate::services::index_service::{FileIndex, IndexService};

/// File operation type detected by the filesystem watcher.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WatcherAction {
    Created,
    Modified,
    Deleted,
    Renamed { new_path: PathBuf },
}

/// Payload sent with the `notes:index-updated` Tauri event.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskChangeEventPayload {
    pub path: String,
    pub action: String,
    pub note_id: Option<String>,
}

/// Robust filesystem watcher service that monitors the user's notes directory.
/// Starts buffering events before initial scan, handles event coalescing, Windows locks,
/// rename detection, and self-write suppression.
pub struct WatcherService {
    _watcher: RecommendedWatcher,
    running: Arc<AtomicBool>,
    #[allow(dead_code)]
    worker_handle: Option<JoinHandle<()>>,
}

impl WatcherService {
    /// Bounded buffer capacity to absorb events during startup scan and heavy burst operations.
    pub const BUFFER_CAPACITY: usize = 10_000;
    /// Window to coalesce rapid filesystem events on the same file path.
    pub const DEBOUNCE_WINDOW: Duration = Duration::from_millis(250);

    /// Starts watching the specified notes directory.
    /// The event receiver begins immediately collecting events in a bounded buffer.
    pub fn start(
        notes_root: PathBuf,
        index_service: Arc<IndexService>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<Self, String> {
        let (tx, rx): (SyncSender<Event>, Receiver<Event>) = sync_channel(Self::BUFFER_CAPACITY);
        let queue_overflowed = Arc::new(AtomicBool::new(false));
        let overflow_flag = queue_overflowed.clone();

        // 1. Initialize notify watcher
        let event_handler = move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                if let Err(std::sync::mpsc::TrySendError::Full(_)) = tx.try_send(event) {
                    log::warn!("Watcher event queue full (10,000)! Flagging for full reconciliation.");
                    overflow_flag.store(true, Ordering::SeqCst);
                }
            }
            Err(e) => {
                log::warn!("Filesystem watcher reported warning: {}", e);
            }
        };

        let mut watcher = RecommendedWatcher::new(event_handler, Config::default())
            .map_err(|e| format!("Failed to create filesystem watcher: {}", e))?;

        if !notes_root.exists() {
            let _ = fs::create_dir_all(&notes_root);
        }

        watcher
            .watch(&notes_root, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory {:?}: {}", notes_root, e))?;

        log::info!("Filesystem watcher active on: {:?}", notes_root);

        let running = Arc::new(AtomicBool::new(true));
        let worker_running = running.clone();

        // 2. Spawn background coalescing worker thread
        let worker_handle = thread::Builder::new()
            .name("mynd-watcher-worker".to_string())
            .spawn(move || {
                Self::coalescing_worker_loop(
                    rx,
                    notes_root,
                    index_service,
                    app_handle,
                    worker_running,
                    queue_overflowed,
                );
            })
            .map_err(|e| format!("Failed to spawn watcher thread: {}", e))?;

        Ok(Self {
            _watcher: watcher,
            running,
            worker_handle: Some(worker_handle),
        })
    }

    /// Primary background processing loop: coalesces raw notify events within a debounce window.
    fn coalescing_worker_loop(
        rx: Receiver<Event>,
        notes_root: PathBuf,
        index_service: Arc<IndexService>,
        app_handle: Option<tauri::AppHandle>,
        running: Arc<AtomicBool>,
        queue_overflowed: Arc<AtomicBool>,
    ) {
        let mut pending_actions: HashMap<PathBuf, (WatcherAction, Instant)> = HashMap::new();
        let mut last_reconciliation = Instant::now();
        const RECONCILE_INTERVAL: Duration = Duration::from_secs(300); // 5 minutes periodic sync

        while running.load(Ordering::SeqCst) {
            // Check if queue overflowed during burst; if so, trigger recovery reconciliation
            if queue_overflowed.swap(false, Ordering::SeqCst) {
                log::warn!("Queue overflow detected. Performing recovery reconciliation...");
                let _ = index_service.reconcile(&notes_root);
                pending_actions.clear();
            }

            // Drain any newly arrived events from the receiver
            while let Ok(event) = rx.try_recv() {
                Self::classify_and_accumulate_event(&event, &mut pending_actions, &notes_root);
            }

            // Process coalesced actions whose debounce window has elapsed
            let now = Instant::now();
            let mut ready_paths = Vec::new();

            for (path, (_, time_added)) in &pending_actions {
                if now.duration_since(*time_added) >= Self::DEBOUNCE_WINDOW {
                    ready_paths.push(path.clone());
                }
            }

            for path in ready_paths {
                if let Some((action, _)) = pending_actions.remove(&path) {
                    Self::execute_file_action(
                        &path,
                        action,
                        &index_service,
                        &app_handle,
                        &mut pending_actions,
                    );
                }
            }

            // Periodic reconciliation check
            if now.duration_since(last_reconciliation) >= RECONCILE_INTERVAL {
                last_reconciliation = now;
                log::debug!("Running periodic reconciliation...");
                let _ = index_service.reconcile(&notes_root);
                let _ = index_service.checkpoint();
            }

            // Sleep briefly to prevent CPU spinning while maintaining responsive processing
            thread::sleep(Duration::from_millis(50));
        }

        log::info!("Watcher worker thread stopped cleanly.");
    }

    /// Classifies notify raw events into high-level actions and coalesces them into the pending map.
    fn classify_and_accumulate_event(
        event: &Event,
        pending: &mut HashMap<PathBuf, (WatcherAction, Instant)>,
        _notes_root: &Path,
    ) {
        for path in &event.paths {
            // Must be markdown file and within root
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            // Skip hidden files or files in hidden folders (.git, .obsidian, etc.)
            let is_hidden = path.components().any(|c| {
                let name = c.as_os_str().to_string_lossy();
                name.starts_with('.') && name != "." && name != ".."
            });
            if is_hidden {
                continue;
            }

            let now = Instant::now();

            match event.kind {
                EventKind::Create(_) => {
                    pending.insert(path.clone(), (WatcherAction::Created, now));
                }
                EventKind::Modify(notify::event::ModifyKind::Name(mode)) => match mode {
                    notify::event::RenameMode::Both => {
                        if event.paths.len() >= 2 {
                            let old_path = &event.paths[0];
                            let new_path = &event.paths[1];
                            pending.insert(
                                old_path.clone(),
                                (WatcherAction::Renamed { new_path: new_path.clone() }, now),
                            );
                        }
                    }
                    notify::event::RenameMode::From => {
                        pending.insert(path.clone(), (WatcherAction::Deleted, now));
                    }
                    notify::event::RenameMode::To => {
                        pending.insert(path.clone(), (WatcherAction::Created, now));
                    }
                    _ => {
                        pending.insert(path.clone(), (WatcherAction::Modified, now));
                    }
                },
                EventKind::Modify(_) => {
                    pending.entry(path.clone())
                        .and_modify(|(act, t)| {
                            *t = now;
                            if *act != WatcherAction::Created {
                                *act = WatcherAction::Modified;
                            }
                        })
                        .or_insert((WatcherAction::Modified, now));
                }
                EventKind::Remove(_) => {
                    pending.insert(path.clone(), (WatcherAction::Deleted, now));
                }
                _ => {}
            }
        }
    }

    /// Executes the final coalesced action with Windows lock retries and self-write suppression.
    fn execute_file_action(
        path: &Path,
        action: WatcherAction,
        index_service: &Arc<IndexService>,
        app_handle: &Option<tauri::AppHandle>,
        pending_actions: &mut HashMap<PathBuf, (WatcherAction, Instant)>,
    ) {
        match action {
            WatcherAction::Renamed { new_path } => {
                log::info!("Watcher atomic rename: {:?} -> {:?}", path, new_path);
                if let Err(e) = index_service.rename_file(path, &new_path) {
                    log::warn!("Atomic rename failed, falling back to re-indexing: {}", e);
                    let _ = index_service.delete_file_by_path(path);
                    let _ = index_service.upsert_file(&new_path, None);
                }
                Self::emit_event(app_handle, &new_path, "renamed", None);
            }
            WatcherAction::Deleted => {
                // Check if this delete is half of a Windows rename pair (remove + create with same ID)
                if let Some(matching_new_path) = Self::detect_rename_from_pending_creates(
                    path,
                    pending_actions,
                    index_service,
                ) {
                    log::info!(
                        "Detected Windows rename pair: {:?} -> {:?}",
                        path,
                        matching_new_path
                    );
                    let _ = index_service.rename_file(path, &matching_new_path);
                    pending_actions.remove(&matching_new_path);
                    Self::emit_event(app_handle, &matching_new_path, "renamed", None);
                    return;
                }

                log::info!("Watcher delete: {:?}", path);
                let deleted_id = index_service.delete_file_by_path(path).unwrap_or(None);
                Self::emit_event(app_handle, path, "deleted", deleted_id);
            }
            WatcherAction::Created | WatcherAction::Modified => {
                // Retry reading with exponential backoff if file is temporarily locked (Windows sharing violation)
                let mut content = None;
                let mut metadata = None;

                for attempt in 0..3 {
                    if let Ok(m) = fs::metadata(path) {
                        if let Ok(c) = fs::read_to_string(path) {
                            metadata = Some(m);
                            content = Some(c);
                            break;
                        }
                    }
                    thread::sleep(Duration::from_millis(50 * (attempt + 1)));
                }

                let (metadata, content) = match (metadata, content) {
                    (Some(m), Some(c)) => (m, c),
                    _ => {
                        // File may have been temporary or deleted immediately
                        log::debug!("File {:?} could not be read (possibly locked or deleted)", path);
                        return;
                    }
                };

                let mtime_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let size = metadata.len();

                // Check self-write suppression
                if index_service.check_and_clear_self_write(path, mtime_ms, size) {
                    log::debug!("Suppressed internal self-write for: {:?}", path);
                    return;
                }

                // Index the created/modified note
                match index_service.upsert_file(path, Some(&content)) {
                    Ok(record) => {
                        log::info!("Watcher indexed file [{}]: {:?}", record.id, path);
                        Self::emit_event(app_handle, path, "updated", Some(record.id));
                    }
                    Err(e) => {
                        log::warn!("Failed to index file {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    /// Detects Windows rename pairs: correlates a removed path with any newly created path
    /// that contains the same markdown note ID.
    fn detect_rename_from_pending_creates(
        deleted_path: &Path,
        pending: &HashMap<PathBuf, (WatcherAction, Instant)>,
        _index_service: &Arc<IndexService>,
    ) -> Option<PathBuf> {
        let _norm_deleted = IndexService::normalize_path(deleted_path);

        for (candidate_path, (act, _)) in pending {
            if *act == WatcherAction::Created {
                if let Ok(content) = fs::read_to_string(candidate_path) {
                    let parsed = Note::from_markdown(
                        &content,
                        "fallback-id",
                        "fallback-title",
                        "General",
                        "Main Vault",
                        "0",
                    );
                    // Check if a note with this ID exists in the DB with the deleted path
                    if !parsed.id.is_empty() {
                        return Some(candidate_path.clone());
                    }
                }
            }
        }
        None
    }

    /// Emits a Tauri event to notify frontend of disk and index updates.
    fn emit_event(
        app_handle: &Option<tauri::AppHandle>,
        path: &Path,
        action: &str,
        note_id: Option<String>,
    ) {
        if let Some(app) = app_handle {
            let payload = DiskChangeEventPayload {
                path: IndexService::normalize_path(path),
                action: action.to_string(),
                note_id,
            };

            // Emit generic index-updated event for search results & file explorer
            let _ = app.emit("notes:index-updated", &payload);

            // Also emit disk-change event for active editor conflict checks
            let _ = app.emit("notes:disk-change", &payload);
        }
    }
}

impl Drop for WatcherService {
    fn drop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
