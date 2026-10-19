import { apiUrl, getErrorMessage, readBody, requestJson } from './http';
import { isDrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeApiRecord } from '../../types/drillhole';

/** Fetches one map's dataset, honouring an abort signal. */
export type FetchDrillholeRecords = (signal?: AbortSignal) => Promise<DrillholeApiRecord[]>;

/**
 * Builds the fetcher for one map endpoint.
 *
 * The array check is the contract with the backend and fails loudly, because
 * a single object reaching `.map()` downstream would crash the page. Entries
 * within the array are filtered, not rejected: one malformed row must not
 * cost the user every other drillhole.
 */
function createMapFetcher(path: string, subject: string, loadError: string): FetchDrillholeRecords {
  return async (signal) => {
    const response = await requestJson(apiUrl(path), {
      signal,
      connectionErrorMessage: `Unable to connect to the ${subject} API.`,
    });
    const body = await readBody(response);

    if (!response.ok) throw new Error(getErrorMessage(body, loadError));
    if (!Array.isArray(body)) {
      throw new Error(`The ${subject} API returned an invalid response. Expected a JSON array.`);
    }

    return body.filter(isDrillholeApiRecord);
  };
}

export const fetchDrillholeMap = createMapFetcher('/api/exploration-map', 'drillhole', 'Unable to load drillholes.');
export const fetchTechnoMap = createMapFetcher('/api/techno-map', 'TechnoMap', 'Unable to load TechnoMap records.');
