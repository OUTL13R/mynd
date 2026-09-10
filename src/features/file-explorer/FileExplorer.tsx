import React, { useState, useRef, useEffect } from 'react';
import { Note } from '../../types';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './FileExplorer.module.css';

interface FileExplorerProps {
  notes: Note[];
  folders: string[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: (title?: string, folder?: string) => void;
  onDeleteNote: (id: string) => void;
  onCreateFolder: (folderName: string) => void;
  onDeleteFolder: (folderName: string) => void;
  width: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  notes,
  folders,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onCreateFolder,
  onDeleteFolder,
  width
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState<{ type: 'note' | 'folder'; folder?: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  const toggleFolder = (folder: string) => {
    setExpanded(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const collapseAllFolders = () => {
    const next: Record<string, boolean> = {};
    folders.forEach(f => { next[f] = false; });
    setExpanded(next);
  };

  const startCreateNote = (folder?: string) => {
    const targetFolder = folder || folders[0] || 'Brainstorming';
    setExpanded(prev => ({ ...prev, [targetFolder]: true }));
    setCreating({ type: 'note', folder: targetFolder });
    setInputValue('');
  };

  const startCreateFolder = () => {
    setCreating({ type: 'folder' });
    setInputValue('');
  };

  const cancelCreate = () => {
    setCreating(null);
    setInputValue('');
  };

  const commitCreate = () => {
    const name = inputValue.trim();
    if (!name) {
      cancelCreate();
      return;
    }

    if (creating?.type === 'note') {
      onCreateNote(name, creating.folder);
    } else if (creating?.type === 'folder') {
      onCreateFolder(name);
      setExpanded(prev => ({ ...prev, [name]: true }));
    }
    cancelCreate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCreate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCreate();
    }
  };

  const allFolders = Array.from(new Set([...folders, ...notes.map(n => n.folder)])).filter(Boolean);

  return (
    <div className={styles.explorer} style={{ width }}>
      {/* Sleek single action bar - No word "Explorer", no clutter */}
      <div className={styles.topBar}>
        <IconButton
          icon={<Icons.NewFile />}
          title="New Note"
          size="sm"
          onClick={() => startCreateNote()}
        />
        <IconButton
          icon={<Icons.FolderPlus />}
          title="New Folder"
          size="sm"
          onClick={startCreateFolder}
        />
        <IconButton
          icon={<Icons.CollapseAll />}
          title="Collapse All"
          size="sm"
          onClick={collapseAllFolders}
        />
      </div>

      {/* Inline Folder Creation */}
      {creating?.type === 'folder' && (
        <div className={styles.inlineRow}>
          <Icons.Folder />
          <input
            ref={inputRef}
            className={styles.inlineInput}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitCreate}
            placeholder="Folder name..."
          />
        </div>
      )}

      {/* Clean Tree */}
      <div className={styles.tree}>
        {allFolders.map(folder => {
          const folderNotes = notes.filter(n => n.folder === folder);
          const isExpanded = expanded[folder] !== false;
          const isCreatingInThisFolder = creating?.type === 'note' && creating?.folder === folder;

          return (
            <div key={folder} className={styles.folderGroup}>
              {/* Folder Row */}
              <div
                className={styles.folder}
                onClick={() => toggleFolder(folder)}
              >
                <div className={styles.folderChevron}>
                  {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                </div>
                <span className={styles.folderLabel}>{folder}</span>
                <span className={styles.folderCount}>{folderNotes.length}</span>

                {/* Hover Actions */}
                <div className={styles.folderActions} onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    icon={<Icons.Plus />}
                    title="New note in folder"
                    size="sm"
                    onClick={() => startCreateNote(folder)}
                  />
                  <IconButton
                    icon={<Icons.Trash />}
                    title="Delete folder"
                    size="sm"
                    onClick={() => onDeleteFolder(folder)}
                  />
                </div>
              </div>

              {/* Folder Children */}
              {isExpanded && (
                <div className={styles.notesList}>
                  {/* Inline Note Creation */}
                  {isCreatingInThisFolder && (
                    <div className={styles.inlineRow}>
                      <Icons.FileText />
                      <input
                        ref={inputRef}
                        className={styles.inlineInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={commitCreate}
                        placeholder="Note name..."
                      />
                    </div>
                  )}

                  {folderNotes.map(note => {
                    const isActive = activeNoteId === note.id;
                    return (
                      <div
                        key={note.id}
                        className={`${styles.noteItem} ${isActive ? styles.noteItemActive : ''}`}
                        onClick={() => onSelectNote(note.id)}
                      >
                        <div className={styles.noteIcon}>
                          <Icons.FileText />
                        </div>
                        <span className={styles.noteLabel}>{note.title}</span>

                        <div className={styles.noteActions} onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            icon={<Icons.Trash />}
                            title="Delete note"
                            size="sm"
                            onClick={() => onDeleteNote(note.id)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {folderNotes.length === 0 && !isCreatingInThisFolder && (
                    <div className={styles.emptyFolder}>Empty</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
