-- The only statement this application sends to the platform database.
-- The schema and table come from the SourceTable configuration section;
-- this copy is for running by hand.
-- SELECT only: no DDL, no temp tables, no session settings.
--
-- One row per HOLEID (confirmed from the source sample), so a campaign
-- year is a few hundred rows. Everything else - week numbering, weekly
-- rollup, cumulative totals, the target ramp, campaign averages, the
-- cored/destructive split - happens in C# over this result set.
--
-- Date range is passed as a half-open interval rather than computed
-- here, so no DATEFIRST dependency and no server-side date functions.

SELECT
    HOLEID,
    RigNumber,
    DrillPurpose,
    HOLEPURPOSE,
    HoleStatus,
    PROJECTCODE,
    CoreLength_m          AS CoreLengthM,
    DestructiveLength_m   AS DestructiveLengthM,
    TotalRecovery_per     AS TotalRecoveryPct,
    DeviationMax_per      AS DeviationMaxPct,
    PlannedDepth,
    FinalDepth_m          AS FinalDepthM,
    StartingDate,
    EndDate
FROM   [DRILLING_PROGRESS]   -- see SourceTable in appsettings
WHERE  StartingDate >= @from
  AND  StartingDate <  @to
  -- Scope filters, both still unconfirmed. Switch on once someone has
  -- run the two GROUP BY checks:
  --   SELECT HoleStatus, COUNT(*) ... GROUP BY HoleStatus
  --   SELECT PROJECTCODE, PROSPECT, COUNT(*) ... GROUP BY PROJECTCODE, PROSPECT
  AND  (@statuses  IS NULL OR HoleStatus  IN (SELECT value FROM STRING_SPLIT(@statuses, ',')))
  AND  (@projects  IS NULL OR PROJECTCODE IN (SELECT value FROM STRING_SPLIT(@projects, ',')));
