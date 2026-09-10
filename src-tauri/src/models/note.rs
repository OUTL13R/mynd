use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub folder: String,
    pub content: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
}

impl Note {
    /// Serializes Note into Markdown with YAML frontmatter
    pub fn to_markdown(&self) -> String {
        let created = self.created_at.as_deref().unwrap_or(&self.updated_at);
        let safe_title = self.title.replace('"', "\\\"");
        let safe_folder = self.folder.replace('"', "\\\"");

        format!(
            "---\nid: {}\ntitle: \"{}\"\nfolder: \"{}\"\ncreatedAt: {}\nupdatedAt: {}\n---\n{}",
            self.id, safe_title, safe_folder, created, self.updated_at, self.content
        )
    }

    /// Parses Markdown content with optional YAML frontmatter into a Note
    pub fn from_markdown(
        raw_text: &str,
        fallback_id: &str,
        fallback_title: &str,
        fallback_folder: &str,
        fallback_time: &str,
    ) -> Self {
        let normalized = raw_text.replace("\r\n", "\n");

        if normalized.starts_with("---\n") {
            if let Some(closing_idx) = normalized[4..].find("\n---\n") {
                let frontmatter = &normalized[4..4 + closing_idx];
                let body = &normalized[4 + closing_idx + 5..];

                let mut id = fallback_id.to_string();
                let mut title = fallback_title.to_string();
                let mut folder = fallback_folder.to_string();
                let mut created_at: Option<String> = None;
                let mut updated_at = fallback_time.to_string();

                for line in frontmatter.lines() {
                    let line = line.trim();
                    if let Some((key, val)) = line.split_once(':') {
                        let key = key.trim();
                        let val = val.trim().trim_matches('"').trim_matches('\'').trim();

                        match key {
                            "id" => {
                                if !val.is_empty() {
                                    id = val.to_string();
                                }
                            }
                            "title" => {
                                if !val.is_empty() {
                                    title = val.to_string();
                                }
                            }
                            "folder" => {
                                folder = val.to_string();
                            }
                            "createdAt" => {
                                if !val.is_empty() {
                                    created_at = Some(val.to_string());
                                }
                            }
                            "updatedAt" => {
                                if !val.is_empty() {
                                    updated_at = val.to_string();
                                }
                            }
                            _ => {}
                        }
                    }
                }

                return Note {
                    id,
                    title,
                    folder,
                    content: body.to_string(),
                    updated_at,
                    created_at,
                };
            }
        }

        // No frontmatter found, parse entire document as content
        Note {
            id: fallback_id.to_string(),
            title: fallback_title.to_string(),
            folder: fallback_folder.to_string(),
            content: raw_text.to_string(),
            updated_at: fallback_time.to_string(),
            created_at: Some(fallback_time.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roundtrip_markdown_frontmatter() {
        let original = Note {
            id: "test-note-123".to_string(),
            title: "Project Architecture & Design".to_string(),
            folder: "Engineering".to_string(),
            content: "# Heading\n\nThis is a test note body with markdown content.".to_string(),
            updated_at: "2026-09-10T12:00:00.000Z".to_string(),
            created_at: Some("2026-09-09T10:00:00.000Z".to_string()),
        };

        let md = original.to_markdown();
        let parsed = Note::from_markdown(&md, "fb-id", "fb-title", "fb-folder", "fb-time");

        assert_eq!(parsed.id, original.id);
        assert_eq!(parsed.title, original.title);
        assert_eq!(parsed.folder, original.folder);
        assert_eq!(parsed.content, original.content);
        assert_eq!(parsed.updated_at, original.updated_at);
        assert_eq!(parsed.created_at, original.created_at);
    }

    #[test]
    fn test_parse_plain_markdown_without_frontmatter() {
        let raw = "# Just Plain Markdown\n\nNo frontmatter delimiters here.";
        let parsed = Note::from_markdown(raw, "note-fallback", "Fallback Title", "Notes", "12345");

        assert_eq!(parsed.id, "note-fallback");
        assert_eq!(parsed.title, "Fallback Title");
        assert_eq!(parsed.folder, "Notes");
        assert_eq!(parsed.content, raw);
        assert_eq!(parsed.updated_at, "12345");
    }
}
