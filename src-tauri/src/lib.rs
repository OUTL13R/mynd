use std::sync::Arc;
use tauri::Manager;

pub mod commands;
pub mod models;
pub mod services;

use services::{FileIndex, IndexService, StorageService, WatcherService};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 1. Resolve notes directory
            let notes_root = StorageService::get_notes_dir(app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;

            // 2. Resolve database path in app_data_dir/mynd_index.db
            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| notes_root.join(".mynd"));
            let db_path = app_dir.join("mynd_index.db");

            log::info!("Initializing SQLite index database at: {:?}", db_path);
            let index_service = Arc::new(
                IndexService::new(db_path, notes_root.clone())
                    .map_err(|e| Box::<dyn std::error::Error>::from(e))?,
            );

            // 3. START WATCHER BEFORE SCAN to avoid missing file events
            log::info!("Starting filesystem watcher on notes root: {:?}", notes_root);
            let watcher_service = WatcherService::start(
                notes_root.clone(),
                index_service.clone(),
                Some(app.handle().clone()),
            )
            .map_err(|e| Box::<dyn std::error::Error>::from(e))?;

            // 4. Check if existing index exists or run initial disk scan in background
            let index_for_scan = index_service.clone();
            let notes_root_for_scan = notes_root.clone();
            std::thread::Builder::new()
                .name("mynd-startup-indexer".to_string())
                .spawn(move || {
                    if index_for_scan.has_existing_index() {
                        log::info!("Existing index found. Running fast startup reconciliation...");
                    } else {
                        log::info!("No existing index found. Starting initial disk scan...");
                    }
                    if let Err(e) = index_for_scan.reconcile(&notes_root_for_scan) {
                        log::error!("Startup index reconciliation failed: {}", e);
                    }
                })
                .ok();

            // 5. Register managed services
            app.manage(index_service);
            app.manage(Arc::new(watcher_service));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::notes::get_notes,
            commands::notes::get_vaults,
            commands::notes::create_vault,
            commands::notes::rename_vault,
            commands::notes::delete_vault,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::save_note,
            commands::notes::delete_note,
            commands::notes::get_notes_dir,
            commands::notes::open_notes_dir,
            // SQLite search commands
            commands::search::search_notes,
            commands::search::reindex_notes,
            commands::search::get_index_stats,
            commands::search::checkpoint_index,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
