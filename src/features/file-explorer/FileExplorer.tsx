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
  const [filterText, setFilterText] = useState('');
  const [creating, setCreating] = useState<{ type: 'note' | 'folder'; folder?: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating starts
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
    const targetFolder = folder || folders[0] || 'Notes';
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

  // Combine unique folders from prop and note folders
  const allFolders = Array.from(new Set([...folders, ...notes.map(n => n.folder)])).filter(Boolean);

  // Filter notes
  const filteredNotes = filterText.trim()
    ? notes.filter(n => n.title.toLowerCase().includes(filterText.toLowerCase().trim()))
    : notes;

  return (
    <div className={styles.explorer} style={{ width }}>
      {/* Top Explorer Title + VS Code Actions */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Explorer</span>
        <div className={styles.headerActions}>
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
            title="Collapse All Folders"
            size="sm"
            onClick={collapseAllFolders}
          />
          <IconButton
            icon={<Icons.Refresh />}
            title="Refresh"
            size="sm"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Vault Subheader with Total Note Count */}
      <div className={styles.vaultBar}>
        <div className={styles.vaultTitle}>
          <Icons.FolderOpen />
          <span>Mynd Vault</span>
        </div>
        <span className={styles.countBadge}>{notes.length}</span>
      </div>

      {/* Filter / Quick Search Bar */}
      <div className={styles.filterContainer}>
        <div className={styles.filterInputWrapper}>
          <div className={styles.filterIcon}>
            <Icons.Search />
          </div>
          <input
            className={styles.filterInput}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter files..."
          />
          {filterText && (
            <button className={styles.clearFilter} onClick={() => setFilterText('')} title="Clear filter">
              <Icons.X />
            </button>
          )}
        </div>
      </div>

      {/* Inline Folder Creation */}
      {creating?.type === 'folder' && (
        <div className={styles.inlineCreateRow}>
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

      {/* Tree Content */}
      <div className={styles.tree}>
        {allFolders.map(folder => {
          const folderNotes = filteredNotes.filter(n => n.folder === folder);
          const isExpanded = expanded[folder] !== false; // default true
          const isCreatingInThisFolder = creating?.type === 'note' && creating?.folder === folder;

          // If filtering and this folder has 0 matching notes, hide it unless creating in it
          if (filterText.trim() && folderNotes.length === 0 && !isCreatingInThisFolder) {
            return null;
          }

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
                <div className={styles.folderIcon}>
                  {isExpanded ? <Icons.FolderOpen /> : <Icons.Folder />}
                </div>
                <span className={styles.folderLabel}>{folder}</span>
                <span className={styles.folderBadge}>{folderNotes.length}</span>

                {/* Folder Hover Actions */}
                <div className={styles.folderActions} onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    icon={<Icons.Plus />}
                    title="New Note in folder"
                    size="sm"
                    onClick={() => startCreateNote(folder)}
                  />
                  <IconButton
                    icon={<Icons.Trash />}
                    title="Delete Folder"
                    size="sm"
                    onClick={() => onDeleteFolder(folder)}
                  />
                </div>
              </div>

              {/* Folder Children / Notes List */}
              {isExpanded && (
                <div className={styles.notesList}>
                  {/* Inline Note Creation */}
                  {isCreatingInThisFolder && (
                    <div className={styles.inlineCreateRow}>
                      <Icons.FileText />
                      <input
                        ref={inputRef}
                        className={styles.inlineInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={commitCreate}
                        placeholder="Note title..."
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

                        {/* Note Hover Actions */}
                        <div className={styles.noteActions} onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            icon={<Icons.Trash />}
                            title="Delete Note"
                            size="sm"
                            onClick={() => onDeleteNote(note.id)}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {folderNotes.length === 0 && !isCreatingInThisFolder && (
                    <div className={styles.emptyFolder}>No notes</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredNotes.length === 0 && filterText.trim() && (
          <div className={styles.emptyState}>No matching notes</div>
        )}
      </div>
    </div>
  );
};
