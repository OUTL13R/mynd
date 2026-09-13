import React from 'react';
import styles from './TextInput.module.css';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  type?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder,
  onSubmit,
  rightElement,
  className = '',
  disabled = false,
  autoFocus = false,
  type = 'text',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  return (
    <div className={`${styles.wrapper} ${className || ''}`.trim()}>
      <input
        type={type}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {rightElement && <div className={styles.rightElement}>{rightElement}</div>}
    </div>
  );
};

export default TextInput;
