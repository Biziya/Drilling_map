namespace Backend.Models.Dashboard;

/// <summary>
/// Contents of the three slicers, plus which categories get a donut.
///
/// Categories lists everything present in the data; Donuts is the
/// configured subset the dashboard draws, in display order, each with
/// the metric it shows. They differ on purpose — Ra-Grade and Other have
/// no donut but still count toward the metres and hole totals.
/// </summary>
public sealed record FiltersDto(
    IReadOnlyList<CampaignTarget> Years,
    IReadOnlyList<string> Categories,
    IReadOnlyList<string> Rigs,
    IReadOnlyList<DonutSpec> Donuts);

/// <summary>
/// The cards. The campaign window and target feed the banner; the
/// original DAX built that string itself and did it wrong — it rendered
/// "Campaign W14 - W45Target: 38,000 m" with no separator. Returning the
/// parts lets the client format it properly.
/// </summary>
public sealed record SummaryDto(
    int HoleCount, int? StartWeek, int? EndWeek, decimal? AnnualTarget);

/// <summary>One row per week of the year, including weeks with no drilling.</summary>
public sealed record WeeklyPointDto(
    int WeekNum,
    string WeekLabel,
    int MonthNum,
    string MonthName,
    int HoleCount,
    decimal RealizedM,
    decimal CumulativeM,
    decimal? CumulativeTargetM,
    decimal? PctCored,
    decimal? AvgDeviationPct,
    decimal? AvgRecoveryPct,
    bool InCampaign);

/// <summary>Series split for the stacked column chart on the rig page.</summary>
public sealed record WeeklyByRigDto(
    int WeekNum, string WeekLabel, int MonthNum, string MonthName,
    string Rig, decimal RealizedM);

/// <summary>The three flat reference lines.</summary>
public sealed record CampaignAveragesDto(
    decimal? CampaignAvgDeviationPct,
    decimal? CampaignAvgRecoveryPct,
    decimal? CampaignPctCored);

/// <summary>One per donut: the cored/destructive split for a hole purpose.</summary>
public sealed record TypeSplitDto(
    string Category, decimal CoredM, decimal DestructiveM, int HoleCount);
