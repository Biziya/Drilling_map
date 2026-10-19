import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import DrillMap from './pages/DrillMap/DrillMap';
import TechnoMap from './pages/TechnoMap/TechnoMap';
import { APP_PAGE_IDS, APP_TITLE } from './appConfig';
import type { AppPageId } from './appConfig';

function App() {
  const [activePage, setActivePage] = useState<AppPageId>(APP_PAGE_IDS.drillMap);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Keeps the browser tab title correct even if index.html still ships the
  // old placeholder title.
  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  return (
    <div className={`app-layout${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <Sidebar
        activePage={activePage}
        isCollapsed={isSidebarCollapsed}
        onNavigate={setActivePage}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="app-content">
        {activePage === APP_PAGE_IDS.drillMap && <DrillMap />}
        {activePage === APP_PAGE_IDS.technoMap && <TechnoMap />}
      </main>
    </div>
  );
}

export default App;
