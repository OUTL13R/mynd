import React from 'react';
import CodeMirror, { EditorView, scrollPastEnd } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDark?: boolean;
}

// Pure monochromatic Obsidian / VS Code editor styling — NO line separator, NO color themes
const monoEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace)",
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-base)',
  },
  '.cm-scroller': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace)",
    lineHeight: '1.65',
    padding: '12px 0 32px 0',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    padding: '0 24px 0 8px',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text-primary)',
    borderLeftWidth: '2px',
  },
  // NO line between line numbers and code editor:
  '.cm-gutters': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRight: 'none !important',
    color: 'var(--text-muted) !important',
    paddingRight: '6px',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 14px',
    minWidth: '28px',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontSize: '11px',
    opacity: 0.6,
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
    color: 'var(--text-primary) !important',
    opacity: '1 !important',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-hover) !important',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--bg-hover)',
    borderRadius: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--bg-active) !important',
  },
  // Monochromatic markdown typography (Obsidian-style)
  '.cm-header-1': { fontSize: '1.4em', fontWeight: '700', color: 'var(--text-primary)' },
  '.cm-header-2': { fontSize: '1.22em', fontWeight: '600', color: 'var(--text-primary)' },
  '.cm-header-3': { fontSize: '1.1em', fontWeight: '600', color: 'var(--text-primary)' },
  '.cm-link': { textDecoration: 'underline', color: 'var(--text-secondary)' },
  '.cm-strong': { fontWeight: '700', color: 'var(--text-primary)' },
  '.cm-emphasis': { fontStyle: 'italic', color: 'var(--text-secondary)' },
  '.cm-quote': { color: 'var(--text-secondary)', fontStyle: 'italic' },
  '.cm-monospace': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    backgroundColor: 'var(--bg-elevated)',
    padding: '1px 4px',
    borderRadius: '3px',
    color: 'var(--text-primary)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 2px',
    cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--text-primary)',
  },
});

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing note in markdown...',
  isDark = true
}) => {
  const extensions = [
    markdown({ base: markdownLanguage }),
    monoEditorTheme,
    EditorView.lineWrapping, // Obsidian-style auto word wrap
    scrollPastEnd(),        // VS Code-style scroll past the end
  ];

  return (
    <div className="codemirror-wrapper">
      <CodeMirror
        value={value}
        height="100%"
        theme={isDark ? 'dark' : 'light'}
        extensions={extensions}
        onChange={onChange}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
};
