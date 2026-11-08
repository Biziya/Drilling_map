# Frontend dependency audit — 2026-11-08

All 23 direct dependencies have confirmed uses. No packages can safely be
removed without removing application features or development tooling.
The existing npm manifest and lockfile are synchronized and remain unchanged;
no packages were removed, moved, or upgraded.

| Category | Before | After |
| --- | ---: | ---: |
| Direct runtime dependencies | 4 | 4 |
| Direct development dependencies | 19 | 19 |
| Total direct dependencies | 23 | 23 |
| Installed package locations, including transitive/peer dependencies | 393 | 393 |
| Installed locations beyond the 23 direct dependencies | 370 | 370 |
| Dependency locations recorded in `package-lock.json` | 464 | 464 |

Installed counts exclude caches and count package manifests under `node_modules`,
including nested installations. The lockfile also records optional packages for
other platforms. Those uninstalled platform variants are not unused dependencies.

## Retained packages and evidence

| Packages | Required use |
| --- | --- |
| `react`, `react-dom` | Application components, hooks, portals, and `src/main.tsx` rendering |
| `@tanstack/react-query`, `echarts` | Weekly Geos dashboard data queries and charts; both dashboard pages remain part of the frontend |
| `vite`, `@vitejs/plugin-react`, `typescript` | Development server, React integration, production bundling, and `tsc` scripts |
| `@types/react`, `@types/react-dom` | TypeScript declarations for React, JSX, and React DOM APIs |
| `tailwindcss`, `@tailwindcss/vite` | CSS import/theme/utilities in `src/index.css` and the Vite styling plugin |
| `@rollup/plugin-yaml` | Vite imports of application and page YAML configuration |
| `eslint`, `@eslint/js`, `globals`, `typescript-eslint` | ESLint CLI, rule presets, environment globals, and type-aware source linting in `eslint.config.js` |
| `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | JSX test usage tracking, hook rules, and Fast Refresh lint rules |
| `vitest`, `jsdom`, `@testing-library/react`, `fake-indexeddb` | Test runner, browser-like environment, React interaction tests, and IndexedDB/cache tests |

The map renderer, inline SVG icons, camera selection, PNG rasterization, and SVG
export use application code and browser APIs. No obsolete screenshot, map, or
standalone SVG toolbar npm dependency was found. No duplicate runtime/dev
declarations, redundant copies of the same package version, extraneous packages,
missing packages, or invalid dependency relationships were found (`npm ls --all`).

## Verification after clean installation

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Pass; 393 packages installed from the existing lockfile |
| `npm ls --all --json` | Pass; no dependency problems |
| `npm run typecheck` | Pass |
| `npm run build -- --outDir .dependency-audit-build` | Pass; existing large dashboard chunk warning remains |
| `npm run lint` | Pass; zero errors and warnings |
| `npm test` | 914 passed, 7 failed, 4 skipped |
| Development startup | Pass; Vite ready and HTTP 200 for the app entry, both map modules, dashboard/chart modules, and shared stylesheet |

Tests ran with `NODE_OPTIONS=--no-experimental-webstorage` so Node 26's native
storage does not override jsdom's `localStorage`. The seven failures match the
previously verified baseline: TechnoMap culling (one), overlapping-marker hit
tests (two), demo refresh (one), Show All rendering (one), and tooltip dismissal
(two). They are not missing-module or dependency-resolution failures.

Temporary build output and verification logs were removed after verification.
