import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

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
  isDark = true
}) => {
  const extensions = [
    markdown({ base: markdownLanguage }),
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
