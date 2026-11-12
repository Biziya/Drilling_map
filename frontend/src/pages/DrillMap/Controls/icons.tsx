// The Exploration Map's control icons, shared by the controls and the help dialog
// so the help shows exactly what is on screen.

const TOOLBAR_ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const HEADER_ICON = { ...TOOLBAR_ICON, strokeWidth: 2.2 } as const;

/** Two curved arrows chasing each other round a circle. */
export function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg className={`size-4 ${spinning ? 'motion-safe:animate-spin' : ''}`} {...HEADER_ICON} data-icon="refresh">
      <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/** Two stacked sheets: map layers. */
export function LayersIcon() {
  return (
    <svg className="size-4" {...HEADER_ICON} data-icon="layers">
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

/** A ruler laid diagonally, with tick marks. */
export function RulerIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <path d="M3 17 17 3l4 4L7 21z" />
      <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
    </svg>
  );
}

/** A camera: the export is a picture of the current view. */
export function CameraIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <path d="M14.5 4h-5L7 7H4v13h16V7h-3z" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** The help button: a question mark in a circle. */
export function HelpIcon() {
  return (
    <svg {...HEADER_ICON}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.4-2.6 4" />
      <path d="M12 17.4h.01" />
    </svg>
  );
}
