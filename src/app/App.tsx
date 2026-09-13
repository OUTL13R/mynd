import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/global.css';
import { NotesProvider } from '../context/NotesContext';
import { useNotes } from '../hooks/useNotes';
import { ActivityBar } from '../features/activity-bar/ActivityBar';
import { FileExplorer } from '../features/file-explorer/FileExplorer';
import { SearchPanel } from '../features/search';
import { EditorWorkspace } from '../features/editor/EditorWorkspace';
import { AIView } from '../features/ai/AIView';
import { StatusBar } from '../features/status-bar/StatusBar';
import { AgentMessage, ActiveView } from '../types';
import styles from './App.module.css';

const AppInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState('files');
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const isResizing = useRef(false);

  const { activeNote } = useNotes();

  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([
    {
      id: 'msg-1',
      sender: 'agent',
      content: 'Hello. I am Mynd AI. I can assist you with your notes saved on disk.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'active'>('idle');

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Resize handler for sidebar
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(420, Math.max(160, startWidth + delta));
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
      let reply = `I received your request: "${content}".`;
      if (activeNote) {
        reply += ` Current note on disk is "${activeNote.title}" in folder "${activeNote.folder}".`;
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
    }, 800);
  };

  // Global keyboard shortcut (Ctrl+Shift+F / Cmd+Shift+F) to open Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveTab('search');
        setActiveView('editor');
        setSidebarOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showFilesSidebar = activeView === 'editor' && isSidebarOpen && activeTab === 'files';
  const showSearchSidebar = activeView === 'editor' && isSidebarOpen && activeTab === 'search';
  const showAnySidebar = showFilesSidebar || showSearchSidebar;

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
            {showAnySidebar && (
              <>
                {showFilesSidebar && <FileExplorer width={sidebarWidth} />}
                {showSearchSidebar && <SearchPanel width={sidebarWidth} />}
                <div
                  className={styles.resizeHandle}
                  onMouseDown={startResize}
                />
              </>
            )}

            <EditorWorkspace isDark={isDark} />
          </>
        )}

        {activeView === 'ai' && (
          <AIView
            messages={agentMessages}
            onSendMessage={handleSendMessageToAgent}
          />
        )}
      </div>

      <StatusBar agentStatus={agentStatus} />
    </div>
  );
};

export function App() {
  return (
    <NotesProvider>
      <AppInner />
    </NotesProvider>
  );
}

export default App;
