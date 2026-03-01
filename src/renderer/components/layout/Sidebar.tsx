import { useUIStore, type ActiveView } from '../../store/ui-store';
import type { ScannerType } from '../../../main/scanners/types';

interface ScannerInfo {
  type: ScannerType;
  label: string;
  shortLabel: string;
  description: string;
}

const SCANNERS: ScannerInfo[] = [
  {
    type: 'system-junk',
    label: 'System Junk',
    shortLabel: 'SYS',
    description: 'Temp files, caches, logs',
  },
  {
    type: 'browser-cache',
    label: 'Browser Cache',
    shortLabel: 'BRW',
    description: 'Web browser data',
  },
  {
    type: 'duplicates',
    label: 'Duplicates',
    shortLabel: 'DUP',
    description: 'Identical files',
  },
  {
    type: 'big-files',
    label: 'Big Files',
    shortLabel: 'BIG',
    description: 'Largest files on disk',
  },
  {
    type: 'empty-items',
    label: 'Empty Items',
    shortLabel: 'MTY',
    description: 'Empty folders & zero-byte files',
  },
  {
    type: 'stale-files',
    label: 'Stale Files',
    shortLabel: 'OLD',
    description: 'Untouched for months',
  },
  {
    type: 'app-leftovers',
    label: 'App Leftovers',
    shortLabel: 'APP',
    description: 'Orphaned uninstall data',
  },
  {
    type: 'registry',
    label: 'Registry',
    shortLabel: 'REG',
    description: 'MRU lists, shell history',
  },
];

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const handleClick = (view: ActiveView) => {
    setActiveView(view);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-title">Bloat Hunter</span>}
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${activeView === 'dashboard' ? 'sidebar-item--active' : ''}`}
          onClick={() => handleClick('dashboard')}
        >
          <span className="sidebar-icon sidebar-icon--dashboard">
            {collapsed ? '\u25A3' : '\u25A3'}
          </span>
          {!collapsed && (
            <div className="sidebar-item-text">
              <span className="sidebar-item-label">Dashboard</span>
              <span className="sidebar-item-desc">Overview & summary</span>
            </div>
          )}
        </button>

        <div className="sidebar-divider" />

        {SCANNERS.map((scanner) => (
          <button
            key={scanner.type}
            className={`sidebar-item ${activeView === scanner.type ? 'sidebar-item--active' : ''}`}
            onClick={() => handleClick(scanner.type)}
          >
            <span className="sidebar-icon">
              {collapsed ? scanner.shortLabel : scanner.shortLabel}
            </span>
            {!collapsed && (
              <div className="sidebar-item-text">
                <span className="sidebar-item-label">{scanner.label}</span>
                <span className="sidebar-item-desc">{scanner.description}</span>
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-divider" />
        <button
          className={`sidebar-item ${activeView === 'settings' ? 'sidebar-item--active' : ''}`}
          onClick={() => handleClick('settings')}
        >
          <span className="sidebar-icon">{collapsed ? '\u2699' : '\u2699'}</span>
          {!collapsed && (
            <div className="sidebar-item-text">
              <span className="sidebar-item-label">Settings</span>
              <span className="sidebar-item-desc">Preferences & API keys</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
