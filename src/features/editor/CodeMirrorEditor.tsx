import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { createFormattingKeymap } from './markdownCommands';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isDark?: boolean;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  isDark = true,
}) => {
  const extensions = useMemo(() => {
    return [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      Prec.highest(keymap.of(createFormattingKeymap())),
      EditorView.theme({
        '&': {
          height: '100%',
        },
        '.cm-content': {
          whiteSpace: 'pre-wrap !important',
          wordBreak: 'break-word !important',
          overflowWrap: 'break-word !important',
          padding: '12px 18px',
        },
        '.cm-line': {
          wordBreak: 'break-word !important',
          overflowWrap: 'break-word !important',
          lineHeight: '1.65',
        },
        // Elevate selection layer so it is always rendered clearly
        '.cm-selectionLayer': {
          zIndex: '2 !important',
          pointerEvents: 'none !important',
        },
        // Prominent selection highlight for single characters, words, or sentences
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: isDark
            ? 'rgba(59, 130, 246, 0.45) !important'
            : 'rgba(59, 130, 246, 0.35) !important',
          borderRadius: '2px',
        },
        // Highlight other occurrences of the selected word/character across the note
        '.cm-selectionMatch': {
          backgroundColor: isDark
            ? 'rgba(234, 179, 8, 0.35) !important'
            : 'rgba(234, 179, 8, 0.28) !important',
          outline: isDark
            ? '1px solid rgba(234, 179, 8, 0.7) !important'
            : '1px solid rgba(234, 179, 8, 0.6) !important',
          borderRadius: '2px',
        },
        '::selection, .cm-content ::selection, .cm-line ::selection': {
          backgroundColor: isDark
            ? 'rgba(59, 130, 246, 0.45) !important'
            : 'rgba(59, 130, 246, 0.35) !important',
          color: 'inherit !important',
        },
      }),
    ];
  }, [isDark]);

  return (
    <div
      className="codemirror-wrapper"
      style={{ position: 'relative', height: '100%', width: '100%' }}
    >
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
          highlightActiveLine: false,
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
