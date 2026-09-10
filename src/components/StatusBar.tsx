import React from 'react';
import { Theme } from './types';

interface StatusBarProps {
  currentTheme: Theme;
  activeNoteTitle?: string;
  wordCount: number;
  agentStatus: 'idle' | 'thinking' | 'active';
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentTheme,
  activeNoteTitle,
  wordCount,
  agentStatus
}) => {
  return (
    <div style={{
      height: '24px',
      backgroundColor: 'var(--status-bar-bg)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      userSelect: 'none',
      zIndex: 20
    }}>
      {/* Left items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: agentStatus === 'thinking' ? '#f59e0b' : '#10b981'
          }} />
          Agent: {agentStatus === 'thinking' ? 'Thinking...' : 'Idle'}
        </span>

        {activeNoteTitle && (
          <span>File: <strong>{activeNoteTitle}</strong></span>
        )}
      </div>

      {/* Right items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span>{wordCount} words</span>
        <span>UTF-8</span>
        <span style={{ textTransform: 'capitalize' }}>Theme: {currentTheme.replace('-', ' ')}</span>
      </div>
    </div>
  );
};
