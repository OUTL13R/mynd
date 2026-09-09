import React, { useState } from 'react';
import { Icons, Note, Theme } from './types';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownPreview } from './MarkdownPreview';

interface EditorWorkspaceProps {
  notes: Note[];
  activeNoteId: string | null;
  openNoteIds: string[];
  currentTheme: Theme;
  onSelectNote: (id: string) => void;
  onCloseNoteTab: (id: string) => void;
  onUpdateNoteContent: (id: string, content: string) => void;
  onAskAgent: (prompt: string) => void;
}

export type ViewMode = 'edit' | 'preview' | 'split';

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  notes,
  activeNoteId,
  openNoteIds,
  currentTheme,
  onSelectNote,
  onCloseNoteTab,
  onUpdateNoteContent,
  onAskAgent
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
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
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        minHeight: '36px',
        paddingRight: '8px'
      }}>
        {/* Open File Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
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

        {/* View Mode Toggle Controls */}
        {activeNote && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              title="CodeMirror Edit Mode"
              onClick={() => setViewMode('edit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'edit' ? 'var(--bg-active)' : 'transparent',
                color: viewMode === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Icons.Edit3 /> Code
            </button>
            <button
              title="Split View (Edit + Preview)"
              onClick={() => setViewMode('split')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'split' ? 'var(--bg-active)' : 'transparent',
                color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Icons.Columns /> Split
            </button>
            <button
              title="Markdown Reading/Preview Mode"
              onClick={() => setViewMode('preview')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'preview' ? 'var(--bg-active)' : 'transparent',
                color: viewMode === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Icons.Eye /> Preview
            </button>
          </div>
        )}
      </div>

      {/* Editor & Preview Workspace Container */}
      {activeNote ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 24px', overflow: 'hidden' }}>
          {/* Header & AI Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <input
              type="text"
              value={activeNote.title}
              readOnly
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
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
                <Icons.Sparkles /> Summarize AI
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
                <Icons.Network /> Graph Connections
              </button>
            </div>
          </div>

          {/* Main Editing / Preview Content Panes */}
          <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden' }}>
            {/* CodeMirror Editor Pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                borderRight: viewMode === 'split' ? '1px solid var(--border-subtle)' : 'none',
                paddingRight: viewMode === 'split' ? '16px' : '0'
              }}>
                <CodeMirrorEditor
                  value={activeNote.content}
                  onChange={(val) => onUpdateNoteContent(activeNote.id, val)}
                  theme={currentTheme}
                />
              </div>
            )}

            {/* Markdown Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <MarkdownPreview content={activeNote.content} />
              </div>
            )}
          </div>
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
