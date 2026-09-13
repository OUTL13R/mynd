import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDebouncedCallback } from "../hooks/useDebounce";
import { notesService, isTauri } from "../services/notesService";
import { syncWorker } from "../services/syncWorker";
import { Note, SaveStatus } from "../types";

const LAST_ACTIVE_NOTE_KEY = "mynd_active_note_id";
const OPEN_NOTE_IDS_KEY = "mynd_open_note_ids";
const LAST_ACTIVE_VAULT_KEY = "mynd_active_vault";

export interface NotesContextType {
  notes: Note[];
  activeNoteId: string | null;
  activeNote: Note | null;
  openNoteIds: string[];
  isLoading: boolean;
  saveStatus: SaveStatus;
  notesDir: string;
  error: string | null;
  vaults: string[];
  activeVault: string;
  setActiveVault: (vault: string) => void;
  createVault: (name: string) => Promise<string>;
  renameVault: (oldName: string, newName: string) => Promise<string>;
  deleteVault: (name: string) => Promise<void>;
  createNote: (folder?: string, vault?: string) => Promise<Note>;
  saveActiveNote: () => Promise<void>;
  updateNoteContent: (id: string, content: string) => void;
  updateNoteTitle: (id: string, title: string) => Promise<void>;
  updateNoteFolder: (id: string, folder: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string) => void;
  closeNoteTab: (id: string) => void;
  openNotesDirectory: () => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export const NotesContext = createContext<NotesContextType | undefined>(
  undefined,
);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [vaults, setVaults] = useState<string[]>([]);
  const [activeVault, setActiveVault] = useState<string>(() => {
    return localStorage.getItem(LAST_ACTIVE_VAULT_KEY) || "";
  });
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [notesDir, setNotesDir] = useState<string>("");
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

  // Persist active vault to localStorage
  useEffect(() => {
    localStorage.setItem(LAST_ACTIVE_VAULT_KEY, activeVault || "");
  }, [activeVault]);

  // Load notes and vaults from disk on startup
  const loadNotesFromDisk = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [loadedNotes, dir, loadedVaults] = await Promise.all([
        notesService.getNotes(),
        notesService.getNotesDirectory(),
        notesService.getVaults(),
      ]);

      const normalizedNotes = loadedNotes.map((n) => {
        const vault = (n.vault && n.vault.trim()) || "";
        const folder =
          !n.folder ||
          n.folder === "Brainstorming" ||
          n.folder === "General" ||
          n.folder === vault
            ? vault
            : n.folder;
        return { ...n, vault, folder };
      });

      setNotes(normalizedNotes);
      setNotesDir(dir);

      const noteVaults = normalizedNotes
        .map((n) => n.vault)
        .filter(Boolean) as string[];
      const combinedVaults = Array.from(
        new Set([...loadedVaults, ...noteVaults]),
      )
        .filter(Boolean)
        .sort();
      setVaults(combinedVaults);

      setActiveVault((prev) => {
        if (prev && combinedVaults.includes(prev)) {
          return prev;
        }
        return combinedVaults.length > 0 ? combinedVaults[0] : "";
      });

