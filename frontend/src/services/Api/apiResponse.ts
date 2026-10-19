/**
 * Shared request/response plumbing for the drillhole endpoints.
 *
 * Everything here treats the response as untrusted: a body is `unknown` until
 * it has been narrowed, and an error caught from `fetch` is `unknown` until it
 * has been checked, because a proxy can return HTML and a rejected fetch can
 * in principle throw anything.
 */

export interface RequestJsonOptions {
  /** Abort signal from the caller's `AbortController`, if it has one. */
  signal?: AbortSignal | undefined;
  /** Message to surface when the request never reaches the server. */
  connectionErrorMessage: string;
}

/**
 * The part of `Response` this module needs.
 *
 * Narrower than `Response` on purpose: it documents that only the body is
 * read here, and it lets callers pass anything that can produce text.
 */
export type ReadableBody = Pick<Response, 'text'>;

/** True for the error `fetch` raises when a request is aborted. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Turns an unknown thrown value into an `Error`.
 *
 * `catch` binds `unknown`, and the state helpers downstream need a `message`,
 * so anything that is not already an `Error` is wrapped rather than having
 * properties read off it blindly.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;

  return new Error(typeof value === 'string' ? value : 'Unexpected error.');
}

/** True for a string carrying something other than nothing. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Picks the most specific message an error body offers.
 *
 * A plain-text body wins outright; otherwise the RFC 7807 ProblemDetails
 * fields are tried in order of specificity. Each is checked with `in` before
 * it is read, so an unrecognised body shape falls through to the fallback
 * rather than being asserted into a shape it does not have. A whitespace-only
 * body carries no information and is treated as absent.
 */
export function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string') return body.trim() ? body : fallback;
  if (typeof body !== 'object' || body === null) return fallback;

  if ('detail' in body && isNonEmptyString(body.detail)) return body.detail;
  if ('message' in body && isNonEmptyString(body.message)) return body.message;
  if ('title' in body && isNonEmptyString(body.title)) return body.title;

  return fallback;
}

/**
 * Issues the GET.
 *
 * Non-OK responses are returned rather than thrown: status handling belongs
 * to the caller, which needs the body to build its message. Only a genuine
 * connection failure is converted into an error, and an abort is rethrown
 * untouched so callers can recognise and ignore it.
 */
export async function requestJson(
  url: string,
  { signal, connectionErrorMessage }: RequestJsonOptions,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error(connectionErrorMessage, { cause: error });
  }
}

/**
 * Reads the body as JSON where possible.
 *
 * Returns `unknown`, because the server can and does return an HTML error
 * page from a proxy. The caller decides what shape it will accept.
 */
export async function readBody(response: ReadableBody): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
