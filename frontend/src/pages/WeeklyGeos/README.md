# Weekly Geos drilling dashboard

The two drilling pages from the `Weekly_Geos.pbix` report. They appear in
the sidebar as Drilling Details and Drilling by Rig.

Both render `DrillingDashboard`. They differ only in the `dimension` prop,
`category` or `rig`, which sets the heading and whether the metres chart is
stacked by rig. The two pages in the original report differed in the same
way, so there is one copy of the chart code.

```
WeeklyGeos.tsx            page shell: query client, page root, CSS import
DrillingDashboard.tsx     the dashboard itself, both pages
WeeklyGeos.css            every style, scoped under .weekly-geos-page
config/weeklyGeos.yaml    headings, default campaign year, cache lifetime
config/weeklyGeosConfig.ts  typed view of the YAML
types/drilling.ts         mirrors the backend's dashboard DTOs
api/client.ts             fetch layer for /api/Dashboard/<Action>
hooks/useDrilling.ts      filter state and one query hook per endpoint
components/charts.tsx     ECharts wrapper and the four chart types
components/shell.tsx      slicers, panels, cards, dialog, loading/error states
```

## Data

`api/client.ts` calls `/api/Dashboard/<Action>` on the same backend as the
map pages. It builds the base with `apiUrl('/api')` from
`src/services/api/http.ts`, so `VITE_API_BASE_URL` is the only setting
involved. Array filters repeat the query key
(`?categories=Techno&categories=Hydro`), which is how ASP.NET binds a
`string[]` parameter. A 404 is reported as "That campaign year has no data
yet."

The `QueryClient` is created at module scope in `WeeklyGeos.tsx`. The
application unmounts a page on navigation, so a client created per mount
would be discarded and every figure refetched on each visit. At module scope
the cache outlives the mount and both pages share it. Loaded data stays
fresh for `staleTimeMs` from `config/weeklyGeos.yaml`, and window focus does
not trigger a refetch.

## How the page fits into the application

The application's own sidebar navigates to these pages, and switching pages
is done with state, without a router. `WeeklyGeos.tsx` keys
`DrillingDashboard` by `dimension`. Both sidebar entries render the same
component in the same tree position, so without the key React would keep the
filter state across navigation and a hole purpose picked on one page would
silently filter the other.

Every style is scoped under `.weekly-geos-page`, including the design tokens.
`tests/pages/pageIndependence.test.js` enforces the scoping and checks that
none of the application sidebar's class names (`.sidebar`, `.sidebar__link`,
`.sidebar__label`, `.sidebar__icon`, `.sidebar__brand`) appear here. The
charts read their tokens from the `.weekly-geos-page` element for the same
reason.

The page declares `container: inline-size`, so the grid reflows against the
main area instead of the window; a window-width media query fired a
sidebar's width too late and left four columns in 980px of space. A CSS
container is also the containing block for `position: fixed` descendants, so
the enlarged-chart dialog is portalled to `<body>` to let its backdrop cover
the whole window. The portal wrapper keeps the page class, since the
dialog's styles are scoped to it.

`App.tsx` lazy-loads the page. ECharts and the query client are about
200 kB gzipped, more than the rest of the application put together, and
someone who only opens a map should not have to download them.

## Design choices

The charts use ECharts because the weekly column chart needs a two-level
category axis, with week labels banded by month. ECharts does this with a
second x-axis; Recharts has no way to do it.

Cored proportion, deviation and recovery are the same chart: a weekly series
plus a flat campaign-average reference line. They are three configurations
of one `RateChart` component.

Three things were fixed against the Power BI model. In the original the
Techno donut was filtered to `Hydro`; here each donut binds to its own
category. The banner rendered as `Campaign W14 - W45Target: 38,000 m`,
missing a separator. The recovery chart used the unclamped measure while
deviation used the clamped one; here both are clamped to the campaign
window. As a result the numbers differ slightly from the Power BI report
during parallel running. Someone should sign this off so it does not get
filed as a bug.

## Still unsettled

- Number formats. Decimal places, thousands separators and axis ranges are a
  best guess. Screenshots of the report pages would settle it quickly.
- The KPI cards. The original had five, four of which were per-category hole
  counts beside the donuts. Those counts moved into the donut headers, and
  the top row now shows four campaign-level figures. Revert if the original
  four were what people actually read.
- Month names come from the API (`DATENAME`), so they follow the SQL
  connection's language. If the report should read in French, decide whether
  to localise in SQL or in the frontend, and do it in only one place.
- Sidebar labels. "Drilling Details" and "Drilling by Rig" are in
  `src/config/app.yaml`; the page headings are in `config/weeklyGeos.yaml`.
  They are kept separate on purpose, since a sidebar entry has less room than
  a heading, but they should keep the same meaning.
