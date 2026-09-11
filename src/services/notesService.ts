import { invoke } from "@tauri-apps/api/core";
import { Note } from "../types";

export const isTauri = (): boolean => {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
};

// Fallback in-memory / localStorage storage for browser preview mode
const LOCAL_STORAGE_KEY = "mynd_notes_fallback";

const getBrowserFallbackNotes = (): Note[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to read notes from localStorage fallback", e);
  }
  return [
    {
      id: "note-1",
      title: "Welcome to Mynd",
      folder: "Main Vault",
      vault: "Main Vault",
      content: `# Welcome to Mynd\n\nMynd is your **AI-first Second Brain** — a minimalist note-taking app with an embedded AI assistant.\n\n### Features\n- Minimalist & fast\n- Embedded AI assistant\n- Markdown editing with live preview\n- Notes auto-saved to system disk\n\nSwitch to the AI tab to start a conversation.`,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];
};

const saveBrowserFallbackNotes = (notes: Note[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error("Failed to write notes to localStorage fallback", e);
  }
};

export const notesService = {
  /**
   * Fetches all notes from system disk (or localStorage fallback if running in browser).
   */
  async getNotes(): Promise<Note[]> {
    if (isTauri()) {
      try {
        return await invoke<Note[]>("get_notes");
      } catch (err) {
        console.error("Failed to load notes from Tauri system disk:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to read notes from disk",
          { cause: err },
        );
      }
    }
    return getBrowserFallbackNotes();
  },

  /**
   * Fetches all vault names available under the notes root.
   */
  async getVaults(): Promise<string[]> {
    if (isTauri()) {
      try {
        return await invoke<string[]>("get_vaults");
      } catch (err) {
        console.error("Failed to load vaults:", err);
        return [];
      }
    }

    try {
      const raw = localStorage.getItem("mynd_vaults_fallback");
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.sort();
        }
      }
    } catch (e) {
      console.error("Failed to read vaults from fallback", e);
    }

    const notes = getBrowserFallbackNotes();
    const list = Array.from(
      new Set(notes.map((note) => note.vault).filter(Boolean) as string[]),
    ).sort();
    return list;
  },

  /**
   * Creates a new vault under the notes directory.
   */
  async createVault(vaultName: string): Promise<string> {
    const trimmed = vaultName.trim();
    if (!trimmed) {
      throw new Error("Vault name cannot be empty");
    }

    if (isTauri()) {
      try {
        return await invoke<string>("create_vault", { vaultName: trimmed });
      } catch (err) {
        console.error("Failed to create vault:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to create vault",
          { cause: err },
        );
      }
    }

    const vaults = await this.getVaults();
    if (!vaults.includes(trimmed)) {
      vaults.push(trimmed);
      vaults.sort();
      localStorage.setItem("mynd_vaults_fallback", JSON.stringify(vaults));
    }
    return trimmed;
  },

  /**
   * Renames an existing vault on disk or in localStorage fallback.
   */
  async renameVault(oldName: string, newName: string): Promise<string> {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedNew) {
      throw new Error("Vault name cannot be empty");
    }

    if (isTauri()) {
      try {
        return await invoke<string>("rename_vault", {
          oldName: trimmedOld,
          newName: trimmedNew,
        });
      } catch (err) {
        console.error("Failed to rename vault:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to rename vault",
          { cause: err },
        );
      }
    }

    const vaults = await this.getVaults();
    const index = vaults.indexOf(trimmedOld);
    if (index !== -1) {
      vaults[index] = trimmedNew;
    } else if (!vaults.includes(trimmedNew)) {
      vaults.push(trimmedNew);
    }
    const uniqueVaults = Array.from(new Set(vaults)).sort();
    localStorage.setItem("mynd_vaults_fallback", JSON.stringify(uniqueVaults));

    // Update notes belonging to the renamed vault
    const notes = getBrowserFallbackNotes();
    let updatedAny = false;
    const updatedNotes = notes.map((note) => {
      if ((note.vault || "Main Vault") === trimmedOld) {
        updatedAny = true;
        return { ...note, vault: trimmedNew };
      }
      return note;
    });
    if (updatedAny) {
      saveBrowserFallbackNotes(updatedNotes);
    }

    return trimmedNew;
  },

  /**
   * Deletes a vault and all notes within it from disk or fallback storage.
   */
  async deleteVault(vaultName: string): Promise<void> {
    const trimmed = vaultName.trim();
    if (!trimmed) {
      throw new Error("Vault name cannot be empty");
    }

    if (isTauri()) {
      try {
        await invoke("delete_vault", { vaultName: trimmed });
        return;
      } catch (err) {
        console.error("Failed to delete vault:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to delete vault",
          { cause: err },
        );
      }
    }

    const vaults = (await this.getVaults()).filter((v) => v !== trimmed);
    localStorage.setItem("mynd_vaults_fallback", JSON.stringify(vaults));

    const notes = getBrowserFallbackNotes().filter(
      (note) => (note.vault || "").toLowerCase() !== trimmed.toLowerCase(),
    );
    saveBrowserFallbackNotes(notes);
  },

  /**
   * Fetches a specific note by ID.
   */
  async getNote(id: string): Promise<Note> {
    if (isTauri()) {
      try {
        return await invoke<Note>("get_note", { id });
      } catch (err) {
        console.error(`Failed to get note ${id}:`, err);
        throw new Error(typeof err === "string" ? err : "Note not found", {
          cause: err,
        });
      }
    }
    const notes = getBrowserFallbackNotes();
    const found = notes.find((n) => n.id === id);
    if (!found) throw new Error(`Note with id ${id} not found`);
    return found;
  },

  /**
   * Creates a new note on the system disk.
   */
  async createNote(note: Note): Promise<Note> {
    if (isTauri()) {
      try {
        return await invoke<Note>("create_note", { note });
      } catch (err) {
        console.error("Failed to create note on system disk:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to create note on disk",
          { cause: err },
        );
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
        return await invoke<Note>("save_note", { note });
      } catch (err) {
        console.error("Failed to save note to system disk:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to save note to disk",
          { cause: err },
        );
      }
    }
    const notes = getBrowserFallbackNotes();
    const index = notes.findIndex((n) => n.id === note.id);
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
        await invoke("delete_note", { id });
        return;
      } catch (err) {
        console.error("Failed to delete note from system disk:", err);
        throw new Error(
          typeof err === "string" ? err : "Failed to delete note",
          { cause: err },
        );
      }
    }
    const notes = getBrowserFallbackNotes().filter((n) => n.id !== id);
    saveBrowserFallbackNotes(notes);
  },

  /**
   * Gets the path to the system disk folder where notes are stored.
   */
  async getNotesDirectory(): Promise<string> {
    if (isTauri()) {
      try {
        return await invoke<string>("get_notes_dir");
      } catch (err) {
        console.error("Failed to get notes directory path:", err);
        return "Documents/Mynd/notes";
      }
    }
    return "Browser Storage (Local)";
  },

  /**
   * Opens the notes folder in the native file explorer.
   */
  async openNotesDirectory(): Promise<void> {
    if (isTauri()) {
      try {
        await invoke("open_notes_dir");
      } catch (err) {
        console.error("Failed to open notes directory in file explorer:", err);
      }
    }
  },
};
