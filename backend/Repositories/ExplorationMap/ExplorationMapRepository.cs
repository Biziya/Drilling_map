using Backend.Models.ExplorationMap;
using Dapper;
using Microsoft.Data.SqlClient;

namespace Backend.Repositories.ExplorationMap;

public sealed class ExplorationMapRepository : IExplorationMapRepository
{
    private const string Query = """
        /*==========================================================
        Exploration Map - 2026 drillholes
        ---------------------------------------------------------
        Source of truth for hole existence : HOLEDETAILS
        Everything else (collar, coords, GT, deviation) : OPTIONAL

        Purpose gate:
            include a hole only if it has exactly ONE distinct
            actual HolePurpose and it is SEDIMENT or DEVELOP.
        Status:
            never filtered, always returned as stored.

        Output columns are unchanged:
            Hole_ID, CoordinateType, X, Y, Z, Year, Campaign, GT,
            MaxDepth, HolePurpose, HoleStatus, Azimuth, FinalDeviation

        ---------------------------------------------------------
        Temp tables are prefixed #Expl* on purpose.

        SQL Server binds an entire batch before executing any of
        it, so the DROP TABLE guards below have not run yet when
        the final SELECT is compiled. If a temp table of the same
        name is already in the session from an earlier query, the
        batch is validated against THAT table's columns and fails
        with "Invalid column name" on anything the old table did
        not have - even though this script creates the column two
        hundred lines earlier.

        Both map queries originally used the same six unprefixed
        names (#Drillholes, #Collar, #GT, ...), so running them in
        one session was enough to trigger it. Prefixing keeps the
        two scripts from binding against each other's tables.
        ==========================================================*/


        ---------------------------------------------------------
        -- 1. Purpose gate  (SEDIMENT / DEVELOP only)
        --
        --    HolePurpose is compared case/whitespace-insensitively
        --    but the value RETURNED is the actual stored text.
        --
        --    Gating and reading the purpose in one place is what
        --    keeps them consistent: a hole is included only if its
        --    HolePurpose rows agree on a single value, and that
        --    same value is what comes back. A hole carrying both
        --    'SEDIMENT' and 'INJECT' rows has no unambiguous
        --    purpose, so it is excluded rather than reported as
        --    one of the two arbitrarily.
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplPurposeHoles') IS NOT NULL
            DROP TABLE #ExplPurposeHoles;

        SELECT
            p.PROJECTCODE,
            p.HOLEID,

            -- actual stored value, not the normalized comparison key
            MAX(p.RawPurpose)        AS HolePurpose,
            MAX(p.NormalizedPurpose) AS PurposeKey

        INTO #ExplPurposeHoles

        FROM
        (
            SELECT
                hd.PROJECTCODE,
                hd.HOLEID,

                NULLIF(LTRIM(RTRIM(hd.VALUE)), '')        AS RawPurpose,
                NULLIF(UPPER(LTRIM(RTRIM(hd.VALUE))), '') AS NormalizedPurpose

            FROM HOLEDETAILS hd

            WHERE hd.NAME = 'HolePurpose'
        ) p

        -- blank / whitespace-only rows are not a "conflicting purpose",
        -- but they must not become the value we return either
        WHERE p.NormalizedPurpose IS NOT NULL

        GROUP BY
            p.PROJECTCODE,
            p.HOLEID

        HAVING
                COUNT(DISTINCT p.NormalizedPurpose) = 1
            AND MAX(p.NormalizedPurpose) IN ('SEDIMENT', 'DEVELOP');


        CREATE CLUSTERED INDEX IX_ExplPurposeHoles
            ON #ExplPurposeHoles (PROJECTCODE, HOLEID);


        ---------------------------------------------------------
        -- 2. Collar rows, with STARTDATE parsed ONCE
        --
        --    TRY_CAST(STARTDATE AS DATE) alone is language- and
        --    format-dependent: a 'DD/MM/YYYY' string parses under
        --    one login's DATEFORMAT and returns NULL under
        --    another, silently dropping 2026 holes. The explicit
        --    style list removes that dependency.
        --
        --    One row per collar record is kept here; the single
        --    row per hole is chosen in 7a.
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplCollar') IS NOT NULL
            DROP TABLE #ExplCollar;

        SELECT
            c.PROJECTCODE,
            c.HOLEID,
            c.PROSPECT,

            TRY_CAST(c.DEPTH AS DECIMAL(18,4)) AS DEPTH,

            COALESCE
            (
                TRY_CONVERT(DATE, c.STARTDATE, 112),
                TRY_CONVERT(DATE, c.STARTDATE, 23),
                TRY_CONVERT(DATE, c.STARTDATE, 103),
                TRY_CONVERT(DATE, c.STARTDATE)
            ) AS ParsedStartDate

        INTO #ExplCollar

        FROM ZOOVCH_COLLAR_LIST_ALL c

        INNER JOIN #ExplPurposeHoles ph
                ON ph.HOLEID     = c.HOLEID
            AND ph.PROJECTCODE = c.PROJECTCODE;


        CREATE CLUSTERED INDEX IX_ExplCollar
            ON #ExplCollar (PROJECTCODE, HOLEID);


        ---------------------------------------------------------
        -- 3. Drillhole master list
        --
        --    A. hole has a 2026-dated collar record      -> keep
        --    B. hole has NO usable collar date at all    -> keep
        --    C. hole only has old-year dated collars     -> drop
        --
        --    Driving off #ExplPurposeHoles rather than off the collar
        --    table is also what removes the duplicate rows: a hole
        --    with two 2026 collar records used to reach the final
        --    SELECT twice.
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplDrillholes') IS NOT NULL
            DROP TABLE #ExplDrillholes;

        SELECT
            ph.PROJECTCODE,
            ph.HOLEID,
            ph.HolePurpose,

            -- HoleStatus is NEVER filtered, only reported
            MAX
            (
                CASE
                    WHEN hd.NAME = 'HoleStatus'
                    THEN NULLIF(LTRIM(RTRIM(hd.VALUE)), '')
                END
            ) AS HoleStatus,

            MAX
            (
                CASE
                    WHEN hd.NAME = 'HolePlanDepth'
                    THEN TRY_CAST(LTRIM(RTRIM(hd.VALUE)) AS DECIMAL(18,4))
                END
            ) AS HolePlanDepth

        INTO #ExplDrillholes

        FROM #ExplPurposeHoles ph

        /* NAME predicate lives in the JOIN, not the WHERE.
        In the WHERE it would silently turn this into an inner
        join and delete every hole that has no HoleStatus row. */
        LEFT JOIN HOLEDETAILS hd
                ON hd.HOLEID     = ph.HOLEID
            AND hd.PROJECTCODE = ph.PROJECTCODE
            AND hd.NAME IN ('HoleStatus', 'HolePlanDepth')

        WHERE
        (
            EXISTS
            (
                SELECT 1
                FROM #ExplCollar c
                WHERE c.HOLEID      = ph.HOLEID
                AND c.PROJECTCODE = ph.PROJECTCODE
                AND c.ParsedStartDate >= '20260101'
                AND c.ParsedStartDate <  '20270101'
            )
            OR
            NOT EXISTS
            (
                SELECT 1
                FROM #ExplCollar c
                WHERE c.HOLEID      = ph.HOLEID
                AND c.PROJECTCODE = ph.PROJECTCODE
                AND c.ParsedStartDate IS NOT NULL
            )
        )

        GROUP BY
            ph.PROJECTCODE,
            ph.HOLEID,
            ph.HolePurpose;


        CREATE CLUSTERED INDEX IX_ExplDrillholes
            ON #ExplDrillholes (PROJECTCODE, HOLEID);


        ---------------------------------------------------------
        -- 4. GT   (OPTIONAL)
        --
        --    Summed as DECIMAL rather than FLOAT so repeated
        --    additions cannot drift in the 4th decimal place the
        --    map actually bands on.
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplGT') IS NOT NULL
            DROP TABLE #ExplGT;

        SELECT
            g.PROJECTCODE,
            g.HOLEID,

            CAST
            (
                ROUND(SUM(TRY_CAST(LTRIM(RTRIM(g.VALUE)) AS DECIMAL(18,6))), 4)
                AS DECIMAL(18,4)
            ) AS GT

        INTO #ExplGT

        FROM GEODETAILS g

        INNER JOIN #ExplDrillholes d
                ON d.HOLEID      = g.HOLEID
            AND d.PROJECTCODE = g.PROJECTCODE

        WHERE g.NAME     = 'Accus'
        AND g.PRIORITY = 10075

        GROUP BY
            g.PROJECTCODE,
            g.HOLEID;


        CREATE CLUSTERED INDEX IX_ExplGT
            ON #ExplGT (PROJECTCODE, HOLEID);


        ---------------------------------------------------------
        -- 5. Approved geophysical headers   (OPTIONAL)
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplApprovedHeaders') IS NOT NULL
            DROP TABLE #ExplApprovedHeaders;

        SELECT DISTINCT
            gh.GEOPHYSGID,
            gh.PROJECTCODE,
            gh.HOLEID

        INTO #ExplApprovedHeaders

        FROM GEOPHYSHEADER gh

        INNER JOIN #ExplDrillholes d
                ON d.HOLEID      = gh.HOLEID
            AND d.PROJECTCODE = gh.PROJECTCODE

        WHERE EXISTS
        (
            SELECT 1
            FROM GEOPHYSHEADERDETAILS ghd
            WHERE ghd.GEOPHYSGID = gh.GEOPHYSGID
            AND ghd.NAME       = 'GeophysApproved'
            AND LTRIM(RTRIM(ghd.VALUE)) = '1'
        );


        CREATE CLUSTERED INDEX IX_ExplApprovedHeaders
            ON #ExplApprovedHeaders (GEOPHYSGID);


        ---------------------------------------------------------
        -- 6. Azimuth / FinalDeviation   (OPTIONAL)
        --
        --    FinalDeviation is NOT a measured column. It is
        --    derived, and the mechanic below mirrors the reference
        --    DevData view exactly:
        --
        --      a) take the DEEPEST approved station in the hole
        --      b) at that station, read AzimuthAdj,
        --         EastingBalanced and NorthingBalanced
        --      c) round Easting/Northing to 3 dp FIRST, then
        --         FinalDeviation = SQRT(E^2 + N^2) rounded to 2 dp
        --
        --    The rounding order in (c) is load-bearing. Squaring
        --    the raw floats and rounding only at the end differs
        --    from the view in the last digit, which is the digit
        --    the map bands on.
        --
        --    Azimuth and the deviation pair are read from the SAME
        --    deepest station, matching the view. That means a hole
        --    whose deepest station carries an AzimuthAdj but no
        --    balanced coordinates reports FinalDeviation = NULL.
        --    That is the defined behaviour, not a fault.
        --
        --    Grain is (PROJECTCODE, HOLEID, DEPTH rounded to 2 dp),
        --    which reproduces the view's
        --    "round(DEPTH,2) = round(MaxDepth,2)" match and folds
        --    together stations from two approved surveys at the
        --    same depth, as the view's PIVOT max(VALUE) does.
        --
        --    Note: the view filters PROJECTCODE = 'ZOOVCH'. That is
        --    deliberately NOT copied - #ExplApprovedHeaders is
        --    already restricted to this result set's holes, so the
        --    query stays project-agnostic.
        --
        --    The view also returns TVDBalanced as TVD_Final. There
        --    is no TVD column in the output contract, so it is not
        --    selected here.
        ---------------------------------------------------------

        IF OBJECT_ID('tempdb..#ExplDeviation') IS NOT NULL
            DROP TABLE #ExplDeviation;

        ;WITH Stations AS
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

            FROM #ExplApprovedHeaders ah

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
        )

        SELECT
            PROJECTCODE,
            HOLEID,

            CAST(MAX(Azimuth) AS DECIMAL(18,3)) AS Azimuth,

            /* ROUND before SQUARE, matching the view. The outer
            MAX only collapses the single qualifying group to one
            row per hole; it is not picking between stations. */
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

        INTO #ExplDeviation

        FROM DeepestStation

        WHERE DepthRounded = MaxDepthRounded

        GROUP BY
            PROJECTCODE,
            HOLEID;


        CREATE CLUSTERED INDEX IX_ExplDeviation
            ON #ExplDeviation (PROJECTCODE, HOLEID);


        ---------------------------------------------------------
        -- 7. FINAL RESULT
        --
        --    One row per (PROJECTCODE, HOLEID):
        --      #ExplDrillholes  is grouped to one row per hole
        --      collar/coord are OUTER APPLY TOP (1)
        --      #ExplGT/#ExplDeviation are grouped to one row per hole
        --    so nothing here can fan a hole out into duplicates.
        --
        --    Every optional source is OUTER APPLY or LEFT JOIN, so
        --    a hole with no coordinates, no GT and no survey still
        --    comes back - with NULLs, not as a missing row.
        ---------------------------------------------------------

        SELECT
            d.HOLEID AS Hole_ID,

            coord.COORDINATESET AS CoordinateType,

            TRY_CAST(coord.X AS DECIMAL(18,4)) AS X,
            TRY_CAST(coord.Y AS DECIMAL(18,4)) AS Y,
            TRY_CAST(coord.Z AS DECIMAL(18,4)) AS Z,

            2026 AS [Year],

            collar.PROSPECT AS Campaign,

            gt.GT,

            -- actual collar depth first, HolePlanDepth as fallback.
            -- explicit CAST so the column is decimal, not float or
            -- varchar, for the DTO's decimal? MaxDepth
            CAST
            (
                COALESCE(collar.DEPTH, d.HolePlanDepth)
                AS DECIMAL(18,4)
            ) AS MaxDepth,

            d.HolePurpose,   -- actual stored value
            d.HoleStatus,    -- unfiltered

            dev.Azimuth,
            dev.FinalDeviation

        FROM #ExplDrillholes d


        ---------------------------------------------------------
        -- 7a. Collar: prefer a 2026 record, then an undated one.
        --     Old-year collars are never selected here, so they
        --     cannot leak 2026 depth/campaign values.
        ---------------------------------------------------------

        OUTER APPLY
        (
            SELECT TOP (1)
                c.PROSPECT,
                c.DEPTH,
                c.ParsedStartDate

            FROM #ExplCollar c

            WHERE c.HOLEID      = d.HOLEID
            AND c.PROJECTCODE = d.PROJECTCODE
            AND
            (
                    (c.ParsedStartDate >= '20260101' AND c.ParsedStartDate < '20270101')
                OR  c.ParsedStartDate IS NULL
            )

            ORDER BY
                CASE WHEN c.ParsedStartDate IS NOT NULL THEN 1 ELSE 2 END,
                c.ParsedStartDate DESC,
                c.DEPTH DESC            -- deterministic tie-break
        ) collar


        ---------------------------------------------------------
        -- 7b. Coordinate: exactly one row per hole
        --     Surveyed -> Pegged -> Planned
        --
        --     Matched on the normalized value: under a
        --     case-sensitive collation the old literal list missed
        --     'UTM_Z49N_PLANNED' entirely and the hole came back
        --     with no coordinates at all.
        ---------------------------------------------------------

        OUTER APPLY
        (
            SELECT TOP (1)
                hc.COORDINATESET,
                hc.X,
                hc.Y,
                hc.Z

            FROM HOLECOORD hc

            WHERE hc.HOLEID      = d.HOLEID
            AND hc.PROJECTCODE = d.PROJECTCODE
            AND UPPER(LTRIM(RTRIM(hc.COORDINATESET))) IN
                (
                    'UTM_Z49N_SURVEYED',
                    'UTM_Z49N_PEGGED',
                    'UTM_Z49N_PLANNED'
                )

            ORDER BY
                CASE UPPER(LTRIM(RTRIM(hc.COORDINATESET)))
                    WHEN 'UTM_Z49N_SURVEYED' THEN 1
                    WHEN 'UTM_Z49N_PEGGED'   THEN 2
                    WHEN 'UTM_Z49N_PLANNED'  THEN 3
                    ELSE 4
                END,
                -- within the winning set, prefer a populated row
                CASE WHEN hc.X IS NOT NULL AND hc.Y IS NOT NULL THEN 0 ELSE 1 END,
                hc.X, hc.Y              -- deterministic tie-break
        ) coord


        LEFT JOIN #ExplGT gt
                ON gt.HOLEID      = d.HOLEID
            AND gt.PROJECTCODE = d.PROJECTCODE

        LEFT JOIN #ExplDeviation dev
                ON dev.HOLEID      = d.HOLEID
            AND dev.PROJECTCODE = d.PROJECTCODE

        ORDER BY
            d.PROJECTCODE,
            d.HOLEID;
        """;

    private readonly string _connectionString;

    public ExplorationMapRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured.");
    }

    public async Task<IReadOnlyList<ExplorationMapDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        var command = new CommandDefinition(
            Query,
            cancellationToken: cancellationToken);

        var drillholes = await connection.QueryAsync<ExplorationMapDto>(command);

        return drillholes.AsList();
    }
}
