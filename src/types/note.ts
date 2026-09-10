export interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  updatedAt: string;
  createdAt?: string;
}

export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

export type ViewMode = 'edit' | 'preview' | 'split';
