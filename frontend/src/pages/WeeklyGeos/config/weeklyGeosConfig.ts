import data from './weeklyGeos.yaml';

interface WeeklyGeosConfig {
  titles: { category: string; rig: string };
  defaultYear: number;
  staleTimeMs: number;
}

export const WEEKLY_GEOS_CONFIG = data as WeeklyGeosConfig;
