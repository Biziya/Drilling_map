import { useEffect, useState } from 'react';
import { MAP_ID } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';
import { parseFilters, setAllFilters } from '../utils/mapFilters';
import type { MapFilters } from '../utils/mapFilters';
import { readStored, writeStored } from '../utils/storage';

/** Own key, so the Exploration Map's settings can never mix in. */
export const FILTERS_STORAGE_KEY = `${MAP_ID}:filters`;

/** The 12 visibility filters, all on at first and remembered across refreshes. */
export function useMapFilters() {
  const [filters, setFilters] = useState<MapFilters>(() => parseFilters(readStored(FILTERS_STORAGE_KEY)));

  useEffect(() => writeStored(FILTERS_STORAGE_KEY, filters), [filters]);

  return {
    filters,
    setFilter: (id: FilterId, visible: boolean) => setFilters((current) => ({ ...current, [id]: visible })),
    setAll: (visible: boolean) => setFilters(setAllFilters(visible)),
  };
}
