# Drilling Map

An internal website for following the drilling programme. It has four pages:

- Exploration Map: 2026 exploration drillholes coloured by GT band, on the redox, geological or white grid base map.
- Techno Map: technological wells by type, with layer filters, a selection table and Excel/CSV export.
- Drilling Details and Drilling by Rig: weekly metres, targets, coring, deviation and recovery charts (the former Power BI report).

Both maps can measure distances and export a dragged area as PNG or SVG.

The repository has two parts:

- [`backend/`](backend/README.md): ASP.NET Core API (.NET 10, Dapper, SQL Server).
- [`frontend/`](frontend/README.md): React + TypeScript site built with Vite.

## Running it locally

Start the API (listens on `http://localhost:5236`):

```bash
cd backend
dotnet run
```

Then the website, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env` points the site at `http://localhost:5236`. The API needs network access to the SQL Server named in `backend/appsettings.json`; without it the pages load but show the backend as offline.

## Checks

From `frontend/`: `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. From `backend/`: `dotnet build`. The backend has no automated tests.

## Versioning

The website version is in [VERSION](VERSION) (`MAJOR.MINOR.PATCH.BUILD`, for example `1.1.1.1`) and is shown in the sidebar. Every merge to `main` that changes the website bumps it and adds an entry to [CHANGELOG.md](CHANGELOG.md). [VERSIONING.md](VERSIONING.md) explains which part to bump and how.
