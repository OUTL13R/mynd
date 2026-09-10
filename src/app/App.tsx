import { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/global.css';
import { ActivityBar } from '../features/activity-bar/ActivityBar';
import { FileExplorer } from '../features/file-explorer/FileExplorer';
import { EditorWorkspace } from '../features/editor/EditorWorkspace';
import { AIView } from '../features/ai/AIView';
import { StatusBar } from '../features/status-bar/StatusBar';
import { AgentMessage, Note, ActiveView } from '../types';
import styles from './App.module.css';

const INITIAL_NOTES: Note[] = [
  {
    id: 'note-1',
    title: 'Welcome to Mynd',
    folder: 'Brainstorming',
    content: `# Welcome to Mynd\n\nMynd is your **AI-first Second Brain** — a minimalist note-taking app with an embedded AI assistant.\n\n### Features\n- Minimalist & fast\n- Embedded AI assistant\n- Markdown editing with live preview\n\nSwitch to the AI tab to start a conversation.`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note-2',
    title: 'AI Agent Architecture',
    folder: 'Projects',
    content: `# AI Agent Architecture\n\n- Multi-modal local LLM pipeline\n- Vector search for markdown files\n- Autonomous goal-seeking workflows`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note-3',
    title: 'Daily Log - 2026-09-09',
    folder: 'Daily Notes',
    content: `# Daily Log\n\n- [x] Initialized Mynd Tauri + React setup\n- [x] Implemented core UI layout\n- [ ] Connect Tauri IPC for filesystem operations`,
    updatedAt: new Date().toISOString()
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('files');
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [activeNoteId, setActiveNoteId] = useState<string | null>('note-1');
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(['note-1', 'note-2']);
  const isResizing = useRef(false);

  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      content: 'Hello. How can I help you with your notes today?',
      timestamp: '14:25'
    }
  ]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'active'>('idle');

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Resize handler
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX;
      const newWidth = Math.min(400, Math.max(140, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    if (!openNoteIds.includes(id)) {
      setOpenNoteIds(prev => [...prev, id]);
    }
  };

  const handleCloseNoteTab = (id: string) => {
    const nextTabs = openNoteIds.filter(t => t !== id);
    setOpenNoteIds(nextTabs);
    if (activeNoteId === id) {
      setActiveNoteId(nextTabs[nextTabs.length - 1] || null);
    }
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      folder: 'Brainstorming',
      content: '# New Note\n\nStart typing...',
      updatedAt: new Date().toISOString()
    };
    setNotes(prev => [newNote, ...prev]);
    setOpenNoteIds(prev => [...prev, newNote.id]);
    setActiveNoteId(newNote.id);
  };

  const handleUpdateNoteContent = (id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  };

  const handleSendMessageToAgent = (content: string) => {
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setAgentMessages(prev => [...prev, userMsg]);
    setAgentStatus('thinking');

    setTimeout(() => {
      const activeNote = notes.find(n => n.id === activeNoteId);
      let reply = `I evaluated your request regarding "${content}".`;
      if (activeNote) {
        reply += ` Referencing active note "${activeNote.title}".`;
      }

      setAgentMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: 'agent',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'done'
        }
      ]);
      setAgentStatus('idle');
    }, 1000);
  };

  const activeNote = notes.find(n => n.id === activeNoteId);
  const wordCount = activeNote ? activeNote.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const showSidebar = activeView === 'editor' && isSidebarOpen && activeTab === 'files';

  return (
    <div className={styles.shell}>
      <div className={styles.body}>
        <ActivityBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeView={activeView}
          setActiveView={setActiveView}
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isDark={isDark}
          toggleTheme={toggleTheme}
        />

        {activeView === 'editor' && (
          <>
            {showSidebar && (
              <>
                <FileExplorer
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onSelectNote={handleSelectNote}
                  onCreateNote={handleCreateNote}
                  width={sidebarWidth}
                />
                <div
                  className={styles.resizeHandle}
                  onMouseDown={startResize}
                />
              </>
            )}

            <EditorWorkspace
              notes={notes}
              activeNoteId={activeNoteId}
              openNoteIds={openNoteIds}
              onSelectNote={handleSelectNote}
              onCloseNoteTab={handleCloseNoteTab}
              onUpdateNoteContent={handleUpdateNoteContent}
              isDark={isDark}
            />
          </>
        )}

        {activeView === 'ai' && (
          <AIView
            messages={agentMessages}
            onSendMessage={handleSendMessageToAgent}
          />
        )}
      </div>

      <StatusBar
        activeNoteTitle={activeNote?.title}
        wordCount={wordCount}
        agentStatus={agentStatus}
      />
    </div>
  );
}

export default App;
