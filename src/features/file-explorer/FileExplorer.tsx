import React, { useEffect, useRef, useState } from "react";
import { IconButton } from "../../components/IconButton/IconButton";
import { Icons } from "../../components/Icons";
import { ConfirmModal } from "../../components/Modal/ConfirmModal";
import { PromptModal } from "../../components/Modal/PromptModal";
import { useNotes } from "../../hooks/useNotes";
import styles from "./FileExplorer.module.css";

interface FileExplorerProps {
  width: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ width }) => {
  const {
    notes,
    activeNoteId,
    selectNote,
    createNote,
    updateNoteTitle,
    deleteNote,
    openNotesDirectory,
    vaults,
    activeVault,
    setActiveVault,
    createVault,
    renameVault,
    deleteVault,
  } = useNotes();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isVaultDropdownOpen, setIsVaultDropdownOpen] = useState(false);
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [vaultToRename, setVaultToRename] = useState<string | null>(null);
  const [vaultToDelete, setVaultToDelete] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [noteToDelete, setNoteToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsVaultDropdownOpen(false);
      }
    };

    if (isVaultDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVaultDropdownOpen]);

  const getDisplayFolder = (
    note: { folder?: string },
    currentVault: string,
  ): string => {
    const f = (note.folder || "").trim();
    if (
      !f ||
      f === "Brainstorming" ||
      f === "General" ||
      f === "Main Vault" ||
      f.toLowerCase() === currentVault.toLowerCase()
    ) {
      return currentVault;
    }
    return f;
  };

  const activeVaultNotes = notes.filter(
    (note) => (note.vault || "").toLowerCase() === (activeVault || "").toLowerCase(),
  );
  const folders = Array.from(
    new Set(activeVaultNotes.map((n) => getDisplayFolder(n, activeVault))),
  ).sort((a, b) => {
    if (a.toLowerCase() === activeVault.toLowerCase()) return -1;
    if (b.toLowerCase() === activeVault.toLowerCase()) return 1;
    return a.localeCompare(b);
  });

  const toggleFolder = (folder: string) => {
    setExpanded((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleCreateInFolder = (e: React.MouseEvent, folder: string) => {
    e.stopPropagation();
    createNote(folder === activeVault ? activeVault : folder, activeVault);
    setExpanded((prev) => ({ ...prev, [folder]: true }));
  };

  const startRenamingNote = (note: { id: string; title: string }) => {
    setEditingNoteId(note.id);
    setEditingTitle(note.title);
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
    }, 10);
  };

  const handleRenameNoteSubmit = async (id: string) => {
    if (editingNoteId !== id) return;
    const trimmed = editingTitle.trim() || "Untitled Note";
    setEditingNoteId(null);
    const target = notes.find((n) => n.id === id);
    if (target && target.title !== trimmed) {
      await updateNoteTitle(id, trimmed);
    }
  };

  const handleRenameNoteKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameNoteSubmit(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingNoteId(null);
    }
  };

  const handleDeleteClick = (
    e: React.MouseEvent,
    note: { id: string; title: string },
  ) => {
    e.stopPropagation();
    setNoteToDelete(note);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await deleteNote(noteToDelete.id);
      setNoteToDelete(null);
    }
  };

  const handleCreateVaultConfirm = async (name: string) => {
    await createVault(name);
    setIsCreateVaultOpen(false);
  };

  const handleRenameVaultConfirm = async (newName: string) => {
    if (vaultToRename) {
      await renameVault(vaultToRename, newName);
      setVaultToRename(null);
    }
  };

  const handleDeleteVaultConfirm = async () => {
    if (vaultToDelete) {
      await deleteVault(vaultToDelete);
      setVaultToDelete(null);
    }
  };

  const validateNewVault = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Vault name cannot be empty";
    if (vaults.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      return "A vault with this name already exists";
    }
    return null;
  };

  const validateRenameVault = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Vault name cannot be empty";
    if (
      vaultToRename &&
      trimmed.toLowerCase() !== vaultToRename.toLowerCase() &&
      vaults.some((v) => v.toLowerCase() === trimmed.toLowerCase())
    ) {
      return "A vault with this name already exists";
    }
    return null;
  };

  return (
    <div className={styles.explorer} style={{ width }}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Explorer</span>
        <div className={styles.headerActions}>
          <IconButton
            icon={<Icons.FolderPlus />}
            title="New Vault"
            onClick={() => setIsCreateVaultOpen(true)}
            size="sm"
          />
          <IconButton
            icon={<Icons.FolderSymlink />}
            title="Open Notes Folder on Disk"
            onClick={openNotesDirectory}
            size="sm"
          />
          <IconButton
            icon={<Icons.Plus />}
            title={activeVault ? `New Note in ${activeVault}` : "New Note"}
            onClick={() => {
              if (!activeVault && vaults.length === 0) {
                setIsCreateVaultOpen(true);
              } else {
                createNote(activeVault, activeVault);
              }
            }}
            size="sm"
          />
        </div>
      </div>

      {/* Vault Switcher & Management Bar */}
      <div className={styles.vaultSection} ref={dropdownRef}>
        <div className={styles.vaultBar}>
          <button
            type="button"
            className={styles.vaultCurrentBtn}
            onClick={() => setIsVaultDropdownOpen((prev) => !prev)}
            title={
              activeVault
                ? `Active Vault: ${activeVault}. Click to switch vault.`
                : "No active vault. Click to create a vault."
            }
          >
            <span className={styles.vaultIcon}>
              <Icons.Folder />
            </span>
            <span className={styles.vaultName}>{activeVault || "No Vaults"}</span>
            <span className={styles.vaultCaret}>
              {isVaultDropdownOpen ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
            </span>
          </button>
          {activeVault && (
            <div className={styles.vaultBarActions}>
              <button
                type="button"
                className={styles.vaultActionBtn}
                title={`Rename "${activeVault}"`}
                onClick={() => setVaultToRename(activeVault)}
              >
                <Icons.Edit3 />
              </button>
              <button
                type="button"
                className={styles.vaultActionDeleteBtn}
                title={`Delete "${activeVault}"`}
                onClick={() => setVaultToDelete(activeVault)}
              >
                <Icons.Trash2 />
              </button>
            </div>
          )}
        </div>

        {isVaultDropdownOpen && (
          <div className={styles.vaultDropdown}>
            <div className={styles.vaultList}>
              {vaults.length === 0 ? (
                <div className={styles.vaultEmptyDropdownMsg}>
                  No vaults available
                </div>
              ) : (
                vaults.map((vault) => {
                  const isActive = vault === activeVault;
                  return (
                    <div
                      key={vault}
                      className={`${styles.vaultListItem} ${
                        isActive ? styles.vaultListItemActive : ""
                      }`}
                    >
                      <div
                        className={styles.vaultItemLeft}
                        onClick={() => {
                          setActiveVault(vault);
                          setIsVaultDropdownOpen(false);
                        }}
                      >
                        <span className={styles.vaultIcon}>
                          <Icons.Folder />
                        </span>
                        <span className={styles.vaultItemName}>{vault}</span>
                        {isActive && (
                          <span className={styles.vaultCheckIcon}>
                            <Icons.Check />
                          </span>
                        )}
                      </div>

                      <div className={styles.vaultItemActions}>
                        <button
                          type="button"
                          className={styles.vaultActionBtn}
                          title={`Rename "${vault}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVaultToRename(vault);
                            setIsVaultDropdownOpen(false);
                          }}
                        >
                          <Icons.Edit3 />
                        </button>
                        <button
                          type="button"
                          className={styles.vaultActionDeleteBtn}
                          title={`Delete "${vault}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVaultToDelete(vault);
                            setIsVaultDropdownOpen(false);
                          }}
                        >
                          <Icons.Trash2 />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.vaultDropdownFooter}>
              <button
                type="button"
                className={styles.vaultNewBtn}
                onClick={() => {
                  setIsVaultDropdownOpen(false);
                  setIsCreateVaultOpen(true);
                }}
              >
                <Icons.Plus /> New Vault
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.tree}>
        {vaults.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No vaults created</span>
            <button
              type="button"
              className={styles.primaryActionButton}
              onClick={() => setIsCreateVaultOpen(true)}
            >
              + Create a Vault
            </button>
          </div>
        ) : activeVaultNotes.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No notes in "{activeVault}"</span>
            <button
              type="button"
              className={styles.primaryActionButton}
              onClick={() => createNote(activeVault, activeVault)}
            >
              + Create note in {activeVault}
            </button>
          </div>
        ) : (
          folders.map((folder) => {
            const folderNotes = activeVaultNotes.filter(
              (n) => getDisplayFolder(n, activeVault) === folder,
            );
            const isExpanded = expanded[folder] !== false;

            return (
              <div key={folder}>
                <div
                  className={styles.folder}
                  onClick={() => toggleFolder(folder)}
                >
                  <div className={styles.folderLeft}>
                    <div className={styles.folderIcon}>
                      {isExpanded ? (
                        <Icons.ChevronDown />
                      ) : (
                        <Icons.ChevronRight />
                      )}
                    </div>
                    <span>{folder}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className={styles.folderBadge}>
                      {folderNotes.length}
                    </span>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      title={`New note in ${folder}`}
                      onClick={(e) => handleCreateInFolder(e, folder)}
                    >
                      <Icons.Plus />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.notesList}>
                    {folderNotes.map((note) => {
                      const isEditing = editingNoteId === note.id;
                      return (
                        <div
                          key={note.id}
                          className={`${styles.noteItem} ${
                            activeNoteId === note.id ? styles.noteItemActive : ""
                          }`}
                          onClick={() => {
                            if (!isEditing) selectNote(note.id);
                          }}
                        >
                          <div className={styles.noteContent}>
                            <div
                              className={`${styles.noteIcon} ${
                                activeNoteId === note.id
                                  ? styles.noteIconActive
                                  : ""
                              }`}
                            >
                              <Icons.FileText />
                            </div>
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                type="text"
                                className={styles.noteRenameInput}
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) =>
                                  handleRenameNoteKeyDown(e, note.id)
                                }
                                onBlur={() => handleRenameNoteSubmit(note.id)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <span
                                className={styles.noteLabel}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  startRenamingNote(note);
                                }}
                              >
                                {note.title}
                              </span>
                            )}
                          </div>

                          <div className={styles.noteActions}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              title="Rename note"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRenamingNote(note);
                              }}
                            >
                              <Icons.Edit3 />
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              title="Delete note from disk"
                              onClick={(e) => handleDeleteClick(e, note)}
                            >
                              <Icons.Trash2 />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete Note Confirmation */}
      <ConfirmModal
        isOpen={noteToDelete !== null}
        title="Delete Note"
        message={`Are you sure you want to delete "${noteToDelete?.title}"? This will permanently delete the Markdown file from your system disk.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />

      {/* Create Vault Modal */}
      <PromptModal
        isOpen={isCreateVaultOpen}
        title="Create New Vault"
        placeholder="e.g. Work, Personal, Research..."
        confirmLabel="Create Vault"
        cancelLabel="Cancel"
        validate={validateNewVault}
        onConfirm={handleCreateVaultConfirm}
        onCancel={() => setIsCreateVaultOpen(false)}
      />

      {/* Rename Vault Modal */}
      <PromptModal
        isOpen={vaultToRename !== null}
        title={`Rename Vault "${vaultToRename}"`}
        initialValue={vaultToRename || ""}
        placeholder="New vault name..."
        confirmLabel="Rename Vault"
        cancelLabel="Cancel"
        validate={validateRenameVault}
        onConfirm={handleRenameVaultConfirm}
        onCancel={() => setVaultToRename(null)}
      />

      {/* Delete Vault Confirmation */}
      <ConfirmModal
        isOpen={vaultToDelete !== null}
        title={`Delete Vault "${vaultToDelete}"`}
        message={`Are you sure you want to delete the vault "${vaultToDelete}" and all notes inside it? This will permanently delete its directory and files from your system disk.`}
        confirmLabel="Delete Vault"
        cancelLabel="Cancel"
        onConfirm={handleDeleteVaultConfirm}
        onCancel={() => setVaultToDelete(null)}
      />
    </div>
  );
};
