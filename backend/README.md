
# Backend Maps API

The backend exposes two independent endpoints with the same initial query and
response structure:

- `GET /api/exploration-map`
- `GET /api/techno-map`

The former `/api/drillhole-map` route has been removed.

## Build command
```bash
dotnet publish -c Release -o publish
```


## Server Useful commands

```bash
iisreset   # reset ISS server 
```

```bash 
cd C:\inetpub\wwwroot\Drilling-Maps\backend  # Go to project folder 
Get-Content .\appsettings.Production.json    # Get varible information 
``` 


```bash 
cd C:\inetpub\wwwroot\Drilling-Maps\backend  # Go to project folder 
dotnet backend.dll                           # Manual run dotnet project
```


## Windows excluded/reserved
```bash
netsh interface ipv4 show excludedportrange protocol=tcp
```


```bash
Invoke-WebRequest http://localhost:5236/api/exploration-map # local checking
Invoke-WebRequest http://localhost:5236/api/techno-map      # local checking

Invoke-WebRequest http://10.10.20.50:5236/api/exploration-map
Invoke-WebRequest http://10.10.20.50:5236/api/techno-map
```

# Drilling Maps Backend API

ASP.NET Core Web API that provides exploration and techno map drillhole data from SQL Server using Dapper.

## Project Folder Structure

```text
backend/
├── Controllers/
│   ├── ExplorationMap/
│   │   └── ExplorationMapController.cs
│   └── TechnoMap/
│       └── TechnoMapController.cs
├── Models/
│   ├── ExplorationMap/
│   │   └── ExplorationMapDto.cs
│   └── TechnoMap/
│       └── TechnoMapDto.cs
├── Repositories/
│   ├── ExplorationMap/
│   │   ├── IExplorationMapRepository.cs
│   │   └── ExplorationMapRepository.cs
│   └── TechnoMap/
│       ├── ITechnoMapRepository.cs
│       └── TechnoMapRepository.cs
├── Properties/
│   └── launchSettings.json
├── appsettings.json
├── appsettings.Development.json
├── backend.csproj
├── backend.http
├── Program.cs
└── README.md
```

## API Endpoints

### Exploration Map

```http
GET /api/exploration-map
```

Returns the exploration map drillholes.

Local example:

```text
http://localhost:5236/api/exploration-map
```

### Techno Map

```http
GET /api/techno-map
```

Returns the TechnoMap drillholes.

Local example:

```text
http://localhost:5236/api/techno-map
```

The two endpoints have separate controllers, repositories, interfaces, and DTOs. The Techno Map reads `[ACQMN01].[dbo].[pyISR_AllData_V2]`; see [Techno Map Response](#techno-map-response). The sections below up to it describe the Exploration Map.

The old endpoint below has been removed:

```http
GET /api/drillhole-map
```

## API Response Format

Both endpoints return an array of drillhole objects in JSON format.

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

## Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `holeId` | string | Unique drillhole identifier. |
| `coordinateType` | string | Coordinate source selected by priority: surveyed, pegged, then planned. |
| `x` | number | UTM Zone 49N easting coordinate. |
| `y` | number | UTM Zone 49N northing coordinate. |
| `z` | number | Elevation coordinate. |
| `year` | integer | Drillhole year. The current query returns 2026. |
| `campaign` | string | Prospect or campaign name. |
| `gt` | number | Calculated GT value. |
| `maxDepth` | number | Final or planned drillhole depth. |
| `azimuth` | number | Azimuth from the deepest approved geophysical measurement. |
| `finalDeviation` | number | Final horizontal deviation calculated from balanced easting and northing. |
| `holePurpose` | string | Hole purpose, such as `DEVELOP` or `SEDIMENT`. |
| `holeStatus` | string | Current hole status. `INPROGRESS` identifies an active rig. |

## Coordinate Selection Priority

The API returns one coordinate record per drillhole using this priority:

1. `UTM_Z49N_Surveyed`
2. `UTM_Z49N_Pegged`
3. `UTM_Z49N_Planned`

## Data Filtering

The current SQL query:

- Selects drillholes with a start date in 2026.
- Includes hole purposes `DEVELOP` and `SEDIMENT`.
- Retrieves hole status from `HOLEDETAILS`.
- Calculates GT from `GEODETAILS`.
- Uses approved geophysical records for azimuth and final deviation.
- Keeps drillholes even when optional GT or deviation information is unavailable.

## Techno Map Response

`GET /api/techno-map` returns one object per row of `[ACQMN01].[dbo].[pyISR_AllData_V2]`, unfiltered. Names the frontend already used are kept (`holeId`, `holePurpose`, `holeStatus`, `x`/`y`/`z`, `azimuth`, `finalDeviation`).

| Field | View column / source |
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
| `raGradeSampling`, `sedimentSampling` | `[Ra_Grade_Sampling]`, `[Sediment_Sampling]`: 1 → true, 0 → false, NULL → null |
| `azimuth`, `finalDeviation` | the deviation calculation below |
| `deviationEndX`, `deviationEndY` | `x + finalDeviation·sin(azimuth)`, `y + finalDeviation·cos(azimuth)`; null without a usable survey |
| `category` | the Techno Map filter, below |

### Category

Resolved in `Models/TechnoMap/TechnoMapCategory.cs`, one per row:

1. `raGradeSampling = true` → `ra-grade-sampling`
2. `sedimentSampling = true` → `sediment-sampling`
3. otherwise `[Type]` (trimmed, case-insensitive):

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

Unchanged from the previous Techno Map query: approved geophysical headers (`GeophysApproved = 1`), the deepest station (depth rounded to 2 dp), `AzimuthAdj` there, and `FinalDeviation = √(E² + N²)` of `EastingBalanced`/`NorthingBalanced` each rounded to 3 dp first. Surveys are matched on `HOLEID = [Key]`; the view has no `PROJECTCODE`, so a `HOLEID` surveyed in more than one project gets no deviation rather than another hole's.

## Backend Flow

```text
Frontend request
    ↓
API controller
    ↓
Repository interface
    ↓
Dapper repository
    ↓
SQL Server query
    ↓
DTO mapping
    ↓
JSON response
```

## Configuration

The SQL Server connection is read from `DefaultConnection` in `appsettings.json` or the active environment-specific settings file.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "your-sql-server-connection-string"
  }
}
```

Do not commit real database credentials to source control.

## Run Locally

```bash
dotnet restore
dotnet run
```

For automatic restart during development:

```bash
dotnet watch run
```

## Build and Publish

```bash
dotnet build
dotnet publish -c Release -o publish
```

## Test the Endpoints

```powershell
Invoke-WebRequest http://localhost:5236/api/exploration-map
Invoke-WebRequest http://localhost:5236/api/techno-map
```


