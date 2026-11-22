import { APP_CONFIG } from '../../config/app';
import type { AppPageId } from '../../config/app';
import { APP_VERSION } from '../../config/version';
import { useBackendStatus } from '../../state/backendStatus';
import type { BackendStatus } from '../../state/backendStatus';
import SidebarIcon from './SidebarIcon';
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
        {/* The whole header is the collapse toggle: a large target, not a small arrow. */}
        <button
          className="sidebar__toggle"
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <span className="sidebar__brand-mark" aria-hidden="true">D</span>
          <span className="sidebar__brand-text" aria-hidden="true">{APP_CONFIG.title}</span>
          <span className="sidebar__collapse" aria-hidden="true">{isCollapsed ? '»' : '«'}</span>
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
            // Collapsed, only the icon shows: the page name appears beside it on
            // hover or focus (a CSS tooltip), so the native title is left out.
            title={isCollapsed ? undefined : item.label}
            data-tooltip={item.label}
          >
            <SidebarIcon name={item.icon} />
            <span className="sidebar__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <p
        className={`sidebar__status is-${backendStatus}`}
        role="status"
        title={`Backend: ${statusLabel} · Version ${APP_VERSION}`}
      >
        <span className="sidebar__status-dot" aria-hidden="true" />
        <span className="sidebar__label">{statusLabel}</span>
      </p>
      {/* The website version (VERSION at the repository root); hidden when collapsed, where the status tooltip carries it. */}
      <p className="sidebar__version">v{APP_VERSION}</p>
    </aside>
  );
}

export default Sidebar;
