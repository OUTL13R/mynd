# Mynd User Guide

Welcome to **Mynd**, a fast, local-first Markdown note-taking and knowledge management desktop application built with Tauri, Rust, React, and CodeMirror 6.

All notes are stored as plain `.md` files directly on your local filesystem, organized by vaults and folders, and indexed in real time using SQLite FTS5 for instant search.

---

## Table of Contents

1. [Quick Start & Overview](#1-quick-start--overview)
2. [Interface Layout](#2-interface-layout)
3. [Vaults & Folder Management](#3-vaults--folder-management)
4. [Writing & Formatting Notes](#4-writing--formatting-notes)
   - [Editing View Modes](#editing-view-modes)
   - [Keyboard Formatting Shortcuts](#keyboard-formatting-shortcuts)
   - [Text Selection & Word Highlighting](#text-selection--word-highlighting)
5. [Instant Full-Text Search](#5-instant-full-text-search)
   - [Opening Search](#opening-search)
   - [Search Capabilities & Syntax](#search-capabilities--syntax)
   - [Keyboard Navigation in Search](#keyboard-navigation-in-search)
   - [Index Statistics & Rebuilding](#index-statistics--rebuilding)
6. [AI Assistant](#6-ai-assistant)
7. [Theme & Customization](#7-theme--customization)
8. [File Storage & Architecture](#8-file-storage--architecture)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. Quick Start & Overview

When you launch Mynd, it automatically resolves or creates your local notes directory (e.g. `Documents/Mynd` or `<app_data>/notes`) and starts an active filesystem watcher.

- **Create a Note**: Click the `+` button in the file explorer sidebar or next to any folder.
- **Write Markdown**: Type directly in the editor with auto-wrapping, syntax highlighting, and live split preview.
- **Search Everything**: Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on macOS) to search filenames and note contents instantly.

---

## 2. Interface Layout

The workspace is organized into four main sections:

```
+---+-------------------+-----------------------------------+
| A |                   |  [Tabs: Note 1 | Note 2] [Modes]  |
| C |   Sidebar Panel   |-----------------------------------|
| T |                   |                                   |
| I |  - File Explorer  |          Editor Workspace         |
| V |  - Search Panel   |   (Editor / Split / Preview)      |
| I |                   |                                   |
| T |                   |                                   |
| Y |-------------------|                                   |
|   |                   |                                   |
| B | Resizable Divider |                                   |
| A |                   |                                   |
| R |                   |                                   |
+---+-------------------+-----------------------------------+
|                     Status Bar                            |
+-----------------------------------------------------------+
```

1. **Activity Bar (Far Left)**:
   - **Files (`Folder` icon)**: Toggle File Explorer sidebar.
   - **Search (`Magnifying Glass` icon)**: Open Full-Text Search.
   - **Graph (`Network` icon)**: Reserved for knowledge graph view.
   - **AI (`Bot` icon)**: Open Mynd AI chat view.
   - **Theme (`Sun`/`Moon` icon)**: Toggle between Dark and Light mode.
   - **Settings (`Gear` icon)**: Application configuration.
2. **Sidebar Panel**:
   - Displays either the **File Explorer** (vaults, folders, notes) or the **Search Panel**.
   - Width is fully adjustable: hover over the border and drag to resize (160px – 420px).
3. **Editor Workspace**:
   - Tab bar for multi-note workflows.
   - View mode switches (Edit, Split, Preview).
   - Distraction-free CodeMirror 6 markdown editor.
4. **Status Bar (Bottom)**:
   - Displays current note status, word count, character count, and system health.

---

## 3. Vaults & Folder Management

Mynd supports multi-vault isolation and nested folder organization.

### Vaults
- **Switch Vaults**: Click the Vault dropdown header at the top of the file explorer.
- **Create Vault**: Click the `+` button in the vault dropdown or choose "Create Vault", then enter a name.
- **Rename or Delete Vault**: Hover over a vault in the dropdown list and click the edit or trash icon.

### Folders & Notes
- **Create a Note in a Specific Folder**: Click the `+` icon next to the folder name.
- **Rename a Note**: Double-click the note name in the explorer or click the pencil icon, type the new name, and press `Enter` (or click checkmark).
- **Delete a Note**: Click the trash icon next to any note. A confirmation prompt prevents accidental deletion.
- **Open Notes Directory**: Click the folder open icon in the sidebar header to reveal the folder in Windows File Explorer / macOS Finder.

---

## 4. Writing & Formatting Notes

### Editing View Modes
Use the mode buttons on the top right of the editor tab bar:
- **Edit Mode (`Edit3` icon)**: Full-width distraction-free editor.
- **Split Mode (`Columns` icon)**: Side-by-side editing and live rendered Markdown preview.
- **Preview Mode (`Eye` icon)**: Clean, read-only rendered Markdown preview.

### Keyboard Formatting Shortcuts
Format text quickly without taking your hands off the keyboard:

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Result / Behavior |
| :--- | :--- | :--- | :--- |
| **Undo** | `Ctrl + Z` | `Cmd + Z` | Undo previous action |
| **Redo** | `Ctrl + Y` or `Ctrl + Shift + Z` | `Cmd + Shift + Z` | Redo undone action |
| **Delete** | `Delete` | `Delete` | Deletes selected text |
| **Bold** | `Ctrl + B` | `Cmd + B` | Wraps or unwraps with `**text**` |
| **Italic** | `Ctrl + I` | `Cmd + I` | Wraps or unwraps with `*text*` |
| **Strikethrough** | `Ctrl + Shift + X` | `Cmd + Shift + X` | Wraps or unwraps with `~~text~~` |
| **Inline Code** | `Ctrl + E` or `Ctrl + \`` | `Cmd + E` or `Cmd + \`` | Wraps or unwraps with `` `code` `` |
| **Headings (1-6)** | `Ctrl + 1` ... `Ctrl + 6` | `Cmd + 1` ... `Cmd + 6` | Sets line heading level (`#` to `######`) |
| **Bullet List** | `Ctrl + Shift + 8`, `Ctrl + Shift + U`, or `Ctrl + L` | `Cmd + Shift + 8`, `Cmd + Shift + U`, or `Cmd + L` | Toggles `- ` on selected line(s) |
| **Numbered List** | `Ctrl + Shift + 7` or `Ctrl + Shift + O` | `Cmd + Shift + 7` or `Cmd + Shift + O` | Toggles `1. ` on selected line(s) |
| **Task / Checklist**| `Ctrl + Shift + C` | `Cmd + Shift + C` | Toggles `- [ ] ` checklist item |
| **Blockquote** | `Ctrl + Shift + .` | `Cmd + Shift + .` | Toggles `> ` blockquote prefix |

> **Tip**: If text is selected, pressing a shortcut wraps that selection. If no text is selected, the shortcut inserts the markdown syntax with your cursor placed right inside the tags.

### Text Selection & Word Highlighting
- **Prominent Highlighting**: When you select any text—even a single letter or word—it is highlighted with a crisp, visible selection layer.
- **Occurrences Matching**: Selecting a word automatically highlights all other occurrences of that word in the note with a subtle indicator so you can track repeated terms.
- **Word Wrapping**: Lines automatically wrap at the edge of the editor pane without horizontal scrollbars, keeping long sentences easy to read.

---

## 5. Instant Full-Text Search

Mynd features a high-performance SQLite FTS5 index running natively in Rust. It monitors your filesystem in real-time, keeping every keystroke and file creation indexed.

### Opening Search
- Press **`Ctrl + Shift + F`** (or **`Cmd + Shift + F`**) anywhere in the application.
- Or click the **Search (`Magnifying Glass`)** icon on the Activity Bar.

### Search Capabilities & Syntax
- **Filename & Content Search**: Finds matches in note titles, filenames, and note bodies.
- **Word Prefix Matching**: Typing `prog` will match `program`, `programming`, and `progress`.
- **Exact Phrases**: Enclose phrases in quotes, e.g. `"quarterly goals"`.
- **Vault Filtering**: Use the vault dropdown at the top of the Search panel to restrict results to a specific vault or search across all vaults.
- **Snippets with Context**: Search results display extracted snippets showing your search keywords in context with bold highlights.

### Keyboard Navigation in Search
- **`ArrowDown` / `ArrowUp`**: Navigate through the search results list.
- **`Enter`**: Open the currently highlighted search result in the editor.
- **`Escape`**: Clear the search box and reset focus.

### Index Statistics & Rebuilding
- The Search panel header shows total indexed notes and index health.
- If you manually moved files outside the app or wish to refresh the database, click the **Reindex** button (`Refresh` icon) next to the search bar to run a full reconciliation.

---

## 6. AI Assistant

Access the integrated assistant by clicking the **AI (`Bot`)** icon in the Activity Bar.

- **Context-Aware**: The assistant knows which note and folder you currently have open.
- **Disk Integration**: Chat with the assistant to summarize notes, formulate ideas, or retrieve relevant information stored in your local workspace.

---

## 7. Theme & Customization

- **Dark / Light Theme**: Click the `Sun`/`Moon` button in the bottom left corner of the Activity Bar to toggle themes.
- **Responsive Layout**: The sidebar width can be adjusted by dragging the divider.

---

## 8. File Storage & Architecture

- **Local Markdown**: Notes are stored as standard `.md` files on your hard drive. There is no proprietary lock-in; you can open and edit your notes in VS Code, Obsidian, or any text editor.
- **SQLite FTS5 Index**: Stored in your local app data directory (`mynd_index.db`).
- **Filesystem Watcher**: Background Rust thread powered by `notify` observes filesystem changes (create, edit, rename, delete) and debounces updates straight into the SQLite index.

---

## 9. Troubleshooting & FAQ

#### Q: Where are my notes saved on disk?
Click the folder icon in the File Explorer header ("Open notes directory") to open the exact folder on your system.

#### Q: How do I backup my notes?
Because all notes are plain files, you can simply back up the notes directory using Git, Dropbox, Google Drive, OneDrive, or an external drive.

#### Q: Why are my changes made in an external editor not showing?
The built-in filesystem watcher automatically detects external modifications and updates the index. If an external change is not reflected immediately, click the **Reindex** button in the Search panel.

#### Q: How do I open multiple notes at the same time?
Clicking notes in the File Explorer opens them as tabs in the top tab bar. Click any tab to switch between active notes, or click the `x` on a tab to close it.
