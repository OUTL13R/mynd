use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};
use walkdir::WalkDir;

use crate::models::{
    IndexStats, Note, NoteRecord, RebuildSummary, ReconciliationSummary, SearchHighlight,
    SearchQuery, SearchResponse, SearchResult, SearchSnippet,
};

/// Trait defining the file indexing interface.
/// This abstraction decouples SQLite from high-level commands, allowing future extensions
/// (e.g. Windows NTFS USN Journal engine for system-wide indexing) without breaking the API.
pub trait FileIndex: Send + Sync {
    /// Inserts or updates a file in the index from its disk path and optional preloaded content.
    fn upsert_file(&self, path: &Path, content: Option<&str>) -> Result<NoteRecord, String>;

    /// Deletes a file from the index by its disk path. Returns the note ID if removed.
    fn delete_file_by_path(&self, path: &Path) -> Result<Option<String>, String>;

    /// Deletes a note from the index by its unique ID. Returns the removed path if found.
    fn delete_note_by_id(&self, id: &str) -> Result<Option<PathBuf>, String>;

    /// Atomically renames a file in the index from old_path to new_path.
    fn rename_file(&self, old_path: &Path, new_path: &Path) -> Result<(), String>;

    /// Performs hybrid full-text and title substring search.
    fn search(&self, query: &SearchQuery) -> Result<SearchResponse, String>;

    /// Scans the root directory and reconciles disk state with the SQLite database.
    fn reconcile(&self, root: &Path) -> Result<ReconciliationSummary, String>;

    /// Completely wipes and rebuilds the SQLite content and FTS5 search index.
    fn rebuild(&self, root: &Path) -> Result<RebuildSummary, String>;

    /// Retrieves current index statistics and operational health.
    fn get_stats(&self) -> Result<IndexStats, String>;

    /// Records an internal file write by Mynd to suppress duplicate watcher re-indexing.
    fn record_self_write(&self, path: &Path, mtime_ms: u64, size: u64);

    /// Checks whether an event is an internal write from Mynd and consumes the entry.
    fn check_and_clear_self_write(&self, path: &Path, mtime_ms: u64, size: u64) -> bool;

    /// Runs a WAL checkpoint to flush SQLite write-ahead logs to the main database file.
    fn checkpoint(&self) -> Result<(), String>;
}

/// Metadata recorded for internal file writes to avoid self-triggered re-indexing.
#[derive(Debug, Clone)]
struct SelfWriteEntry {
    expected_mtime_ms: u64,
    expected_size: u64,
    timestamp: Instant,
}

/// Thread-safe registry for suppressing duplicate indexing from Mynd's own saves.
#[derive(Debug, Default)]
struct SelfWriteSuppression {
    entries: HashMap<PathBuf, SelfWriteEntry>,
}

impl SelfWriteSuppression {
    const TTL: Duration = Duration::from_millis(2500);

    fn record(&mut self, path: PathBuf, mtime_ms: u64, size: u64) {
        self.cleanup();
        self.entries.insert(
            path,
            SelfWriteEntry {
                expected_mtime_ms: mtime_ms,
                expected_size: size,
                timestamp: Instant::now(),
            },
        );
    }

    fn check_and_clear(&mut self, path: &Path, mtime_ms: u64, size: u64) -> bool {
        self.cleanup();
        if let Some(entry) = self.entries.get(path) {
            // Check if within TTL and mtime and size match
            if entry.timestamp.elapsed() <= Self::TTL
                && entry.expected_size == size
                && (entry.expected_mtime_ms == mtime_ms
                    // Allow slight timestamp jitter (up to 10ms) across filesystems
                    || entry.expected_mtime_ms.abs_diff(mtime_ms) <= 10)
            {
                self.entries.remove(path);
                return true;
            }
        }
        false
    }

    fn cleanup(&mut self) {
        let now = Instant::now();
        self.entries
            .retain(|_, entry| now.duration_since(entry.timestamp) <= Self::TTL);
    }
}

/// Primary SQLite index service implementing the `FileIndex` trait.
pub struct IndexService {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
    notes_root: PathBuf,
    suppression: Arc<Mutex<SelfWriteSuppression>>,
}

impl IndexService {
    /// Current schema version for SQLite migrations.
    pub const SCHEMA_VERSION: i32 = 1;

    /// Opens or initializes the SQLite database at `db_path` for notes under `notes_root`.
    /// If the database is missing or corrupted, it automatically recovers and recreates schema.
    pub fn new(db_path: PathBuf, notes_root: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory {:?}: {}", parent, e))?;
        }

        let conn = Self::open_and_migrate(&db_path)?;

