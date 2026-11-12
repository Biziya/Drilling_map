# Drilling Map backend

ASP.NET Core Web API (.NET 10) that reads drilling data from SQL Server with Dapper and serves it to the frontend. It has three areas:

- the Exploration Map: `GET /api/exploration-map`
- the Techno Map: `GET /api/techno-map`
- the Drilling Details and Drilling by Rig dashboards: `GET /api/Dashboard/<Action>`

`GET /api/health` returns 200 without touching the database. The frontend polls it for the Online/Offline indicator in the sidebar.

## Folder structure

```text
backend/
├── Controllers/
│   ├── Dashboard/DashboardController.cs
│   ├── ExplorationMap/ExplorationMapController.cs
│   └── TechnoMap/TechnoMapController.cs
├── Models/
│   ├── Dashboard/          CampaignOptions.cs, DashboardDtos.cs, Hole.cs
│   ├── ExplorationMap/     ExplorationMapDto.cs
│   └── TechnoMap/          TechnoMapCategory.cs, TechnoMapDto.cs
├── Repositories/
│   ├── Dashboard/HoleRepository.cs
│   ├── ExplorationMap/ExplorationMapRepository.cs
│   └── TechnoMap/TechnoMapRepository.cs
├── Services/               CampaignWeek.cs, DrillingService.cs
├── Sql/Reconcile.sql       hand-run checks against the old Power BI numbers
├── Properties/launchSettings.json
├── appsettings.json
├── backend.csproj
└── Program.cs
```

A request goes controller → repository (one SQL query through Dapper) → DTO → JSON. The dashboard adds one step: `HoleRepository` loads a campaign year's holes once (cached for 5 minutes) and `DrillingService` computes every chart from that list in memory.

## Run locally

```bash
dotnet restore
dotnet run
```

The `http` profile listens on `http://localhost:5236`. Swagger UI is at `/swagger` when `ASPNETCORE_ENVIRONMENT` is `Development`. Use `dotnet watch run` to restart on changes.

```powershell
Invoke-WebRequest http://localhost:5236/api/health
Invoke-WebRequest http://localhost:5236/api/exploration-map
Invoke-WebRequest http://localhost:5236/api/techno-map
Invoke-WebRequest "http://localhost:5236/api/Dashboard/Filters?year=2026"
```

## Build and publish

```bash
dotnet build
dotnet publish -c Release -o publish
```

## Configuration

`appsettings.json` holds three sections:

- `ConnectionStrings:DefaultConnection`: the SQL Server connection used by every repository.
- `SourceTable`: schema and name of the table the dashboard reads (`dbo.DRILLING_PROGRESS`).
- `Campaigns`: the dashboard's yearly targets (`Targets`), optional status and project filters, the category rules copied from the Power BI model, and which donuts to show. The `"//..."` keys next to each setting explain the current values.

Do not commit real database credentials to source control.

## Exploration Map: `GET /api/exploration-map`

Returns an array of drillholes:

```json
[
  {
    "holeId": "IZO_447_053_36_A_",
    "coordinateType": "UTM_Z49N_Surveyed",
    "x": 420917.76,
    "y": 4893215.79,
    "z": 710,
    "year": 2026,
    "campaign": "ZOOVCH OVOO - 2026",
    "gt": 0.8505,
    "maxDepth": 180.5,
    "azimuth": 135.246,
    "finalDeviation": 2.35,
    "holePurpose": "DEVELOP",
    "holeStatus": "INPROGRESS"
  }
]
```

| Field | Type | Description |
| --- | --- | --- |
| `holeId` | string | Drillhole identifier. |
| `coordinateType` | string | Which coordinate record was used (see below). |
| `x`, `y` | number | UTM zone 49N easting and northing. |
| `z` | number | Elevation. |
| `year` | integer | Drillhole year. The query currently returns 2026 only. |
| `campaign` | string | Prospect or campaign name. |
| `gt` | number | GT calculated from `GEODETAILS`. |
| `maxDepth` | number | Final depth, or the planned depth when there is no final one. |
| `azimuth` | number | Azimuth from the deepest approved geophysical measurement. |
| `finalDeviation` | number | Horizontal deviation from the balanced easting and northing. |
| `holePurpose` | string | `DEVELOP` or `SEDIMENT`. |
| `holeStatus` | string | Status as stored. `INPROGRESS` marks an active rig. |

Each hole gets one coordinate record, chosen in this order: `UTM_Z49N_Surveyed`, then `UTM_Z49N_Pegged`, then `UTM_Z49N_Planned`.

