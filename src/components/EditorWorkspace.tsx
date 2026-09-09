import React from 'react';
import { Icons, Note } from './types';

interface EditorWorkspaceProps {
  notes: Note[];
  activeNoteId: string | null;
  openNoteIds: string[];
  onSelectNote: (id: string) => void;
  onCloseNoteTab: (id: string) => void;
  onUpdateNoteContent: (id: string, content: string) => void;
  onAskAgent: (prompt: string) => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  notes,
  activeNoteId,
  openNoteIds,
  onSelectNote,
  onCloseNoteTab,
  onUpdateNoteContent,
  onAskAgent
}) => {
  const activeNote = notes.find(n => n.id === activeNoteId);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        overflowX: 'auto',
        minHeight: '36px'
      }}>
        {openNoteIds.map(id => {
          const note = notes.find(n => n.id === id);
          if (!note) return null;
          const isActive = id === activeNoteId;

          return (
            <div
              key={id}
              onClick={() => onSelectNote(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '36px',
                backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                borderRight: '1px solid var(--border-subtle)',
                borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                minWidth: '120px',
                maxWidth: '200px'
              }}
            >
              <Icons.FileText />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseNoteTab(id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
              >
                <Icons.X />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor Content Area */}
      {activeNote ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 40px', overflowY: 'auto' }}>
          {/* Note Title */}
          <input
            type="text"
            value={activeNote.title}
            onChange={(e) => {
              // Future: title update logic
            }}
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              marginBottom: '16px',
              fontFamily: 'inherit'
            }}
          />

          {/* Quick AI Action Toolbar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => onAskAgent(`Summarize note "${activeNote.title}"`)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Icons.Sparkles /> Summarize with AI
            </button>

            <button
              onClick={() => onAskAgent(`Find connected notes & concepts for "${activeNote.title}"`)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Icons.Network /> Find Graph Connections
            </button>
          </div>

          {/* Markdown Content Area */}
          <textarea
            value={activeNote.content}
            onChange={(e) => onUpdateNoteContent(activeNote.id, e.target.value)}
            placeholder="Start typing your note (Markdown supported)..."
            style={{
              flex: 1,
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: '1.7',
              resize: 'none',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)'
        }}>
          <Icons.FileText />
          <p style={{ marginTop: '12px', fontSize: '13px' }}>Select or create a note to start editing</p>
        </div>
      )}
    </div>
  );
};
