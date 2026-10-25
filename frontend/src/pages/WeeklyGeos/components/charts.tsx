// All four chart types live here while the shapes are settling. Split
// into one file each once they stop changing.
//
// ECharts rather than Recharts for one concrete reason: the weekly
// column chart needs a two-level category axis (week labels banded by
// month), which ECharts does natively with a second xAxis and Recharts
// does not do at all.

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent, LegendComponent, MarkLineComponent, TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type {
  BarSeriesOption, EChartsOption, SeriesOption,
} from 'echarts/types/dist/shared';
import { useEffect, useRef } from 'react';
import type { WeeklyByRig, WeeklyPoint } from '../types/drilling';

// Only what the four charts actually use. The full `echarts` barrel adds
// roughly 400 kB gzipped for features this dashboard never touches.
echarts.use([
  BarChart, LineChart, PieChart,
  GridComponent, LegendComponent, MarkLineComponent, TooltipComponent,
  SVGRenderer,
]);

/* ------------------------------------------------------------------ */
/* Wrapper                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every live chart on the page, with the element it occupies.
 *
 * Tooltips stick because each chart only knows about its own pointer
 * events, and those are not reliable between charts that sit side by
 * side — the cursor can cross from one to its neighbour without the
 * first ever registering an exit. Vertical neighbours happen to work;
 * horizontal ones do not.
 *
 * So the pointer position is tracked once, at the document, and whatever
 * chart it is actually over wins. Nothing depends on enter or leave
 * firing in the right order, which is what kept failing.
 */
const liveCharts = new Map<echarts.ECharts, HTMLElement>();

/** Dismisses the tooltip AND the enlarged point, which hideTip leaves. */
function dismiss(instance: echarts.ECharts | undefined) {
  if (!instance) return;
  instance.dispatchAction({ type: 'hideTip' });
  instance.dispatchAction({ type: 'downplay' });
}

function dismissAllExcept(keep?: echarts.ECharts) {
  for (const instance of liveCharts.keys()) {
    if (instance !== keep) dismiss(instance);
  }
}

if (typeof document !== 'undefined') {
  // The chart the pointer was last over, so the common case — moving
  // within one chart — costs a single rect check rather than one per
  // chart on the page.
  let over: echarts.ECharts | undefined;
  let frame = 0;

  const contains = (node: HTMLElement, x: number, y: number) => {
    const r = node.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  document.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const previous = over ? liveCharts.get(over) : undefined;
      if (previous && contains(previous, e.clientX, e.clientY)) return;

      over = undefined;
      for (const [instance, node] of liveCharts) {
        if (contains(node, e.clientX, e.clientY)) { over = instance; break; }
      }
      dismissAllExcept(over);
    });
  }, { passive: true });

  // Leaving the document entirely fires no chart event at all.
  const clear = () => { over = undefined; dismissAllExcept(); };
  document.addEventListener('pointerleave', clear);
  window.addEventListener('blur', clear);
}