The query takes holes started in 2026 whose `HOLEDETAILS` rows agree on one purpose, `DEVELOP` or `SEDIMENT`. Status is never filtered. Holes without GT or deviation data are still returned, with those fields null.

## Techno Map: `GET /api/techno-map`

Returns one object per row of `[ACQMN01].[dbo].[pyISR_AllData_V2]`, unfiltered.

| Field | View column or source |
| --- | --- |
| `id` | `[ID]` |
| `holeId` | `[Key]`, trimmed |
| `holePurpose` | `[Type]`, as stored |
| `holeStatus` | `[Status]`, as stored. `INPROGRESS` draws the rig |
| `x`, `y`, `z` | `[X (m)]`, `[Y (m)]`, `[Z (well head - topo) (m)]` |
| `relativeLevel`, `license`, `stratigraphicUnit` | `[Relative level]`, `[License]`, `[Stratigraphic Unit]` |
| `screenMinDepth`, `screenMaxDepth`, `screenLength`, `screenTopAltitude`, `screenBottomAltitude` | the `[Screen ...]` columns |
| `drillingCompany`, `drillingRig` | `[Drilling company]`, `[Drilling Rig]` |
| `startDate`, `endDate`, `billingDate` | `[STARTDATE]`, `[ENDDATE]`, `[BillingDate]` as `yyyy-MM-dd`, or null |
| `generalComment` | `[GeneralComment]` |
| `raGradeSampling`, `sedimentSampling` | `[Ra_Grade_Sampling]`, `[Sediment_Sampling]`: 1 is true, 0 is false, NULL is null |
| `azimuth`, `finalDeviation` | the deviation calculation below |
| `deviationEndX`, `deviationEndY` | `x + finalDeviation·sin(azimuth)`, `y + finalDeviation·cos(azimuth)`; null without a usable survey |
| `category` | the Techno Map filter, below |

### Category

`Models/TechnoMap/TechnoMapCategory.cs` picks one category per row:

1. `raGradeSampling = true` gives `ra-grade-sampling`.
2. `sedimentSampling = true` gives `sediment-sampling`.
3. Otherwise `[Type]` decides (trimmed, case-insensitive):

| Type | Category |
| --- | --- |
| `DEVELOP` | `development` |
| `EXPLO` | `exploration` |
| `GEOTECHNICAL` | `geotechnical` |
| `INJECT` | `injector` |
| `PIEZO` | `monitoring` |
| `PRODUCT` | `producer` |
| `EAU`, `WATER_WELL` | `water` |
| `CONTROLE`, `HYDRO_WELL`, `SEDIMENT`, `SER`, anything else | `null`, which no filter shows |

### Deviation

The query uses approved geophysical headers (`GeophysApproved = 1`) and the deepest station (depth rounded to 2 dp). `azimuth` is `AzimuthAdj` at that station, and `finalDeviation = √(E² + N²)` of `EastingBalanced` and `NorthingBalanced`, each rounded to 3 dp first. Surveys are matched on `HOLEID = [Key]`. The view has no `PROJECTCODE`, so a `HOLEID` surveyed in more than one project gets no deviation instead of another hole's.

## Dashboard: `GET /api/Dashboard/<Action>`

All actions take `year`, and optionally repeated `categories` and `rigs` query parameters (empty means no filter). `Summary`, `CampaignAverages` and `TypeSplit` also take `fromWeek` and `toWeek` for a week range picked on the bar chart.

| Action | Returns |
| --- | --- |
| `Filters` | campaign years with their targets, the category and rig lists (each narrowed by the other selection), and the donuts to draw |
| `Summary` | hole count, campaign start and end week, and the annual target |
| `Weekly` | one row per week: metres, cumulative metres against the target ramp, % cored, average deviation and recovery; `groupBy=rig` returns metres per rig per week instead |
| `CampaignAverages` | campaign averages for deviation, recovery and % cored (the flat reference lines) |
| `TypeSplit` | per category: cored metres, destructive metres and hole count, for the donuts |

Weeks are counted by the week a hole started, as the Power BI model did (`Services/CampaignWeek.cs`).

## Server notes

The production site runs under IIS from `C:\inetpub\wwwroot\Drilling-Maps\backend`.

```powershell
iisreset                                         # restart IIS
cd C:\inetpub\wwwroot\Drilling-Maps\backend
Get-Content .\appsettings.Production.json        # show production settings
dotnet backend.dll                               # run the API by hand
```

If the port will not bind, check whether Windows has reserved it:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Checking the server from another machine:

```powershell
Invoke-WebRequest http://10.10.20.50:5236/api/exploration-map
Invoke-WebRequest http://10.10.20.50:5236/api/techno-map
```
