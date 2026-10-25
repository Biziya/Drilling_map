// Generated stand-in data, deterministic so charts don't reshuffle on
// every render. Shaped from what the Power BI model told us: two campaign
// years, four hole purposes, cored/destructive split, weeks numbered the
// Power BI way (Monday start, week 1 contains Jan 1).
//
// Delete this file once the API is live.

import type {
  CampaignAverages, CampaignYear, DonutSpec, Filters, Summary, TypeSplit,
  WeeklyByRig, WeeklyPoint,
} from '../types/drilling';

/* Named rather than reached for as CAMPAIGNS[0], which the compiler can
   only see as possibly missing. */
const DEFAULT_CAMPAIGN: CampaignYear =
  { year: 2026, startWeek: 14, endWeek: 45, annualTarget: 38000 };

const CAMPAIGNS: CampaignYear[] = [
  DEFAULT_CAMPAIGN,
  { year: 2025, startWeek: 21, endWeek: 47, annualTarget: 15450 },
];

// The six categories the "Drilling Detail Category" rule produces, with
// their real shares of the 368 live holes:
// Delineation 210, Techno 95, Hydro 30, Hybrid 16, Ra-Grade 9, Other 8.
const CATEGORIES = [
  'Delineation', 'Techno', 'Hydro', 'Hybrid', 'Ra-Grade', 'Other',
];

// The four the report drew. Ra-Grade and Other are real but get no donut.
// Techno shows its share of the campaign: the category is defined as the
// technological wells that were NOT cored, so a cored split there would
// read 0% every week.
const DONUTS: DonutSpec[] = [
  { category: 'Delineation', metric: 'coredSplit' },
  { category: 'Techno', metric: 'coredSplit' },
  { category: 'Hydro', metric: 'coredSplit' },
  { category: 'Hybrid', metric: 'coredSplit' },
  // The failed holes. Included so the donuts sum exactly to the card.
  { category: 'Other', metric: 'coredSplit' },
];

const CATEGORY_SHARE: Record<string, number> = {
  Delineation: 0.571, Techno: 0.258, Hydro: 0.082,
  Hybrid: 0.043, 'Ra-Grade': 0.024, Other: 0.022,
};
// Real rig identifiers from the source table.
const RIGS = ['P7000_O5', 'P7000_O10', 'P9000_O9', 'P9000_O12'];

/** Current week, so the "campaign in progress" shape looks real. */
const TODAY_WEEK = 42;

/** mulberry32 — small, seeded, good enough for placeholder data. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) =>
  [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'] as const;

/** Approximate month for a week number — good enough for axis banding. */
function monthOfWeek(week: number) {
  // Clamped at both ends: week 0 or a negative would otherwise index off
  // the front of the list, which reads as undefined rather than throwing.
  const m = Math.min(11, Math.max(0, Math.floor(((week - 1) * 7) / 30.44)));

  return { monthNum: m + 1, monthName: MONTHS[m] ?? MONTHS[11] };
}

const campaignFor = (year: number) =>
  CAMPAIGNS.find((c) => c.year === year) ?? DEFAULT_CAMPAIGN;

const delay = <T,>(v: T) =>
  new Promise<T>((r) => setTimeout(() => r(v), 180 + Math.random() * 220));

/** Scales volume down for the categories and rigs selected. */
function share(categories: string[], rigs: string[]) {
  let s = 1;
  if (categories.length) {
    s *= categories.reduce((sum, c) => sum + (CATEGORY_SHARE[c] ?? 0.1), 0);
  }
  if (rigs.length) s *= rigs.length / RIGS.length;
  return s;
}

