import React from 'react';
import { Icons } from '../Icons';
import { IconButton } from '../IconButton/IconButton';
import styles from './TabBar.module.css';

export interface Tab {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  children?: React.ReactNode;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeId,
  onSelect,
  onClose,
  children,
}) => {
  return (
    <div className={styles.tabBar}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => onSelect(tab.id)}
              title={tab.label}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(tab.id);
                }
              }}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              {onClose && (
                <IconButton
                  icon={<Icons.X />}
                  size="sm"
                  title="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
};

export default TabBar;
