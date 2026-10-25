import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { api } from '../api/client';
import { WEEKLY_GEOS_CONFIG } from '../config/weeklyGeosConfig';
import type { FilterState } from '../types/drilling';

/**
 * One piece of state drives every chart on the page, which is what the
 * Power BI slicers did.
 *
 * Both pages carry both slicers, so there is no "primary" dimension — only
 * which chart is stacked. Note that each page must be keyed, or React
 * reconciles the two as the same component and the filters leak across
 * navigation; WeeklyGeos.tsx does that.
 */
export function useFilters(initialYear = WEEKLY_GEOS_CONFIG.defaultYear) {
  const [filters, setFilters] = useState<FilterState>({
    year: initialYear,
    categories: [],
    rigs: [],
    weeks: [],
  });

  const setYear = useCallback(
    // Week numbers mean different things in different campaigns, so a
    // selection cannot survive a year change.
    (year: number) => setFilters((f) => ({ ...f, year, weeks: [] })),
    [],
  );

  const setCategories = useCallback(
    (categories: string[]) => setFilters((f) => ({ ...f, categories })),
    [],
  );

  const setRigs = useCallback(
    (rigs: string[]) => setFilters((f) => ({ ...f, rigs })),
    [],
  );

  /** Toggles a set of weeks — one bar click, or a month's worth. */
  const toggleWeeks = useCallback((weeks: number[]) => {
    setFilters((f) => {
      const already = weeks.every((w) => f.weeks.includes(w));
      return {
        ...f,
        weeks: already
          ? f.weeks.filter((w) => !weeks.includes(w))
          : [...new Set([...f.weeks, ...weeks])],
      };
    });
  }, []);

  const clearWeeks = useCallback(
    () => setFilters((f) => ({ ...f, weeks: [] })),
    [],
  );

  const clearAll = useCallback(
    () => setFilters((f) => ({ ...f, categories: [], rigs: [], weeks: [] })),
    [],
  );

  /**
   * The API takes a contiguous range rather than a set. Clicking spread
   * bars is unusual; sending min..max keeps the contract simple and the
   * cache keys short, and the chart still highlights exactly what was
   * picked.
   */
  const weekRange = useMemo(() => {
    if (filters.weeks.length === 0) return {};
    return {
      fromWeek: Math.min(...filters.weeks),
      toWeek: Math.max(...filters.weeks),
    };
  }, [filters.weeks]);

  const isFiltered =
    filters.categories.length > 0 ||
    filters.rigs.length > 0 ||
    filters.weeks.length > 0;

  return {
    filters, weekRange, isFiltered,
    setYear, setCategories, setRigs, toggleWeeks, clearWeeks, clearAll,
  };
}

const STALE = WEEKLY_GEOS_CONFIG.staleTimeMs; // weekly data; no need to refetch aggressively

/** Slicer contents. Each list is narrowed by the other selection. */
export function useFilterOptions({ year, categories, rigs }: FilterState) {
  return useQuery({
    queryKey: ['filters', year, categories, rigs],
    queryFn: () => api.filters(year, categories, rigs),
    staleTime: STALE,
    // Keeps the dropdowns populated while a narrowed list is in flight,
    // instead of emptying and refilling on every tick.
    placeholderData: (previous) => previous,
  });
}

export function useSummary(
  { year, categories, rigs }: FilterState,
  weekRange: { fromWeek?: number; toWeek?: number },
) {
  return useQuery({
    queryKey: ['summary', year, categories, rigs, weekRange],
    queryFn: () => api.summary(year, categories, rigs, weekRange),
    staleTime: STALE,
  });
}

/** Never week filtered: this is what the week selection is made from. */
export function useWeekly({ year, categories, rigs }: FilterState) {
  return useQuery({
    queryKey: ['weekly', year, categories, rigs],
    queryFn: () => api.weekly(year, categories, rigs),
    staleTime: STALE,
  });
}

export function useWeeklyByRig(
  { year, categories, rigs }: FilterState, enabled: boolean,
) {
  return useQuery({
    queryKey: ['weeklyByRig', year, categories, rigs],
    queryFn: () => api.weeklyByRig(year, categories, rigs),
    staleTime: STALE,
    enabled,
  });
}

export function useCampaignAverages(
  { year, categories, rigs }: FilterState,
  weekRange: { fromWeek?: number; toWeek?: number },
) {
  return useQuery({
    queryKey: ['campaignAverages', year, categories, rigs, weekRange],
    queryFn: () => api.campaignAverages(year, categories, rigs, weekRange),
    staleTime: STALE,
  });
}

export function useTypeSplit(
  { year, categories, rigs }: FilterState,
  weekRange: { fromWeek?: number; toWeek?: number },
) {
  return useQuery({
    queryKey: ['typeSplit', year, categories, rigs, weekRange],
    queryFn: () => api.typeSplit(year, categories, rigs, weekRange),
    staleTime: STALE,
  });
}
