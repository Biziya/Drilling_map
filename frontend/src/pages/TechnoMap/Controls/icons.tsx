// The Techno Map's control icons, shared by the controls and the help dialog
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

/** A dashed selection box with a pointer in its corner. */
export function BoxSelectIcon() {
  return (
    <svg {...TOOLBAR_ICON} data-icon="box-select">
      <rect x="3" y="3" width="14" height="14" rx="1" strokeDasharray="3 2.5" />
      <path d="m12 12 9 3.5-3.8 1.3-1.3 3.8z" />
    </svg>
  );
}

/** A camera: the export is a picture of the current view. */
export function CameraIcon() {
  return (
    <svg {...TOOLBAR_ICON} data-icon="camera">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3.5" />
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

/** A down arrow, as on the selection table headers. */
export function ChevronDownIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** A tray with an arrow into it: download. */
export function DownloadIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4" />
    </svg>
  );
}

/** Three columns: show or hide table columns. */
export function ColumnsIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  );
}

/** An eye with a slash: hide. */
export function EyeOffIcon() {
  return (
    <svg {...TOOLBAR_ICON}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 21 21 3" />
    </svg>
  );
}
