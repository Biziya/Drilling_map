import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DrillingDashboard from './DrillingDashboard';
import { WEEKLY_GEOS_CONFIG } from './config/weeklyGeosConfig';
import type { Dimension } from './types/drilling';
import './WeeklyGeos.css';

/**
 * One cache for both Weekly Geos pages, created once at module load rather
 * than per render.
 *
 * Module scope is what makes the two pages worth having in one file: the
 * application shell unmounts a page when you navigate away from it, so a
 * client held in component state would be thrown away and every figure
 * refetched on each visit. Here the cache outlives the mount, and the two
 * pages share it — their queries key on the same filters, so switching
 * between them repaints from cache instead of going back to the backend.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // weekly data; refocusing proves nothing
      retry: 1,
      staleTime: WEEKLY_GEOS_CONFIG.staleTimeMs,
    },
  },
});

export interface WeeklyGeosProps {
  /** Which slicer the metres chart is split by. */
  dimension: Dimension;
}

/**
 * Weekly Geos: the drilling dashboard from the weekly geology report.
 *
 * Both sidebar entries land here, and `dimension` is the only difference
 * between them — the same difference the two pages had in the original
 * report, so there is no second copy of the charts to keep in step.
 */
function WeeklyGeos({ dimension }: WeeklyGeosProps) {
  return (
    <div className="weekly-geos-page">
      <QueryClientProvider client={queryClient}>
        {/* Keyed by dimension. Both sidebar entries render this component
            type in the same tree position, so without a differing key React
            reconciles rather than remounts and the filter state survives
            navigation — the second page stayed filtered by a hole purpose
            chosen on the first, with its own slicer showing nothing
            selected. */}
        <DrillingDashboard key={dimension} dimension={dimension} />
      </QueryClientProvider>
    </div>
  );
}

export default WeeklyGeos;