        let service = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
            notes_root,
            suppression: Arc::new(Mutex::new(SelfWriteSuppression::default())),
        };

        Ok(service)
    }

    /// Opens the SQLite database with WAL pragmas and applies versioned migrations.
    fn open_and_migrate(db_path: &Path) -> Result<Connection, String> {
        let open_result = Connection::open(db_path);

        let mut conn = match open_result {
            Ok(c) => c,
            Err(e) => {
                log::error!("SQLite open failed: {}. Attempting database recovery...", e);
                Self::backup_and_recreate_corrupt_db(db_path)?;
                Connection::open(db_path)
                    .map_err(|e| format!("Failed to recreate database {:?}: {}", db_path, e))?
            }
        };

        // Validate database integrity
        if let Err(e) = Self::configure_pragmas(&conn) {
            log::error!("Database integrity check failed: {}. Recreating...", e);
            drop(conn);
            Self::backup_and_recreate_corrupt_db(db_path)?;
            conn = Connection::open(db_path)
                .map_err(|e| format!("Failed to recreate database {:?}: {}", db_path, e))?;
            Self::configure_pragmas(&conn)?;
        }

        Self::apply_migrations(&mut conn)?;

        Ok(conn)
    }

    /// Sets up required SQLite PRAGMA options for concurrency, reliability, and speed.
    fn configure_pragmas(conn: &Connection) -> Result<(), String> {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;
             PRAGMA temp_store = MEMORY;",
        )
        .map_err(|e| format!("Failed to set SQLite pragmas: {}", e))?;

        // Quick integrity verification
        let integrity: String = conn
            .query_row("PRAGMA quick_check;", [], |row| row.get(0))
            .map_err(|e| format!("Integrity check query failed: {}", e))?;

        if integrity != "ok" {
            return Err(format!("SQLite quick_check returned: {}", integrity));
        }

        Ok(())
    }

    /// Moves a corrupt database file to a `.corrupt.<timestamp>` file.
    fn backup_and_recreate_corrupt_db(db_path: &Path) -> Result<(), String> {
        if db_path.exists() {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let backup = db_path.with_extension(format!("corrupt.{}.db", timestamp));
            let _ = fs::rename(db_path, &backup);
            let _ = fs::remove_file(db_path.with_extension("db-wal"));
            let _ = fs::remove_file(db_path.with_extension("db-shm"));
            log::warn!(
                "Moved corrupted database to {:?} and reset database.",
                backup
            );
        }
        Ok(())
    }

    /// Applies versioned database migrations.
    fn apply_migrations(conn: &mut Connection) -> Result<(), String> {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start migration transaction: {}", e))?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );",
            [],
        )
        .map_err(|e| format!("Failed to create schema_migrations: {}", e))?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS index_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
            [],
        )
        .map_err(|e| format!("Failed to create index_metadata: {}", e))?;

        let current_version: i32 = tx
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current_version < 1 {
            log::info!("Applying SQLite migration v1...");

            tx.execute(
                "CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    folder TEXT NOT NULL,
                    vault TEXT NOT NULL,
                    content TEXT NOT NULL,
                    file_modified_ms INTEGER NOT NULL,
                    file_size INTEGER NOT NULL,
                    updated_at TEXT NOT NULL,
                    created_at TEXT
                );",
                [],
            )
            .map_err(|e| format!("Failed to create notes table: {}", e))?;

            tx.execute(
                "CREATE INDEX IF NOT EXISTS idx_notes_vault ON notes(vault);",
                [],
            )
            .map_err(|e| format!("Failed to create idx_notes_vault: {}", e))?;

            tx.execute(
                "CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title COLLATE NOCASE);",
                [],
            )
            .map_err(|e| format!("Failed to create idx_notes_title: {}", e))?;

            tx.execute(
                "CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);",
                [],
            )
            .map_err(|e| format!("Failed to create idx_notes_path: {}", e))?;

            // Standalone FTS5 table managed strictly within Rust transactions to avoid rowid mapping bugs
            tx.execute(
                "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                    note_id UNINDEXED,
                    title,
                    folder,
                    vault,
                    content,
                    tokenize = 'unicode61 remove_diacritics 2'
                );",
                [],
            )
            .map_err(|e| format!("Failed to create notes_fts table: {}", e))?;

            let now = chrono_now();
            tx.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?);",
                params![now],
            )
            .map_err(|e| format!("Failed to record migration 1: {}", e))?;

            tx.execute(
                "INSERT OR REPLACE INTO index_metadata (key, value) VALUES ('schema_version', '1');",
                [],
            )
            .map_err(|e| format!("Failed to set metadata schema_version: {}", e))?;

            tx.execute(
                "INSERT OR REPLACE INTO index_metadata (key, value) VALUES ('scan_status', 'ready');",
                [],
            )
            .map_err(|e| format!("Failed to set metadata scan_status: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit migrations: {}", e))?;

        Ok(())
    }

    /// Checks if the index has already been initialized with indexed data.
    pub fn has_existing_index(&self) -> bool {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return false,
        };

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes;", [], |row| row.get(0))
            .unwrap_or(0);

        count > 0
    }

    /// Normalizes a filesystem path for storage and comparisons.
    /// Handles Windows drive lowercasing, forward slashes, and removes verbatim prefixes.
    pub fn normalize_path(path: &Path) -> String {
        let path_str = path.to_string_lossy().to_string();

        // Strip Windows verbatim prefix '\\?\' if present
        let clean = if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
            stripped.to_string()
        } else {
            path_str
        };

        // Convert backslashes to forward slashes
        let mut normalized = clean.replace('\\', "/");

        // Lowercase drive letter on Windows (e.g. C:/ -> c:/)
        if normalized.len() >= 2
            && normalized.chars().next().unwrap().is_ascii_alphabetic()
            && normalized.chars().nth(1) == Some(':')
        {
            let drive = normalized.chars().next().unwrap().to_ascii_lowercase();
            normalized.replace_range(..1, &drive.to_string());
        }

        normalized
    }

    /// Verifies that a path is strictly inside the authorized notes root and not a hidden file.
    pub fn is_safe_note_path(&self, path: &Path) -> bool {
        // Must have .md extension
        if path.extension().and_then(|ext| ext.to_str()) != Some("md") {
            return false;
        }

        // Must not be a hidden file or inside a hidden directory (starts with '.')
        for comp in path.components() {
            let s = comp.as_os_str().to_string_lossy();
            if s.starts_with('.') && s != "." && s != ".." {
                return false;
            }
        }

        // Must be located within the configured notes root
        let norm_path = Self::normalize_path(path);
        let norm_root = Self::normalize_path(&self.notes_root);

        norm_path.starts_with(&norm_root)
    }

    /// Computes vault and folder relative names for a note given its path and the notes root.
    pub fn derive_vault_and_folder(root_dir: &Path, file_path: &Path) -> (String, String) {
        if let Ok(rel) = file_path.strip_prefix(root_dir) {
            let comps: Vec<String> = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy().to_string())
                .collect();
            if comps.len() >= 3 {
                let vault = comps[0].clone();
                let folder = comps[1..comps.len() - 1].join("/");
                (vault, folder)
            } else if comps.len() == 2 {
                let vault = comps[0].clone();
                (vault.clone(), vault)
            } else {
                ("Main Vault".to_string(), "Main Vault".to_string())
            }
        } else {
            ("Main Vault".to_string(), "Main Vault".to_string())
        }
    }
    pub fn map_fts_row(row: &rusqlite::Row) -> rusqlite::Result<(NoteRecord, f64)> {
        Ok((
            NoteRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                folder: row.get(3)?,
                vault: row.get(4)?,
                content: row.get(5)?,
                file_modified_ms: row.get(6)?,
                file_size: row.get(7)?,
                updated_at: row.get(8)?,
                created_at: row.get(9)?,
            },
            row.get::<_, f64>(10)?,
        ))
    }

    /// Maps an SQLite row to a NoteRecord.
    pub fn map_note_row(row: &rusqlite::Row) -> rusqlite::Result<NoteRecord> {
        Ok(NoteRecord {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
            folder: row.get(3)?,
            vault: row.get(4)?,
            content: row.get(5)?,
            file_modified_ms: row.get(6)?,
            file_size: row.get(7)?,
            updated_at: row.get(8)?,
            created_at: row.get(9)?,
        })
    }
}

