import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Theme } from './types';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  theme: Theme;
  placeholder?: string;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  theme,
  placeholder = 'Start typing markdown...'
}) => {
  const extensions = [
    markdown({ base: markdownLanguage })
  ];

  // Select extension theme if applicable
  const themeExtension = theme !== 'minimal-light' ? [oneDark] : [];

  return (
    <div className="codemirror-wrapper">
      <CodeMirror
        value={value}
        height="100%"
        theme={themeExtension}
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
