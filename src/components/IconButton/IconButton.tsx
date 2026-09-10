import React from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  icon: React.ReactNode;
  title?: string;
  isActive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  title,
  isActive = false,
  onClick,
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
}) => {
  const combinedClasses = `${styles.button} ${styles[size]} ${isActive ? styles.active : ''} ${className || ''}`.trim();

  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};

export default IconButton;
