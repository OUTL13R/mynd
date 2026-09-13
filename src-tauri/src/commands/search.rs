use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::models::{IndexStats, RebuildSummary, SearchQuery, SearchResponse};
use crate::services::index_service::{FileIndex, IndexService};
use crate::services::StorageService;

/// Tauri command to execute a hybrid full-text and title substring search.
#[tauri::command]
pub async fn search_notes(
    app: AppHandle,
    index_service: State<'_, Arc<IndexService>>,
    query: String,
    vault: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<SearchResponse, String> {
    let search_query = SearchQuery {
        query,
        vault,
        limit,
        offset,
    };

    // Execute search through the decoupled FileIndex trait
    let response = index_service.search(&search_query)?;
    let _ = app; // Keep handle in scope if needed for future events
    Ok(response)
}

/// Tauri command to force a complete re-scan and rebuild of the SQLite and FTS5 search index.
#[tauri::command]
pub async fn reindex_notes(
    app: AppHandle,
    index_service: State<'_, Arc<IndexService>>,
) -> Result<RebuildSummary, String> {
    let notes_root = StorageService::get_notes_dir(&app)?;
    let summary = index_service.rebuild(&notes_root)?;
    Ok(summary)
}

/// Tauri command to fetch statistical and operational metrics of the search index.
#[tauri::command]
pub async fn get_index_stats(
    index_service: State<'_, Arc<IndexService>>,
) -> Result<IndexStats, String> {
    index_service.get_stats()
}

/// Tauri command to flush SQLite write-ahead log (WAL) to the main database file.
#[tauri::command]
pub async fn checkpoint_index(
    index_service: State<'_, Arc<IndexService>>,
) -> Result<(), String> {
    index_service.checkpoint()
}