impl FileIndex for IndexService {
    fn upsert_file(&self, path: &Path, content: Option<&str>) -> Result<NoteRecord, String> {
        if !self.is_safe_note_path(path) {
            return Err(format!("Path {:?} is outside notes root or invalid", path));
        }

        let metadata = fs::metadata(path)
            .map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;

        let file_size = metadata.len() as i64;
        let file_modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let owned_content;
        let raw_content = match content {
            Some(c) => c,
            None => {
                owned_content = fs::read_to_string(path)
                    .map_err(|e| format!("Failed to read note file {:?}: {}", path, e))?;
                &owned_content
            }
        };

        let fallback_title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let (fallback_vault, fallback_folder) =
            Self::derive_vault_and_folder(&self.notes_root, path);

        let fallback_id = format!("note-{}", fallback_title.replace(' ', "-").to_lowercase());
        let fallback_time = file_modified_ms.to_string();

        let note = Note::from_markdown(
            raw_content,
            &fallback_id,
            &fallback_title,
            &fallback_folder,
            &fallback_vault,
            &fallback_time,
        );

        let normalized_path = Self::normalize_path(path);

        let record = NoteRecord {
            id: note.id.clone(),
            path: normalized_path.clone(),
            title: note.title.clone(),
            folder: note.folder.clone(),
            vault: note.vault.clone(),
            content: note.content.clone(),
            file_modified_ms,
            file_size,
            updated_at: note.updated_at.clone(),
            created_at: note.created_at.clone(),
        };

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        // 1. Upsert into notes table
        tx.execute(
            "INSERT INTO notes (
                id, path, title, folder, vault, content,
                file_modified_ms, file_size, updated_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                path = excluded.path,
                title = excluded.title,
                folder = excluded.folder,
                vault = excluded.vault,
                content = excluded.content,
                file_modified_ms = excluded.file_modified_ms,
                file_size = excluded.file_size,
                updated_at = excluded.updated_at,
                created_at = excluded.created_at;",
            params![
                record.id,
                record.path,
                record.title,
                record.folder,
                record.vault,
                record.content,
                record.file_modified_ms,
                record.file_size,
                record.updated_at,
                record.created_at,
            ],
        )
        .map_err(|e| format!("Failed to upsert into notes: {}", e))?;

        // If another note previously had this path, clear its path conflict
        tx.execute(
            "UPDATE notes SET path = path || '.old' WHERE path = ? AND id != ?;",
            params![record.path, record.id],
        )
        .ok();

        // 2. Transactionally update FTS5 search index
        tx.execute(
            "DELETE FROM notes_fts WHERE note_id = ?;",
            params![record.id],
        )
        .map_err(|e| format!("Failed to delete old FTS entry: {}", e))?;

        tx.execute(
            "INSERT INTO notes_fts (note_id, title, folder, vault, content)
             VALUES (?, ?, ?, ?, ?);",
            params![
                record.id,
                record.title,
                record.folder,
                record.vault,
                record.content
            ],
        )
        .map_err(|e| format!("Failed to insert FTS entry: {}", e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit upsert: {}", e))?;

        Ok(record)
    }

    fn delete_file_by_path(&self, path: &Path) -> Result<Option<String>, String> {
        let normalized_path = Self::normalize_path(path);

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let note_id: Option<String> = conn
            .query_row(
                "SELECT id FROM notes WHERE path = ?;",
                params![normalized_path],
                |row| row.get(0),
            )
            .ok();

        if let Some(ref id) = note_id {
            let tx = conn
                .transaction()
                .map_err(|e| format!("Failed to start delete transaction: {}", e))?;

            tx.execute("DELETE FROM notes WHERE id = ?;", params![id])
                .map_err(|e| format!("Failed to delete from notes: {}", e))?;

            tx.execute("DELETE FROM notes_fts WHERE note_id = ?;", params![id])
                .map_err(|e| format!("Failed to delete from notes_fts: {}", e))?;

            tx.commit()
                .map_err(|e| format!("Failed to commit delete: {}", e))?;
        }

        Ok(note_id)
    }

    fn delete_note_by_id(&self, id: &str) -> Result<Option<PathBuf>, String> {
        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let path_str: Option<String> = conn
            .query_row(
                "SELECT path FROM notes WHERE id = ?;",
                params![id],
                |row| row.get(0),
            )
            .ok();

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to begin delete transaction: {}", e))?;

        tx.execute("DELETE FROM notes WHERE id = ?;", params![id])
            .map_err(|e| format!("Failed to delete from notes: {}", e))?;

        tx.execute("DELETE FROM notes_fts WHERE note_id = ?;", params![id])
            .map_err(|e| format!("Failed to delete from notes_fts: {}", e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit delete: {}", e))?;

        Ok(path_str.map(PathBuf::from))
    }

    fn rename_file(&self, old_path: &Path, new_path: &Path) -> Result<(), String> {
        let norm_old = Self::normalize_path(old_path);
        let norm_new = Self::normalize_path(new_path);

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let new_title = new_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let (new_vault, new_folder) = Self::derive_vault_and_folder(&self.notes_root, new_path);

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to begin rename transaction: {}", e))?;

        let updated_rows = tx
            .execute(
                "UPDATE notes SET path = ?, title = ?, vault = ?, folder = ? WHERE path = ?;",
                params![norm_new, new_title, new_vault, new_folder, norm_old],
            )
            .map_err(|e| format!("Failed to rename note record: {}", e))?;

        if updated_rows > 0 {
            // Update FTS entry
            let note_id: String = tx
                .query_row(
                    "SELECT id FROM notes WHERE path = ?;",
                    params![norm_new],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Failed to retrieve renamed note ID: {}", e))?;

            tx.execute(
                "UPDATE notes_fts SET title = ?, vault = ?, folder = ? WHERE note_id = ?;",
                params![new_title, new_vault, new_folder, note_id],
            )
            .map_err(|e| format!("Failed to update FTS on rename: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit rename: {}", e))?;

        Ok(())
    }

    fn search(&self, query: &SearchQuery) -> Result<SearchResponse, String> {
        let start_time = Instant::now();
        let raw_query = query.query.trim();

        if raw_query.is_empty() {
            return Ok(SearchResponse {
                results: Vec::new(),
                total: 0,
                took_ms: 0.0,
            });
        }

        let limit = query.limit.unwrap_or(30).min(100);
        let offset = query.offset.unwrap_or(0);

        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        // 1. Prepare sanitized FTS5 query token string
        let fts_query = sanitize_fts5_query(raw_query);

        // 2. Fetch candidates from FTS5 with BM25 score
        let mut candidate_map: HashMap<String, (NoteRecord, f64)> = HashMap::new();
        if !fts_query.is_empty() {
            let vault_filter = query.vault.as_deref().unwrap_or("");
            if !vault_filter.is_empty() {
                let sql = "SELECT n.id, n.path, n.title, n.folder, n.vault, n.content,
                                  n.file_modified_ms, n.file_size, n.updated_at, n.created_at,
                                  bm25(notes_fts) AS bm25_score
                           FROM notes_fts f
                           JOIN notes n ON n.id = f.note_id
                           WHERE notes_fts MATCH ? AND n.vault = ?
                           ORDER BY bm25_score ASC
                           LIMIT 150;";
                if let Ok(mut stmt) = conn.prepare(sql) {
                    if let Ok(rows) = stmt.query_map(params![fts_query, vault_filter], Self::map_fts_row) {
                        for r in rows.flatten() {
                            candidate_map.insert(r.0.id.clone(), r);
                        }
                    }
                }
            } else {
                let sql = "SELECT n.id, n.path, n.title, n.folder, n.vault, n.content,
                                  n.file_modified_ms, n.file_size, n.updated_at, n.created_at,
                                  bm25(notes_fts) AS bm25_score
                           FROM notes_fts f
                           JOIN notes n ON n.id = f.note_id
                           WHERE notes_fts MATCH ?
                           ORDER BY bm25_score ASC
                           LIMIT 150;";
                if let Ok(mut stmt) = conn.prepare(sql) {
                    if let Ok(rows) = stmt.query_map(params![fts_query], Self::map_fts_row) {
                        for r in rows.flatten() {
                            candidate_map.insert(r.0.id.clone(), r);
                        }
                    }
                }
            }
        }

        // 3. Title Substring Query (LIKE %query% ESCAPE '\') for instant as-you-type matches
        let escaped_query = escape_like_pattern(raw_query);
        let pattern = format!("%{}%", escaped_query);
        let vault_filter = query.vault.as_deref().unwrap_or("");

        if !vault_filter.is_empty() {
            let substring_sql = "SELECT id, path, title, folder, vault, content,
                    file_modified_ms, file_size, updated_at, created_at
             FROM notes
             WHERE title LIKE ? ESCAPE '\\' AND vault = ?
             LIMIT 100;";
            if let Ok(mut stmt) = conn.prepare(substring_sql) {
                if let Ok(rows) = stmt.query_map(params![pattern, vault_filter], Self::map_note_row) {
                    for record in rows.flatten() {
                        candidate_map.entry(record.id.clone()).or_insert((record, 0.0));
                    }
                }
            }
        } else {
            let substring_sql = "SELECT id, path, title, folder, vault, content,
                    file_modified_ms, file_size, updated_at, created_at
             FROM notes
             WHERE title LIKE ? ESCAPE '\\'
             LIMIT 100;";
            if let Ok(mut stmt) = conn.prepare(substring_sql) {
                if let Ok(rows) = stmt.query_map(params![pattern], Self::map_note_row) {
                    for record in rows.flatten() {
                        candidate_map.entry(record.id.clone()).or_insert((record, 0.0));
                    }
                }
            }
        }

        // 4. Calculate deterministic multi-factor ranking scores and highlights
        let mut scored_results: Vec<SearchResult> = Vec::with_capacity(candidate_map.len());
        let query_lower = raw_query.to_lowercase();
        let query_tokens: Vec<&str> = query_lower.split_whitespace().collect();

        // Calculate min/max modified times for recency normalization
        let mut max_modified = 1i64;
        let mut min_modified = i64::MAX;
        for (record, _) in candidate_map.values() {
            if record.file_modified_ms > max_modified {
                max_modified = record.file_modified_ms;
            }
            if record.file_modified_ms < min_modified {
                min_modified = record.file_modified_ms;
            }
        }
        if min_modified == i64::MAX {
            min_modified = 0;
        }

        for (record, raw_bm25) in candidate_map.into_values() {
            let title_lower = record.title.to_lowercase();

            // Normalized BM25: FTS5 raw score is negative; convert to positive 0..10 range
            let bm25_score = if raw_bm25 != 0.0 {
                10.0 / (1.0 + raw_bm25.abs())
            } else {
                0.0
            };

            // Title boost points
            let mut title_boost = 0.0;
            if title_lower == query_lower {
                title_boost += 100.0; // Exact match
            } else if title_lower.starts_with(&query_lower) {
                title_boost += 50.0; // Prefix match
            } else if title_lower.contains(&query_lower) {
                title_boost += 20.0; // Substring match
            }

            // Word-boundary token matches in title
            for token in &query_tokens {
                if title_lower.contains(token) {
                    title_boost += 15.0;
                }
            }

            // Recency boost (0.0 to 5.0)
            let recency_boost = if max_modified > min_modified {
                ((record.file_modified_ms - min_modified) as f64
                    / (max_modified - min_modified) as f64)
                    * 5.0
            } else {
                2.5
            };

            let total_score = bm25_score + title_boost + recency_boost;

            // Extract structured title matches
            let title_matches = extract_title_highlights(&record.title, &query_tokens);

            // Extract safe structured snippets from content
            let snippets = extract_content_snippets(&record.content, &query_tokens, 2);

            scored_results.push(SearchResult {
                id: record.id,
                title: record.title,
                folder: record.folder,
                vault: record.vault,
                path: record.path,
                updated_at: record.updated_at,
                score: total_score,
                title_matches,
                snippets,
            });
        }

        // Sort descending by score
        scored_results.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let total = scored_results.len();
        let paginated: Vec<SearchResult> = scored_results
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect();

        let took_ms = start_time.elapsed().as_secs_f64() * 1000.0;

        Ok(SearchResponse {
            results: paginated,
            total,
            took_ms,
        })
    }

    fn reconcile(&self, root: &Path) -> Result<ReconciliationSummary, String> {
        let start_time = Instant::now();
        let mut summary = ReconciliationSummary::default();

        if !root.exists() {
            return Ok(summary);
        }

        // 1. Collect all valid markdown files currently on disk
        let mut disk_files: HashMap<String, (PathBuf, i64, i64)> = HashMap::new();

        for entry in WalkDir::new(root)
            .follow_links(false) // Security: avoid recursive symlink traps
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                // Skip hidden files and directories (.git, .trash, etc.)
                !name.starts_with('.') || name == "."
            })
        {
            let entry = match entry {
                Ok(e) => e,
                Err(err) => {
                    log::warn!("Reconciliation skipped inaccessible entry: {}", err);
                    continue;
                }
            };

            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(metadata) = entry.metadata() {
                    let mtime = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);
                    let size = metadata.len() as i64;
                    let norm = Self::normalize_path(path);
                    disk_files.insert(norm, (path.to_path_buf(), mtime, size));
                }
            }
        }

        // 2. Query all existing indexed records from SQLite
        let mut db_records: HashMap<String, (String, i64, i64)> = HashMap::new(); // norm_path -> (id, mtime, size)
        {
            let conn = self
                .conn
                .lock()
                .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;
            let mut stmt = conn
                .prepare("SELECT id, path, file_modified_ms, file_size FROM notes;")
                .map_err(|e| format!("Failed to prepare select: {}", e))?;

            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                })
                .map_err(|e| format!("Failed to query notes: {}", e))?;

            for r in rows.flatten() {
                db_records.insert(r.1, (r.0, r.2, r.3));
            }
        }

        // 3. Detect additions and modifications
        for (norm_path, (disk_path, disk_mtime, disk_size)) in &disk_files {
            if let Some((_id, db_mtime, db_size)) = db_records.get(norm_path) {
                if *db_mtime != *disk_mtime || *db_size != *disk_size {
                    // File modified
                    if self.upsert_file(disk_path, None).is_ok() {
                        summary.updated += 1;
                    }
                } else {
                    summary.unchanged += 1;
                }
            } else {
                // File newly added
                if self.upsert_file(disk_path, None).is_ok() {
                    summary.added += 1;
                }
            }
        }

        // 4. Detect deletions (records in DB that no longer exist on disk)
        for (norm_path, (note_id, _, _)) in &db_records {
            if !disk_files.contains_key(norm_path) {
                let _ = self.delete_note_by_id(note_id);
                summary.removed += 1;
            }
        }

        // Update metadata table
        if let Ok(conn) = self.conn.lock() {
            let now = chrono_now();
            let _ = conn.execute(
                "INSERT OR REPLACE INTO index_metadata (key, value) VALUES ('last_successful_sync', ?);",
                params![now],
            );
        }

        summary.took_ms = start_time.elapsed().as_millis() as u64;
        log::info!(
            "Reconciliation complete in {}ms: +{} added, ~{} updated, -{} removed, {} unchanged",
            summary.took_ms,
            summary.added,
            summary.updated,
            summary.removed,
            summary.unchanged
        );

        Ok(summary)
    }

