import { EditorView, KeyBinding } from '@codemirror/view';
import { EditorSelection, ChangeSpec } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';

/**
 * Surrounds the selected text with formatting markers (e.g. `**` for bold),
 * or unwraps it if already surrounded by those markers.
 * If no text is selected, inserts the markers with the cursor in the middle.
 */
export function toggleInlineWrap(
  view: EditorView,
  before: string,
  after: string = before
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const newRanges = [];

  for (const range of state.selection.ranges) {
    if (range.empty) {
      // Empty selection: insert markers and place cursor between them
      changes.push({ from: range.from, insert: before + after });
      newRanges.push(EditorSelection.cursor(range.from + before.length));
    } else {
      const selectedText = state.sliceDoc(range.from, range.to);

      // Check if text itself has the wrapping markers
      if (
        selectedText.startsWith(before) &&
        selectedText.endsWith(after) &&
        selectedText.length >= before.length + after.length
      ) {
        // Unwrap inside selection
        const unwrapped = selectedText.slice(
          before.length,
          selectedText.length - after.length
        );
        changes.push({ from: range.from, to: range.to, insert: unwrapped });
        newRanges.push(
          EditorSelection.range(range.from, range.from + unwrapped.length)
        );
        continue;
      }

      // Check if characters immediately surrounding selection are the markers
      const charBefore = state.sliceDoc(
        Math.max(0, range.from - before.length),
        range.from
      );
      const charAfter = state.sliceDoc(
        range.to,
        Math.min(state.doc.length, range.to + after.length)
      );

      if (charBefore === before && charAfter === after) {
        // Unwrap surrounding markers
        changes.push(
          { from: range.from - before.length, to: range.from, insert: '' },
          { from: range.to, to: range.to + after.length, insert: '' }
        );
        newRanges.push(
          EditorSelection.range(
            range.from - before.length,
            range.to - before.length
          )
        );
      } else {
        // Wrap selection
        changes.push({
          from: range.from,
          to: range.to,
          insert: before + selectedText + after,
        });
        newRanges.push(
          EditorSelection.range(
            range.from,
            range.to + before.length + after.length
          )
        );
      }
    }
  }

  view.dispatch(
    state.update({
      changes,
      selection: EditorSelection.create(newRanges),
      scrollIntoView: true,
      userEvent: 'input.format',
    })
  );
  return true;
}

/**
 * Toggles bold formatting (**text**) on current selection or cursor.
 */
export function runToggleBold(view: EditorView): boolean {
  return toggleInlineWrap(view, '**');
}

/**
 * Toggles italic formatting (*text*) on current selection or cursor.
 */
export function runToggleItalic(view: EditorView): boolean {
  return toggleInlineWrap(view, '*');
}

/**
 * Toggles strikethrough (~~text~~) on current selection or cursor.
 */
export function runToggleStrikethrough(view: EditorView): boolean {
  return toggleInlineWrap(view, '~~');
}

/**
 * Toggles inline code (`text`) or code block on current selection.
 */
export function runToggleCode(view: EditorView): boolean {
  const { state } = view;
  const isMultiLine = state.selection.ranges.some((r) =>
    state.sliceDoc(r.from, r.to).includes('\n')
  );

  if (isMultiLine) {
    return toggleInlineWrap(view, '```\n', '\n```');
  }
  return toggleInlineWrap(view, '`');
}

/**
 * Toggles markdown heading level (# Heading, ## Heading, etc.) across all lines
 * touched by the selection. If the line already has the specified heading level,
 * it removes the heading (reverts to paragraph).
 */
