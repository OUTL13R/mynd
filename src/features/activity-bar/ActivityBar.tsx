import React from 'react';
import { ActiveView } from '../../types';
import { Icons } from '../../components/Icons';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './ActivityBar.module.css';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  activeView,
  setActiveView,
  isSidebarOpen,
  setSidebarOpen,
  isDark,
  toggleTheme
}) => {
  const handleSidebarTab = (tab: string) => {
    if (activeView === 'editor' && activeTab === tab && isSidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActiveTab(tab);
      setActiveView('editor');
      setSidebarOpen(true);
    }
  };

  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <div className={styles.brand}>M</div>

        <IconButton
          icon={<Icons.Folder />}
          title="Files"
          size="sm"
          isActive={activeTab === 'files' && activeView === 'editor' && isSidebarOpen}
          onClick={() => handleSidebarTab('files')}
        />
        <IconButton
          icon={<Icons.Search />}
          title="Search"
          size="sm"
          isActive={activeTab === 'search' && activeView === 'editor' && isSidebarOpen}
          onClick={() => handleSidebarTab('search')}
        />
        <IconButton
          icon={<Icons.Network />}
          title="Graph"
          size="sm"
          isActive={activeTab === 'graph' && activeView === 'editor' && isSidebarOpen}
          onClick={() => handleSidebarTab('graph')}
        />
      </div>

      <div className={styles.bottom}>
        <IconButton
          icon={<Icons.Bot />}
          title="AI"
          size="sm"
          isActive={activeView === 'ai'}
          onClick={() => setActiveView('ai')}
        />
        <div className={styles.divider} />
        <IconButton
          icon={isDark ? <Icons.Sun /> : <Icons.Moon />}
          title={isDark ? 'Light mode' : 'Dark mode'}
          size="sm"
          onClick={toggleTheme}
        />
        <IconButton
          icon={<Icons.Settings />}
          title="Settings"
          size="sm"
        />
      </div>
    </div>
  );
};
