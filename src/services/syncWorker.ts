import { Note, SaveStatus } from "../types";
import { notesService } from "./notesService";

type SyncActionType = "SAVE" | "DELETE";

interface SyncAction {
  type: SyncActionType;
  id: string;
  note?: Note;
  retries?: number;
}

class SyncWorker {
  private queue: SyncAction[] = [];
  private isProcessing = false;
  private currentStatus: SaveStatus = "saved";
  private listeners: Set<(status: SaveStatus) => void> = new Set();
  private deletedIds: Set<string> = new Set();
  private maxRetries = 3;

  public subscribe(listener: (status: SaveStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): SaveStatus {
    return this.currentStatus;
  }

  private setStatus(status: SaveStatus) {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.listeners.forEach((listener) => {
        try {
          listener(status);
        } catch (e) {
          console.error("Error in sync worker listener", e);
        }
      });
    }
  }

  /**
   * Enqueues a note save action.
   * Coalesces multiple saves for the same note into the latest version.
   */
  public enqueueSave(note: Note): void {
    // If this note was previously marked deleted, un-mark it since it's being saved
    this.deletedIds.delete(note.id);

    // If there's an existing delete action for this note, remove it
    this.queue = this.queue.filter(
      (action) => !(action.id === note.id && action.type === "DELETE"),
    );

    // Coalesce existing SAVE action if already queued
    const existingSave = this.queue.find(
      (action) => action.id === note.id && action.type === "SAVE",
    );
    if (existingSave) {
      existingSave.note = note;
    } else {
      this.queue.push({
        type: "SAVE",
        id: note.id,
        note,
        retries: 0,
      });
    }

    this.setStatus("saving");
    this.processQueue();
  }

  /**
   * Enqueues a note deletion action.
   * Cancels any pending save action in the queue for this note.
   */
  public enqueueDelete(noteId: string): void {
    this.deletedIds.add(noteId);

    // Immediately drop any pending SAVE action for this note from the queue
    this.queue = this.queue.filter(
      (action) => !(action.id === noteId && action.type === "SAVE"),
    );

    // Check if a DELETE is already in queue
    const alreadyQueued = this.queue.some(
      (action) => action.id === noteId && action.type === "DELETE",
    );
    if (!alreadyQueued) {
      this.queue.push({
        type: "DELETE",
        id: noteId,
        retries: 0,
      });
    }

    this.setStatus("saving");
    this.processQueue();
  }

  /**
   * Processes queued actions sequentially with retry logic.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const action = this.queue[0];

        // If action is SAVE but note was marked deleted in the meantime, skip it
        if (action.type === "SAVE" && this.deletedIds.has(action.id)) {
          this.queue.shift();
          continue;
        }

        let success = false;
        const attempts = (action.retries || 0) + 1;

        for (let attempt = action.retries || 0; attempt < this.maxRetries; attempt++) {
          try {
            if (action.type === "SAVE" && action.note) {
              // Final check before disk write
              if (this.deletedIds.has(action.id)) {
                success = true;
                break;
              }
              await notesService.saveNote(action.note);
            } else if (action.type === "DELETE") {
              await notesService.deleteNote(action.id);
            }
            success = true;
            break;
          } catch (err) {
            console.warn(
              `SyncWorker: disk op [${action.type}] for note ${action.id} attempt ${attempt + 1} failed:`,
              err,
            );
            // If it failed and we have retries left, wait a bit for file-lock / sharing release
            if (attempt < this.maxRetries - 1) {
              await new Promise((res) => setTimeout(res, 50 * (attempt + 1)));
            }
          }
        }

        // Remove the processed action from the front of the queue
        this.queue.shift();

        if (!success) {
          console.error(
            `SyncWorker: failed to persist [${action.type}] for note ${action.id} after ${attempts} attempts`,
          );
          this.setStatus("error");
          // Continue draining remaining items so one failed action does not lock up the queue
        }
      }

      if (this.currentStatus !== "error") {
        this.setStatus("saved");
      }
    } finally {
      this.isProcessing = false;

      // In case new actions were pushed while finishing the loop
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Returns a promise that resolves when all pending actions in the queue are completed.
   */
  public async flush(): Promise<void> {
    while (this.isProcessing || this.queue.length > 0) {
      await new Promise((res) => setTimeout(res, 25));
    }
  }
}

export const syncWorker = new SyncWorker();