export function runToggleHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const targetPrefix = '#'.repeat(level) + ' ';
  const changes: ChangeSpec[] = [];

  const touchedLineNumbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      touchedLineNumbers.add(l);
    }
  }

  const sortedLines = Array.from(touchedLineNumbers).sort((a, b) => a - b);

  for (const lineNum of sortedLines) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;

    // Match existing heading prefix (e.g. "# ", "## ", etc.)
    const headingMatch = lineText.match(/^(#{1,6})\s+/);

    if (headingMatch) {
      const existingLevel = headingMatch[1].length;
      if (existingLevel === level) {
        // Remove heading prefix (toggle off)
        changes.push({
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: '',
        });
      } else {
        // Replace with new heading level
        changes.push({
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: targetPrefix,
        });
      }
    } else {
      // Prepend heading prefix
      changes.push({
        from: line.from,
        to: line.from,
        insert: targetPrefix,
      });
    }
  }

  view.dispatch(
    state.update({
      changes,
      scrollIntoView: true,
      userEvent: 'input.format',
    })
  );
  return true;
}

/**
 * Toggles list formatting (bullet, numbered, or task checklist) on lines
 * touched by the current selection.
 */
export function runToggleList(
  view: EditorView,
  listType: 'bullet' | 'number' | 'task'
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];

  const touchedLineNumbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      touchedLineNumbers.add(l);
    }
  }

  const sortedLines = Array.from(touchedLineNumbers).sort((a, b) => a - b);
  let itemIndex = 1;

  for (const lineNum of sortedLines) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;

    // Match any existing list markers (bullet, numbered, or task checkbox)
    const listMatch = lineText.match(
      /^(\s*)([-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/
    );

    if (listMatch) {
      const indent = listMatch[1];
      const marker = listMatch[2];

      const isCurrentBullet =
        (marker.startsWith('- ') || marker.startsWith('* ')) &&
        !marker.includes('[');
      const isCurrentNumbered = /^\d+[.)]\s+/.test(marker);
      const isCurrentTask = marker.includes('[');

      // If already of the requested type, toggle off (remove list marker)
      if (
        (listType === 'bullet' && isCurrentBullet) ||
        (listType === 'number' && isCurrentNumbered) ||
        (listType === 'task' && isCurrentTask)
      ) {
        changes.push({
          from: line.from + indent.length,
          to: line.from + listMatch[0].length,
          insert: '',
        });
        continue;
      }

      // Convert to requested type
      let newMarker = '- ';
      if (listType === 'number') {
        newMarker = `${itemIndex++}. `;
      } else if (listType === 'task') {
        newMarker = '- [ ] ';
      }

      changes.push({
        from: line.from + indent.length,
        to: line.from + listMatch[0].length,
        insert: newMarker,
      });
    } else {
      // Add new list marker
      const indentMatch = lineText.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      let newMarker = '- ';
      if (listType === 'number') {
        newMarker = `${itemIndex++}. `;
      } else if (listType === 'task') {
        newMarker = '- [ ] ';
      }

      changes.push({
        from: line.from + indent.length,
        to: line.from + indent.length,
        insert: newMarker,
      });
    }
  }

  view.dispatch(
    state.update({
      changes,
      scrollIntoView: true,
      userEvent: 'input.format',
    })
  );
  return true;
}

/**
 * Toggles blockquote (`> `) on lines touched by selection.
 */
export function runToggleBlockquote(view: EditorView): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];

  const touchedLineNumbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      touchedLineNumbers.add(l);
    }
  }

  for (const lineNum of Array.from(touchedLineNumbers).sort((a, b) => a - b)) {
    const line = state.doc.line(lineNum);
    if (line.text.startsWith('> ')) {
      changes.push({ from: line.from, to: line.from + 2, insert: '' });
    } else {
      changes.push({ from: line.from, to: line.from, insert: '> ' });
    }
  }

  view.dispatch(
    state.update({
      changes,
      scrollIntoView: true,
      userEvent: 'input.format',
    })
  );
  return true;
}

/**
 * Deletes current selection if non-empty.
 */
