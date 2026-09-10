import React, { useState } from 'react';
import { TabBar } from '../../components/TabBar/TabBar';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownPreview } from './MarkdownPreview';
import { Note } from '../../types';
import styles from './EditorWorkspace.module.css';

interface EditorWorkspaceProps {
  notes: Note[];
  activeNoteId: string | null;
  openNoteIds: string[];
  onSelectNote: (id: string) => void;
  onCloseNoteTab: (id: string) => void;
  onUpdateNoteContent: (id: string, content: string) => void;
  isDark?: boolean;
}

type ViewMode = 'edit' | 'preview' | 'split';

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  notes,
  activeNoteId,
  openNoteIds,
  onSelectNote,
  onCloseNoteTab,
  onUpdateNoteContent,
  isDark = true
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const tabs = openNoteIds
    .map(id => {
      const note = notes.find(n => n.id === id);
      return note ? { id: note.id, label: note.title } : null;
    })
    .filter((tab): tab is { id: string; label: string } => tab !== null);

  const activeNote = notes.find(n => n.id === activeNoteId);
  const words = activeNote ? activeNote.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = activeNote ? activeNote.content.length : 0;

  return (
    <div className={styles.workspace}>
      {/* File Tabs with Mode Switcher */}
      <TabBar
        tabs={tabs}
        activeId={activeNoteId || ''}
        onSelect={onSelectNote}
        onClose={onCloseNoteTab}
      >
        {activeNote && (
          <div className={styles.viewToggle}>
            <IconButton
              icon={<Icons.Edit3 />}
              title="Editor only"
              size="sm"
              isActive={viewMode === 'edit'}
              onClick={() => setViewMode('edit')}
            />
            <IconButton
              icon={<Icons.Columns />}
              title="Split view"
              size="sm"
              isActive={viewMode === 'split'}
              onClick={() => setViewMode('split')}
            />
            <IconButton
              icon={<Icons.Eye />}
              title="Preview only"
              size="sm"
              isActive={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
            />
          </div>
        )}
      </TabBar>

      {activeNote ? (
        <>
          {/* Breadcrumb Path & Document Stats */}
          <div className={styles.breadcrumbBar}>
            <div className={styles.breadcrumbPath}>
              <span className={styles.breadcrumbFolder}>{activeNote.folder || 'Vault'}</span>
              <span className={styles.breadcrumbSeparator}>›</span>
              <span className={styles.breadcrumbFile}>{activeNote.title}</span>
            </div>
            <div className={styles.breadcrumbStats}>
              {words} words · {chars} chars
            </div>
          </div>

          {/* Full-bleed Editor Panes */}
          <div className={styles.panes}>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className={`${styles.pane} ${viewMode === 'split' ? styles.paneDivider : ''}`}>
                <CodeMirrorEditor
                  value={activeNote.content}
                  onChange={(val) => onUpdateNoteContent(activeNote.id, val)}
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
        </>
      ) : (
        <div className={styles.emptyState}>
          <Icons.FileText />
          <div className={styles.emptyText}>No note open</div>
          <div className={styles.emptyHint}>Select a note from the sidebar or create a new one</div>
        </div>
      )}
    </div>
  );
};
