export interface RefreshButtonProps {
  /** True while any request for this map runs; further clicks are ignored. */
  isRefreshing: boolean;
  onRefresh: () => void;
}

/** Top-right of the map: asks the backend for fresh data. */
function RefreshButton({ isRefreshing, onRefresh }: RefreshButtonProps) {
  return (
    <button
      type="button"
      className="map-refresh absolute top-3.5 right-3.5 z-30 grid size-9.5 cursor-pointer place-items-center rounded-[10px] border border-ink/16 bg-white/94 text-[#21352a] shadow-[0_5px_16px_rgb(15_31_21/0.13)] backdrop-blur-sm hover:bg-brand-soft focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-blue-600 disabled:cursor-wait disabled:text-muted"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-busy={isRefreshing}
      aria-label="Refresh map data"
      title="Refresh map data"
    >
      <svg
        className={`size-4.5 ${isRefreshing ? 'motion-safe:animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
        <path d="M20 4v7h-7" />
      </svg>
    </button>
  );
}

export default RefreshButton;
