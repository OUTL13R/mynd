import React, { useState } from 'react';
import { AgentMessage } from '../../types';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { TextInput } from '../../components/TextInput/TextInput';
import styles from './AIView.module.css';

interface AIViewProps {
  messages: AgentMessage[];
  onSendMessage: (msg: string) => void;
}

export const AIView: React.FC<AIViewProps> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className={styles.aiView}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Icons.Bot />
        </div>
        <span className={styles.headerTitle}>AI</span>
      </div>

      <div className={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${
              msg.sender === 'user' ? styles.messageUser : styles.messageAgent
            }`}
          >
            {msg.content}
            {msg.status === 'thinking' && (
              <div className={styles.thinking}>Thinking...</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputContainer}>
          <TextInput
            value={input}
            onChange={setInput}
            placeholder="Message AI..."
            onSubmit={handleSubmit}
            rightElement={
              <IconButton
                icon={<Icons.Send />}
                title="Send"
                onClick={handleSubmit}
                size="sm"
              />
            }
          />
        </div>
      </div>
    </div>
  );
};
