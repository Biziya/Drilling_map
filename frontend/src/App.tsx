import { Suspense, lazy, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import ToastContainer from "./components/Toast/ToastContainer";
import DrillMap from "./pages/DrillMap/DrillMap";
import TechnoMap from "./pages/TechnoMap/TechnoMap";
import { APP_CONFIG } from "./config/app";
import type { AppPageId } from "./config/app";

/**
 * Loaded on demand. The dashboard brings ECharts and a query client with
 * it — about 200 kB gzipped, more than double the rest of the application
 * — and someone who only ever opens a map should not pay for that. The two
 * map pages are eager, as they were: they are the landing page.
 */
const WeeklyGeos = lazy(() => import("./pages/WeeklyGeos/WeeklyGeos"));

function App() {
  const [activePage, setActivePage] = useState<AppPageId>("drill-map");
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
        isSidebarCollapsed ? "" : " sidebar:grid-cols-[220px_minmax(0,1fr)]"
      }`}
    >
      <Sidebar
        activePage={activePage}
        isCollapsed={isSidebarCollapsed}
        onNavigate={setActivePage}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
      />

      <main className="min-h-0 min-w-0 overflow-hidden">
        {activePage === "drill-map" && <DrillMap />}
        {activePage === "techno-map" && <TechnoMap />}
        {(activePage === "drilling-details" ||
          activePage === "drilling-by-rigs") && (
          <Suspense
            fallback={<p className="p-6 text-muted">Loading dashboard…</p>}
          >
            <WeeklyGeos
              dimension={activePage === "drilling-by-rigs" ? "rig" : "category"}
            />
          </Suspense>
        )}
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;
