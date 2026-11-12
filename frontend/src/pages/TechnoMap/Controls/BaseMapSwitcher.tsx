import { useState } from 'react';
import { MAP_CONFIG } from '../config/technoMapConfig';
import type { BaseMapId } from '../config/technoMapConfig';
import { LayersIcon } from './icons';

export interface BaseMapSwitcherProps {
  value: BaseMapId;
  onChange: (baseMap: BaseMapId) => void;
}

/**
 * Header control beside Refresh: a layers button opening a small menu of the
 * configured base maps, the current one ticked. Hidden when only one is offered.
 */
function BaseMapSwitcher({ value, onChange }: BaseMapSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { options } = MAP_CONFIG.baseMap;
  if (options.length < 2) return null;

  const current = options.find(({ id }) => id === value)?.label;

  return (
    <div
      className="relative z-50 shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <button
        type="button"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-paper/95 text-muted hover:bg-control-hover hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus aria-expanded:bg-control-selected aria-expanded:text-brand"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Base map"
        title={current ? `Base map: ${current}` : 'Base map'}
      >
        <LayersIcon />
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+6px)] right-0 grid min-w-[170px] rounded-[10px] border border-line bg-paper p-1 shadow-[0_8px_24px_rgba(15,31,21,.16)]"
          role="menu"
          aria-label="Base map"
        >
          {options.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[.76rem] font-semibold text-ink hover:bg-control-hover focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus aria-checked:text-brand aria-checked:bg-control-selected"
              onClick={() => {
                setIsOpen(false);
                onChange(id);
              }}
            >
              <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {id === value && <path d="m5 12 5 5 9-10" />}
              </svg>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BaseMapSwitcher;
