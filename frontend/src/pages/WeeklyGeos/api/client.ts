import type {
  CampaignAverages, Filters, Summary, TypeSplit, WeeklyByRig, WeeklyPoint,
} from '../types/drilling';
import { WEEKLY_API_BASE_URL, WEEKLY_USE_MOCK } from '../../../config/env';
import * as mock from './mockData';

// Routes follow the backend's api/[controller]/[action] convention, so every
// path below is <base>/Dashboard/<Action>. The base and the mock switch are
// read from config/env.ts with the application's other environment values,
// rather than from import.meta.env here.
const BASE = WEEKLY_API_BASE_URL;

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
export interface WeekRange { fromWeek?: number; toWeek?: number }

export const api = {
  filters: (year: number, categories: string[], rigs: string[]) =>
    WEEKLY_USE_MOCK
      ? mock.filters()
      : get<Filters>('/Dashboard/Filters', { year, categories, rigs }),

  summary: (year: number, categories: string[], rigs: string[], w: WeekRange) =>
    WEEKLY_USE_MOCK
      ? mock.summary(year, categories, rigs)
      : get<Summary>('/Dashboard/Summary', { year, categories, rigs, ...w }),

  weekly: (year: number, categories: string[], rigs: string[]) =>
    WEEKLY_USE_MOCK
      ? mock.weekly(year, categories, rigs)
      : get<WeeklyPoint[]>('/Dashboard/Weekly', { year, categories, rigs }),

  weeklyByRig: (year: number, categories: string[], rigs: string[]) =>
    WEEKLY_USE_MOCK
      ? mock.weeklyByRig(year, categories)
      : get<WeeklyByRig[]>('/Dashboard/Weekly',
          { year, categories, rigs, groupBy: 'rig' }),

  campaignAverages: (
    year: number, categories: string[], rigs: string[], w: WeekRange) =>
    WEEKLY_USE_MOCK
      ? mock.campaignAverages(year, categories, rigs)
      : get<CampaignAverages>('/Dashboard/CampaignAverages',
          { year, categories, rigs, ...w }),

  typeSplit: (year: number, categories: string[], rigs: string[], w: WeekRange) =>
    WEEKLY_USE_MOCK
      ? mock.typeSplit(year, rigs)
      : get<TypeSplit[]>('/Dashboard/TypeSplit', { year, categories, rigs, ...w }),
};

export { ApiError };
