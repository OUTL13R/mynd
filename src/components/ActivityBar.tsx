import React from 'react';
import { Icons, Theme } from './types';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleRightPanel: () => void;
  isRightPanelOpen: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  currentTheme,
  setTheme,
  toggleRightPanel,
  isRightPanelOpen
}) => {
  const themes: { id: Theme; name: string }[] = [
    { id: 'antigravity-dark', name: 'Antigravity Dark' },
    { id: 'obsidian-dark', name: 'Obsidian Dark' },
    { id: 'vscode-dark', name: 'VS Code Dark' },
    { id: 'minimal-light', name: 'Minimal Light' }
  ];

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].id);
  };

  return (
    <div style={{
      width: '48px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      justifyContent: 'space-between',
      zIndex: 10
    }}>
      {/* Top Main Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        {/* Brand Logo */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--accent), #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          marginBottom: '8px'
        }} title="Mynd - AI Second Brain">
          M
        </div>

        <button
          onClick={() => setActiveTab('files')}
          title="File Explorer"
          style={{
            background: activeTab === 'files' ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'files' ? 'var(--accent)' : 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <Icons.Folder />
        </button>

        <button
          onClick={() => setActiveTab('search')}
          title="Search Vault"
          style={{
            background: activeTab === 'search' ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'search' ? 'var(--accent)' : 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <Icons.Search />
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          title="Knowledge Graph View"
          style={{
            background: activeTab === 'graph' ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            color: activeTab === 'graph' ? 'var(--accent)' : 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <Icons.Network />
        </button>
      </div>

      {/* Bottom Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={toggleRightPanel}
          title={isRightPanelOpen ? "Close AI Assistant" : "Open AI Assistant"}
          style={{
            background: isRightPanelOpen ? 'var(--accent-subtle)' : 'transparent',
            border: 'none',
            color: isRightPanelOpen ? 'var(--accent)' : 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icons.Bot />
        </button>

        <button
          onClick={cycleTheme}
          title={`Theme: ${themes.find(t => t.id === currentTheme)?.name} (Click to switch)`}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icons.Palette />
        </button>

        <button
          title="Settings"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icons.Settings />
        </button>
      </div>
    </div>
  );
};
