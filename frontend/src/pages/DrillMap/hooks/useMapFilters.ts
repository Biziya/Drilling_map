import { useCallback, useEffect, useState } from 'react';
import { LAYER_IDS, MAP_ID } from '../config/drillMapConfig';
import type { LayerId } from '../config/drillMapConfig';
import { readStored, writeStored } from '../utils/storage';

/** Which Layers panel layers are shown. */
export type MapFilters = Readonly<Record<LayerId, boolean>>;

/** Own key, so the Techno Map's settings can never mix in. */
export const FILTERS_STORAGE_KEY = `${MAP_ID}:filters`;

/** Every layer on or off. */
export function setAllFilters(visible: boolean): MapFilters {
  return Object.fromEntries(LAYER_IDS.map((id) => [id, visible])) as Record<LayerId, boolean>;
}

/** Stored choices, every layer on unless stored as exactly false. */
export function parseFilters(value: unknown): MapFilters {
  const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(LAYER_IDS.map((id) => [id, stored[id] !== false])) as Record<LayerId, boolean>;
}

/** The Layers panel choices, all on at first and remembered across refreshes. */
export function useMapFilters() {
  const [filters, setFilters] = useState<MapFilters>(() => parseFilters(readStored(FILTERS_STORAGE_KEY)));

  useEffect(() => writeStored(FILTERS_STORAGE_KEY, filters), [filters]);

  // Stable, so the memoised Layers panel skips the re-render on every pan frame.
  const setFilter = useCallback((id: LayerId, visible: boolean) => setFilters((current) => ({ ...current, [id]: visible })), []);
  const setAll = useCallback((visible: boolean) => setFilters(setAllFilters(visible)), []);

  return { filters, setFilter, setAll };
}
