import { MarkerSymbol, RigIcon } from './DrillholeMarker';
import { MAP_CONFIG } from './mapConfig';
import type { MapPageConfig } from './mapConfig';
import { markerShapeFor } from './markerKind';
import type { ReactNode } from 'react';

function LegendSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-2xs font-bold tracking-wider text-[#33483b] uppercase short:mb-0.5 short:text-3xs">
        {title}
      </h2>
      <ul className="grid gap-0.5">{children}</ul>
    </section>
  );
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 text-2xs leading-tight text-muted short:text-3xs">
      {swatch}
      <span>{label}</span>
    </li>
  );
}

const SWATCH = 'h-5 w-7.5 shrink-0 border border-ink/20';

/** Symbols are drawn with the same components as the markers, so the legend cannot drift. */
function MapLegend({ symbols }: { symbols: MapPageConfig['legendSymbols'] }) {
  return (
    <aside
      aria-label="Map legend"
      className="grid grid-cols-2 gap-3 border-t border-line bg-white/92 px-4 pt-2 pb-2.5 max-sm:max-h-[32vh] max-sm:overflow-y-auto lg:grid-cols-4 lg:gap-8 short:py-1.5"
    >
      <LegendSection title="GT @75 ppm">
        {MAP_CONFIG.gtRanges.map((range) => (
          <LegendItem
            key={range.label}
            label={range.label}
            swatch={<i className={`${SWATCH} rounded-full`} style={{ background: range.color }} />}
          />
        ))}
      </LegendSection>

      <LegendSection title="Redox Status">
        {Object.entries(MAP_CONFIG.redox).map(([label, color]) => (
          <LegendItem key={label} label={label} swatch={<i className={`${SWATCH} rounded-xs`} style={{ background: color }} />} />
        ))}
      </LegendSection>

      <LegendSection title="Symbol">
        {symbols.map(({ kind, label }) => (
          <LegendItem
            key={kind}
            label={label}
            swatch={
              <span className="grid h-5 w-7.5 shrink-0 place-items-center">
                {kind === 'rig' ? (
                  <RigIcon className="h-5 w-auto max-w-7.5" />
                ) : (
                  <MarkerSymbol shape={markerShapeFor(kind)} color={MAP_CONFIG.legendSymbolColor} small />
                )}
              </span>
            }
          />
        ))}
      </LegendSection>
    </aside>
  );
}

export default MapLegend;
