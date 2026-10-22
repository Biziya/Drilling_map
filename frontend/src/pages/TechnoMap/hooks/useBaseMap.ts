import { useEffect, useState } from 'react';
import { MAP_CONFIG, MAP_ID } from '../config/technoMapConfig';
import type { BaseMapId } from '../config/technoMapConfig';
import { readStored, writeStored } from '../utils/storage';

/** Own key, so the Exploration Map's choice can never mix in. */
export const BASE_MAP_STORAGE_KEY = `${MAP_ID}:base-map`;

/** A stored choice, or the configured default when it is missing or no longer offered. */
export function parseBaseMap(value: unknown): BaseMapId {
  const option = MAP_CONFIG.baseMap.options.find(({ id }) => id === value);

  return option ? option.id : MAP_CONFIG.baseMap.default;
}

/** The background the map is drawn on, remembered across page switches and refreshes. */
export function useBaseMap() {
  const [baseMap, setBaseMap] = useState<BaseMapId>(() => parseBaseMap(readStored(BASE_MAP_STORAGE_KEY)));

  useEffect(() => writeStored(BASE_MAP_STORAGE_KEY, baseMap), [baseMap]);

  return { baseMap, setBaseMap };
}
