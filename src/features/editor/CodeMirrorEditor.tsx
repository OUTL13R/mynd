import React from 'react';
import CodeMirror, { EditorView, scrollPastEnd } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDark?: boolean;
}

// VS Code / Obsidian styled theme extension
const vsObsidianTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace)",
  },
  '.cm-scroller': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace)",
    lineHeight: '1.65',
    padding: '8px 0 24px 0',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    padding: '0 16px',
    maxWidth: '900px',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text-primary)',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
    paddingRight: '4px',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '32px',
    textAlign: 'right',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-hover)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--bg-active) !important',
  },
  // Obsidian / VS Code markdown heading styles
  '.cm-header-1': { fontSize: '1.45em', fontWeight: '700', lineHeight: '1.3' },
  '.cm-header-2': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.35' },
  '.cm-header-3': { fontSize: '1.12em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-link': { textDecoration: 'underline', color: 'var(--text-secondary)' },
  '.cm-strong': { fontWeight: '700', color: 'var(--text-primary)' },
  '.cm-emphasis': { fontStyle: 'italic', color: 'var(--text-secondary)' },
  '.cm-quote': { color: 'var(--text-secondary)', fontStyle: 'italic' },
  '.cm-monospace': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    backgroundColor: 'var(--bg-elevated)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  // Fold gutter markers
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
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
  const baseTheme = isDark ? vscodeDark : vscodeLight;

  const extensions = [
    markdown({ base: markdownLanguage }),
    baseTheme,
    vsObsidianTheme,
    EditorView.lineWrapping, // Obsidian-style auto word wrap
    scrollPastEnd(),        // VS Code-style scroll past the end of document
  ];

  return (
    <div className="codemirror-wrapper">
      <CodeMirror
        value={value}
        height="100%"
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