function useChart(
  option: EChartsOption,
  deps: unknown[],
  onSelect?: (dataIndex: number) => void,
) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | undefined>(undefined);

  // Held in a ref so the listener is attached exactly once and never
  // needs re-registering on render.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!host.current) return;
    chart.current = echarts.init(host.current, undefined, { renderer: 'svg' });

    // Collapsing the sidebar resizes every chart at once, and the grid
    // transition fires the observer on each frame. Coalesce to one
    // resize per frame so a dozen instances do not thrash.
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A tooltip positioned against the old geometry is stranded by a
        // resize — collapsing the sidebar, or opening the dialog, which
        // locks body scrolling and shifts the layout.
        dismiss(chart.current);
        chart.current?.resize();
      });
    });
    ro.observe(host.current);

    liveCharts.set(chart.current, host.current);

    // Kept as a cheap fast path; the document-level tracker above is
    // what actually guarantees a single tooltip.
    chart.current.on('globalout', () => dismiss(chart.current));

    chart.current.on('click', (params: { dataIndex?: number }) => {
      if (params.dataIndex !== undefined) select.current?.(params.dataIndex);
    });

    // Clicking the empty area clears the selection, which is how people
    // expect to undo a click without hunting for a button.
    chart.current.getZr().on('click', (event: { target?: unknown }) => {
      if (!event.target) select.current?.(-1);
    });

    const instance = chart.current;
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      liveCharts.delete(instance);
      instance.dispose();
    };
  }, []);

  useEffect(() => {
    const instance = chart.current;
    if (!instance) return;

    // Dismiss before touching the option: rebuilding while a tooltip is
    // on screen orphans the popup in the DOM and leaves the chart
    // believing it is still showing.
    dismiss(instance);

    // replaceMerge rather than notMerge: it swaps the parts that change
    // and leaves the tooltip plumbing alone. legend is listed because
    // some options omit it, and a plain merge would strand a stale one.
    instance.setOption(option, {
      replaceMerge: ['series', 'xAxis', 'yAxis', 'legend'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return host;
}

/**
 * Height is set on this element directly rather than inherited from the
 * panel. Relying on `height: 100%` through a flex ancestor collapsed the
 * chart whenever that ancestor had no resolved height of its own, and
 * made the size depend on stylesheet order. Tune the --h-chart-* tokens.
 */
export function Chart({
  option, deps, height = 'var(--h-chart-md)', onSelect,
}: {
  option: EChartsOption;
  deps: unknown[];
  height?: string | number;
  /** Called with the category index of a clicked bar, if provided. */
  onSelect?: (dataIndex: number) => void;
}) {
  const host = useChart(option, deps, onSelect);
  return (
    <div ref={host}
         style={{ width: '100%', height, cursor: onSelect ? 'pointer' : 'default' }} />
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/**
 * Reads one of the page's design tokens.
 *
 * The tokens sit on `.weekly-geos-page`, not on `:root`: scoping them was
 * what kept this page's palette and typeface off the map pages, whose own
 * styles are Tailwind's. So the lookup starts there. Every chart renders
 * inside that element — the enlarged one too, since its dialog carries the
 * same class — and the fallback only matters before the first paint.
 */
const css = (name: string) => {
  const scope = document.querySelector('.weekly-geos-page') ?? document.documentElement;

  return getComputedStyle(scope).getPropertyValue(name).trim();
};

const INK = () => css('--ink-muted') || '#5b6b7d';
const FAINT = () => css('--ink-faint') || '#8a98a8';
const GRID = () => css('--border') || '#dde4ec';

const baseText = () => ({
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontSize: 11,
  color: INK(),
});

const tooltip = (): NonNullable<EChartsOption["tooltip"]> => ({
  trigger: 'axis',
  // Keeps the popup inside the chart rather than overflowing the panel,
  // where it can be clipped and left behind on a scroll.
  confine: true,
  transitionDuration: 0,
  // Not enterable: the popup must never take the pointer, or the chart
  // sees an exit and the tooltip it just handed the cursor to persists.
  enterable: false,
  hideDelay: 0,
  backgroundColor: '#ffffff',
  borderColor: GRID(),
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { ...baseText(), fontSize: 12, color: css('--ink') || '#152433' },
  axisPointer: { type: 'line', lineStyle: { color: GRID() } },
});

const yAxis = (name?: string): Record<string, unknown> => ({
  type: 'value',
  name,
  nameTextStyle: { ...baseText(), fontSize: 10, color: FAINT(), padding: [0, 0, 0, -28] },
  nameGap: 12,
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: baseText(),
  splitLine: { lineStyle: { color: GRID(), type: 'dashed' } },
});

/**
 * Week labels ("S14" = semaine 14, the French week numbering the original
 * report used) along the bottom, month bands beneath them — the two-level
 * axis the original column chart used (Month Name drilling down to
 * Week Number). A month label is drawn once, at the middle of its run.
 */
function weekAxes(points: { weekLabel: string; monthName: string }[]) {
  const months = points.map((p) => p.monthName);
  const mid = new Set<number>();
  let runStart = 0;
  for (let i = 1; i <= months.length; i++) {
    if (i === months.length || months[i] !== months[runStart]) {
      mid.add(Math.floor((runStart + i - 1) / 2));
      runStart = i;
    }
  }
  const boundary = (i: number) => i === 0 || months[i] !== months[i - 1];

  return [
    {
      type: 'category' as const,
      data: points.map((p) => p.weekLabel),
      axisLine: { lineStyle: { color: GRID() } },
      axisTick: { show: false },
      axisLabel: { ...baseText(), fontSize: 10, interval: 0, hideOverlap: true },
    },
    {
      type: 'category' as const,
      position: 'bottom' as const,
      offset: 20,
      data: months,
      axisLine: { show: false },
      axisTick: {
        show: true,
        length: 16,
        inside: false,
        alignWithLabel: false,
        interval: (i: number) => boundary(i),
        lineStyle: { color: GRID() },
      },
      axisLabel: {
        ...baseText(),
        fontSize: 10,
        color: FAINT(),
        interval: 0,
        // A month covering only two or three weeks has no room for its
        // full name next to its neighbour, which ran them together as
        // "MarchApril". Drop a label rather than overlap it; the tick
        // marks still show where each month begins.
        hideOverlap: true,
        formatter: (v: string, i: number) => (mid.has(i) ? v : ''),
      },
      splitLine: { show: false },
    },
  ];
}

/**
 * Shades the weeks picked on the bar chart.
 *
 * The line charts are highlighted rather than filtered: narrowing them to
 * a single selected week would leave one point and destroy the trend the
 * chart exists to show. The reference lines DO recompute for the
 * selection, so the dashed line moves and its label says so.
 */
function selectionArea(
  weeksOnAxis: { weekNum: number; weekLabel: string }[],
  selected: number[],
) {
  if (selected.length === 0) return undefined;

  const picked = weeksOnAxis.filter((p) => selected.includes(p.weekNum));
  const first = picked.at(0);
  const last = picked.at(-1);
  if (!first || !last) return undefined;

  // ECharts types a mark area as a PAIR of bounds, so this has to be a
  // fixed-length tuple rather than an array literal.
  const span: [{ xAxis: string }, { xAxis: string }] = [
    { xAxis: first.weekLabel },
    { xAxis: last.weekLabel },
  ];

  return {
    silent: true,
    itemStyle: { color: css('--blue-50') },
    label: { show: false },
    data: [span],
  };
}

/**
 * Every formatter below is handed values by ECharts, and ECharts passes
 * `undefined` for a gap in a series — which these charts have whenever a
 * week recorded no cored holes.
 *
 * Note that `Number.isNaN(undefined)` is FALSE, so a `null`/NaN guard
 * lets undefined straight through to `.toFixed()`. That threw inside the
 * tooltip render, which aborted the show and left the popup stranded with
 * the chart's internal state broken — the "stuck tooltip" that only ever
 * appeared on the two charts with gaps in their data.
 */
const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const DASH = '–';

/**
 * The three fields the pie callbacks read. ECharts types its callback
 * parameter as a broad union that varies by series type, and reading it as
 * `any` disabled every check inside these formatters — including on
 * `percent`, which is genuinely absent on some callbacks.
 */
interface SliceParams {
  name?: unknown;
  value?: unknown;
  percent?: unknown;
}

const m0 = (v: unknown) =>
  isNumber(v)
    ? `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`
    : DASH;

/* ------------------------------------------------------------------ */
/* 1. Drilled metres — column, by month or by week                     */
/* ------------------------------------------------------------------ */

const RIG_COLOURS = ['--rig-1', '--rig-2', '--rig-3', '--rig-4', '--rig-5', '--rig-6'];

export type Grouping = 'month' | 'week';

/** Thousands-separated metres, for axis and bar labels. */
const metres = (v: unknown) =>
  isNumber(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : DASH;

/**
 * Collapses the weekly series into months. Months are kept in calendar
 * order and only those touched by the campaign appear, so a 32-week
 * campaign yields eight bars rather than thirty-two.
 */
function byMonth<T extends { monthNum: number; monthName: string }>(
  rows: T[],
  value: (row: T) => number,
) {
  const buckets = new Map<number, { name: string; total: number }>();

  for (const row of rows) {
    const bucket = buckets.get(row.monthNum)
      ?? { name: row.monthName, total: 0 };
    bucket.total += value(row);
    buckets.set(row.monthNum, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([monthNum, b]) => ({
      key: monthNum,
      // Three letters keeps eight labels legible without rotation.
      label: b.name.slice(0, 3),
      total: b.total,
    }));
}

export function WeeklyMetresChart({
  points, byRig, grouping = 'month', selectedWeeks = [], onSelectWeeks,
  height = 'var(--h-chart-lg)',
}: {
  points: WeeklyPoint[];
  byRig?: WeeklyByRig[];
  grouping?: Grouping;
  /** Weeks currently selected; anything else is dimmed. */
  selectedWeeks?: number[];
  /** Weeks behind the clicked bar, or [] when the click was off-bar. */
  onSelectWeeks?: (weeks: number[]) => void;
  /** Overridden when the chart is enlarged in a dialog. */
  height?: string;
}) {
  const inCampaign = points.filter((p) => p.inCampaign);
  const monthly = grouping === 'month';

  const buckets = monthly
    ? byMonth(inCampaign, (p) => p.realizedM)
    : inCampaign.map((p) => ({
        key: p.weekNum, label: p.weekLabel, total: p.realizedM,
      }));

  // Which weeks sit behind each bar — one for a week bar, several for a
  // month — so a click can report them to the page.
  const weeksPerBucket = buckets.map((b) =>
    monthly
      ? inCampaign.filter((p) => p.monthNum === b.key).map((p) => p.weekNum)
      : [b.key]);

  const hasSelection = selectedWeeks.length > 0;
  const isSelected = (i: number) =>
    (weeksPerBucket[i] ?? []).some((w) => selectedWeeks.includes(w));

  // Dim what is not selected rather than hiding it, so the clicked bar
  // keeps its context.
  const opacityFor = (i: number) =>
    !hasSelection || isSelected(i) ? 1 : 0.28;

  // Bar labels only fit when the bars are wide enough. Eight months
  // always fit; thirty-two weeks never do.
  const showLabels = buckets.length <= 16;

  // ECharts types the formatter's value as a broad union, so narrow it
  // here rather than lying about the callback signature.
  const asNumber = (value: unknown) => (isNumber(value) ? value : 0);

  const barLabel = (threshold = 0): BarSeriesOption['label'] => ({
    show: showLabels,
    position: 'top',
    formatter: (p) =>
      asNumber(p.value) > threshold ? metres(asNumber(p.value)) : '',
    ...baseText(),
    fontSize: 10,
    color: css('--ink-muted'),
  });

  let series: SeriesOption[];
  let legend: NonNullable<EChartsOption['legend']> | undefined;

  if (byRig?.length) {
    const rigs = [...new Set(byRig.map((r) => r.rig))].sort();

    series = rigs.map((rig, i) => {
      const rows = byRig.filter((r) => r.rig === rig);
      const data = monthly
        ? (() => {
            const m = byMonth(rows, (r) => r.realizedM);
            return buckets.map(
              (b) => m.find((x) => x.key === b.key)?.total ?? 0);
          })()
        : buckets.map(
            (b) => rows.find((r) => r.weekNum === b.key)?.realizedM ?? 0);

      return {
        name: rig,
        type: 'bar',
        stack: 'metres',
        barMaxWidth: monthly ? 56 : 22,
        itemStyle: {
          color: css(RIG_COLOURS[i % RIG_COLOURS.length] ?? '--rig-1'),
          opacity: 1,
        },
        // Inside each segment, and only where the segment is tall enough
        // to hold a number without colliding with its neighbours.
        label: {
          ...barLabel(0),
          show: showLabels,
          position: 'inside',
          color: '#fff',
          formatter: (p) =>
            asNumber(p.value) >= 250 ? metres(asNumber(p.value)) : '',
        },
        data: data.map((value, idx) => ({
          value,
          itemStyle: { opacity: opacityFor(idx) },
        })),
      } satisfies SeriesOption;
    });

    legend = {
      bottom: 0, itemWidth: 9, itemHeight: 9, icon: 'roundRect',
      textStyle: baseText(),
    };
  } else {
    series = [{
      name: 'Drilled',
      type: 'bar',
      barMaxWidth: monthly ? 56 : 22,
      itemStyle: { color: css('--blue-600'), borderRadius: [2, 2, 0, 0] },
      label: barLabel(),
      data: buckets.map((b, i) => ({
        value: b.total,
        itemStyle: { opacity: opacityFor(i) },
      })),
    }];
  }

  const option: EChartsOption = {
    // Extra headroom so the topmost bar label is not clipped.
    grid: { top: showLabels ? 28 : 16, right: 12,
            bottom: legend ? 54 : 32, left: 56 },
    tooltip: { ...tooltip(), valueFormatter: (v) => m0(v) },
    legend,
    xAxis: monthly
      ? {
          type: 'category',
          data: buckets.map((b) => b.label),
          axisLine: { lineStyle: { color: GRID() } },
          axisTick: { show: false },
          axisLabel: { ...baseText(), interval: 0 },
        }
      : weekAxes(inCampaign),
    yAxis: { ...yAxis('metres'),
             axisLabel: { ...baseText(), formatter: (v: unknown) => metres(v) } },
    series,
  };

  return (
    <Chart
      option={option}
      deps={[points, byRig, grouping, selectedWeeks, height]}
      height={height}
      onSelect={onSelectWeeks
        ? (i) => onSelectWeeks(i < 0 ? [] : weeksPerBucket[i] ?? [])
        : undefined}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 2. Cumulative realized vs target                                    */
/* ------------------------------------------------------------------ */

export function CumulativeChart({
  points, selectedWeeks = [], height = 'var(--h-chart-lg)',
}: { points: WeeklyPoint[]; selectedWeeks?: number[]; height?: string }) {
  const inCampaign = points.filter((p) => p.inCampaign);
  const band = selectionArea(inCampaign, selectedWeeks);

  const option: EChartsOption = {
    grid: { top: 16, right: 12, bottom: 60, left: 58 },
    tooltip: { ...tooltip(), valueFormatter: (v) => m0(v) },
    legend: {
      bottom: 0, itemWidth: 16, itemHeight: 2,
      textStyle: baseText(),
    },
    xAxis: weekAxes(inCampaign),
    yAxis: yAxis('metres'),
    series: [
      {
        name: 'Drilled',
        type: 'line',
        smooth: false,
        symbol: 'none',
        lineStyle: { width: 2.5, color: css('--blue-600') },
        areaStyle: { color: css('--blue-50'), opacity: 0.8 },
        data: inCampaign.map((p) => p.cumulativeM),
        markArea: band,
      },
      {
        name: 'Planned',
        type: 'line',
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed', color: css('--sand-500') },
        data: inCampaign.map((p) => p.cumulativeTargetM),
      },
    ],
  };

  return (
    <Chart option={option} deps={[points, selectedWeeks, height]}
           height={height} />
  );
}

/* ------------------------------------------------------------------ */
/* 3. Rate chart — weekly value plus a flat campaign reference line    */
/*    Used three times: % cored, deviation, recovery.                  */
/* ------------------------------------------------------------------ */

export function RateChart({
  points, field, reference, unit, decimals = 1, colour = '--blue-600',
  selectedWeeks = [], height = 'var(--h-chart-md)',
}: {
  points: WeeklyPoint[];
  field: 'pctCored' | 'avgDeviationPct' | 'avgRecoveryPct';
  reference: number | null;
  unit: '%' ;
  decimals?: number;
  colour?: string;
  selectedWeeks?: number[];
  height?: string;
}) {
  const inCampaign = points.filter((p) => p.inCampaign);
  const band = selectionArea(inCampaign, selectedWeeks);

  // The reference line is computed over whatever is selected, so calling
  // it "Campaign" once a selection exists would be a lie.
  const referenceName = selectedWeeks.length > 0 ? 'Selection' : 'Campaign';
  // pctCored arrives as a 0–1 ratio; the other two are already percentages.
  const scale = field === 'pctCored' ? 100 : 1;
  const fmt = (v: unknown) =>
    isNumber(v) ? `${v.toFixed(decimals)}${unit}` : DASH;

  const option: EChartsOption = {
    grid: { top: 16, right: 12, bottom: 44, left: 48 },
    tooltip: { ...tooltip(), valueFormatter: (v) => fmt(v) },
    xAxis: weekAxes(inCampaign),
    yAxis: {
      ...yAxis(),
      axisLabel: {
        ...baseText(),
        formatter: (v: unknown) => (isNumber(v) ? `${v}${unit}` : ''),
      },
      scale: true,
    },
    series: [{
      name: 'Weekly',
      type: 'line',
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2, color: css(colour) },
      itemStyle: { color: css(colour) },
      connectNulls: false,
      data: inCampaign.map((p) => {
        const v = p[field];
        return v === null ? null : Number((v * scale).toFixed(decimals + 2));
      }),
      markArea: band,
      markLine: reference === null ? undefined : {
        silent: true,
        symbol: 'none',
        lineStyle: { color: css('--sand-500'), type: 'dashed', width: 1.5 },
        label: {
          formatter: `${referenceName} ${fmt(reference === null ? null : reference * scale)}`,
          position: 'insideEndTop',
          ...baseText(),
          fontSize: 10,
          color: css('--sand-600'),
        },
        data: [{ yAxis: Number((reference * scale).toFixed(decimals + 2)) }],
      },
    }],
  };

  return (
    <Chart option={option} deps={[points, reference, field, selectedWeeks, height]}
           height={height} />
  );
}

/* ------------------------------------------------------------------ */
/* 4. Donut                                                            */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  name: string;
  value: number;
  /** CSS custom property name, e.g. "--series-cored". */
  colour: string;
}

/**
 * Metres in the compact form the original report used: 2475 -> "2.48K",
 * 99 -> "0.1K". Trailing zeros are trimmed, so 2000 reads "2K".
 */
function compactMetres(v: unknown) {
  if (!isNumber(v)) return DASH;
  const k = (v / 1000).toFixed(2).replace(/\.?0+$/, '');
  return `${k}K`;
}

/**
 * Takes slices rather than a TypeSplit, because not every donut
 * necessarily compares the same pair of values.
 *
 * Labels sit outside on leader lines showing metres and share, matching
 * the report. The hole count goes in the hole of the donut, rendered by
 * the page rather than by ECharts so it can be styled as ordinary text.
 */
export function TypeDonut({
  slices, height = 'var(--h-chart-sm)',
}: { slices: DonutSlice[]; height?: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const option: EChartsOption = {
    tooltip: {
      ...tooltip(),
      trigger: 'item',
      formatter: (params) => {
        const p = params as SliceParams;
        const percent = isNumber(p.percent) ? `${p.percent}%` : DASH;
        const name = typeof p.name === 'string' ? p.name : '';

        return `${name}<br/><b>${m0(p.value)}</b> (${percent})`;
      },
    },
    series: [{
      type: 'pie',
      // Leaves room for the outside labels and their leader lines; a
      // larger ring pushes them into the panel edge and ECharts clips
      // them rather than wrapping.
      radius: ['52%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      // A zero slice still needs its label — "0 (0%)" is information,
      // and Techno is 100% destructive by definition.
      minAngle: 0,
      label: {
        show: true,
        position: 'outside',
        ...baseText(),
        fontSize: 10,
        color: css('--ink-muted'),
        // Keeps a long label from running off the panel.
        overflow: 'none',
        formatter: (params) => {
          const p = params as SliceParams;
          const percent = isNumber(p.percent)
            ? `${p.percent.toFixed(2)}%` : DASH;

          return `${compactMetres(p.value)} (${percent})`;
        },
      },
      labelLine: {
        show: true,
        length: 6,
        length2: 8,
        lineStyle: { color: css('--border-strong') },
      },
      emphasis: { scale: true, scaleSize: 3 },
      data: total === 0 ? [] : slices.map((s) => ({
        name: s.name,
        value: s.value,
        itemStyle: { color: css(s.colour) },
      })),
    }],
  };

  return <Chart option={option} deps={[slices, height]} height={height} />;
}