    fn rebuild(&self, root: &Path) -> Result<RebuildSummary, String> {
        let start_time = Instant::now();

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to begin rebuild transaction: {}", e))?;

        tx.execute("DELETE FROM notes;", [])
            .map_err(|e| format!("Failed to clear notes table: {}", e))?;

        tx.execute("DELETE FROM notes_fts;", [])
            .map_err(|e| format!("Failed to clear notes_fts table: {}", e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit clear: {}", e))?;

        drop(conn);

        // Perform full initial disk scan
        let recon = self.reconcile(root)?;

        // Optimize FTS5 structure
        if let Ok(conn) = self.conn.lock() {
            let _ = conn.execute("INSERT INTO notes_fts(notes_fts) VALUES('rebuild');", []);
            let _ = conn.execute("INSERT INTO notes_fts(notes_fts) VALUES('optimize');", []);
        }

        Ok(RebuildSummary {
            total_indexed: recon.added,
            took_ms: start_time.elapsed().as_millis() as u64,
        })
    }

    fn get_stats(&self) -> Result<IndexStats, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        let total_notes: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes;", [], |r| r.get(0))
            .unwrap_or(0);

        let total_vaults: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT vault) FROM notes WHERE vault != '';",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let last_sync_time: Option<String> = conn
            .query_row(
                "SELECT value FROM index_metadata WHERE key = 'last_successful_sync';",
                [],
                |r| r.get(0),
            )
            .ok();

        let status: String = conn
            .query_row(
                "SELECT value FROM index_metadata WHERE key = 'scan_status';",
                [],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "ready".to_string());

        let db_size_bytes = fs::metadata(&self.db_path).map(|m| m.len()).unwrap_or(0);

        Ok(IndexStats {
            total_notes: total_notes as usize,
            total_vaults: total_vaults as usize,
            db_size_bytes,
            last_sync_time,
            status,
        })
    }