export function runDeleteSelection(view: EditorView): boolean {
  const { state } = view;
  if (state.selection.main.empty) return false;

  const changes = state.selection.ranges
    .filter((r) => !r.empty)
    .map((r) => ({ from: r.from, to: r.to, insert: '' }));

  if (changes.length === 0) return false;

  view.dispatch(
    state.update({
      changes,
      selection: EditorSelection.cursor(state.selection.main.from),
      scrollIntoView: true,
      userEvent: 'delete.selection',
    })
  );
  return true;
}

/**
 * Creates full CodeMirror keybindings for text selection actions:
 * - Bold: Ctrl+B / Cmd+B
 * - Italic: Ctrl+I / Cmd+I
 * - Strikethrough: Ctrl+Shift+X / Cmd+Shift+X
 * - Code: Ctrl+E / Cmd+E
 * - Headings: Ctrl+1..6 / Cmd+1..6, Ctrl+Alt+1..6
 * - Bullet list: Ctrl+Shift+8 / Cmd+Shift+8, Ctrl+Shift+U / Cmd+Shift+U, Ctrl+L
 * - Numbered list: Ctrl+Shift+7 / Cmd+Shift+7, Ctrl+Shift+O / Cmd+Shift+O
 * - Task list: Ctrl+Shift+C / Cmd+Shift+C
 * - Blockquote: Ctrl+Shift+. / Cmd+Shift+.
 * - Undo: Ctrl+Z / Cmd+Z
 * - Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
 * - Delete selection: Delete / Backspace
 */
export function createFormattingKeymap(): KeyBinding[] {
  return [
    // Undo / Redo
    { key: 'Mod-z', run: undo, preventDefault: true },
    { key: 'Mod-y', run: redo, preventDefault: true },
    { key: 'Mod-Shift-z', run: redo, preventDefault: true },

    // Bold / Italic / Strike / Code
    {
      key: 'Mod-b',
      run: (view) => runToggleBold(view),
      preventDefault: true,
    },
    {
      key: 'Mod-i',
      run: (view) => runToggleItalic(view),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-x',
      run: (view) => runToggleStrikethrough(view),
      preventDefault: true,
    },
    {
      key: 'Mod-e',
      run: (view) => runToggleCode(view),
      preventDefault: true,
    },

    // Headings (Mod-1 through Mod-6 and Mod-Alt-1..6)
    {
      key: 'Mod-1',
      run: (view) => runToggleHeading(view, 1),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-1',
      run: (view) => runToggleHeading(view, 1),
      preventDefault: true,
    },
    {
      key: 'Mod-2',
      run: (view) => runToggleHeading(view, 2),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-2',
      run: (view) => runToggleHeading(view, 2),
      preventDefault: true,
    },
    {
      key: 'Mod-3',
      run: (view) => runToggleHeading(view, 3),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-3',
      run: (view) => runToggleHeading(view, 3),
      preventDefault: true,
    },
    {
      key: 'Mod-4',
      run: (view) => runToggleHeading(view, 4),
      preventDefault: true,
    },
    {
      key: 'Mod-5',
      run: (view) => runToggleHeading(view, 5),
      preventDefault: true,
    },
    {
      key: 'Mod-6',
      run: (view) => runToggleHeading(view, 6),
      preventDefault: true,
    },

    // Lists
    {
      key: 'Mod-Shift-8',
      run: (view) => runToggleList(view, 'bullet'),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-u',
      run: (view) => runToggleList(view, 'bullet'),
      preventDefault: true,
    },
    {
      key: 'Mod-l',
      run: (view) => runToggleList(view, 'bullet'),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-7',
      run: (view) => runToggleList(view, 'number'),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-o',
      run: (view) => runToggleList(view, 'number'),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-c',
      run: (view) => runToggleList(view, 'task'),
      preventDefault: true,
    },

    // Blockquote
    {
      key: 'Mod-Shift-.',
      run: (view) => runToggleBlockquote(view),
      preventDefault: true,
    },

    // Delete selection
    {
      key: 'Delete',
      run: (view) => {
        if (!view.state.selection.main.empty) {
          return runDeleteSelection(view);
        }
        return false;
      },
    },
  ];
}
