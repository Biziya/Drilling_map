// The Exploration Map's tooltip rows, which are also its selection table's
// columns: only what /api/exploration-map returns (ExplorationMapDto), read
// through drillholeFields so camelCase and PascalCase payloads show the same.

import { measureColumn, numberColumn, textColumn, toNumber } from '../../../components/SelectionTable/columns';
import type { ColumnSpec, DrillholeColumn } from '../../../components/SelectionTable/columns';
import { readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

const gtFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });

/** GT keeps up to four decimals: its bands start at 0.025. */
const gtColumn: ColumnSpec = (() => {
  const sortValue = (drillhole: DrillholeApiRecord) => toNumber(readDrillholeValue(drillhole, 'gt'));

  return {
    read: (drillhole) => {
      const value = sortValue(drillhole);

      return value === null ? null : gtFormat.format(value);
    },
    sort: 'number',
    sortValue,
    available: true,
  };
})();

/** Every row in the tooltip and every column of the table, in this order. */
export const EXPLORATION_FIELDS: readonly DrillholeColumn[] = [
  { label: 'Hole ID', ...textColumn('holeId') },
  { label: 'Hole Purpose', ...textColumn('holePurpose') },
  { label: 'Hole Status', ...textColumn('holeStatus') },
  { label: 'X (m)', ...measureColumn('x') },
  { label: 'Y (m)', ...measureColumn('y') },
  { label: 'Z (m)', ...measureColumn('z') },
  { label: 'Coordinate Type', ...textColumn('coordinateType') },
  // Text, so 2026 never gains a thousands separator; four digits sort correctly as text.
  { label: 'Year', ...textColumn('year') },
  { label: 'Campaign', ...textColumn('campaign') },
  { label: 'GT', ...gtColumn },
  { label: 'Max Depth (m)', ...measureColumn('maxDepth') },
  { label: 'Azimuth', ...numberColumn('azimuth', 2) },
  { label: 'Final Deviation (m)', ...measureColumn('finalDeviation') },
];

/** Where the hidden table columns are remembered, per browser. */
export const TABLE_COLUMNS_STORAGE_KEY = 'exploration-map:table-columns';

/** Table export file names start with this. */
export const TABLE_EXPORT_PREFIX = 'ExplorationMap_selection';