    fn record_self_write(&self, path: &Path, mtime_ms: u64, size: u64) {
        if let Ok(mut sup) = self.suppression.lock() {
            sup.record(path.to_path_buf(), mtime_ms, size);
        }
    }

    fn check_and_clear_self_write(&self, path: &Path, mtime_ms: u64, size: u64) -> bool {
        if let Ok(mut sup) = self.suppression.lock() {
            sup.check_and_clear(path, mtime_ms, size)
        } else {
            false
        }
    }

    fn checkpoint(&self) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Failed to acquire SQLite lock: {}", e))?;

        conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);")
            .map_err(|e| format!("WAL checkpoint failed: {}", e))?;

        Ok(())
    }
}

// ---------------- Helper Functions ----------------

/// Sanitizes user query text into safe FTS5 match query terms.
/// Handles special FTS5 operators (*, :, ", ^, etc.) to prevent syntax errors.
fn sanitize_fts5_query(input: &str) -> String {
    let clean: String = input
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '_' || c == '-' {
                c
            } else {
                ' '
            }
        })
        .collect();

    let terms: Vec<String> = clean
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| format!("\"{}\"*", w))
        .collect();

    terms.join(" ")
}

/// Escapes special SQL LIKE wildcard characters (`%`, `_`, `\`).
fn escape_like_pattern(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for c in input.chars() {
        if c == '%' || c == '_' || c == '\\' {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

/// Extracts character start/end ranges for matched tokens within a note title.
fn extract_title_highlights(title: &str, query_tokens: &[&str]) -> Vec<SearchHighlight> {
    let mut highlights = Vec::new();
    let title_lower = title.to_lowercase();

    for token in query_tokens {
        if token.is_empty() {
            continue;
        }

        let mut start_idx = 0;
        while let Some(found_idx) = title_lower[start_idx..].find(*token) {
            let abs_start = start_idx + found_idx;
            let abs_end = abs_start + token.len();

            // Convert byte indices to char indices
            let char_start = title[..abs_start].chars().count();
            let char_end = char_start + title[abs_start..abs_end].chars().count();

            highlights.push(SearchHighlight {
                start: char_start,
                end: char_end,
            });

            start_idx = abs_end;
            if start_idx >= title_lower.len() {
                break;
            }
        }
    }

    highlights.sort_by_key(|h| h.start);
    highlights.dedup();
    highlights
}

/// Extracts safe structured content snippets without unsanitized HTML.
fn extract_content_snippets(
    content: &str,
    query_tokens: &[&str],
    max_snippets: usize,
) -> Vec<SearchSnippet> {
    let mut snippets = Vec::new();
    let content_lower = content.to_lowercase();
    const CONTEXT_LEN: usize = 40;

    for token in query_tokens {
        if token.is_empty() {
            continue;
        }

        let mut search_from = 0;
        while let Some(pos) = content_lower[search_from..].find(*token) {
            let match_start = search_from + pos;
            let match_end = match_start + token.len();

            let prefix_start = match_start.saturating_sub(CONTEXT_LEN);
            let suffix_end = (match_end + CONTEXT_LEN).min(content.len());

            let mut prefix = content[prefix_start..match_start]
                .replace('\r', "")
                .replace('\n', " ");
            if prefix_start > 0 {
                prefix = format!("...{}", prefix);
            }

            let matched = content[match_start..match_end].to_string();

            let mut suffix = content[match_end..suffix_end]
                .replace('\r', "")
                .replace('\n', " ");
            if suffix_end < content.len() {
                suffix.push_str("...");
            }

            snippets.push(SearchSnippet {
                prefix,
                matched,
                suffix,
            });

            if snippets.len() >= max_snippets {
                return snippets;
            }

            search_from = match_end;
            if search_from >= content.len() {
                break;
            }
        }
    }

    snippets
}

/// Helper to get current ISO 8601 UTC timestamp string.
fn chrono_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}-01-01T00:00:00Z", 1970 + (now / 31536000))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_env(test_name: &str) -> (PathBuf, PathBuf, IndexService) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let base_dir = std::env::temp_dir().join(format!("mynd_test_{}_{}", test_name, timestamp));
        let notes_root = base_dir.join("notes");
        let db_path = base_dir.join("test_index.db");

        fs::create_dir_all(&notes_root).unwrap();
        let service = IndexService::new(db_path.clone(), notes_root.clone()).unwrap();

        (base_dir, notes_root, service)
    }

    #[test]
    fn test_migrations_and_metadata() {
        let (base_dir, _, service) = create_test_env("migrations");

        let stats = service.get_stats().unwrap();
        assert_eq!(stats.total_notes, 0);
        assert_eq!(stats.status, "ready");

        // Verify tables and pragmas
        let conn = service.conn.lock().unwrap();
        let schema_ver: i32 = conn
            .query_row("SELECT MAX(version) FROM schema_migrations;", [], |r| r.get(0))
            .unwrap();
        assert_eq!(schema_ver, 1);

        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |r| r.get(0))
            .unwrap();
        assert_eq!(journal_mode.to_uppercase(), "WAL");

        drop(conn);
        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_fts_transactional_sync() {
        let (base_dir, notes_root, service) = create_test_env("fts_sync");

        let note_path = notes_root.join("Architecture.md");
        let note = Note {
            id: "note-arch-1".to_string(),
            title: "System Architecture".to_string(),
            folder: "Main Vault".to_string(),
            vault: "Main Vault".to_string(),
            content: "# System Architecture\n\nThis note explains the distributed index and caching pipeline.".to_string(),
            updated_at: "2026-09-13T12:00:00Z".to_string(),
            created_at: Some("2026-09-13T12:00:00Z".to_string()),
        };
        fs::write(&note_path, note.to_markdown()).unwrap();

        // 1. Insert file
        let record = service.upsert_file(&note_path, None).unwrap();
        assert_eq!(record.title, "System Architecture");

        // Search for token in content
        let res1 = service
            .search(&SearchQuery {
                query: "distributed".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();
        assert_eq!(res1.results.len(), 1);
        assert_eq!(res1.results[0].id, "note-arch-1");

        // 2. Update file content
        let updated_note = Note {
            content: "# System Architecture\n\nUpdated pipeline with Kafka message broker.".to_string(),
            ..note
        };
        fs::write(&note_path, updated_note.to_markdown()).unwrap();
        service.upsert_file(&note_path, None).unwrap();

        // Old keyword "distributed" should no longer match
        let res2 = service
            .search(&SearchQuery {
                query: "distributed".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();
        assert_eq!(res2.results.len(), 0);

        // New keyword "Kafka" must match
        let res3 = service
            .search(&SearchQuery {
                query: "Kafka".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();
        assert_eq!(res3.results.len(), 1);

        // 3. Delete file
        service.delete_file_by_path(&note_path).unwrap();
        let res4 = service
            .search(&SearchQuery {
                query: "Kafka".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();
        assert_eq!(res4.results.len(), 0);

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_ranking_formula() {
        let (base_dir, notes_root, service) = create_test_env("ranking");

        // Note A: Exact title match
        let path_a = notes_root.join("Rust.md");
        let note_a = Note {
            id: "note-a".to_string(),
            title: "Rust".to_string(),
            folder: "Main Vault".to_string(),
            vault: "Main Vault".to_string(),
            content: "General info.".to_string(),
            updated_at: "2026-09-13T10:00:00Z".to_string(),
            created_at: None,
        };
        fs::write(&path_a, note_a.to_markdown()).unwrap();
        service.upsert_file(&path_a, None).unwrap();

        // Note B: Prefix title match
        let path_b = notes_root.join("Rust Programming Guide.md");
        let note_b = Note {
            id: "note-b".to_string(),
            title: "Rust Programming Guide".to_string(),
            folder: "Main Vault".to_string(),
            vault: "Main Vault".to_string(),
            content: "Detailed tutorial.".to_string(),
            updated_at: "2026-09-13T10:00:00Z".to_string(),
            created_at: None,
        };
        fs::write(&path_b, note_b.to_markdown()).unwrap();
        service.upsert_file(&path_b, None).unwrap();

        // Note C: Content match only
        let path_c = notes_root.join("Languages.md");
        let note_c = Note {
            id: "note-c".to_string(),
            title: "Languages".to_string(),
            folder: "Main Vault".to_string(),
            vault: "Main Vault".to_string(),
            content: "Discussing Rust and C++.".to_string(),
            updated_at: "2026-09-13T10:00:00Z".to_string(),
            created_at: None,
        };
        fs::write(&path_c, note_c.to_markdown()).unwrap();
        service.upsert_file(&path_c, None).unwrap();

        let res = service
            .search(&SearchQuery {
                query: "Rust".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();

        assert_eq!(res.results.len(), 3);
        // Note A (exact title match) MUST rank #1
        assert_eq!(res.results[0].id, "note-a");
        // Note B (prefix title match) MUST rank #2
        assert_eq!(res.results[1].id, "note-b");
        // Note C (content match only) MUST rank #3
        assert_eq!(res.results[2].id, "note-c");

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_idempotent_indexing_and_reconciliation() {
        let (base_dir, notes_root, service) = create_test_env("idempotence");

        let path1 = notes_root.join("Note1.md");
        let path2 = notes_root.join("Note2.md");
        fs::write(&path1, "# Note One\nContent one.").unwrap();
        fs::write(&path2, "# Note Two\nContent two.").unwrap();

        // Initial scan
        let recon1 = service.reconcile(&notes_root).unwrap();
        assert_eq!(recon1.added, 2);
        assert_eq!(recon1.updated, 0);
        assert_eq!(recon1.removed, 0);

        // Immediate repeated scan should be a no-op (idempotent)
        let recon2 = service.reconcile(&notes_root).unwrap();
        assert_eq!(recon2.added, 0);
        assert_eq!(recon2.updated, 0);
        assert_eq!(recon2.removed, 0);
        assert_eq!(recon2.unchanged, 2);

        // Remove a file from disk and modify another
        fs::remove_file(&path1).unwrap();
        fs::write(&path2, "# Note Two\nUpdated content.").unwrap();

        let recon3 = service.reconcile(&notes_root).unwrap();
        assert_eq!(recon3.removed, 1);
        assert_eq!(recon3.updated, 1);
        assert_eq!(recon3.added, 0);

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_windows_rename_handling() {
        let (base_dir, notes_root, service) = create_test_env("rename");

        let old_path = notes_root.join("OldName.md");
        let new_path = notes_root.join("NewName.md");

        let note = Note {
            id: "note-rename-1".to_string(),
            title: "OldName".to_string(),
            folder: "Main Vault".to_string(),
            vault: "Main Vault".to_string(),
            content: "Document content".to_string(),
            updated_at: "2026-09-13T10:00:00Z".to_string(),
            created_at: None,
        };
        fs::write(&old_path, note.to_markdown()).unwrap();
        service.upsert_file(&old_path, None).unwrap();

        // Perform rename
        fs::rename(&old_path, &new_path).unwrap();
        service.rename_file(&old_path, &new_path).unwrap();

        let stats = service.get_stats().unwrap();
        assert_eq!(stats.total_notes, 1);

        let res = service
            .search(&SearchQuery {
                query: "NewName".to_string(),
                vault: None,
                limit: None,
                offset: None,
            })
            .unwrap();
        assert_eq!(res.results.len(), 1);
        assert_eq!(res.results[0].id, "note-rename-1");
        assert_eq!(res.results[0].title, "NewName");

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_metadata_self_write_suppression() {
        let (base_dir, notes_root, service) = create_test_env("suppression");

        let path = notes_root.join("MyndNote.md");
        fs::write(&path, "Content").unwrap();
        let metadata = fs::metadata(&path).unwrap();
        let mtime = metadata
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let size = metadata.len();

        // Record self-write
        service.record_self_write(&path, mtime, size);

        // Suppressed for identical mtime and size
        assert!(service.check_and_clear_self_write(&path, mtime, size));

        // Subsequent check should be false (consumed)
        assert!(!service.check_and_clear_self_write(&path, mtime, size));

        // Different mtime / size should not be suppressed
        service.record_self_write(&path, mtime, size);
        assert!(!service.check_and_clear_self_write(&path, mtime + 500, size + 10));

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_security_boundary_containment() {
        let (base_dir, notes_root, service) = create_test_env("security");

        let inside_path = notes_root.join("Legit.md");
        let outside_path = base_dir.join("Outside.md");
        let hidden_path = notes_root.join(".git").join("Hidden.md");

        fs::write(&inside_path, "Inside").unwrap();
        fs::write(&outside_path, "Outside").unwrap();
        let _ = fs::create_dir_all(notes_root.join(".git"));
        fs::write(&hidden_path, "Hidden").unwrap();

        assert!(service.is_safe_note_path(&inside_path));
        assert!(!service.is_safe_note_path(&outside_path));
        assert!(!service.is_safe_note_path(&hidden_path));

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_large_vault_benchmarks() {
        let (base_dir, notes_root, service) = create_test_env("benchmark");

        const NOTE_COUNT: usize = 1_000;
        let start_index = Instant::now();

        // Generate 1,000 synthetic notes
        for i in 0..NOTE_COUNT {
            let path = notes_root.join(format!("Note_{:04}.md", i));
            let content = format!(
                "---\nid: note-{:04}\ntitle: Note {:04}\nfolder: Main Vault\nvault: Main Vault\nupdatedAt: 2026-09-13T10:00:00Z\n---\n# Note {:04}\n\nThis is synthetic markdown content for benchmark testing. Keyword: target_{}.",
                i, i, i, if i % 10 == 0 { "alpha" } else { "beta" }
            );
            fs::write(&path, content).unwrap();
        }

        let write_time = start_index.elapsed();
        println!("Generated {} test notes in {:?}", NOTE_COUNT, write_time);

        // Measure initial disk scan throughput
        let start_scan = Instant::now();
        let recon = service.reconcile(&notes_root).unwrap();
        let scan_time = start_scan.elapsed();
        println!("Reconciled {} notes in {:?}", recon.added, scan_time);
        assert_eq!(recon.added, NOTE_COUNT);

        let throughput = (NOTE_COUNT as f64) / scan_time.as_secs_f64();
        println!("Indexing Throughput: {:.2} notes/second", throughput);
        assert!(throughput > 100.0, "Throughput was below 100 notes/sec");

        // Measure cold-cache query latency
        let start_cold = Instant::now();
        let res_cold = service
            .search(&SearchQuery {
                query: "alpha".to_string(),
                vault: None,
                limit: Some(20),
                offset: None,
            })
            .unwrap();
        let cold_duration = start_cold.elapsed();
        println!(
            "Cold search latency: {:?} (found {} matches)",
            cold_duration, res_cold.total
        );
        assert_eq!(res_cold.total, 100);

        // Measure warm-cache p50 and p95 latency over 50 iterations
        let mut latencies: Vec<f64> = Vec::new();
        for _ in 0..50 {
            let start = Instant::now();
            let _ = service
                .search(&SearchQuery {
                    query: "target".to_string(),
                    vault: None,
                    limit: Some(20),
                    offset: None,
                })
                .unwrap();
            latencies.push(start.elapsed().as_secs_f64() * 1000.0);
        }
        latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let p50 = latencies[latencies.len() / 2];
        let p95 = latencies[(latencies.len() as f64 * 0.95) as usize];
        println!(
            "Warm query latencies over 50 runs on {} notes: p50 = {:.3}ms, p95 = {:.3}ms",
            NOTE_COUNT, p50, p95
        );
        assert!(p50 < 10.0, "p50 latency exceeded 10ms");

        let _ = fs::remove_dir_all(base_dir);
    }
}

