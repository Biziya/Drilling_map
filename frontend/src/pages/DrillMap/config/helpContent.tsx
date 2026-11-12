// What the Exploration Map's help dialog says: every shortcut and every
// button. Button names match the controls' accessible names, which the page
// test checks, so a new toolbar button cannot ship without a description here.

import type { HelpSection } from '../../../components/HelpDialog/help';
import { CameraIcon, HelpIcon, LayersIcon, RefreshIcon, RulerIcon } from '../Controls/icons';

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
      { keys: ['Click'], action: "Show or hide the hole's details. Clicking elsewhere closes them." },
    ],
  },
  {
    title: 'Keys',
    shortcuts: [
      { keys: ['Esc'], action: 'Cancel a screenshot, close a menu or this help.' },
      { keys: ['?'], action: 'Open this help.' },
    ],
  },
  {
    title: 'Header buttons',
    buttons: [
      { icon: <RefreshIcon />, name: 'Refresh map data', description: 'Reload the drillholes. The map and your view stay as they are.' },
      { icon: <LayersIcon />, name: 'Base map', description: 'Switch the background between the Redox Map (the default), the Geological Map and the white coordinate grid. Switching to another image recentres the map and clears the measurement.' },
      { icon: <HelpIcon />, name: 'Help', description: 'Show this list of shortcuts and buttons.' },
    ],
  },
  {
    title: 'Map toolbar',
    buttons: [
      { icon: '+', name: 'Zoom in', description: 'Zoom in on the centre of the map.' },
      { icon: '−', name: 'Zoom out', description: 'Zoom out from the centre of the map.' },
      { icon: '⤢', name: 'Reset', description: 'Go back to the starting view.' },
      {
        icon: <RulerIcon />,
        name: 'Measure distance',
        description: 'Click point A, then point B to see the distance. A third click starts again. Turning it off clears the line.',
      },
      { icon: <CameraIcon />, name: 'Screenshot map', description: 'Drag over the area to export, then choose PNG or SVG.' },
    ],
  },
];
