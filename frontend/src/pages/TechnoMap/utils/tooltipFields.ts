// The TechnoMap hover popup's rows, which are also the selection table's
// columns: label, how each value is read and formatted from an already-loaded
// API record, and how the column sorts. Shared by the popup, the table and
// their tests.

import { dateColumn as date, measureColumn as measure, notYetAvailable, textColumn as text } from '../../../components/SelectionTable/columns';
import type { DrillholeColumn } from '../../../components/SelectionTable/columns';

export type { DrillholeColumn, Read, SortKind } from '../../../components/SelectionTable/columns';

/**
 * The popup rows, in the agreed order, under the ID title (Screen max depth
 * once, though the request listed it twice). Fields with no data source yet are
 * `notYetAvailable`; connecting one later means giving it a reader. Built
 * once, not per hover.
 */
export const TOOLTIP_FIELDS: readonly DrillholeColumn[] = [
  { label: 'Key', ...text('holeId') },
  { label: 'Type', ...text('holePurpose') },
  { label: 'License', ...text('license') },
  { label: 'Stratigraphic Unit', ...text('stratigraphicUnit') },
  { label: 'X (m)', ...measure('x') },
  { label: 'Y (m)', ...measure('y') },
  // No verified source: the API's `z` is the well-head topo level, below.
  { label: 'Z (m)', ...notYetAvailable },
  { label: 'Z (well head-topo) (m)', ...measure('z') },
  { label: 'Screen min depth (m)', ...measure('screenMinDepth') },
  { label: 'Screen max depth (m)', ...measure('screenMaxDepth') },
  { label: 'Screen length (m)', ...measure('screenLength') },
  { label: 'Screen top altitude (m)', ...measure('screenTopAltitude') },
  { label: 'Status', ...text('holeStatus') },
  { label: 'Drilling Company', ...text('drillingCompany') },
  { label: 'Drilling Rig', ...text('drillingRig') },
  { label: 'Start Date', ...date('startDate') },
  { label: 'End Date', ...date('endDate') },
  { label: 'Billing Time', ...date('billingDate', true) },
  { label: 'Relative level', ...text('relativeLevel') },
  { label: 'Mining level', ...notYetAvailable },
  { label: 'Associated Production cells', ...notYetAvailable },
  { label: 'Development Flowrates (m³/h)', ...notYetAvailable },
];
