export interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  status?: 'thinking' | 'done' | 'error';
}

export type ActiveView = 'editor' | 'ai';
