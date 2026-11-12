# Changelog

Every version of the Drilling Map website, newest first. The version format
and when to bump each part are in [VERSIONING.md](VERSIONING.md). Write each
entry for the people using the site: what they can now do, or what got fixed.

## 1.1.2.0 - 2026-11-12

- The Techno Map no longer offers a "Technological cells" layer. Only the old
  demo dataset had cell outlines, so the checkbox never showed anything on
  real data.
- The demo datasets for the Techno Map and the dashboards are gone. Both
  always read the backend.
- Code and documentation cleanup with no other visible change.

## 1.1.1.1 - 2026-11-12

First numbered version. What the website does today:

- Exploration Map: drillholes by GT band on the Redox, Geological or White
  Grid map, with measurement, map export (PNG/SVG) and a help dialog.
- Techno Map: drillholes by type on the Geological or White Grid map, layer
  filters, measurement, map export and a help dialog.
- Techno Map selection: Ctrl+click or the area tool selects holes. The
  selection table filters, sorts, hides columns and exports to Excel or CSV,
  and stays fast with 5,000 holes selected.
- Drilling Details and Drilling by Rig dashboards.
- The sidebar shows the backend status and this version number.
