// Mirrors the DTOs in DrillingApi.cs. Keep the two in sync by hand, or
// generate this from the OpenAPI document once the backend is live
// (`npx openapi-typescript http://localhost:5000/swagger/v1/swagger.json`).

export type Dimension = 'category' | 'rig';

export interface CampaignYear {
  year: number;
  startWeek: number;
  endWeek: number;
  annualTarget: number;
}

export interface Filters {
  years: CampaignYear[];
  /** Every category present in the data, including those without a donut. */
  categories: string[];
  rigs: string[];
  /**
   * The categories that get a donut, in display order, and what each
   * measures. Narrower than `categories` on purpose: the report drew
   * four, while the rules produce six. Ra-Grade and Other still count
   * toward the metres and hole totals, they just have no donut.
   */
  donuts: DonutSpec[];
}

/**
 * `coredSplit` shows cored against destructive metres within the
 * category. `shareOfCampaign` shows the category's metres against the
 * rest — used where coring is structurally impossible, as with Techno,
 * which is defined as the technological wells that were NOT cored and so
 * can only ever read 0% cored.
 */
export type DonutMetric = 'coredSplit' | 'shareOfCampaign';

export interface DonutSpec {
  category: string;
  metric: DonutMetric;
}

export interface Summary {
  holeCount: number;
  startWeek: number | null;
  endWeek: number | null;
  annualTarget: number | null;
}

export interface WeeklyPoint {
  weekNum: number;
  weekLabel: string;          // "S14" — semaine 14, French for week 14
  monthNum: number;
  monthName: string;
  holeCount: number;
  realizedM: number;
  cumulativeM: number;
  cumulativeTargetM: number | null;   // null before the campaign opens
  pctCored: number | null;            // 0–1
  avgDeviationPct: number | null;
  avgRecoveryPct: number | null;
  inCampaign: boolean;
}

export interface WeeklyByRig {
  weekNum: number;
  weekLabel: string;
  monthNum: number;
  monthName: string;
  rig: string;
  realizedM: number;
}

export interface CampaignAverages {
  campaignAvgDeviationPct: number | null;
  campaignAvgRecoveryPct: number | null;
  campaignPctCored: number | null;
}

export interface TypeSplit {
  category: string;
  coredM: number;
  destructiveM: number;
  holeCount: number;
}

/**
 * Slicer state, shared by every query on the page.
 *
 * Empty arrays mean "no filter", matching an untouched slicer — the same
 * convention the API uses. `weeks` is the selection made by clicking the
 * bar chart; empty means the whole campaign.
 */
export interface FilterState {
  year: number;
  categories: string[];
  rigs: string[];
  weeks: number[];
}
