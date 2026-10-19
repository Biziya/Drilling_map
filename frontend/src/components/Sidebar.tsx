import { APP_CONFIG } from '../config/app';
import type { AppPageId } from '../config/app';
import { useBackendStatus } from '../state/backendStatus';
import type { BackendStatus } from '../state/backendStatus';
import './Sidebar.css';

const STATUS_LABELS: Readonly<Record<BackendStatus, string>> = {
  checking: 'Checking…',
  online: 'Online',
  offline: 'Offline',
};

export interface SidebarProps {
  activePage: AppPageId;
  isCollapsed: boolean;
  onNavigate: (page: AppPageId) => void;
  onToggle: () => void;
}

function Sidebar({ activePage, isCollapsed, onNavigate, onToggle }: SidebarProps) {
  const backendStatus = useBackendStatus();
  const statusLabel = STATUS_LABELS[backendStatus];

  return (
    <aside className={`sidebar${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar__brand" aria-label={APP_CONFIG.title}>
        <span className="sidebar__brand-mark">D</span>
        <span className="sidebar__brand-text">{APP_CONFIG.title}</span>
        <button
          className="sidebar__collapse"
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <span aria-hidden="true">{isCollapsed ? '»' : '«'}</span>
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {APP_CONFIG.navigation.map((item) => (
          <button
            key={item.id}
            className={`sidebar__link${activePage === item.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? 'page' : undefined}
            title={item.label}
          >
            <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <p
        className={`sidebar__status is-${backendStatus}`}
        role="status"
        title={`Backend: ${statusLabel}`}
      >
        <span className="sidebar__status-dot" aria-hidden="true" />
        <span className="sidebar__label">{statusLabel}</span>
      </p>
    </aside>
  );
}

export default Sidebar;
