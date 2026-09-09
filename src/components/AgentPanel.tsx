import React, { useState } from 'react';
import { AgentMessage, Icons } from './types';

interface AgentPanelProps {
  messages: AgentMessage[];
  onSendMessage: (msg: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  messages,
  onSendMessage,
  isOpen,
  onClose
}) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div style={{
      width: '320px',
      backgroundColor: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      zIndex: 5
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
          <Icons.Bot />
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
            Antigravity Agent
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px'
          }}
        >
          <Icons.X />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              backgroundColor: msg.sender === 'user' ? 'var(--accent)' : 'var(--agent-bubble-bg)',
              color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              border: msg.sender === 'agent' ? '1px solid var(--border-color)' : 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {msg.sender === 'agent' && (
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                AI SECOND BRAIN
              </div>
            )}
            <div>{msg.content}</div>

            {msg.status === 'thinking' && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                Thinking & searching vault...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-tertiary)'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '4px 8px'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask agent or prompt /ai..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              padding: '6px'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icons.Send />
          </button>
        </div>
      </form>
    </div>
  );
};
