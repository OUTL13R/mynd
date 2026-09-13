use serde::{Deserialize, Serialize};

/// Represents a character range highlight within a string (e.g. within a note title).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHighlight {
    /// 0-based start character index
    pub start: usize,
    /// 0-based end character index (exclusive)
    pub end: usize,
}

/// A structured, safe excerpt snippet from note content.
/// Avoids raw unsanitized HTML so the frontend can safely render React elements.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSnippet {
    /// Surrounding context before the matched token
    pub prefix: String,
    /// The actual matched keyword / token text
    pub matched: String,
    /// Surrounding context after the matched token
    pub suffix: String,
}

/// A single matched note returned by the search engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// Unique stable note identifier (e.g., "note-1715000000")
    pub id: String,
    /// Note title
    pub title: String,
    /// Folder relative to vault root
    pub folder: String,
    /// Vault name
    pub vault: String,
    /// Vault-relative display path
    pub path: String,
    /// Last updated ISO timestamp
    pub updated_at: String,
    /// Multi-factor calculated relevance score (higher is more relevant)
    pub score: f64,
    /// Highlight ranges in the note title
    pub title_matches: Vec<SearchHighlight>,
    /// Highlighted excerpts extracted from the note content
    pub snippets: Vec<SearchSnippet>,
}

/// Search query parameters passed from frontend or API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    /// Search terms entered by the user
    pub query: String,
    /// Optional filter to constrain search to a specific vault
    pub vault: Option<String>,
    /// Maximum number of search results to return (default: 20)
    pub limit: Option<usize>,
    /// Offset for pagination (default: 0)
    pub offset: Option<usize>,
}

/// Response payload containing matched notes and query metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    /// Matched notes sorted by descending relevance score
    pub results: Vec<SearchResult>,
    /// Total number of matching candidates found
    pub total: usize,
    /// Time taken to execute the search in milliseconds
    pub took_ms: f64,
}

/// Statistical information about the SQLite index.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    /// Total number of indexed notes
    pub total_notes: usize,
    /// Total number of distinct vaults indexed
    pub total_vaults: usize,
    /// SQLite database file size in bytes
    pub db_size_bytes: u64,
    /// ISO 8601 timestamp of last successful index synchronization
    pub last_sync_time: Option<String>,
    /// Current status of the indexer ("idle", "scanning", "ready", "error")
    pub status: String,
}

/// Summary of a disk reconciliation run.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationSummary {
    pub added: usize,
    pub updated: usize,
    pub removed: usize,
    pub unchanged: usize,
    pub took_ms: u64,
}

/// Summary of a full index rebuild operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildSummary {
    pub total_indexed: usize,
    pub took_ms: u64,
}

/// Internal representation of a note stored in the SQLite `notes` table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoteRecord {
    pub id: String,
    pub path: String,
    pub title: String,
    pub folder: String,
    pub vault: String,
    pub content: String,
    pub file_modified_ms: i64,
    pub file_size: i64,
    pub updated_at: String,
    pub created_at: Option<String>,
}
