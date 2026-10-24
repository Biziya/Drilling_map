namespace Backend.Models.TechnoMap;

/// <summary>
/// One row of [dbo].[pyISR_AllData_V2], plus the deviation from the
/// approved geophysical surveys. Names already used by the frontend are kept:
/// Key -> HoleId, Type -> HolePurpose, Status -> HoleStatus, X/Y/Z.
/// </summary>
public sealed class TechnoMapDto
{
    public string? Id { get; init; }
    public string? HoleId { get; init; }
    public string? RelativeLevel { get; init; }

    /// <summary>The SQL Type, as stored.</summary>
    public string? HolePurpose { get; init; }

    public string? License { get; init; }
    public string? StratigraphicUnit { get; init; }

    public decimal? X { get; init; }
    public decimal? Y { get; init; }
    public decimal? Z { get; init; }

    public decimal? ScreenMinDepth { get; init; }
    public decimal? ScreenMaxDepth { get; init; }
    public decimal? ScreenLength { get; init; }
    public decimal? ScreenTopAltitude { get; init; }
    public decimal? ScreenBottomAltitude { get; init; }

    /// <summary>The SQL Status, as stored. INPROGRESS draws the rig.</summary>
    public string? HoleStatus { get; init; }

    public string? DrillingCompany { get; init; }
    public string? DrillingRig { get; init; }

    /// <summary>yyyy-MM-dd, or null when missing or unparseable.</summary>
    public string? StartDate { get; init; }
    public string? EndDate { get; init; }
    public string? BillingDate { get; init; }

    public string? GeneralComment { get; init; }

    /// <summary>1 -> true, 0 -> false, NULL stays null (inactive for filtering).</summary>
    public bool? RaGradeSampling { get; init; }
    public bool? SedimentSampling { get; init; }

    public decimal? Azimuth { get; init; }
    public decimal? FinalDeviation { get; init; }

    /// <summary>UTM end of the deviation line; null when the hole has no usable survey.</summary>
    public decimal? DeviationEndX { get; init; }
    public decimal? DeviationEndY { get; init; }

    /// <summary>The one filter this hole is drawn under, or null when it has none.</summary>
    public string? Category => TechnoMapCategory.Resolve(HolePurpose, RaGradeSampling, SedimentSampling);
}