function series(year: number, categories: string[], rigs: string[]) {
  const c = campaignFor(year);
  const rand = rng(hash(`${year}|${categories.join()}|${rigs.join()}`));
  const weeksInYear = 52;
  const weekly = c.annualTarget / (c.endWeek - c.startWeek + 1);
  const s = share(categories, rigs);

  const out: WeeklyPoint[] = [];
  let cumulative = 0;

  for (let w = 1; w <= weeksInYear; w++) {
    const { monthNum, monthName } = monthOfWeek(w);
    const inCampaign = w >= c.startWeek && w <= c.endWeek;
    const drilled = inCampaign && w <= TODAY_WEEK;

    // Ramp up over the first four weeks, wobble thereafter.
    const rampIn = Math.min(1, (w - c.startWeek + 1) / 4);
    const noise = 0.72 + rand() * 0.55;
    const realizedM = drilled
      ? Math.round(weekly * s * rampIn * noise * 10) / 10
      : 0;

    cumulative += realizedM;

    const elapsed = w - c.startWeek + 1;
    const total = c.endWeek - c.startWeek + 1;
    const cumulativeTargetM = !inCampaign
      ? w > c.endWeek
        ? c.annualTarget * s
        : null
      : (elapsed / total) * c.annualTarget * s;

    out.push({
      weekNum: w,
      weekLabel: `S${String(w).padStart(2, '0')}`,
      monthNum,
      monthName,
      holeCount: drilled ? 2 + Math.floor(rand() * 7) : 0,
      realizedM,
      cumulativeM: Math.round(cumulative * 10) / 10,
      cumulativeTargetM:
        cumulativeTargetM === null ? null : Math.round(cumulativeTargetM * 10) / 10,
      // Ranges taken from the source sample: deviation 0.1-1.4 %,
      // recovery 95-99 %, and most holes destructive-only so the
      // cored share sits well under half.
      pctCored: drilled ? 0.08 + rand() * 0.30 : null,
      avgDeviationPct: drilled ? 0.1 + rand() * 1.3 : null,
      avgRecoveryPct: drilled ? 95 + rand() * 4 : null,
      inCampaign,
    });
  }
  return out;
}

export const filters = () =>
  delay<Filters>({
    years: CAMPAIGNS,
    categories: CATEGORIES,
    rigs: RIGS,
    donuts: DONUTS,
  });

export const summary = (year: number, categories: string[], rigs: string[]) => {
  const c = campaignFor(year);
  const holes = series(year, categories, rigs).reduce((a, p) => a + p.holeCount, 0);
  return delay<Summary>({
    holeCount: holes,
    startWeek: c.startWeek,
    endWeek: c.endWeek,
    annualTarget: c.annualTarget,
  });
};

export const weekly = (year: number, categories: string[], rigs: string[]) =>
  delay(series(year, categories, rigs));

export const weeklyByRig = (year: number, categories: string[]) => {
  const rows: WeeklyByRig[] = [];
  for (const rig of RIGS) {
    for (const p of series(year, categories, [rig])) {
      if (p.realizedM > 0) {
        rows.push({
          weekNum: p.weekNum,
          weekLabel: p.weekLabel,
          monthNum: p.monthNum,
          monthName: p.monthName,
          rig,
          realizedM: p.realizedM,
        });
      }
    }
  }
  return delay(rows);
};

export const campaignAverages = (
  year: number, categories: string[], rigs: string[],
) => {
  const pts = series(year, categories, rigs).filter((p) => p.realizedM > 0);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  // Ratio of sums, matching the backend — not the mean of weekly ratios.
  const cored = pts.reduce((a, p) => a + p.realizedM * (p.pctCored ?? 0), 0);
  const total = pts.reduce((a, p) => a + p.realizedM, 0);

  return delay<CampaignAverages>({
    campaignAvgDeviationPct: mean(pts.map((p) => p.avgDeviationPct)),
    campaignAvgRecoveryPct: mean(pts.map((p) => p.avgRecoveryPct)),
    campaignPctCored: total ? cored / total : null,
  });
};

export const typeSplit = (year: number, rigs: string[]) => {
  const rows = CATEGORIES.map<TypeSplit>((category) => {
    const pts = series(year, [category], rigs);
    const total = pts.reduce((a, p) => a + p.realizedM, 0);
    const rand = rng(hash(category));
    // Hybrid holes are cored by definition; technological wells mostly
    // are not; delineation always is.
    const coredShare =
      category === 'Hybrid' ? 0.3 + rand() * 0.2
      : category === 'Techno' ? 0            // uncored by definition
      : category === 'Delineation' ? 0.75 + rand() * 0.2
      : 0.1 + rand() * 0.25;
    return {
      category,
      coredM: Math.round(total * coredShare),
      destructiveM: Math.round(total * (1 - coredShare)),
      holeCount: pts.reduce((a, p) => a + p.holeCount, 0),
    };
  });
  return delay(rows);
};
