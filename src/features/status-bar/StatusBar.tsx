import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  activeNoteTitle?: string;
  wordCount: number;
  agentStatus: 'idle' | 'thinking' | 'active';
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeNoteTitle,
  wordCount,
  agentStatus
}) => {
  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <span>Agent: {agentStatus === 'thinking' ? 'Thinking...' : agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}</span>
        {activeNoteTitle && <span className={styles.noteTitle}>{activeNoteTitle}</span>}
      </div>
      <div className={styles.right}>
        <span>{wordCount} words</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};
