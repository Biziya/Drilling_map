import { APP_PAGE_IDS, APP_TITLE } from '../appConfig';
import type { AppPageId } from '../appConfig';
import './Sidebar.css';

interface NavItem {
  id: AppPageId;
  label: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: APP_PAGE_IDS.drillMap, label: 'Exploration Map', icon: '⌖' },
  { id: APP_PAGE_IDS.technoMap, label: 'Techno Map', icon: '⌖' },
];

export interface SidebarProps {
  activePage: AppPageId;
  isCollapsed: boolean;
  onNavigate: (page: AppPageId) => void;
  onToggle: () => void;
}

function Sidebar({ activePage, isCollapsed, onNavigate, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar__brand" aria-label={APP_TITLE}>
        <span className="sidebar__brand-mark">D</span>
        <span className="sidebar__brand-text">{APP_TITLE}</span>
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
        {NAV_ITEMS.map((item) => (
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
    </aside>
  );
}

export default Sidebar;
