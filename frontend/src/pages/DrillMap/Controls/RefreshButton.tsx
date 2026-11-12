import { RefreshIcon } from './icons';

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
      <RefreshIcon spinning={isRefreshing} />
    </button>
  );
}

export default RefreshButton;
