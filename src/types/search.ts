export interface SearchHighlight {
  start: number;
  end: number;
}

export interface SearchSnippet {
  prefix: string;
  matched: string;
  suffix: string;
}

export interface SearchResult {
  id: string;
  title: string;
  folder: string;
  vault: string;
  path: string;
  updatedAt: string;
  score: number;
  titleMatches: SearchHighlight[];
  snippets: SearchSnippet[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  tookMs: number;
}

export interface IndexStats {
  totalNotes: number;
  totalVaults: number;
  dbSizeBytes: number;
  lastSyncTime: string | null;
  status: string;
}

export interface RebuildSummary {
  totalIndexed: number;
  tookMs: number;
}
