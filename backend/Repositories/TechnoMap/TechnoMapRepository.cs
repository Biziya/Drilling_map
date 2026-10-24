using Backend.Models.TechnoMap;
using Dapper;
using Microsoft.Data.SqlClient;

namespace Backend.Repositories.TechnoMap;

public sealed class TechnoMapRepository : ITechnoMapRepository
{
    private const string Query = """
        /*==========================================================
        Techno Map
        ---------------------------------------------------------
        Drillholes : [ACQMN01].[dbo].[pyISR_AllData_V2], one row
                     out per row in, never filtered.
        Deviation  : the existing Techno Map calculation over the
                     approved geophysical surveys, unchanged, for
                     the view's [Key] values (Key = HOLEID).

        Every view column is cast explicitly, so the DTO types
        hold whatever the view's own column types are.

        The filter category (Type + sampling flags) is resolved
        in TechnoMapCategory.cs, not here.
        ==========================================================*/

        WITH Holes AS
        (
            SELECT
                v.[ID],
                NULLIF(LTRIM(RTRIM(v.[Key])), '') AS HoleKey,
                v.[Relative level],
                v.[Type],
                v.[License],
                v.[Stratigraphic Unit],

                TRY_CAST(v.[X (m)] AS DECIMAL(18,4)) AS X,
                TRY_CAST(v.[Y (m)] AS DECIMAL(18,4)) AS Y,
                TRY_CAST(v.[Z (well head - topo) (m)] AS DECIMAL(18,4)) AS Z,

                TRY_CAST(v.[Screen min depth (m)]       AS DECIMAL(18,4)) AS ScreenMinDepth,
                TRY_CAST(v.[Screen max depth (m)]       AS DECIMAL(18,4)) AS ScreenMaxDepth,
                TRY_CAST(v.[Screen length (m)]          AS DECIMAL(18,4)) AS ScreenLength,
                TRY_CAST(v.[Screen top altitude (m)]    AS DECIMAL(18,4)) AS ScreenTopAltitude,
                TRY_CAST(v.[Screen bottom altitude (m)] AS DECIMAL(18,4)) AS ScreenBottomAltitude,

                v.[Status],
                v.[Drilling company],
                v.[Drilling Rig],
                v.[STARTDATE],
                v.[ENDDATE],
                v.[BillingDate],
                v.[GeneralComment],

                -- 0/1 flags; BIT also accepts bit, numeric and 'true'/'false'.
                TRY_CAST(v.[Ra_Grade_Sampling] AS BIT) AS RaGradeSampling,
                TRY_CAST(v.[Sediment_Sampling] AS BIT) AS SedimentSampling

            FROM [ACQMN01].[dbo].[pyISR_AllData_V2] v
        ),

        ---------------------------------------------------------
        -- Deviation: the previous Techno Map query, step for step.
        --
        --   a) approved geophysical headers (GeophysApproved = 1)
        --   b) the DEEPEST station, depth rounded to 2 dp
        --   c) at that station: AzimuthAdj, and
        --      FinalDeviation = SQRT(E^2 + N^2) of EastingBalanced
        --      and NorthingBalanced, each rounded to 3 dp FIRST,
        --      the result rounded to 2 dp (mirrors DevData)
        ---------------------------------------------------------

        ApprovedHeaders AS
        (
            SELECT DISTINCT
                gh.GEOPHYSGID,
                gh.PROJECTCODE,
                gh.HOLEID

            FROM GEOPHYSHEADER gh

            WHERE gh.HOLEID IN (SELECT h.HoleKey FROM Holes h)
            AND EXISTS
            (
                SELECT 1
                FROM GEOPHYSHEADERDETAILS ghd
                WHERE ghd.GEOPHYSGID = gh.GEOPHYSGID
                AND ghd.NAME       = 'GeophysApproved'
                AND LTRIM(RTRIM(ghd.VALUE)) = '1'
            )
        ),

        Stations AS
        (
            SELECT
                ah.PROJECTCODE,
                ah.HOLEID,

                ROUND(TRY_CAST(gd.DEPTH AS FLOAT), 2) AS DepthRounded,

                MAX(CASE WHEN gd.NAME = 'AzimuthAdj'
                        THEN TRY_CAST(gd.VALUE AS FLOAT) END) AS Azimuth,

                MAX(CASE WHEN gd.NAME = 'EastingBalanced'
                        THEN TRY_CAST(gd.VALUE AS FLOAT) END) AS EastingBalanced,

                MAX(CASE WHEN gd.NAME = 'NorthingBalanced'
                        THEN TRY_CAST(gd.VALUE AS FLOAT) END) AS NorthingBalanced

            FROM ApprovedHeaders ah

            INNER JOIN GEOPHYSDETAILS gd
                    ON gd.GEOPHYSGID = ah.GEOPHYSGID

            WHERE gd.NAME IN ('AzimuthAdj', 'EastingBalanced', 'NorthingBalanced')

            /* a station with an unparseable DEPTH cannot be ranked,
            and must not become the "deepest" one by accident */
            AND TRY_CAST(gd.DEPTH AS FLOAT) IS NOT NULL

            GROUP BY
                ah.PROJECTCODE,
                ah.HOLEID,
                ROUND(TRY_CAST(gd.DEPTH AS FLOAT), 2)
        ),

        DeepestStation AS
        (
            SELECT
                s.*,

                MAX(s.DepthRounded) OVER
                (
                    PARTITION BY s.PROJECTCODE, s.HOLEID
                ) AS MaxDepthRounded

            FROM Stations s
        ),

        DeviationByProject AS
        (
            SELECT
                PROJECTCODE,
                HOLEID,

                CAST(MAX(Azimuth) AS DECIMAL(18,3)) AS Azimuth,

                CAST
                (
                    MAX
                    (
                        CASE
                            WHEN EastingBalanced  IS NOT NULL
                            AND NorthingBalanced IS NOT NULL
                            THEN ROUND
                                (
                                    SQRT
                                    (
                                        SQUARE(ROUND(EastingBalanced, 3))
                                        + SQUARE(ROUND(NorthingBalanced, 3))
                                    ),
                                    2
                                )
                        END
                    )
                    AS DECIMAL(18,2)
                ) AS FinalDeviation

            FROM DeepestStation

            WHERE DepthRounded = MaxDepthRounded

            GROUP BY
                PROJECTCODE,
                HOLEID
        ),

        ---------------------------------------------------------
        -- The view has no PROJECTCODE, so surveys are matched on
        -- HOLEID alone. A HOLEID surveyed in more than one project
        -- is ambiguous: it gets no deviation rather than another
        -- hole's line.
        ---------------------------------------------------------

        Deviation AS
        (
            SELECT
                HOLEID,
                MAX(Azimuth)        AS Azimuth,
                MAX(FinalDeviation) AS FinalDeviation

            FROM DeviationByProject

            GROUP BY HOLEID

            HAVING COUNT(*) = 1
        )

        SELECT
            CONVERT(NVARCHAR(100), h.[ID])                   AS Id,
            CONVERT(NVARCHAR(100), h.HoleKey)                AS HoleId,
            CONVERT(NVARCHAR(100), h.[Relative level])       AS RelativeLevel,
            CONVERT(NVARCHAR(100), h.[Type])                 AS HolePurpose,
            CONVERT(NVARCHAR(200), h.[License])              AS License,
            CONVERT(NVARCHAR(200), h.[Stratigraphic Unit])   AS StratigraphicUnit,

            h.X,
            h.Y,
            h.Z,

            h.ScreenMinDepth,
            h.ScreenMaxDepth,
            h.ScreenLength,
            h.ScreenTopAltitude,
            h.ScreenBottomAltitude,

            CONVERT(NVARCHAR(100), h.[Status])               AS HoleStatus,
            CONVERT(NVARCHAR(200), h.[Drilling company])     AS DrillingCompany,
            CONVERT(NVARCHAR(200), h.[Drilling Rig])         AS DrillingRig,

            CONVERT(CHAR(10), startDate.Value, 23)           AS StartDate,
            CONVERT(CHAR(10), endDate.Value, 23)             AS EndDate,
            CONVERT(CHAR(10), billingDate.Value, 23)         AS BillingDate,

            CONVERT(NVARCHAR(MAX), h.[GeneralComment])       AS GeneralComment,

            h.RaGradeSampling,
            h.SedimentSampling,

            dev.Azimuth,
            dev.FinalDeviation,

            -- Azimuth is a compass bearing (0 = north, 90 = east), so
            -- sine moves the easting and cosine the northing. Same
            -- validity rules the map applied before: a placed collar,
            -- an azimuth in 0..360 and a positive deviation.
            CASE
                WHEN h.X IS NOT NULL AND h.Y IS NOT NULL
                AND dev.Azimuth BETWEEN 0 AND 360
                AND dev.FinalDeviation > 0
                THEN CAST(h.X + dev.FinalDeviation * SIN(RADIANS(CAST(dev.Azimuth AS FLOAT))) AS DECIMAL(18,4))
            END AS DeviationEndX,

            CASE
                WHEN h.X IS NOT NULL AND h.Y IS NOT NULL
                AND dev.Azimuth BETWEEN 0 AND 360
                AND dev.FinalDeviation > 0
                THEN CAST(h.Y + dev.FinalDeviation * COS(RADIANS(CAST(dev.Azimuth AS FLOAT))) AS DECIMAL(18,4))
            END AS DeviationEndY

        FROM Holes h

        LEFT JOIN Deviation dev
               ON dev.HOLEID = h.HoleKey

        /* Dates may be stored as text in several formats; the
        explicit styles keep parsing independent of the login's
        DATEFORMAT, as in the previous query's STARTDATE. */
        CROSS APPLY (SELECT COALESCE(
            TRY_CONVERT(DATE, h.[STARTDATE], 112), TRY_CONVERT(DATE, h.[STARTDATE], 23),
            TRY_CONVERT(DATE, h.[STARTDATE], 103), TRY_CONVERT(DATE, h.[STARTDATE])) AS Value) startDate
        CROSS APPLY (SELECT COALESCE(
            TRY_CONVERT(DATE, h.[ENDDATE], 112), TRY_CONVERT(DATE, h.[ENDDATE], 23),
            TRY_CONVERT(DATE, h.[ENDDATE], 103), TRY_CONVERT(DATE, h.[ENDDATE])) AS Value) endDate
        CROSS APPLY (SELECT COALESCE(
            TRY_CONVERT(DATE, h.[BillingDate], 112), TRY_CONVERT(DATE, h.[BillingDate], 23),
            TRY_CONVERT(DATE, h.[BillingDate], 103), TRY_CONVERT(DATE, h.[BillingDate])) AS Value) billingDate

        ORDER BY
            h.HoleKey,
            h.[ID];
        """;

    private readonly string _connectionString;

    public TechnoMapRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured.");
    }

    public async Task<IReadOnlyList<TechnoMapDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var command = new CommandDefinition(
            Query,
            cancellationToken: cancellationToken);

        var drillholes = await connection.QueryAsync<TechnoMapDto>(command);

        return drillholes.AsList();
    }
}
