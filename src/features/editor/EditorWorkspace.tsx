import React, { useState, useEffect } from 'react';
import { TabBar } from '../../components/TabBar/TabBar';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownPreview } from './MarkdownPreview';
import { useNotes } from '../../hooks/useNotes';
import { ViewMode } from '../../types';
import styles from './EditorWorkspace.module.css';

interface EditorWorkspaceProps {
  isDark?: boolean;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ isDark = true }) => {
  const {
    notes,
    activeNoteId,
    activeNote,
    openNoteIds,
    selectNote,
    closeNoteTab,
    updateNoteContent,
    updateNoteTitle,
    createNote
  } = useNotes();

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [titleInput, setTitleInput] = useState('');

  // Sync title input when active note changes
  useEffect(() => {
    if (activeNote) {
      setTitleInput(activeNote.title);
    } else {
      setTitleInput('');
    }
  }, [activeNote?.id, activeNote?.title]);

  const handleTitleBlur = () => {
    if (activeNote && titleInput.trim() && titleInput !== activeNote.title) {
      updateNoteTitle(activeNote.id, titleInput.trim());
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const tabs = openNoteIds
    .map(id => {
      const note = notes.find(n => n.id === id);
      return note ? { id: note.id, label: note.title } : null;
    })
    .filter((tab): tab is { id: string; label: string } => tab !== null);

  return (
    <div className={styles.workspace}>
      <TabBar
        tabs={tabs}
        activeId={activeNoteId || ''}
        onSelect={selectNote}
        onClose={closeNoteTab}
      >
        <div className={styles.tabActions}>
          <div className={styles.viewToggle}>
            <IconButton
              icon={<Icons.Edit3 />}
              title="Edit Mode"
              size="sm"
              isActive={viewMode === 'edit'}
              onClick={() => setViewMode('edit')}
            />
            <IconButton
              icon={<Icons.Columns />}
              title="Split Mode"
              size="sm"
              isActive={viewMode === 'split'}
              onClick={() => setViewMode('split')}
            />
            <IconButton
              icon={<Icons.Eye />}
              title="Preview Mode"
              size="sm"
              isActive={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
            />
          </div>
        </div>
      </TabBar>

      {activeNote ? (
        <div className={styles.content}>
          <div className={styles.titleRow}>
            <div className={styles.titleContainer}>
              <span className={styles.folderTag}>{activeNote.folder || 'General'}</span>
              <input
                className={styles.noteTitle}
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="Note title..."
                title="Click to edit title"
              />
            </div>
          </div>

          <div className={styles.panes}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className={`${styles.pane} ${viewMode === 'split' ? styles.paneDivider : ''}`}>
                <CodeMirrorEditor
                  value={activeNote.content}
                  onChange={(val) => updateNoteContent(activeNote.id, val)}
                  isDark={isDark}
                />
              </div>
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={styles.pane}>
                <MarkdownPreview content={activeNote.content} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Icons.FileText />
          <div className={styles.emptyText}>No note selected</div>
          <button
            type="button"
            className={styles.noteTitle}
            style={{
              fontSize: '12px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '4px',
              width: 'auto'
            }}
            onClick={() => createNote()}
          >
            + Create a note
          </button>
        </div>
      )}
    </div>
  );
};
