import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { notesService } from '../../services/notesService';
import { SearchResult, SearchHighlight, SearchSnippet, IndexStats } from '../../types';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './SearchPanel.module.css';

interface SearchPanelProps {
  width: number;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ width }) => {
  const { vaults, selectNote, activeNoteId } = useNotes();
  const [query, setQuery] = useState('');
  const [vaultFilter, setVaultFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'searching' | 'ready' | 'empty' | 'error'>('idle');
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  // Auto-focus search input when panel is mounted
  useEffect(() => {
    inputRef.current?.focus();
    // Load index statistics
    notesService.getIndexStats().then(setIndexStats).catch(() => {});
  }, []);

  // Debounced search effect
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setTookMs(0);
      setStatus('idle');
      return;
    }

    const currentSeq = ++searchSeq.current;
    setStatus('searching');
    setErrorMessage(null);

    const timer = setTimeout(async () => {
      try {
        const response = await notesService.searchNotes(trimmed, vaultFilter || undefined, 40, 0);

        // Discard stale out-of-order responses
        if (currentSeq !== searchSeq.current) return;

        setResults(response.results);
        setTotal(response.total);
        setTookMs(response.tookMs);
        setSelectedIndex(0);
        setStatus(response.results.length > 0 ? 'ready' : 'empty');
      } catch (err) {
        if (currentSeq !== searchSeq.current) return;
        const msg = err instanceof Error ? err.message : 'Search failed';
        setErrorMessage(msg);
        setStatus('error');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, vaultFilter]);

  // Handle note selection
  const handleSelect = useCallback((noteId: string) => {
    selectNote(noteId);
  }, [selectNote]);

  // Keyboard navigation across search results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.focus();
    }
  };

  // Trigger full index rebuild
  const handleRebuildIndex = async () => {
    try {
      setIsRebuilding(true);
      await notesService.reindexNotes();
      const stats = await notesService.getIndexStats();
      setIndexStats(stats);
      // Re-trigger current search if any
      if (query.trim()) {
        const res = await notesService.searchNotes(query.trim(), vaultFilter || undefined, 40, 0);
        setResults(res.results);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Failed to rebuild index:', err);
    } finally {
      setIsRebuilding(false);
    }
  };

  // Safe structured title rendering (Zero dangerouslySetInnerHTML)
  const renderSafeTitle = (title: string, matches: SearchHighlight[]) => {
    if (!matches || matches.length === 0) {
      return <span>{title}</span>;
    }

    const segments: React.ReactNode[] = [];
    let lastIdx = 0;

    matches.forEach((m, i) => {
      if (m.start > lastIdx) {
        segments.push(<span key={`pre-${i}`}>{title.slice(lastIdx, m.start)}</span>);
      }
      segments.push(
        <mark key={`m-${i}`} className={styles.highlight}>
          {title.slice(m.start, m.end)}
        </mark>
      );
      lastIdx = m.end;
    });

    if (lastIdx < title.length) {
      segments.push(<span key="post">{title.slice(lastIdx)}</span>);
    }

    return <>{segments}</>;
  };

  // Safe structured snippet rendering
  const renderSafeSnippet = (snippet: SearchSnippet, index: number) => {
    return (
      <div key={index} className={styles.snippetLine}>
        <span className={styles.context}>{snippet.prefix}</span>
        <mark className={styles.highlight}>{snippet.matched}</mark>
        <span className={styles.context}>{snippet.suffix}</span>
      </div>
    );
  };

  return (
    <aside
      className={styles.container}
      style={{ width }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Notes Search Panel"
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Search</span>
        <div className={styles.headerActions}>
          <IconButton
            icon={
              <span className={isRebuilding ? styles.loadingSpinner : undefined}>
                <Icons.RefreshCw />
              </span>
            }
            title={isRebuilding ? 'Rebuilding Index...' : 'Rebuild Search Index'}
            size="sm"
            onClick={handleRebuildIndex}
            disabled={isRebuilding}
          />
        </div>
      </div>

      {/* Search Input Box */}
      <div className={styles.searchBox}>
        <div className={styles.inputWrapper}>
          <span className={styles.searchIcon}>
            {status === 'searching' ? (
              <span className={styles.loadingSpinner}>
                <Icons.Loader />
              </span>
            ) : (
              <Icons.Search />
            )}
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search notes, titles, or content..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
          />
          {query && (
            <button
              className={styles.clearButton}
              title="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <Icons.X />
            </button>
          )}
        </div>

        {/* Filter Row: Vault selection & Stats */}
        <div className={styles.filterRow}>
          <select
            className={styles.vaultSelect}
            value={vaultFilter}
            onChange={e => setVaultFilter(e.target.value)}
            title="Filter by vault"
          >
            <option value="">All Vaults</option>
            {vaults.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <span className={styles.statsText}>
            {status === 'ready' && `${total} match${total === 1 ? '' : 'es'} (${tookMs.toFixed(1)}ms)`}
            {status === 'idle' && indexStats && `${indexStats.totalNotes} notes indexed`}
          </span>
        </div>
      </div>

      {/* Rebuilding banner feedback */}
      {isRebuilding && (
        <div className={styles.rebuildBanner}>
          <span>Scanning disk and rebuilding index...</span>
          <span className={styles.loadingSpinner}><Icons.Loader /></span>
        </div>
      )}

      {/* Main Results / State Content */}
      <div className={styles.content}>
        {status === 'idle' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Fast Markdown Full-Text Search</div>
            <div className={styles.emptyDescription}>
              Type keywords or partial note titles. SQLite FTS5 instant indexing will query across all notes.
            </div>
          </div>
        )}

        {status === 'empty' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No matching notes</div>
            <div className={styles.emptyDescription}>
              No notes found for "{query}". Try checking for spelling errors or choosing "All Vaults".
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Search Error</div>
            <div className={styles.emptyDescription}>{errorMessage}</div>
            <button
              className={styles.actionButton}
              onClick={() => handleRebuildIndex()}
            >
              Rebuild Index
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'searching') && results.length > 0 && (
          <div className={styles.resultsList}>
            {results.map((result, idx) => {
              const isSelected = idx === selectedIndex || result.id === activeNoteId;
              return (
                <div
                  key={result.id}
                  className={`${styles.resultItem} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleSelect(result.id)}
                  title={`Open ${result.title} in ${result.vault}`}
                >
                  <div className={styles.itemHeader}>
                    <div className={styles.itemTitle}>
                      {renderSafeTitle(result.title, result.titleMatches)}
                    </div>
                    <span className={styles.vaultBadge}>{result.vault}</span>
                  </div>

                  {result.snippets.length > 0 && (
                    <div className={styles.snippetList}>
                      {result.snippets.map((snip, sIdx) => renderSafeSnippet(snip, sIdx))}
                    </div>
                  )}

                  <div className={styles.metaRow}>
                    <span className={styles.metaText}>{result.folder}</span>
                    {result.updatedAt && (
                      <span className={styles.metaText}>
                        • {new Date(result.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
