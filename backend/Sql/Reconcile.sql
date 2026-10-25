/* =====================================================================
   Reconciliation against Power BI

   Run these against the live table and compare each result to the
   corresponding figure in the Power BI report. They are ordered so the
   first one that disagrees tells you where the divergence is, instead of
   leaving you to guess between half a dozen candidates.

   All read-only. Week numbering uses the same deterministic formula as
   CampaignWeek.cs, so no SET DATEFIRST is needed and these numbers are
   directly comparable to the API's.
   ===================================================================== */

-- Shared week calculation, repeated in each query so they can be run
-- independently.  WEEKNUM(d, 2): Monday start, week 1 contains 1 January.
--   monday(d)  = DATEADD(day, -(DATEDIFF(day,'19000101',d) % 7), d)
--   week       = DATEDIFF(day, monday(jan1), monday(d)) / 7 + 1


/* ---------------------------------------------------------------------
   1. TOTALS BY YEAR — start here

   Compare "Holes" against the Drilling Count card with each year
   selected, and "Metres" against the last point of the cumulative line.

   If these already differ, the problem is which rows are in scope, not
   how they are aggregated, and queries 3 to 5 will say why.
   --------------------------------------------------------------------- */

SELECT YEAR(StartingDate)                       AS StartYear,
       COUNT(DISTINCT HOLEID)                   AS Holes,
       SUM(COALESCE(CoreLength_m, 0)
         + COALESCE(DestructiveLength_m, 0))    AS Metres,
       SUM(COALESCE(CoreLength_m, 0))           AS CoredM,
       SUM(COALESCE(DestructiveLength_m, 0))    AS DestructiveM
FROM   dbo.DRILLING_PROGRESS
GROUP  BY YEAR(StartingDate)
ORDER  BY StartYear;


/* ---------------------------------------------------------------------
   2. SAME, BUT BY END DATE

   The model's active relationship was on StartingDate, but its calendar
   was generated from EndDate. If query 1 disagrees with Power BI and
   this one agrees, the report is bucketing by end date and the API
   should switch.
   --------------------------------------------------------------------- */

SELECT YEAR(EndDate)                            AS EndYear,
       COUNT(DISTINCT HOLEID)                   AS Holes,
       SUM(COALESCE(CoreLength_m, 0)
         + COALESCE(DestructiveLength_m, 0))    AS Metres
FROM   dbo.DRILLING_PROGRESS
GROUP  BY YEAR(EndDate)
ORDER  BY EndYear;


/* ---------------------------------------------------------------------
   3. HOLES THE POWER BI CALENDAR CANNOT SEE  *** most likely culprit ***

   The model built its date table as
       CALENDAR(MIN(Drilling[EndDate]), MAX(Drilling[EndDate]))
   and then joined it to StartingDate.

   Any hole that STARTED before the earliest EndDate has no matching
   calendar row. It falls into the blank member and disappears from every
   visual filtered by year or week — so Power BI silently under-counts.
   The API has no such gap and will report more holes.

   If Rows here is greater than zero, that difference is the explanation,
   and the API is the one that is right.
   --------------------------------------------------------------------- */

SELECT COUNT(*)                  AS OrphanedHoles,
       MIN(StartingDate)         AS EarliestStart,
       (SELECT MIN(EndDate) FROM dbo.DRILLING_PROGRESS) AS EarliestEnd,
       SUM(COALESCE(CoreLength_m, 0)
         + COALESCE(DestructiveLength_m, 0))            AS MetresLostInPbi
FROM   dbo.DRILLING_PROGRESS
WHERE  StartingDate < (SELECT MIN(EndDate) FROM dbo.DRILLING_PROGRESS)
   OR  StartingDate > (SELECT MAX(EndDate) FROM dbo.DRILLING_PROGRESS);


/* ---------------------------------------------------------------------
   4. NULL AND DUPLICATE KEYS

   A NULL StartingDate also lands in the blank member and vanishes from
   Power BI. A repeated HOLEID would mean DISTINCTCOUNT and SUM disagree
   about the grain.
   --------------------------------------------------------------------- */

SELECT (SELECT COUNT(*) FROM dbo.DRILLING_PROGRESS WHERE StartingDate IS NULL)
           AS NullStartDate,
       (SELECT COUNT(*) FROM dbo.DRILLING_PROGRESS WHERE EndDate IS NULL)
           AS NullEndDate,
       (SELECT COUNT(*) FROM dbo.DRILLING_PROGRESS WHERE HOLEID IS NULL)
           AS NullHoleId,
       (SELECT COUNT(*) - COUNT(DISTINCT HOLEID) FROM dbo.DRILLING_PROGRESS)
           AS DuplicateRows;


/* ---------------------------------------------------------------------
   5. HOLES THAT CROSS A YEAR BOUNDARY

   These are the rows where start-versus-end actually changes the answer.
   Usually a handful; if it is a handful, that is not the cause of a
   large discrepancy.
   --------------------------------------------------------------------- */

SELECT HOLEID, StartingDate, EndDate, HoleStatus, HOLEPURPOSE,
       COALESCE(CoreLength_m, 0) + COALESCE(DestructiveLength_m, 0) AS TotalM
FROM   dbo.DRILLING_PROGRESS
WHERE  YEAR(StartingDate) <> YEAR(EndDate)
ORDER  BY StartingDate;


/* ---------------------------------------------------------------------
   6. WEEK BY WEEK, FOR ONE YEAR

   Set @year, then compare against the weekly column chart. The first
   week that differs usually identifies the cause on its own: a gap at
   the start points at query 3, a shift of one row points at the week
   numbering, scattered differences point at the date column.
   --------------------------------------------------------------------- */

DECLARE @year int = 2026;

WITH w AS (
    SELECT HOLEID,
           COALESCE(CoreLength_m, 0)
             + COALESCE(DestructiveLength_m, 0) AS TotalM,
           COALESCE(CoreLength_m, 0)            AS CoredM,
           DATEDIFF(
               day,
               DATEADD(day, -(DATEDIFF(day, '19000101',
                       DATEFROMPARTS(YEAR(StartingDate), 1, 1)) % 7),
                       DATEFROMPARTS(YEAR(StartingDate), 1, 1)),
               DATEADD(day, -(DATEDIFF(day, '19000101', StartingDate) % 7),
                       StartingDate)
           ) / 7 + 1                            AS WeekNum
    FROM   dbo.DRILLING_PROGRESS
    WHERE  YEAR(StartingDate) = @year
)
SELECT WeekNum,
       'S' + RIGHT('0' + CAST(WeekNum AS varchar(2)), 2) AS WeekLabel,
       COUNT(DISTINCT HOLEID)                            AS Holes,
       SUM(TotalM)                                       AS Metres,
       SUM(SUM(TotalM)) OVER (ORDER BY WeekNum
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                                         AS CumulativeM
FROM   w
GROUP  BY WeekNum
ORDER  BY WeekNum;
