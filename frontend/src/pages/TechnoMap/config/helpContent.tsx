// What the Techno Map's help dialog says: every shortcut and every button.
// Button names match the controls' accessible names, which the page test
// checks, so a new toolbar button cannot ship without a description here.

import type { HelpSection } from '../../../components/HelpDialog/help';
import { BoxSelectIcon, CameraIcon, ChevronDownIcon, ColumnsIcon, DownloadIcon, EyeOffIcon, HelpIcon, LayersIcon, RefreshIcon, RulerIcon } from '../Controls/icons';

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    title: 'Moving around the map',
    shortcuts: [
      { keys: ['Drag'], action: 'Pan the map.' },
      { keys: ['Mouse wheel'], action: 'Zoom in or out around the pointer.' },
      { keys: ['Double-click'], action: 'Zoom in on that spot (not while measuring).' },
    ],
  },
  {
    title: 'Drillholes',
    shortcuts: [
      { keys: ['Hover'], action: "Show the hole's details." },
      { keys: ['Click'], action: 'Pin the details open. Click the hole again, or empty map, to close them.' },
      { keys: ['Ctrl', 'Click'], action: 'Add the hole to the selection, or take it out if already selected.' },
      { keys: ['Area select', 'Drag'], action: 'Add every hole inside the box to the selection.' },
    ],
  },
  {
    title: 'Keys',
    shortcuts: [
      { keys: ['Esc'], action: 'Leave area select, cancel a screenshot, close a menu or this help.' },
      { keys: ['?'], action: 'Open this help.' },
    ],
  },
  {
    title: 'Header buttons',
    buttons: [
      { icon: <RefreshIcon />, name: 'Refresh map data', description: 'Reload the drillholes. The map and your view stay as they are.' },
      { icon: <LayersIcon />, name: 'Base map', description: 'Switch the background between the Geological map and the white coordinate grid.' },
      { icon: <HelpIcon />, name: 'Help', description: 'Show this list of shortcuts and buttons.' },
    ],
  },
  {
    title: 'Map toolbar',
    buttons: [
      { icon: '+', name: 'Zoom in', description: 'Zoom in on the centre of the map.' },
      { icon: '−', name: 'Zoom out', description: 'Zoom out from the centre of the map.' },
      { icon: '⤢', name: 'Reset', description: 'Fit every drillhole in view, whatever the filters.' },
      {
        icon: <RulerIcon />,
        name: 'Measure distance',
        description: 'Click point A, then point B to see the distance. A third click starts again. Turning it off clears the line.',
      },
      {
        icon: <BoxSelectIcon />,
        name: 'Select drillholes by area',
        description: 'Drag boxes on the map to add the holes inside to the selection. Click again or press Esc to stop.',
      },
      { icon: <CameraIcon />, name: 'Screenshot map', description: 'Drag over the area to export, then choose PNG or SVG.' },
    ],
  },
  {
    title: 'Legends panel',
    buttons: [
      { icon: '☑', name: 'Layer checkboxes', description: 'Show or hide each drillhole type and map feature.' },
      { icon: '◐', name: 'Show All / Hide All', description: 'Turn every layer on or off at once.' },
      { icon: '⌄', name: 'Collapse', description: 'Fold the panel away; the filters stay as they are.' },
    ],
  },
  {
    title: 'Selection table',
    buttons: [
      {
        icon: <ChevronDownIcon />,
        name: 'Column header',
        description: 'Sort A → Z / Z → A (text) or ascending / descending (numbers, dates); search values; Select all / Unselect all; tick the values to show. A dot marks a filtered column.',
      },
      { icon: <EyeOffIcon />, name: 'Hide column', description: "In a column's menu: hide that column. At least one column stays visible." },
      { icon: <ColumnsIcon />, name: 'Columns', description: 'Tick columns to show or hide them, or Show all. Remembered in this browser.' },
      {
        icon: <DownloadIcon />,
        name: 'Export',
        description: 'Download the table as Excel (.xlsx) or CSV: only the rows the filters show, in the current order, without hidden columns.',
      },
      { icon: '↵', name: 'Row', description: "Click a row to pin that hole's details on the map." },
      { icon: '×', name: 'Remove', description: 'Take that hole out of the selection.' },
      { icon: '⟲', name: 'Clear filters', description: 'Reset every column filter and the sort.' },
      { icon: '∅', name: 'Clear selection', description: 'Empty the selection and close the table (also the × at the top right).' },
    ],
  },
];
