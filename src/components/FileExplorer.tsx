import React, { useState } from 'react';
import { Icons, Note } from './types';

interface FileExplorerProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'Brainstorming': true,
    'Projects': true,
    'Daily Notes': true
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  // Group notes by folder
  const folders = notes.reduce((acc, note) => {
    const f = note.folder || 'Vault Root';
    if (!acc[f]) acc[f] = [];
    acc[f].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  return (
    <div style={{
      width: '240px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', tracking: '0.05em', color: 'var(--text-muted)' }}>
          Vault Explorer
        </span>
        <button
          onClick={onCreateNote}
          title="New Note"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Icons.Plus />
        </button>
      </div>

      {/* Tree View */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.entries(folders).map(([folderName, folderNotes]) => {
          const isExpanded = expandedFolders[folderName] ?? true;
          return (
            <div key={folderName} style={{ marginBottom: '4px' }}>
              {/* Folder Header */}
              <div
                onClick={() => toggleFolder(folderName)}
                style={{
                  padding: '4px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)' }}>
                  {isExpanded ? <Icons.FolderOpen /> : <Icons.Folder />}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {folderName}
                </span>
              </div>

              {/* Folder Content Notes */}
              {isExpanded && (
                <div style={{ paddingLeft: '20px' }}>
                  {folderNotes.map(note => {
                    const isActive = note.id === activeNoteId;
                    return (
                      <div
                        key={note.id}
                        onClick={() => onSelectNote(note.id)}
                        style={{
                          padding: '5px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          margin: '1px 8px 1px 0',
                          backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: '12.5px',
                          transition: 'background-color 0.1s ease'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.7 }}>
                          <Icons.FileText />
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
