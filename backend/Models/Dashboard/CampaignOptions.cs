using System.ComponentModel.DataAnnotations;
namespace Backend.Models.Dashboard;

/// <summary>
/// What was a hardcoded DATATABLE inside the Power BI report. It drives
/// every clamp, reference line and target figure on the dashboard, so it
/// has to live somewhere a person can edit. Configuration, because the
/// platform database is read-only to this application.
///
/// If it outgrows config — several projects, revised mid-season targets,
/// an audit trail — move it to a table in a database you own. Only
/// DrillingService.TargetFor reads it.
/// </summary>
public sealed class CampaignOptions
{
    public const string Section = "Campaigns";

    [Required, MinLength(1)]
    public List<CampaignTarget> Targets { get; init; } = [];

    /// <summary>
    /// Hole statuses in scope. Empty means no filter, which is what the
    /// original report did. The source showed REALIZED and VALIDATED;
    /// there are probably others, and a PLANNED hole with no drilled
    /// metres would inflate the hole count. Confirm with:
    ///   SELECT HoleStatus, COUNT(*) FROM ... GROUP BY HoleStatus
    /// </summary>
    public List<string> IncludeStatuses { get; init; } = [];

    /// <summary>
    /// Project codes in scope. Empty means no filter. Every sampled row
    /// was ZOOVCH; if the table holds other projects the dashboard is
    /// silently summing across all of them.
    /// </summary>
    public List<string> IncludeProjects { get; init; } = [];

    /// <summary>
    /// How a hole is assigned to a purpose category. Mirrors the
    /// SWITCH(TRUE()) in the model's "Drilling Detail Category" DAX
    /// one rule at a time, in the same order — first match wins.
    ///
    /// Note what the DAX does NOT use: DrillPurpose plays no part. The
    /// category comes from HOLEPURPOSE, HoleStatus, and whether the hole
    /// was cored.
    /// </summary>
    public List<CategoryRule> CategoryRules { get; init; } = [];

    /// <summary>
    /// Where a hole goes when its HOLEPURPOSE is known to the rules but
    /// its status is not accepted by any of them — a FAILED hole, in
    /// practice. The DAX called this "Other".
    /// </summary>
    public string FallbackCategory { get; init; } = "Other";

    /// <summary>
    /// Which categories get a donut, in display order, and what each one
    /// measures. The report showed four; the rules produce six, and the
    /// remaining two (Ra-Grade and Other) stay in the data so the metres
    /// and hole counts still reconcile — they simply have no donut.
    /// </summary>
    public List<DonutSpec> Donuts { get; init; } = [];
}

/// <summary>
/// Where the drilling data lives. Configurable because the name has
/// already changed twice: the Power BI model pointed at
/// DTM_MINEACQMN.VIEW_DRILLING_PROGRESS, there is no DTM_MINEACQMN
/// schema, and the live object is DRILLING_PROGRESS.
///
/// Confirm the schema with:
///   SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
///   WHERE TABLE_NAME = 'DRILLING_PROGRESS';
///
/// These values are interpolated into SQL, because SQL Server will not
/// accept an object name as a parameter. Both are validated as plain
/// identifiers and bracketed. Never bind them from user input.
/// </summary>
public sealed class SourceTableOptions
{
    public const string Section = "SourceTable";

    /// <summary>Leave empty to let the login's default schema resolve it.</summary>
    public string Schema { get; init; } = "dbo";

    [Required] public string Name { get; init; } = "DRILLING_PROGRESS";

    private static bool IsPlainIdentifier(string value)
        => value.Length is > 0 and <= 128
           && char.IsLetter(value[0])
           && value.All(c => char.IsLetterOrDigit(c) || c == '_');

    /// <summary>
    /// Bracketed, validated "[schema].[name]" for the FROM clause, or just
    /// "[name]" when no schema is configured.
    /// </summary>
    public string QualifiedName
    {
        get
        {
            if (!IsPlainIdentifier(Name))
                throw new InvalidOperationException(
                    $"SourceTable:Name must be a plain SQL identifier; got '{Name}'.");

            if (string.IsNullOrWhiteSpace(Schema))
                return $"[{Name}]";

            if (!IsPlainIdentifier(Schema))
                throw new InvalidOperationException(
                    $"SourceTable:Schema must be a plain SQL identifier; got '{Schema}'.");

            return $"[{Schema}].[{Name}]";
        }
    }
}

public sealed class CampaignTarget
{
    [Range(2000, 2100)] public int Year { get; init; }
    [Range(1, 53)] public int StartWeek { get; init; }
    [Range(1, 53)] public int EndWeek { get; init; }
    [Range(0, double.MaxValue)] public decimal AnnualTarget { get; init; }

    public int WeekCount => EndWeek - StartWeek + 1;

    public bool Contains(int week) => week >= StartWeek && week <= EndWeek;

    /// <summary>
    /// Cumulative planned metres by the end of <paramref name="week"/>.
    /// Null before the campaign opens, a linear ramp inside it, flat at
    /// the full target afterwards — matching the Cumulative Target (m)
    /// measure exactly.
    ///
    /// The even ramp is inherited from the DAX. The source table carries
    /// a real PlannedDepth per hole, which would give a plan shaped by
    /// what was actually scheduled; worth revisiting once this works.
    /// </summary>
    public decimal? CumulativeTarget(int week)
    {
        if (week < StartWeek) return null;
        if (week > EndWeek) return AnnualTarget;
        return (decimal)(week - StartWeek + 1) / WeekCount * AnnualTarget;
    }
}

/// <summary>
/// One arm of the category SWITCH. An empty list matches anything, so
/// omit Statuses to accept every status.
/// </summary>
public sealed class CategoryRule
{
    /// <summary>HOLEPURPOSE values this rule accepts. Empty matches any.</summary>
    public List<string> HolePurposes { get; init; } = [];

    /// <summary>HoleStatus values this rule accepts. Empty matches any.</summary>
    public List<string> Statuses { get; init; } = [];

    /// <summary>
    /// When set, the hole must have core (true) or must not (false).
    /// Null ignores coring. This is what separates Hybrid from Techno:
    /// a PRODUCT or INJECT hole that was also cored.
    /// </summary>
    public bool? RequiresCore { get; init; }

    [Required] public string Category { get; init; } = string.Empty;

    /// <summary>
    /// Comparisons are case-insensitive, matching DAX's IN operator. The
    /// configured Hydro list mixes "Piezo" with "WATER_WELL", so this is
    /// not academic.
    /// </summary>
    public bool Matches(string? holePurpose, string? holeStatus, bool hasCore)
        => Accepts(HolePurposes, holePurpose)
           && Accepts(Statuses, holeStatus)
           && (RequiresCore is null || RequiresCore == hasCore);

    private static bool Accepts(List<string> allowed, string? value)
        => allowed.Count == 0
           || allowed.Any(a => string.Equals(a, value, StringComparison.OrdinalIgnoreCase));
}

/// <summary>What a donut measures.</summary>
public enum DonutMetric
{
    /// <summary>Cored against destructive metres within the category.</summary>
    CoredSplit,

    /// <summary>
    /// The category's metres against the rest of the campaign.
    ///
    /// For a category where coring is structurally impossible, CoredSplit
    /// is a tautology rather than a measurement: Techno is defined as the
    /// PRODUCT/INJECT holes that were NOT cored, so its cored split can
    /// only ever read 0%. This gives that slot something that moves.
    /// </summary>
    ShareOfCampaign,
}

public sealed class DonutSpec
{
    [Required] public string Category { get; init; } = string.Empty;

    public DonutMetric Metric { get; init; } = DonutMetric.CoredSplit;
}