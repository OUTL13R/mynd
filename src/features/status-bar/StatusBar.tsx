import React from 'react';
import { useNotes } from '../../hooks/useNotes';
import { Icons } from '../../components/Icons';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  agentStatus?: 'idle' | 'thinking' | 'active';
}

export const StatusBar: React.FC<StatusBarProps> = ({ agentStatus = 'idle' }) => {
  const { activeNote, saveStatus, notesDir, openNotesDirectory } = useNotes();

  const content = activeNote?.content || '';
  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <span>
          Agent: {agentStatus === 'thinking' ? 'Thinking...' : agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}
        </span>

        {activeNote && (
          <>
            <div className={styles.divider} />
            <span className={styles.noteTitle}>{activeNote.title}</span>
          </>
        )}

        <div className={styles.divider} />
        <div className={styles.saveIndicator}>
          {saveStatus === 'saving' && (
            <span className={styles.saveSaving}>
              <Icons.Disk /> Saving to disk...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className={styles.saveSaved}>
              <Icons.Check /> Saved to disk
            </span>
          )}
          {saveStatus === 'error' && (
            <span className={styles.saveError}>
              Disk sync error
            </span>
          )}
        </div>
      </div>

      <div className={styles.right}>
        {notesDir && (
          <span
            className={styles.clickablePath}
            onClick={openNotesDirectory}
            title={`Notes location on system disk: ${notesDir}\nClick to open in File Explorer`}
          >
            <Icons.Folder /> {notesDir}
          </span>
        )}

        <div className={styles.divider} />
        <span>{wordCount} words</span>
        <span>{lineCount} lines</span>
        <div className={styles.divider} />
        <span>UTF-8</span>
      </div>
    </div>
  );
};
