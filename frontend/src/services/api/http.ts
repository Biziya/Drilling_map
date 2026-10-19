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

/** Why a request failed, so the UI can say something accurate about it. */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid-response';

export class ApiError extends Error {
  override name = 'ApiError';
  readonly kind: ApiErrorKind;
  /** HTTP status, for `http` errors. */
  readonly status: number | undefined;

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.kind = kind;
    this.status = options.status;
  }
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

export interface RequestJsonOptions {
  signal?: AbortSignal | undefined;
  connectionErrorMessage: string;
  /** Gives up when the server has not answered within this time. */
  timeoutMs?: number | undefined;
}

/**
 * Issues a GET that accepts JSON.
 *
 * Non-OK responses are returned rather than thrown, because the caller needs
 * the body to build its message. A connection failure becomes a `network`
 * ApiError and an expired `timeoutMs` a `timeout` one; an abort by the
 * caller is rethrown untouched.
 */
export async function requestJson(
  url: string,
  { signal, connectionErrorMessage, timeoutMs }: RequestJsonOptions,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort);

  try {
    return await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiError('timeout', `No response within ${timeoutMs} ms.`, { cause: error });
    if (isAbortError(error)) throw error;
    throw new ApiError('network', connectionErrorMessage, { cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
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
