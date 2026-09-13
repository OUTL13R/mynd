import React from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { Icons } from '../Icons';
import { IconButton } from '../IconButton/IconButton';
import styles from './Panel.module.css';

export interface PanelProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  onClose?: () => void;
  draggable?: boolean;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  width = 240,
  onClose,
  draggable = false,
  className = '',
}) => {
  const { containerRef, handleRef, position } = useDraggable();

  const panelClassName = `${styles.panel} ${draggable ? styles.panelFloating : ''} ${className || ''}`.trim();
  const headerClassName = `${styles.header} ${draggable ? styles.headerDraggable : ''}`.trim();

  const containerStyle: React.CSSProperties = {
    position: draggable ? 'absolute' : 'relative',
    left: draggable ? position?.x : undefined,
    top: draggable ? position?.y : undefined,
    width: width || 240,
  };

  return (
    <div ref={containerRef} className={panelClassName} style={containerStyle}>
      <div ref={handleRef} className={headerClassName}>
        {draggable && (
          <span className={styles.grip}>
            <Icons.GripVertical />
          </span>
        )}
        <span className={styles.title}>{title}</span>
        {onClose && (
          <IconButton
            icon={<Icons.X />}
            size="sm"
            title="Close"
            onClick={onClose}
          />
        )}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default Panel;
