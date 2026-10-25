import data from './weeklyGeos.yaml';
import { number, object, parseConfig, text } from '../../../config/schema';

/**
 * Validated once at module load, the same way the two map pages read their
 * own YAML. An unreadable value fails here with a named path rather than
 * surfacing later as a NaN in a query key.
 */
export const WEEKLY_GEOS_CONFIG = parseConfig(
  object({
    titles: object({ category: text, rig: text }),
    defaultYear: number,
    staleTimeMs: number,
  }),
  data,
  'weeklyGeos.yaml',
);
