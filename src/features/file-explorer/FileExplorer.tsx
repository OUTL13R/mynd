import React, { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { ConfirmModal } from '../../components/Modal/ConfirmModal';
import styles from './FileExplorer.module.css';

interface FileExplorerProps {
  width: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ width }) => {
  const {
    notes,
    activeNoteId,
    selectNote,
    createNote,
    deleteNote,
    openNotesDirectory
  } = useNotes();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  const toggleFolder = (folder: string) => {
    setExpanded(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const folders = Array.from(new Set(notes.map(n => n.folder || 'General')));

  const handleCreateInFolder = (e: React.MouseEvent, folder: string) => {
    e.stopPropagation();
    createNote(folder);
    setExpanded(prev => ({ ...prev, [folder]: true }));
  };

  const handleDeleteClick = (e: React.MouseEvent, note: { id: string; title: string }) => {
    e.stopPropagation();
    setNoteToDelete(note);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await deleteNote(noteToDelete.id);
      setNoteToDelete(null);
    }
  };

  return (
    <div className={styles.explorer} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Explorer</span>
        <div className={styles.headerActions}>
          <IconButton
            icon={<Icons.FolderSymlink />}
            title="Open Notes Folder on Disk"
            onClick={openNotesDirectory}
            size="sm"
          />
          <IconButton
            icon={<Icons.Plus />}
            title="New Note"
            onClick={() => createNote()}
            size="sm"
          />
        </div>
      </div>

      <div className={styles.tree}>
        {notes.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No notes found on disk</span>
            <button
              type="button"
              className={styles.deleteButton}
              style={{ color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              onClick={() => createNote()}
            >
              + Create your first note
            </button>
          </div>
        ) : (
          folders.map(folder => {
            const folderNotes = notes.filter(n => (n.folder || 'General') === folder);
            const isExpanded = expanded[folder] !== false;

            return (
              <div key={folder}>
                <div className={styles.folder} onClick={() => toggleFolder(folder)}>
                  <div className={styles.folderLeft}>
                    <div className={styles.folderIcon}>
                      {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                    </div>
                    <span>{folder}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={styles.folderBadge}>{folderNotes.length}</span>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      title={`New note in ${folder}`}
                      onClick={(e) => handleCreateInFolder(e, folder)}
                    >
                      <Icons.Plus />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.notesList}>
                    {folderNotes.map(note => (
                      <div
                        key={note.id}
                        className={`${styles.noteItem} ${
                          activeNoteId === note.id ? styles.noteItemActive : ''
                        }`}
                        onClick={() => selectNote(note.id)}
                      >
                        <div className={styles.noteContent}>
                          <div
                            className={`${styles.noteIcon} ${
                              activeNoteId === note.id ? styles.noteIconActive : ''
                            }`}
                          >
                            <Icons.FileText />
                          </div>
                          <span className={styles.noteLabel}>{note.title}</span>
                        </div>

                        <div className={styles.noteActions}>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            title="Delete note from disk"
                            onClick={(e) => handleDeleteClick(e, note)}
                          >
                            <Icons.Trash2 />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={noteToDelete !== null}
        title="Delete Note"
        message={`Are you sure you want to delete "${noteToDelete?.title}"? This will permanently delete the Markdown file from your system disk.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
