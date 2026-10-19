import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/Toast/ToastContainer';
import DrillMap from './pages/DrillMap/DrillMap';
import TechnoMap from './pages/TechnoMap/TechnoMap';
import { APP_CONFIG } from './config/app';
import type { AppPageId } from './config/app';

function App() {
  const [activePage, setActivePage] = useState<AppPageId>('drill-map');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Keeps the browser tab title correct even if index.html still ships the
  // old placeholder title.
  useEffect(() => {
    document.title = APP_CONFIG.title;
  }, []);

  // The sidebar is always narrow below the `sidebar` breakpoint.
  return (
    <div
      className={`grid h-dvh w-full grid-cols-[64px_minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-160 ease-in-out${
        isSidebarCollapsed ? '' : ' sidebar:grid-cols-[220px_minmax(0,1fr)]'
      }`}
    >
      <Sidebar
        activePage={activePage}
        isCollapsed={isSidebarCollapsed}
        onNavigate={setActivePage}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="min-h-0 min-w-0 overflow-hidden">
        {activePage === 'drill-map' && <DrillMap />}
        {activePage === 'techno-map' && <TechnoMap />}
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;
