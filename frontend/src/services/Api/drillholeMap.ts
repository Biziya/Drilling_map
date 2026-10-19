import { getErrorMessage, readBody, requestJson } from './apiResponse';
import { API_BASE_URL as CONFIGURED_API_BASE_URL } from '../../config/env';
import { isDrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeApiRecord } from '../../types/drillhole';

export const API_BASE_URL: string = CONFIGURED_API_BASE_URL;

const DRILLHOLE_MAP_URL = `${API_BASE_URL}/api/exploration-map`;
const DEFAULT_ERROR = 'Unable to load drillholes.';
const CONNECTION_ERROR = 'Unable to connect to the drillhole API.';
const SHAPE_ERROR =
  'The drillhole API returned an invalid response. Expected a JSON array.';

/**
 * Fetches the Exploration Map dataset.
 *
 * The array check is the contract with the backend and fails loudly, because
 * a single object reaching `.map()` downstream would crash the page. Entries
 * within the array are filtered rather than rejected: one malformed row must
 * not cost the user every other drillhole.
 */
export async function fetchDrillholeMap(
  signal?: AbortSignal,
): Promise<DrillholeApiRecord[]> {
  const response = await requestJson(DRILLHOLE_MAP_URL, {
    signal,
    connectionErrorMessage: CONNECTION_ERROR,
  });
  const body = await readBody(response);

  if (!response.ok) throw new Error(getErrorMessage(body, DEFAULT_ERROR));
  if (!Array.isArray(body)) throw new Error(SHAPE_ERROR);

  return body.filter(isDrillholeApiRecord);
}
