import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Note, SaveStatus } from '../types';
import { notesService } from '../services/notesService';
import { useDebouncedCallback } from '../hooks/useDebounce';

const LAST_ACTIVE_NOTE_KEY = 'mynd_active_note_id';
const OPEN_NOTE_IDS_KEY = 'mynd_open_note_ids';

export interface NotesContextType {
  notes: Note[];
  activeNoteId: string | null;
  activeNote: Note | null;
  openNoteIds: string[];
  isLoading: boolean;
  saveStatus: SaveStatus;
  notesDir: string;
  error: string | null;
  createNote: (folder?: string) => Promise<Note>;
  updateNoteContent: (id: string, content: string) => void;
  updateNoteTitle: (id: string, title: string) => Promise<void>;
  updateNoteFolder: (id: string, folder: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string) => void;
  closeNoteTab: (id: string) => void;
  openNotesDirectory: () => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    return localStorage.getItem(LAST_ACTIVE_NOTE_KEY) || null;
  });
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(OPEN_NOTE_IDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [notesDir, setNotesDir] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Keep a ref of latest notes to avoid stale closures in debounced saves
  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;

  // Persist tab state to localStorage
  useEffect(() => {
    if (activeNoteId) {
      localStorage.setItem(LAST_ACTIVE_NOTE_KEY, activeNoteId);
    }
  }, [activeNoteId]);

  useEffect(() => {
    localStorage.setItem(OPEN_NOTE_IDS_KEY, JSON.stringify(openNoteIds));
  }, [openNoteIds]);

  // Load notes from disk on startup
  const loadNotesFromDisk = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [loadedNotes, dir] = await Promise.all([
        notesService.getNotes(),
        notesService.getNotesDirectory()
      ]);

      setNotes(loadedNotes);
      setNotesDir(dir);

      if (loadedNotes.length > 0) {
        // Restore active note if it exists in loaded notes, else select the first
        setActiveNoteId(prev => {
          if (prev && loadedNotes.some(n => n.id === prev)) {
            return prev;
          }
          return loadedNotes[0].id;
        });

        // Ensure open tabs are valid
        setOpenNoteIds(prev => {
          const validTabs = prev.filter(id => loadedNotes.some(n => n.id === id));
          if (validTabs.length > 0) return validTabs;
          return [loadedNotes[0].id];
        });
      } else {
        setActiveNoteId(null);
        setOpenNoteIds([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load notes from disk';
      setError(msg);
      console.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotesFromDisk();
  }, [loadNotesFromDisk]);

  // Debounced disk save function
  const [debouncedSaveToDisk] = useDebouncedCallback(
    async (noteToSave: Note) => {
      try {
        setSaveStatus('saving');
        await notesService.saveNote(noteToSave);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to auto-save note to disk:', err);
        setSaveStatus('error');
      }
    },
    450
  );

  const selectNote = useCallback((id: string) => {
    setActiveNoteId(id);
    setOpenNoteIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closeNoteTab = useCallback((id: string) => {
    setOpenNoteIds(prev => {
      const next = prev.filter(tabId => tabId !== id);
      if (activeNoteId === id) {
        const nextActive = next.length > 0 ? next[next.length - 1] : null;
        setActiveNoteId(nextActive);
      }
      return next;
    });
  }, [activeNoteId]);

  const createNote = useCallback(async (folder = 'Brainstorming'): Promise<Note> => {
    const timestamp = new Date().toISOString();
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      folder: folder || 'General',
      content: '# Untitled Note\n\nStart typing your note here...',
      updatedAt: timestamp,
      createdAt: timestamp
    };

    // Optimistically update in state
    setNotes(prev => [newNote, ...prev]);
    selectNote(newNote.id);

    try {
      setSaveStatus('saving');
      const saved = await notesService.createNote(newNote);
      setSaveStatus('saved');
      return saved;
    } catch (err) {
      console.error('Failed to create note on disk:', err);
      setSaveStatus('error');
      return newNote;
    }
  }, [selectNote]);

  const updateNoteContent = useCallback((id: string, content: string) => {
    const timestamp = new Date().toISOString();
    let targetNote: Note | null = null;

    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          const updated = { ...note, content, updatedAt: timestamp };
          targetNote = updated;
          return updated;
        }
        return note;
      })
    );

    if (targetNote) {
      setSaveStatus('saving');
      debouncedSaveToDisk(targetNote);
    }
  }, [debouncedSaveToDisk]);

  const updateNoteTitle = useCallback(async (id: string, title: string) => {
    const trimmedTitle = title.trim() || 'Untitled Note';
    const timestamp = new Date().toISOString();
    let targetNote: Note | null = null;

    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          const updated = { ...note, title: trimmedTitle, updatedAt: timestamp };
          targetNote = updated;
          return updated;
        }
        return note;
      })
    );

    if (targetNote) {
      try {
        setSaveStatus('saving');
        await notesService.saveNote(targetNote);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save renamed note to disk:', err);
        setSaveStatus('error');
      }
    }
  }, []);

  const updateNoteFolder = useCallback(async (id: string, folder: string) => {
    const trimmedFolder = folder.trim() || 'General';
    const timestamp = new Date().toISOString();
    let targetNote: Note | null = null;

    setNotes(prev =>
      prev.map(note => {
        if (note.id === id) {
          const updated = { ...note, folder: trimmedFolder, updatedAt: timestamp };
          targetNote = updated;
          return updated;
        }
        return note;
      })
    );

    if (targetNote) {
      try {
        setSaveStatus('saving');
        await notesService.saveNote(targetNote);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to move note folder on disk:', err);
        setSaveStatus('error');
      }
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    try {
      setSaveStatus('saving');
      await notesService.deleteNote(id);

      setNotes(prev => {
        const nextNotes = prev.filter(n => n.id !== id);
        if (activeNoteId === id) {
          setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : null);
        }
        return nextNotes;
      });

      setOpenNoteIds(prev => prev.filter(tabId => tabId !== id));
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to delete note from disk:', err);
      setSaveStatus('error');
      throw err;
    }
  }, [activeNoteId]);

  const openNotesDirectory = useCallback(async () => {
    await notesService.openNotesDirectory();
  }, []);

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  const value: NotesContextType = {
    notes,
    activeNoteId,
    activeNote,
    openNoteIds,
    isLoading,
    saveStatus,
    notesDir,
    error,
    createNote,
    updateNoteContent,
    updateNoteTitle,
    updateNoteFolder,
    deleteNote,
    selectNote,
    closeNoteTab,
    openNotesDirectory,
    refreshNotes: loadNotesFromDisk
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};
