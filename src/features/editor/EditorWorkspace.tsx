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

  return (
    <div className={styles.workspace}>
      <TabBar
        tabs={tabs}
        activeId={activeNoteId || ''}
        onSelect={onSelectNote}
        onClose={onCloseNoteTab}
      >
        <div className={styles.viewToggle}>
          <IconButton
            icon={<Icons.Edit3 />}
            title="Edit"
            size="sm"
            isActive={viewMode === 'edit'}
            onClick={() => setViewMode('edit')}
          />
          <IconButton
            icon={<Icons.Columns />}
            title="Split"
            size="sm"
            isActive={viewMode === 'split'}
            onClick={() => setViewMode('split')}
          />
          <IconButton
            icon={<Icons.Eye />}
            title="Preview"
            size="sm"
            isActive={viewMode === 'preview'}
            onClick={() => setViewMode('preview')}
          />
        </div>
      </TabBar>

      {activeNote ? (
        <div className={styles.content}>
          <input
            className={styles.noteTitle}
            value={activeNote.title}
            readOnly
          />
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
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Icons.FileText />
          <div className={styles.emptyText}>Select or create a note</div>
        </div>
      )}
    </div>
  );
};
