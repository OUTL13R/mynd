import React, { useState } from 'react';
import { Note } from '../../types';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './FileExplorer.module.css';

interface FileExplorerProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  width: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  width
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleFolder = (folder: string) => {
    setExpanded(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const folders = Array.from(new Set(notes.map(n => n.folder)));

  return (
    <div className={styles.explorer} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Explorer</span>
        <IconButton icon={<Icons.Plus />} title="New Note" onClick={onCreateNote} size="sm" />
      </div>
      <div className={styles.tree}>
        {folders.map(folder => {
          const folderNotes = notes.filter(n => n.folder === folder);
          const isExpanded = expanded[folder] !== false;

          return (
            <div key={folder}>
              <div className={styles.folder} onClick={() => toggleFolder(folder)}>
                <div className={styles.folderIcon}>
                  {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                </div>
                <span>{folder || 'Root'}</span>
              </div>
              {isExpanded && (
                <div className={styles.notesList}>
                  {folderNotes.map(note => (
                    <div
                      key={note.id}
                      className={`${styles.noteItem} ${activeNoteId === note.id ? styles.noteItemActive : ''}`}
                      onClick={() => onSelectNote(note.id)}
                    >
                      <div className={`${styles.noteIcon} ${activeNoteId === note.id ? styles.noteIconActive : ''}`}>
                        <Icons.FileText />
                      </div>
                      <span className={styles.noteLabel}>{note.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
