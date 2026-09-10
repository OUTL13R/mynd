use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::models::Note;

pub struct StorageService;

impl StorageService {
    /// Resolves the dedicated notes directory on the user's system disk.
    /// Prefers ~/Documents/Mynd/notes, falls back to app_data_dir/notes.
    pub fn get_notes_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let dir = if let Ok(doc_dir) = app.path().document_dir() {
            doc_dir.join("Mynd").join("notes")
        } else if let Ok(app_dir) = app.path().app_data_dir() {
            app_dir.join("notes")
        } else {
            return Err("Failed to resolve documents or app data directory".to_string());
        };

        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
        }

        // Seed initial notes if directory is freshly created or empty
        Self::seed_initial_notes_if_empty(&dir)?;

        Ok(dir)
    }

    /// Seeds default starter notes if no markdown files exist yet in the notes directory.
    fn seed_initial_notes_if_empty(notes_dir: &Path) -> Result<(), String> {
        let has_files = Self::has_any_markdown_files(notes_dir);
        if has_files {
            return Ok(());
        }

        let default_notes = vec![
            Note {
                id: "note-1".to_string(),
                title: "Welcome to Mynd".to_string(),
                folder: "Brainstorming".to_string(),
                content: "# Welcome to Mynd\n\nMynd is your **AI-first Second Brain** — a minimalist note-taking app with an embedded AI assistant.\n\n### Features\n- Minimalist & fast\n- Embedded AI assistant\n- Markdown editing with live preview\n- Auto-saved directly to your system disk as standard Markdown!\n\nSwitch to the AI tab to start a conversation or create a new note in the Explorer.".to_string(),
                updated_at: "2026-09-09T10:00:00.000Z".to_string(),
                created_at: Some("2026-09-09T10:00:00.000Z".to_string()),
            },
            Note {
                id: "note-2".to_string(),
                title: "AI Agent Architecture".to_string(),
                folder: "Projects".to_string(),
                content: "# AI Agent Architecture\n\n- Multi-modal local LLM pipeline\n- Vector search for markdown files\n- Autonomous goal-seeking workflows\n- Direct disk synchronization with Tauri 2 IPC".to_string(),
                updated_at: "2026-09-09T11:00:00.000Z".to_string(),
                created_at: Some("2026-09-09T11:00:00.000Z".to_string()),
            },
            Note {
                id: "note-3".to_string(),
                title: "Daily Log - 2026-09-09".to_string(),
                folder: "Daily Notes".to_string(),
                content: "# Daily Log\n\n- [x] Initialized Mynd Tauri + React setup\n- [x] Implemented core UI layout\n- [x] Structured production-grade Rust backend\n- [x] Implemented disk-persisted CRUD operations".to_string(),
                updated_at: "2026-09-09T12:00:00.000Z".to_string(),
                created_at: Some("2026-09-09T12:00:00.000Z".to_string()),
            },
        ];

        for note in default_notes {
            Self::write_note_to_disk(notes_dir, &note)?;
        }

        Ok(())
    }

    /// Checks if any .md file exists anywhere in the directory hierarchy
    fn has_any_markdown_files(dir: &Path) -> bool {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if Self::has_any_markdown_files(&path) {
                        return true;
                    }
                } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                    return true;
                }
            }
        }
        false
    }

    /// Recursively scans notes_dir and loads all .md notes
    pub fn list_notes(app: &tauri::AppHandle) -> Result<Vec<Note>, String> {
        let notes_dir = Self::get_notes_dir(app)?;
        let mut notes = Vec::new();
        Self::scan_directory_for_notes(&notes_dir, &notes_dir, &mut notes)?;

        // Sort notes by updated_at descending
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(notes)
    }

    /// Scans a directory recursively to read markdown files into Note objects
    fn scan_directory_for_notes(
        root_dir: &Path,
        current_dir: &Path,
        notes: &mut Vec<Note>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(current_dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", current_dir, e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                Self::scan_directory_for_notes(root_dir, &path, notes)?;
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let fallback_title = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Untitled")
                        .to_string();

                    // Derive folder name from relative path or parent folder
                    let fallback_folder = if let Ok(rel) = path.strip_prefix(root_dir) {
                        if let Some(parent) = rel.parent() {
                            let parent_str = parent.to_string_lossy().to_string();
                            if parent_str.is_empty() {
                                "General".to_string()
                            } else {
                                parent_str.replace('\\', "/")
                            }
                        } else {
                            "General".to_string()
                        }
                    } else {
                        "General".to_string()
                    };

                    let fallback_id = format!("note-{}", fallback_title.replace(' ', "-").to_lowercase());
                    let fallback_time = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .map(|t| {
                            let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                            format!("{}", dur.as_millis())
                        })
                        .unwrap_or_else(|| "0".to_string());

                    let note = Note::from_markdown(
                        &content,
                        &fallback_id,
                        &fallback_title,
                        &fallback_folder,
                        &fallback_time,
                    );
                    notes.push(note);
                }
            }
        }

        Ok(())
    }

    /// Sanitizes string for safe filename or directory segment
    pub fn sanitize_filename(name: &str) -> String {
        let invalid = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
        let mut clean = name
            .chars()
            .map(|c| if invalid.contains(&c) { '-' } else { c })
            .collect::<String>()
            .trim()
            .to_string();

        if clean.is_empty() {
            clean = "Untitled".to_string();
        }
        clean
    }

    /// Resolves target file path for a note given its folder and title
    fn get_target_file_path(notes_dir: &Path, note: &Note) -> PathBuf {
        let folder_part = if note.folder.trim().is_empty() {
            "General"
        } else {
            note.folder.trim()
        };

        let safe_folder = Self::sanitize_filename(folder_part);
        let safe_title = Self::sanitize_filename(&note.title);

        notes_dir.join(safe_folder).join(format!("{}.md", safe_title))
    }

    /// Finds any existing disk file containing the specified note ID
    fn find_existing_file_by_id(root_dir: &Path, current_dir: &Path, note_id: &str) -> Option<PathBuf> {
        let entries = fs::read_dir(current_dir).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = Self::find_existing_file_by_id(root_dir, &path, note_id) {
                    return Some(found);
                }
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if content.starts_with("---\n") {
                        if let Some(closing) = content[4..].find("\n---\n") {
                            let fm = &content[4..4 + closing];
                            for line in fm.lines() {
                                if let Some((k, v)) = line.split_once(':') {
                                    if k.trim() == "id" && v.trim().trim_matches('"').trim_matches('\'') == note_id {
                                        return Some(path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    /// Saves or creates a note on the system disk
    pub fn save_note(app: &tauri::AppHandle, note: Note) -> Result<Note, String> {
        let notes_dir = Self::get_notes_dir(app)?;

        // Find if an existing file for this ID exists (may have an old title or folder)
        let old_file = Self::find_existing_file_by_id(&notes_dir, &notes_dir, &note.id);
        let target_file = Self::get_target_file_path(&notes_dir, &note);

        if let Some(old_path) = old_file {
            if old_path != target_file && old_path.exists() {
                let _ = fs::remove_file(&old_path);
                // Clean up old parent folder if empty
                if let Some(parent) = old_path.parent() {
                    if parent != notes_dir {
                        let _ = fs::remove_dir(parent);
                    }
                }
            }
        }

        Self::write_note_to_path(&target_file, &note)?;

        Ok(note)
    }

    /// Writes a note to disk at the standard location
    fn write_note_to_disk(notes_dir: &Path, note: &Note) -> Result<PathBuf, String> {
        let target_file = Self::get_target_file_path(notes_dir, note);
        Self::write_note_to_path(&target_file, note)?;
        Ok(target_file)
    }

    /// Writes markdown content to a specific path, creating parent directories if needed
    fn write_note_to_path(target_path: &Path, note: &Note) -> Result<(), String> {
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create folder {:?}: {}", parent, e))?;
        }

        let markdown = note.to_markdown();
        fs::write(target_path, markdown)
            .map_err(|e| format!("Failed to write note to {:?}: {}", target_path, e))?;

        Ok(())
    }

    /// Deletes a note file from system disk by note ID
    pub fn delete_note(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
        let notes_dir = Self::get_notes_dir(app)?;

        if let Some(file_path) = Self::find_existing_file_by_id(&notes_dir, &notes_dir, id) {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete note file {:?}: {}", file_path, e))?;

            // Remove parent folder if now empty and not the root notes_dir
            if let Some(parent) = file_path.parent() {
                if parent != notes_dir {
                    let _ = fs::remove_dir(parent);
                }
            }
            Ok(())
        } else {
            Err(format!("Note with id '{}' was not found on disk", id))
        }
    }

    /// Opens the notes folder in the native file explorer
    pub fn open_notes_dir(app: &tauri::AppHandle) -> Result<(), String> {
        let dir = Self::get_notes_dir(app)?;

        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&dir)
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {}", e))?;
            return Ok(());
        }

        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&dir)
                .spawn()
                .map_err(|e| format!("Failed to open directory: {}", e))?;
            return Ok(());
        }

        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&dir)
                .spawn()
                .map_err(|e| format!("Failed to open directory: {}", e))?;
            return Ok(());
        }

        #[allow(unreachable_code)]
        Ok(())
    }
}
