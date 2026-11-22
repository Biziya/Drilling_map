import type { ReactNode } from 'react';
import './mapLegend.css';

/**
 * The legend card in a map's top-left corner, shared by both maps so they
 * look the same and differ only in content. Informational only.
 */
export function MapLegend({ children }: { children: ReactNode }) {
  return (
    <aside className="map-legend" aria-label="Map legend">
      {children}
    </aside>
  );
}

/** One group of rows, with an optional subtle title. */
export function LegendSection({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`map-legend__section${className ? ` ${className}` : ''}`}>
      {title && <h2>{title}</h2>}
      <ul>{children}</ul>
    </section>
  );
}

/** One row: the symbol, centred in the shared symbol square, then its label. Hidden rows stay listed, faded. */
export function LegendRow({ symbol, label, hidden = false }: { symbol: ReactNode; label: ReactNode; hidden?: boolean }) {
  return (
    <li className={hidden ? 'is-hidden' : undefined}>
      <span className="legend-symbol" aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </li>
  );
}
