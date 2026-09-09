import { useState, useEffect } from 'react';
import './theme.css';
import { ActivityBar } from './components/ActivityBar';
import { FileExplorer } from './components/FileExplorer';
import { EditorWorkspace } from './components/EditorWorkspace';
import { AgentPanel } from './components/AgentPanel';
import { StatusBar } from './components/StatusBar';
import { AgentMessage, Note, Theme } from './components/types';

const INITIAL_NOTES: Note[] = [
  {
    id: 'note-1',
    title: 'Welcome to Mynd',
    folder: 'Brainstorming',
    content: `# Welcome to Mynd 🚀\n\nMynd is your **AI-first Second Brain** combining the sleek minimalist feel of Obsidian, Antigravity, and VS Code.\n\n### Features\n- 🎯 **Minimalist & Fast**: Pure layout with customizable themes.\n- 🤖 **Embedded AI Agent**: Chat with your local knowledge vault.\n- ⚡ **Theme Engine**: Switch between Antigravity, Obsidian, and VS Code styles instantly.\n\nTry asking the AI Assistant on the right to summarize this note or suggest graph connections!`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note-2',
    title: 'AI Agent Architecture',
    folder: 'Projects',
    content: `# AI Agent Architecture\n\n- Multi-modal local LLM pipeline\n- Vector search for Obsidian markdown files\n- Autonomous goal-seeking workflows`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note-3',
    title: 'Daily Log - 2026-09-09',
    folder: 'Daily Notes',
    content: `# Daily Log\n\n- [x] Initialized Mynd Tauri + React setup\n- [x] Implemented core UI layout with themes (Antigravity Dark, Obsidian Dark, VS Code Dark, Minimal Light)\n- [ ] Connect Tauri IPC for filesystem operations`,
    updatedAt: new Date().toISOString()
  }
];

function App() {
  const [theme, setTheme] = useState<Theme>('antigravity-dark');
  const [activeTab, setActiveTab] = useState('files');
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [activeNoteId, setActiveNoteId] = useState<string | null>('note-1');
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(['note-1', 'note-2']);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      content: 'Hello! I am your AI Second Brain assistant. How can I help you analyze or build your notes today?',
      timestamp: '14:25'
    }
  ]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'active'>('idle');

  // Update root element attribute for active theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

    // Simulate Agent response
    setTimeout(() => {
      const activeNote = notes.find(n => n.id === activeNoteId);
      let reply = `I evaluated your request regarding "${content}".`;
      if (activeNote) {
        reply += ` Referencing active note "${activeNote.title}". I've indexed your vault structure.`;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Activity Bar */}
        <ActivityBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentTheme={theme}
          setTheme={setTheme}
          toggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
          isRightPanelOpen={isRightPanelOpen}
        />

        {/* File Explorer Sidebar */}
        {activeTab === 'files' && (
          <FileExplorer
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
          />
        )}

        {/* Center Editor Workspace */}
        <EditorWorkspace
          notes={notes}
          activeNoteId={activeNoteId}
          openNoteIds={openNoteIds}
          currentTheme={theme}
          onSelectNote={handleSelectNote}
          onCloseNoteTab={handleCloseNoteTab}
          onUpdateNoteContent={handleUpdateNoteContent}
          onAskAgent={handleSendMessageToAgent}
        />

        {/* Right AI Agent Workspace Panel */}
        <AgentPanel
          messages={agentMessages}
          onSendMessage={handleSendMessageToAgent}
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        currentTheme={theme}
        activeNoteTitle={activeNote?.title}
        wordCount={wordCount}
        agentStatus={agentStatus}
      />
    </div>
  );
}

export default App;
