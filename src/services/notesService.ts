import { invoke } from '@tauri-apps/api/core';
import { Note } from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Fallback in-memory / localStorage storage for browser preview mode
const LOCAL_STORAGE_KEY = 'mynd_notes_fallback';

const getBrowserFallbackNotes = (): Note[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read notes from localStorage fallback', e);
  }
  return [
    {
      id: 'note-1',
      title: 'Welcome to Mynd',
      folder: 'Brainstorming',
      content: `# Welcome to Mynd\n\nMynd is your **AI-first Second Brain** — a minimalist note-taking app with an embedded AI assistant.\n\n### Features\n- Minimalist & fast\n- Embedded AI assistant\n- Markdown editing with live preview\n- Notes auto-saved to system disk\n\nSwitch to the AI tab to start a conversation.`,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ];
};

const saveBrowserFallbackNotes = (notes: Note[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to write notes to localStorage fallback', e);
  }
};

export const notesService = {
  /**
   * Fetches all notes from system disk (or localStorage fallback if running in browser).
   */
  async getNotes(): Promise<Note[]> {
    if (isTauri()) {
      try {
        return await invoke<Note[]>('get_notes');
      } catch (err) {
        console.error('Failed to load notes from Tauri system disk:', err);
        throw new Error(typeof err === 'string' ? err : 'Failed to read notes from disk', { cause: err });
      }
    }
    return getBrowserFallbackNotes();
  },

  /**
   * Fetches a specific note by ID.
   */
  async getNote(id: string): Promise<Note> {
    if (isTauri()) {
      try {
        return await invoke<Note>('get_note', { id });
      } catch (err) {
        console.error(`Failed to get note ${id}:`, err);
        throw new Error(typeof err === 'string' ? err : 'Note not found', { cause: err });
      }
    }
    const notes = getBrowserFallbackNotes();
    const found = notes.find(n => n.id === id);
    if (!found) throw new Error(`Note with id ${id} not found`);
    return found;
  },

  /**
   * Creates a new note on the system disk.
   */
  async createNote(note: Note): Promise<Note> {
    if (isTauri()) {
      try {
        return await invoke<Note>('create_note', { note });
      } catch (err) {
        console.error('Failed to create note on system disk:', err);
        throw new Error(typeof err === 'string' ? err : 'Failed to create note on disk', { cause: err });
      }
    }
    const notes = getBrowserFallbackNotes();
    const updated = [note, ...notes];
    saveBrowserFallbackNotes(updated);
    return note;
  },

  /**
   * Updates an existing note on the system disk.
   */
  async saveNote(note: Note): Promise<Note> {
    if (isTauri()) {
      try {
        return await invoke<Note>('save_note', { note });
      } catch (err) {
        console.error('Failed to save note to system disk:', err);
        throw new Error(typeof err === 'string' ? err : 'Failed to save note to disk', { cause: err });
      }
    }
    const notes = getBrowserFallbackNotes();
    const index = notes.findIndex(n => n.id === note.id);
    if (index !== -1) {
      notes[index] = note;
    } else {
      notes.unshift(note);
    }
    saveBrowserFallbackNotes(notes);
    return note;
  },

  /**
   * Deletes a note from system disk.
   */
  async deleteNote(id: string): Promise<void> {
    if (isTauri()) {
      try {
        await invoke('delete_note', { id });
        return;
      } catch (err) {
        console.error('Failed to delete note from system disk:', err);
        throw new Error(typeof err === 'string' ? err : 'Failed to delete note', { cause: err });
      }
    }
    const notes = getBrowserFallbackNotes().filter(n => n.id !== id);
    saveBrowserFallbackNotes(notes);
  },

  /**
   * Gets the path to the system disk folder where notes are stored.
   */
  async getNotesDirectory(): Promise<string> {
    if (isTauri()) {
      try {
        return await invoke<string>('get_notes_dir');
      } catch (err) {
        console.error('Failed to get notes directory path:', err);
        return 'Documents/Mynd/notes';
      }
    }
    return 'Browser Storage (Local)';
  },

  /**
   * Opens the notes folder in the native file explorer.
   */
  async openNotesDirectory(): Promise<void> {
    if (isTauri()) {
      try {
        await invoke('open_notes_dir');
      } catch (err) {
        console.error('Failed to open notes directory in file explorer:', err);
      }
    }
  }
};
