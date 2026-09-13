use tauri::AppHandle;

use crate::models::Note;
use crate::services::StorageService;

#[tauri::command]
pub fn get_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    StorageService::list_notes(&app)
}

#[tauri::command]
pub fn get_vaults(app: AppHandle) -> Result<Vec<String>, String> {
    StorageService::list_vaults(&app)
}

#[tauri::command]
pub fn create_vault(app: AppHandle, vault_name: String) -> Result<String, String> {
    StorageService::create_vault(&app, &vault_name)
}

#[tauri::command]
pub fn rename_vault(app: AppHandle, old_name: String, new_name: String) -> Result<String, String> {
    StorageService::rename_vault(&app, &old_name, &new_name)
}

#[tauri::command]
pub fn delete_vault(app: AppHandle, vault_name: String) -> Result<(), String> {
    StorageService::delete_vault(&app, &vault_name)
}

#[tauri::command]
pub fn get_note(app: AppHandle, id: String) -> Result<Note, String> {
    let notes = StorageService::list_notes(&app)?;
    notes
        .into_iter()
        .find(|n| n.id == id)
        .ok_or_else(|| format!("Note with id '{}' not found", id))
}

#[tauri::command]
pub fn create_note(app: AppHandle, note: Note) -> Result<Note, String> {
    StorageService::save_note(&app, note)
}

#[tauri::command]
pub fn save_note(app: AppHandle, note: Note) -> Result<Note, String> {
    StorageService::save_note(&app, note)
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    StorageService::delete_note(&app, &id)
}

#[tauri::command]
pub fn get_notes_dir(app: AppHandle) -> Result<String, String> {
    let path = StorageService::get_notes_dir(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_notes_dir(app: AppHandle) -> Result<(), String> {
    StorageService::open_notes_dir(&app)
}
