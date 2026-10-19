import { getErrorMessage, readBody, requestJson } from './apiResponse';
import { API_BASE_URL as CONFIGURED_API_BASE_URL } from '../../config/env';
import { isDrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeApiRecord } from '../../types/drillhole';

export const API_BASE_URL: string = CONFIGURED_API_BASE_URL;

const TECHNO_MAP_URL = `${API_BASE_URL}/api/techno-map`;
const DEFAULT_ERROR = 'Unable to load TechnoMap records.';
const CONNECTION_ERROR = 'Unable to connect to the TechnoMap API.';
const SHAPE_ERROR =
  'The TechnoMap API returned an invalid response. Expected a JSON array.';

/**
 * Fetches the Techno Map dataset.
 *
 * The array check is the contract with the backend and fails loudly, because
 * a single object reaching `.map()` downstream would crash the page. Entries
 * within the array are filtered rather than rejected: one malformed row must
 * not cost the user every other drillhole.
 */
export async function fetchTechnoMap(
  signal?: AbortSignal,
): Promise<DrillholeApiRecord[]> {
  const response = await requestJson(TECHNO_MAP_URL, {
    signal,
    connectionErrorMessage: CONNECTION_ERROR,
  });
  const body = await readBody(response);

  if (!response.ok) throw new Error(getErrorMessage(body, DEFAULT_ERROR));
  if (!Array.isArray(body)) throw new Error(SHAPE_ERROR);

  return body.filter(isDrillholeApiRecord);
}
