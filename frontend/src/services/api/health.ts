import { apiUrl } from './http';

export const HEALTH_PATH = '/api/health';

/**
 * Asks the backend whether it is up.
 *
 * Resolves true only for a 2xx answer within `timeoutMs`. Never rejects:
 * a timeout, a network error and an error status all mean "offline".
 */
export async function checkBackendHealth(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(HEALTH_PATH), { cache: 'no-store', signal: controller.signal });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
