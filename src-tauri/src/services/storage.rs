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
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create notes directory: {}", e))?;
        }

        Ok(dir)
    }

    /// Resolves the directory for a specific vault.
    pub fn get_vault_dir(app: &tauri::AppHandle, vault_name: &str) -> Result<PathBuf, String> {
        let root = Self::get_notes_dir(app)?;
        let safe_vault = Self::sanitize_filename(vault_name.trim());
        let vault_dir = root.join(safe_vault);
        if !vault_dir.exists() {
            fs::create_dir_all(&vault_dir)
                .map_err(|e| format!("Failed to create vault directory {:?}: {}", vault_dir, e))?;
        }
        Ok(vault_dir)
    }

    /// Creates a vault directory if it does not yet exist.
    pub fn create_vault(app: &tauri::AppHandle, vault_name: &str) -> Result<String, String> {
        let normalized = vault_name.trim();
        if normalized.is_empty() {
            return Err("Vault name cannot be empty".to_string());
        }

        let vault_path = Self::get_vault_dir(app, normalized)?;
        Ok(vault_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(normalized)
            .to_string())
    }

    /// Renames an existing vault directory and updates notes frontmatter inside it.
    pub fn rename_vault(
        app: &tauri::AppHandle,
        old_name: &str,
        new_name: &str,
    ) -> Result<String, String> {
        let old_trimmed = old_name.trim();
        let new_trimmed = new_name.trim();

        if new_trimmed.is_empty() {
            return Err("Vault name cannot be empty".to_string());
        }

        let old_clean = Self::sanitize_filename(old_trimmed);
        let new_clean = Self::sanitize_filename(new_trimmed);

        let notes_dir = Self::get_notes_dir(app)?;
        let old_dir = notes_dir.join(&old_clean);
        let new_dir = notes_dir.join(&new_clean);

        if old_clean == new_clean {
            if !new_dir.exists() {
                fs::create_dir_all(&new_dir)
                    .map_err(|e| format!("Failed to create vault directory: {}", e))?;
            }
            return Ok(new_clean);
        }

        if new_dir.exists() && !old_clean.eq_ignore_ascii_case(&new_clean) {
            return Err(format!("A vault named '{}' already exists", new_clean));
        }

        if old_dir.exists() {
            fs::rename(&old_dir, &new_dir)
                .map_err(|e| format!("Failed to rename vault directory from '{}' to '{}': {}", old_clean, new_clean, e))?;
        } else {
            fs::create_dir_all(&new_dir)
                .map_err(|e| format!("Failed to create vault directory: {}", e))?;
        }

        // Update frontmatter in all notes inside the renamed vault directory
        Self::update_vault_frontmatter_in_dir(&new_dir, &new_clean)?;

        Ok(new_clean)
    }

    /// Deletes a vault directory and all notes inside it from disk.
    pub fn delete_vault(app: &tauri::AppHandle, vault_name: &str) -> Result<(), String> {
        let trimmed = vault_name.trim();
        if trimmed.is_empty() {
            return Err("Vault name cannot be empty".to_string());
        }

        let clean = Self::sanitize_filename(trimmed);
        let notes_dir = Self::get_notes_dir(app)?;
        let vault_dir = notes_dir.join(&clean);

        if vault_dir.exists() {
            fs::remove_dir_all(&vault_dir)
                .map_err(|e| format!("Failed to delete vault directory '{}': {}", clean, e))?;
        }

        // Also check if any notes with vault == vault_name exist directly in notes_dir
        if let Ok(entries) = fs::read_dir(&notes_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        let parsed = Note::from_markdown(&content, "id", "title", "General", "Main Vault", "0");
                        if parsed.vault.trim().eq_ignore_ascii_case(trimmed) {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Recursively updates the frontmatter of notes in a directory to the new vault name
    fn update_vault_frontmatter_in_dir(dir: &Path, new_vault_name: &str) -> Result<(), String> {
        if !dir.exists() {
            return Ok(());
        }

        let entries = fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory {:?}: {}", dir, e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                Self::update_vault_frontmatter_in_dir(&path, new_vault_name)?;
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let fallback_title = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Untitled")
                        .to_string();
                    let fallback_id =
                        format!("note-{}", fallback_title.replace(' ', "-").to_lowercase());
                    let mut note = Note::from_markdown(
                        &content,
                        &fallback_id,
                        &fallback_title,
                        "General",
                        new_vault_name,
                        "0",
                    );
                    note.vault = new_vault_name.to_string();
                    let updated_md = note.to_markdown();
                    let _ = fs::write(&path, updated_md);
                }
            }
        }

        Ok(())
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

    /// Lists the available vaults under the notes root.
    pub fn list_vaults(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
        let notes_dir = Self::get_notes_dir(app)?;
        let mut vaults = Vec::new();

        if !notes_dir.exists() {
            return Ok(vaults);
        }

        for entry in fs::read_dir(&notes_dir)
            .map_err(|e| format!("Failed to read vault directory {:?}: {}", notes_dir, e))?
        {
            let entry = entry.map_err(|e| format!("Failed to read vault entry: {}", e))?;
            let path = entry.path();
            if path.is_dir() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled")
                    .to_string();
                if !name.is_empty() && !vaults.contains(&name) {
                    vaults.push(name);
                }
            }
        }

        vaults.sort();
        Ok(vaults)
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

                    // Derive vault and folder name from relative path components
                    let (fallback_vault, fallback_folder) = if let Ok(rel) = path.strip_prefix(root_dir) {
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
                    };

                    let fallback_id =
                        format!("note-{}", fallback_title.replace(' ', "-").to_lowercase());
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
                        &fallback_vault,
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
        let vault_dir = Self::get_vault_dir_for_note(notes_dir, &note.vault);
        let folder_part = note.folder.trim();
        let safe_title = Self::sanitize_filename(&note.title);

        if folder_part.is_empty()
            || folder_part.eq_ignore_ascii_case(note.vault.trim())
            || folder_part.eq_ignore_ascii_case("Brainstorming")
            || folder_part.eq_ignore_ascii_case("General")
        {
            vault_dir.join(format!("{}.md", safe_title))
        } else {
            let safe_folder = Self::sanitize_filename(folder_part);
            vault_dir.join(safe_folder).join(format!("{}.md", safe_title))
        }
    }

    fn get_vault_dir_for_note(root_dir: &Path, vault_name: &str) -> PathBuf {
        let trimmed = vault_name.trim();
        if trimmed.is_empty() {
            root_dir.to_path_buf()
        } else {
            let safe_vault = Self::sanitize_filename(trimmed);
            root_dir.join(&safe_vault)
        }
    }

    /// Finds any existing disk file containing the specified note ID
    fn find_existing_file_by_id(
        root_dir: &Path,
        current_dir: &Path,
        note_id: &str,
    ) -> Option<PathBuf> {
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
                                    if k.trim() == "id"
                                        && v.trim().trim_matches('"').trim_matches('\'') == note_id
                                    {
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

        let normalized_note = Note {
            vault: if note.vault.trim().is_empty() {
                "Main Vault".to_string()
            } else {
                note.vault.trim().to_string()
            },
            ..note
        };

        // Find if an existing file for this ID exists (may have an old title or folder)
        let old_file = Self::find_existing_file_by_id(&notes_dir, &notes_dir, &normalized_note.id);
        let target_file = Self::get_target_file_path(&notes_dir, &normalized_note);

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

        Self::write_note_to_path(&target_file, &normalized_note)?;

        Ok(normalized_note)
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
            // Note already does not exist on disk, treat as success (idempotent)
            Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(
            StorageService::sanitize_filename("  My Vault / Notes?  "),
            "My Vault - Notes-"
        );
        assert_eq!(StorageService::sanitize_filename(""), "Untitled");
        assert_eq!(StorageService::sanitize_filename("   "), "Untitled");
        assert_eq!(
            StorageService::sanitize_filename("Vault: 2026*"),
            "Vault- 2026-"
        );
    }

    #[test]
    fn test_update_vault_frontmatter_in_dir() {
        let temp_dir = std::env::temp_dir().join(format!(
            "mynd_test_vault_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        ));
        fs::create_dir_all(&temp_dir).unwrap();

        let note = Note {
            id: "test-v-1".to_string(),
            title: "Testing Vault".to_string(),
            folder: "General".to_string(),
            vault: "Old Vault".to_string(),
            content: "Some content".to_string(),
            updated_at: "2026-09-11T12:00:00Z".to_string(),
            created_at: Some("2026-09-11T12:00:00Z".to_string()),
        };

        let note_path = temp_dir.join("test.md");
        fs::write(&note_path, note.to_markdown()).unwrap();

        StorageService::update_vault_frontmatter_in_dir(&temp_dir, "New Vault Name").unwrap();

        let updated_content = fs::read_to_string(&note_path).unwrap();
        let parsed = Note::from_markdown(&updated_content, "id", "title", "folder", "default", "0");
        assert_eq!(parsed.vault, "New Vault Name");
        assert_eq!(parsed.title, "Testing Vault");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

