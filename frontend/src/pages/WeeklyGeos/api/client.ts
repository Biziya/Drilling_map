import type {
  CampaignAverages, Filters, Summary, TypeSplit, WeeklyByRig, WeeklyPoint,
} from '../types/drilling';
import { apiUrl } from '../../../services/api/http';

// The backend routes these as api/[controller]/[action], so every path below
// is /api/Dashboard/<Action> on the same server as the map endpoints.
const BASE = apiUrl('/api');

class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * What a query parameter may be. Spelled out rather than left as `unknown`
 * so that `String(v)` is known to produce something meaningful: an object
 * reaching this stringifies to "[object Object]" and the backend sees a
 * filter it cannot read, with nothing in the request to say what went
 * wrong.
 */
type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

async function get<T>(path: string, params: Record<string, QueryValue>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    // Arrays repeat the key — ?categories=Techno&categories=Hydro — which
    // is what ASP.NET binds to a string[] parameter.
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, String(item));
    } else {
      qs.set(k, String(v));
    }
  }

  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    // Surface something a person can act on rather than "Request failed".
    const detail = await res.text().catch(() => '');
    throw new ApiError(
      res.status === 404
        ? 'That campaign year has no data yet.'
        : `Could not load drilling data (${res.status}). ${detail}`.trim(),
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

/** A contiguous week selection, or nothing. */
interface WeekRange { fromWeek?: number; toWeek?: number }

export const api = {
  filters: (year: number, categories: string[], rigs: string[]) =>
    get<Filters>('/Dashboard/Filters', { year, categories, rigs }),

  summary: (year: number, categories: string[], rigs: string[], w: WeekRange) =>
    get<Summary>('/Dashboard/Summary', { year, categories, rigs, ...w }),

  weekly: (year: number, categories: string[], rigs: string[]) =>
    get<WeeklyPoint[]>('/Dashboard/Weekly', { year, categories, rigs }),

  weeklyByRig: (year: number, categories: string[], rigs: string[]) =>
    get<WeeklyByRig[]>('/Dashboard/Weekly', { year, categories, rigs, groupBy: 'rig' }),

  campaignAverages: (year: number, categories: string[], rigs: string[], w: WeekRange) =>
    get<CampaignAverages>('/Dashboard/CampaignAverages', { year, categories, rigs, ...w }),

  typeSplit: (year: number, categories: string[], rigs: string[], w: WeekRange) =>
    get<TypeSplit[]>('/Dashboard/TypeSplit', { year, categories, rigs, ...w }),
};

export { ApiError };
