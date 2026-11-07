export interface RefreshButtonProps {
  /** True while any request for this map runs; further clicks are ignored. */
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Header control that asks the backend for fresh data. Only the icon spins
 * (clockwise, and not at all under reduced motion), never the button.
 */
function RefreshButton({ isRefreshing, onRefresh }: RefreshButtonProps) {
  return (
    <button
      type="button"
      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-paper/95 text-muted hover:bg-control-hover hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:text-disabled disabled:bg-control-disabled"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-busy={isRefreshing}
      aria-label="Refresh map data"
      title="Refresh map data"
    >
      {/* Two curved arrows chasing each other round a circle. */}
      <svg
        className={`size-4 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        data-icon="refresh"
      >
        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
    </button>
  );
}

export default RefreshButton;