      if (loadedNotes.length > 0) {
        // Restore active note if it exists in loaded notes, else select the first
        setActiveNoteId((prev) => {
          if (prev && loadedNotes.some((n) => n.id === prev)) {
            return prev;
          }
          return loadedNotes[0].id;
        });

        // Ensure open tabs are valid
        setOpenNoteIds((prev) => {
          const validTabs = prev.filter((id) =>
            loadedNotes.some((n) => n.id === id),
          );
          if (validTabs.length > 0) return validTabs;
          return [loadedNotes[0].id];
        });
      } else {
        setActiveNoteId(null);
        setOpenNoteIds([]);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load notes from disk";
      setError(msg);
      console.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotesFromDisk();
  }, [loadNotesFromDisk]);

  // Subscribe to background sync worker status
  useEffect(() => {
    const unsubscribe = syncWorker.subscribe((status) => {
      setSaveStatus(status);
    });
    return unsubscribe;
  }, []);

  // Listen for real-time filesystem watcher updates from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{ path: string; action: string; noteId?: string }>('notes:disk-change', async (event) => {
          const { path, action, noteId } = event.payload;
          console.debug('[Mynd Watcher Event]', action, path, noteId);
          // If active note is clean and changed externally, or if files were added/removed/renamed, refresh
          await loadNotesFromDisk();
        }).then((u) => {
          unlisten = u;
        });
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [loadNotesFromDisk]);

  // Debounced queue enqueue for content typing
  const [debouncedSaveToDisk] = useDebouncedCallback(
    (noteToSave: Note) => {
      syncWorker.enqueueSave(noteToSave);
    },
    350,
  );

  const saveActiveNote = useCallback(async () => {
    if (!activeNoteId) return;
    const current = notesRef.current.find((n) => n.id === activeNoteId);
    if (!current) return;

    syncWorker.enqueueSave(current);
    await syncWorker.flush();
  }, [activeNoteId]);

  // Global Ctrl+S / Cmd+S shortcut to immediately save active file
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveActiveNote();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [saveActiveNote]);

  const selectNote = useCallback((id: string) => {
    setActiveNoteId(id);
    setOpenNoteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closeNoteTab = useCallback(
    (id: string) => {
      setOpenNoteIds((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (activeNoteId === id) {
          const nextActive = next.length > 0 ? next[next.length - 1] : null;
          setActiveNoteId(nextActive);
        }
        return next;
      });
    },
    [activeNoteId],
  );

  const createVault = useCallback(
    async (vaultName: string): Promise<string> => {
      const created = await notesService.createVault(vaultName);
      setVaults((prev) => {
        if (!prev.includes(created)) {
          return [...prev, created].sort();
        }
        return prev;
      });
      setActiveVault(created);
      return created;
    },
    [],
  );

  const renameVault = useCallback(
    async (oldName: string, newName: string): Promise<string> => {
      const renamed = await notesService.renameVault(oldName, newName);
      setVaults((prev) => {
        const next = prev.map((v) => (v === oldName ? renamed : v));
        return Array.from(new Set(next)).sort();
      });

      setActiveVault((prev) => (prev === oldName ? renamed : prev));

      setNotes((prev) =>
        prev.map((note) =>
          (note.vault || "Main Vault") === oldName
            ? { ...note, vault: renamed }
            : note,
        ),
      );

      return renamed;
    },
    [],
  );

  const deleteVault = useCallback(
    async (vaultName: string): Promise<void> => {
      const trimmed = vaultName.trim();
      if (!trimmed) return;

      const remainingVaults = vaults.filter(
        (v) => v.toLowerCase() !== trimmed.toLowerCase(),
      );
      const nextActiveVault =
        remainingVaults.length > 0 ? remainingVaults[0] : "";

      // 1. Optimistically update vaults list without forcing default
      setVaults(remainingVaults);

      // 2. Switch active vault if deleting the currently active vault
      if (activeVault.toLowerCase() === trimmed.toLowerCase()) {
        setActiveVault(nextActiveVault);
      }

      // 3. Remove all notes belonging to the deleted vault
      const deletedNotes = notes.filter(
        (n) => (n.vault || "").toLowerCase() === trimmed.toLowerCase(),
      );
      const deletedNoteIds = new Set(deletedNotes.map((n) => n.id));

      setNotes((prev) => {
        const filtered = prev.filter((n) => !deletedNoteIds.has(n.id));
        if (activeNoteId && deletedNoteIds.has(activeNoteId)) {
          const nextActiveNote = filtered.length > 0 ? filtered[0].id : null;
          setActiveNoteId(nextActiveNote);
        }
        return filtered;
      });

      // 4. Close any open tabs for notes belonging to this vault
      setOpenNoteIds((prev) => prev.filter((id) => !deletedNoteIds.has(id)));

      // 5. Cancel any pending saves for deleted notes in background sync worker
      deletedNotes.forEach((n) => {
        syncWorker.enqueueDelete(n.id);
      });

      // 6. Delete directory on disk
      try {
        await notesService.deleteVault(trimmed);
      } catch (err) {
        console.error("Failed to delete vault from disk:", err);
      }
    },
    [vaults, activeVault, notes, activeNoteId],
  );

  const createNote = useCallback(
    async (folder?: string, vault?: string): Promise<Note> => {
      const resolvedVault =
        (vault && vault.trim()) || activeVault || "";
      const resolvedFolder =
        folder &&
        folder.trim() &&
        folder !== "Brainstorming" &&
        folder !== "General"
          ? folder.trim()
          : resolvedVault;
      const timestamp = new Date().toISOString();
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: "Untitled Note",
        folder: resolvedFolder,
        vault: resolvedVault,
        content: "# Untitled Note\n\nStart typing your note here...",
        updatedAt: timestamp,
        createdAt: timestamp,
      };

      // Optimistically update in state immediately
      setNotes((prev) => [newNote, ...prev]);
      if (resolvedVault && activeVault !== resolvedVault) {
        setActiveVault(resolvedVault);
      }
      selectNote(newNote.id);

      // Background worker handles disk persistence
      syncWorker.enqueueSave(newNote);
      return newNote;
    },
    [activeVault, selectNote],
  );

  const updateNoteContent = useCallback(
    (id: string, content: string) => {
      const timestamp = new Date().toISOString();
      let targetNote: Note | null = null;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === id) {
            const updated = { ...note, content, updatedAt: timestamp };
            targetNote = updated;
            return updated;
          }
          return note;
        }),
      );

      if (targetNote) {
        debouncedSaveToDisk(targetNote);
      }
    },
    [debouncedSaveToDisk],
  );

  const updateNoteTitle = useCallback(async (id: string, title: string) => {
    const trimmedTitle = title.trim() || "Untitled Note";
    const timestamp = new Date().toISOString();
    let targetNote: Note | null = null;

    setNotes((prev) =>
      prev.map((note) => {
        if (note.id === id) {
          const updated = {
            ...note,
            title: trimmedTitle,
            updatedAt: timestamp,
          };
          targetNote = updated;
          return updated;
        }
        return note;
      }),
    );

    if (targetNote) {
      syncWorker.enqueueSave(targetNote);
    }
  }, []);

  const updateNoteFolder = useCallback(async (id: string, folder: string) => {
    const trimmedFolder = folder.trim() || "General";
    const timestamp = new Date().toISOString();
    let targetNote: Note | null = null;

    setNotes((prev) =>
      prev.map((note) => {
        if (note.id === id) {
          const updated = {
            ...note,
            folder: trimmedFolder,
            updatedAt: timestamp,
          };
          targetNote = updated;
          return updated;
        }
        return note;
      }),
    );

    if (targetNote) {
      syncWorker.enqueueSave(targetNote);
    }
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      // 1. Optimistically update local state immediately (zero UI lag)
      setNotes((prev) => {
        const nextNotes = prev.filter((n) => n.id !== id);
        if (activeNoteId === id) {
          setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : null);
        }
        return nextNotes;
      });

      setOpenNoteIds((prev) => prev.filter((tabId) => tabId !== id));

      // 2. Delegate disk deletion and cancel pending saves in background worker
      syncWorker.enqueueDelete(id);
    },
    [activeNoteId],
  );

  const openNotesDirectory = useCallback(async () => {
    await notesService.openNotesDirectory();
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const value: NotesContextType = {
    notes,
    activeNoteId,
    activeNote,
    openNoteIds,
    isLoading,
    saveStatus,
    notesDir,
    error,
    vaults,
    activeVault,
    setActiveVault,
    createVault,
    renameVault,
    deleteVault,
    createNote,
    saveActiveNote,
    updateNoteContent,
    updateNoteTitle,
    updateNoteFolder,
    deleteNote,
    selectNote,
    closeNoteTab,
    openNotesDirectory,
    refreshNotes: loadNotesFromDisk,
  };

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
};
