import { useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { Grouping } from './components/charts';
import {
  CumulativeChart, RateChart, TypeDonut, WeeklyMetresChart,
} from './components/charts';
import {
  CampaignBanner, Empty, ExpandButton, Failed, Loading, Modal, MultiSelect,
  Panel, Segmented, Select, StatCard,
} from './components/shell';
import {
  useCampaignAverages, useFilterOptions, useFilters, useSummary,
  useTypeSplit, useWeekly, useWeeklyByRig,
} from './hooks/useDrilling';
import { WEEKLY_GEOS_CONFIG } from './config/weeklyGeosConfig';
import type { Dimension } from './types/drilling';

/** A chart, drawn at panel size on the page or at dialog size when enlarged. */
interface ChartDefinition {
  title: string;
  render: (height?: string) => ReactElement;
}

/**
 * The two pages in the original report were identical except for which
 * secondary slicer was live and whether the column chart split by rig.
 * One component, one `dimension` prop.
 */
export default function DrillingDashboard({ dimension }: { dimension: Dimension }) {
  const {
    filters, weekRange, isFiltered,
    setYear, setCategories, setRigs, toggleWeeks, clearWeeks, clearAll,
  } = useFilters();

  // Monthly by default: eight bars with their totals printed on them read
  // better than thirty-two narrow ones. Weekly stays a click away.
  const [grouping, setGrouping] = useState<Grouping>('month');

  /**
   * Which chart is enlarged, if any. Each chart is rendered by the same
   * component in both places with a different height, so there is no
   * second copy to keep in step.
   */
  const [zoomed, setZoomed] = useState<string | null>(null);

  const options = useFilterOptions(filters);
  const summary = useSummary(filters, weekRange);
  const weekly = useWeekly(filters);
  const byRig = useWeeklyByRig(filters, dimension === 'rig');
  const averages = useCampaignAverages(filters, weekRange);
  const split = useTypeSplit(filters, weekRange);

  // Memoised on the query's own data rather than written inline: `?? []`
  // builds a fresh array on every render while the query is empty, and the
  // memos below depend on this identity.
  const points = useMemo(() => weekly.data ?? [], [weekly.data]);

  /** Campaign-level figures the cards show, derived from the weekly series. */
  const totals = useMemo(() => {
    // Campaign weeks only, so these reconcile with the Holes drilled
    // card and with the donuts beneath.
    const drilled = points.filter((p) => p.inCampaign && p.realizedM > 0);
    const last = drilled.at(-1);
    const target = last?.cumulativeTargetM ?? null;
    const actual = last?.cumulativeM ?? 0;
    return {
      currentWeek: last?.weekLabel ?? null,
      actual,
      target,
      ratio: target ? actual / target : null,
    };
  }, [points]);

  /**
   * Technological wells are drilled destructively, so filtering to them
   * leaves the cored-proportion chart flat at zero and the recovery chart
   * empty — TotalRecovery_per is NULL on an uncored hole. Say so instead
   * of drawing a chart that looks broken.
   */
  const coring = useMemo(() => {
    const inCampaign = points.filter((p) => p.inCampaign);
    return {
      drilled: inCampaign.some((p) => p.realizedM > 0),
      cored: inCampaign.some((p) => (p.pctCored ?? 0) > 0),
      recovery: inCampaign.some((p) => p.avgRecoveryPct !== null),
    };
  }, [points]);

  /** Names whatever the page is currently filtered to, for the message. */
  const selection = useMemo(() => {
    if (filters.categories.length === 1) return `${filters.categories[0]} holes`;
    if (filters.categories.length > 1) return 'the selected hole purposes';
    if (filters.rigs.length === 1) return filters.rigs[0];
    if (filters.rigs.length > 1) return 'the selected rigs';
    return 'this campaign';
  }, [filters.categories, filters.rigs]);

  /** Reads back a week selection as "S22" or "S22–S26". */
  const weekLabel = useMemo(() => {
    if (filters.weeks.length === 0) return null;
    const label = (w: number) => `S${String(w).padStart(2, '0')}`;
    // Min and max rather than sorting and indexing the ends: the result is
    // the same, and it does not need the compiler to be told that a list of
    // known length has a first element.
    const first = Math.min(...filters.weeks);
    const last = Math.max(...filters.weeks);

    return first === last ? label(first) : `${label(first)}–${label(last)}`;
  }, [filters.weeks]);

  /**
   * The report drew four donuts; the category rule produces six. Ra-Grade
   * and Other are real categories that still count toward the metres and
   * hole totals — they simply have no donut. The backend decides which
   * four, and in what order, so this never drifts from appsettings.
   */
  const donuts = useMemo(() => {
    const rows = split.data ?? [];
    if (!rows.length) return [];

    // Which categories are drawn, and in what order, is a configuration
    // decision — so wait for the configuration rather than defaulting to
    // "every category", which drew donuts for Ra-Grade and Other.
    const specs = options.data?.donuts;
    if (!specs) return [];

    const campaignM = rows.reduce(
      (sum, r) => sum + r.coredM + r.destructiveM, 0);

    return specs.flatMap((spec) => {
      const row = rows.find((r) => r.category === spec.category);
      if (!row) return [];

      const categoryM = row.coredM + row.destructiveM;

      // Colours follow the report: destructive is the blue mass,
      // cored the sand highlight.
      const slices =
        spec.metric === 'shareOfCampaign'
          ? [
              { name: spec.category, value: categoryM, colour: '--series-destructive' },
              { name: 'Rest of campaign',
                value: Math.max(0, campaignM - categoryM),
                colour: '--series-cored' },
            ]
          : [
              { name: 'Destructive', value: row.destructiveM,
                colour: '--series-destructive' },
              { name: 'Cored', value: row.coredM, colour: '--series-cored' },
            ];

      return [{ row, slices, totalM: categoryM }];
    });
  }, [split.data, options.data?.donuts]);

  /**
   * One definition per chart, used at panel size on the page and at
   * dialog size when enlarged.
   *
   * The five fixed charts are kept in their own object so the panels below
   * can reach them by name. Spreading them into the donut lookup first gave
   * that object an index signature, under which every `charts.weekly` read
   * is possibly undefined — true of a donut key, which depends on the data,
   * but not of these five, which are written right here.
   */
  const fixedCharts = {
    weekly: {
      title: dimension === 'rig' ? 'Metres drilled by rig' : 'Metres drilled',
      render: (h?: string) => (
        <WeeklyMetresChart
          points={points}
          byRig={dimension === 'rig' ? byRig.data : undefined}
          grouping={grouping}
          selectedWeeks={filters.weeks}
          onSelectWeeks={toggleWeeks}
          height={h}
        />
      ),
    },
    cumulative: {
      title: 'Drilled against plan',
      render: (h?: string) => (
        <CumulativeChart points={points} selectedWeeks={filters.weeks} height={h} />
      ),
    },
    cored: {
      title: 'Cored proportion',
      render: (h?: string) => (
        <RateChart
          points={points}
          field="pctCored"
          reference={averages.data?.campaignPctCored ?? null}
          unit="%"
          selectedWeeks={filters.weeks}
          height={h}
        />
      ),
    },
    deviation: {
      title: 'Deviation',
      render: (h?: string) => (
        <RateChart
          points={points}
          field="avgDeviationPct"
          reference={averages.data?.campaignAvgDeviationPct ?? null}
          unit="%"
          decimals={2}
          colour="--sand-500"
          selectedWeeks={filters.weeks}
          height={h}
        />
      ),
    },
    recovery: {
      title: 'Core recovery',
      render: (h?: string) => (
        <RateChart
          points={points}
          field="avgRecoveryPct"
          reference={averages.data?.campaignAvgRecoveryPct ?? null}
          unit="%"
          colour="--green-600"
          selectedWeeks={filters.weeks}
          height={h}
        />
      ),
    },
  } satisfies Record<string, ChartDefinition>;

  /** The donuts, which exist only for the categories the backend returns. */
  const donutCharts: Record<string, ChartDefinition> = Object.fromEntries(
    donuts.map((d) => [
      `donut:${d.row.category}`,
      {
        title: `${d.row.category} — cored against destructive`,
        render: (h?: string) => <TypeDonut slices={d.slices} height={h} />,
      },
    ]),
  );

  const zoomedChart: ChartDefinition | undefined = zoomed
    ? { ...donutCharts, ...fixedCharts }[zoomed]
    : undefined;

  return (
    <div className="dash">
      <header className="dash__head">
        <h1 className="dash__title">
          {WEEKLY_GEOS_CONFIG.titles[dimension]}
        </h1>

        <div className="dash__slicers">
          <Select
            label="Campaign year"
            value={String(filters.year)}
            options={(options.data?.years ?? []).map((y) => ({
              value: String(y.year), label: String(y.year),
            }))}
            onChange={(v) => v && setYear(Number(v))}
          />

          {/* Both slicers on both pages. Each list is narrowed by the
              other, so picking a hole purpose leaves only the rigs that
              drilled it. */}
          <MultiSelect
            label="Hole purpose"
            selected={filters.categories}
            options={options.data?.categories ?? []}
            onChange={setCategories}
            allLabel="All purposes"
          />
          <MultiSelect
            label="Rig"
            selected={filters.rigs}
            options={options.data?.rigs ?? []}
            onChange={setRigs}
            allLabel="All rigs"
          />

          {weekLabel && (
            <span className="selection">
              {weekLabel}
              <button
                type="button"
                className="selection__clear"
                onClick={clearWeeks}
                aria-label="Clear week selection"
              >
                ✕
              </button>
            </span>
          )}

          {isFiltered && (
            <button type="button" className="dash__reset" onClick={clearAll}>
              Reset
            </button>
          )}
        </div>
      </header>

      <CampaignBanner
        startWeek={summary.data?.startWeek ?? null}
        endWeek={summary.data?.endWeek ?? null}
        annualTarget={summary.data?.annualTarget ?? null}
      />

      <div className="dash__kpis">
        <StatCard
          label="Holes drilled"
          value={summary.isLoading ? '—' : (summary.data?.holeCount ?? 0).toLocaleString()}
          sub={totals.currentWeek ? `through ${totals.currentWeek}` : undefined}
        />
        <StatCard
          label="Drilled to date"
          value={`${Math.round(totals.actual).toLocaleString()} m`}
        />
        <StatCard
          label="Planned to date"
          value={totals.target === null ? '—' : `${Math.round(totals.target).toLocaleString()} m`}
        />
        <StatCard
          label="Against plan"
          value={totals.ratio === null ? '—' : `${Math.round(totals.ratio * 100)}%`}
          tone={totals.ratio !== null && totals.ratio >= 1 ? 'positive' : 'default'}
        />
      </div>

      <Panel
        className="dash__weekly"
        title={fixedCharts.weekly.title}
        note={dimension === 'rig' ? 'stacked by rig' : undefined}
        onExpand={() => setZoomed('weekly')}
        action={
          <div className="dash__panelActions">
            <Segmented
              label="Group metres drilled by"
              value={grouping}
              onChange={setGrouping}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ]}
            />
          </div>
        }
      >
        <ChartState query={weekly}>{fixedCharts.weekly.render()}</ChartState>
      </Panel>

      <Panel
        className="dash__cumulative"
        title={fixedCharts.cumulative.title}
        onExpand={() => setZoomed('cumulative')}
      >
        <ChartState query={weekly}>{fixedCharts.cumulative.render()}</ChartState>
      </Panel>

      <Panel
        className="dash__rate1"
        title={fixedCharts.cored.title}
        onExpand={() => setZoomed('cored')}
      >
        <ChartState query={weekly}>
          {coring.drilled && !coring.cored ? (
            <Empty>
              <p>No core was taken in {selection}.</p>
              <p className="state__hint">
                Technological wells are drilled destructively, so there is
                no cored proportion to report.
              </p>
            </Empty>
          ) : fixedCharts.cored.render()}
        </ChartState>
      </Panel>

      <Panel
        className="dash__rate2"
        title={fixedCharts.deviation.title}
        onExpand={() => setZoomed('deviation')}
      >
        <ChartState query={weekly}>{fixedCharts.deviation.render()}</ChartState>
      </Panel>

      <Panel
        className="dash__rate3"
        title={fixedCharts.recovery.title}
        onExpand={() => setZoomed('recovery')}
      >
        <ChartState query={weekly}>
          {coring.drilled && !coring.recovery ? (
            <Empty>
              <p>No recovery measured in {selection}.</p>
              <p className="state__hint">
                Recovery is only recorded on holes that were cored.
              </p>
            </Empty>
          ) : fixedCharts.recovery.render()}
        </ChartState>
      </Panel>

      <section className="dash__donuts" aria-label="Cored and destructive metres by hole purpose">
        {(split.isLoading || options.isLoading) && (
          <Loading label="Loading hole purposes" />
        )}
        {split.isError && <Failed error={split.error} onRetry={() => void split.refetch()} />}
        {!split.isError && options.isError && (
          <Failed error={options.error} onRetry={() => void options.refetch()} />
        )}
        {donuts.map((d) => (
          <article key={d.row.category} className="donut panel">
            <header className="panel__head">
              <h2 className="panel__title">{d.row.category}</h2>
              <span className="panel__note">
                {Math.round(d.totalM).toLocaleString()} m
              </span>
              <div className="panel__action">
                <ExpandButton
                  title={d.row.category}
                  onClick={() => setZoomed(`donut:${d.row.category}`)}
                />
              </div>
            </header>
            <div className="donut__chart">
              <TypeDonut slices={d.slices} />
              {/* Hole count in the hole of the donut, as the report had
                  it. Rendered as text rather than an ECharts graphic so
                  it inherits the page's type and tabular figures. */}
              <p className="donut__centre">
                <span className="donut__count">
                  {d.row.holeCount.toLocaleString()}
                </span>
                <span className="donut__unit">holes</span>
              </p>
            </div>
          </article>
        ))}
        {split.data && options.data && donuts.length === 0 && (
          <Empty>No holes recorded for this campaign.</Empty>
        )}
      </section>

      {zoomedChart && (
        <Modal title={zoomedChart.title} onClose={() => setZoomed(null)}>
          {zoomedChart.render('var(--h-chart-zoom)')}
        </Modal>
      )}
    </div>
  );
}

/** Loading / error wrapper so each panel handles its own state. */
function ChartState({
  query, children,
}: { query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void };
     children: ReactNode }) {
  if (query.isLoading) return <Loading />;
  if (query.isError) return <Failed error={query.error} onRetry={query.refetch} />;
  return <>{children}</>;
}
