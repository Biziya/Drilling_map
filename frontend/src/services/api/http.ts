/**
 * Shared request/response plumbing for the backend endpoints.
 *
 * Responses are untrusted: a proxy can return HTML, and a rejected fetch can
 * in principle throw anything, so bodies stay `unknown` until narrowed.
 */

import { API_BASE_URL } from '../../config/env';

/** Builds an absolute API URL from a path such as `/api/health`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/** True for the error `fetch` raises when a request is aborted. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Turns an unknown thrown value into an `Error`. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;

  return new Error(typeof value === 'string' ? value : 'Unexpected error.');
}

function readString(body: object, key: string): string | null {
  const value: unknown = (body as Record<string, unknown>)[key];

  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Picks the most specific message an error body offers: a plain-text body,
 * then the RFC 7807 ProblemDetails `detail`, `message` and `title` fields.
 */
export function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string') return body.trim() ? body : fallback;
  if (typeof body !== 'object' || body === null) return fallback;

  return readString(body, 'detail') ?? readString(body, 'message') ?? readString(body, 'title') ?? fallback;
}

/**
 * Issues a GET that accepts JSON.
 *
 * Non-OK responses are returned rather than thrown, because the caller needs
 * the body to build its message. A connection failure becomes an error with
 * `connectionErrorMessage`; an abort is rethrown untouched.
 */
export async function requestJson(
  url: string,
  { signal, connectionErrorMessage }: { signal?: AbortSignal | undefined; connectionErrorMessage: string },
): Promise<Response> {
  try {
    return await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error(connectionErrorMessage, { cause: error });
  }
}

/** Reads the body as JSON where possible, otherwise as text, or null when empty. */
export async function readBody(response: Pick<Response, 'text'>): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
