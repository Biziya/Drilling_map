using Backend.Services;

namespace Backend.Models.Dashboard;

public sealed class Hole
{
    public string HoleId { get; set; } = string.Empty;
    public string? RigNumber { get; set; }
    public string? DrillPurpose { get; set; }
    public string? HolePurpose { get; set; }
    public string? HoleStatus { get; set; }
    public string? ProjectCode { get; set; }

    /// <summary>
    /// NULL on destructive-only holes, which is most of them. The source
    /// stores NULL rather than 0, so never read this directly in
    /// arithmetic — use <see cref="Cored"/>.
    /// </summary>
    public decimal? CoreLengthM { get; set; }

    public decimal? DestructiveLengthM { get; set; }

    /// <summary>NULL when the hole was never cored. Must be skipped in
    /// averages, not treated as zero.</summary>
    public decimal? TotalRecoveryPct { get; set; }

    public decimal? DeviationMaxPct { get; set; }
    public decimal? PlannedDepth { get; set; }
    public decimal? FinalDepthM { get; set; }

    public DateTime StartingDate { get; set; }
    public DateTime? EndDate { get; set; }

    // --- Derived -----------------------------------------------------

    /// <summary>
    /// DAX treats BLANK as 0 in arithmetic; C# nullable decimals do not.
    /// Every metrage read goes through these two so a destructive-only
    /// hole contributes its full length instead of nothing.
    /// </summary>
    public decimal Cored => CoreLengthM ?? 0m;

    /// <summary>
    /// Whether the hole was cored at all, matching the DAX test
    /// NOT(ISBLANK(CoreLength_m)). A stored zero would count as cored,
    /// as it does in DAX; only NULL means "no core".
    /// </summary>
    public bool HasCore => CoreLengthM.HasValue;
    public decimal Destructive => DestructiveLengthM ?? 0m;
    public decimal TotalM => Cored + Destructive;

    /// <summary>
    /// The week this hole is attributed to. The Power BI model's active
    /// relationship was on StartingDate, so weekly progress is counted in
    /// the week a hole STARTED, not the week it finished. Holes in the
    /// source run one to three days, so the two differ only for holes
    /// crossing a Monday.
    /// </summary>
    public int StartWeek => CampaignWeek.Of(DateOnly.FromDateTime(StartingDate));
}
