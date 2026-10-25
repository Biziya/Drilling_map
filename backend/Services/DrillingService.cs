using Microsoft.Extensions.Options;
using Backend.Models.Dashboard;
using Backend.Repositories.Dashboard.Interfaces;
using Backend.Services.Interfaces;

namespace Backend.Services;

/// <summary>
/// The former DAX measures, re-expressed over an in-memory hole set.
///
/// A campaign year is a few hundred rows — the 2026 target is 38,000 m at
/// roughly 130–180 m per hole — so there is nothing to gain from pushing
/// this into SQL, and keeping it here means it can be tested without a
/// database, which the DAX never could.
/// </summary>
public sealed class DrillingService(
    IHoleRepository repository,
    IOptions<CampaignOptions> options) : IDrillingService
{
    private readonly CampaignOptions _options = options.Value;

    private CampaignTarget? TargetFor(int year)
        => _options.Targets.FirstOrDefault(t => t.Year == year);

    private int LatestYear() => _options.Targets.Count == 0
        ? DateTime.UtcNow.Year
        : _options.Targets.Max(t => t.Year);

    /// <summary>
    /// Holes that match no rule land here rather than vanishing, so a
    /// gap in the mapping is visible on the dashboard instead of showing
    /// up as missing metres.
    /// </summary>
    public const string Unclassified = "Unclassified";

    /// <summary>
    /// Assigns a hole to a purpose category, mirroring the model's
    /// "Drilling Detail Category" DAX arm for arm.
    ///
    /// Two things are easy to get wrong here, so they are spelled out:
    ///
    /// 1. DrillPurpose plays no part. The category is decided by
    ///    HOLEPURPOSE, HoleStatus and whether the hole was cored.
    ///
    /// 2. Hybrid is not a hole type. It is a PRODUCT or INJECT well that
    ///    was ALSO cored — the DAX tests NOT(ISBLANK(CoreLength_m))
    ///    before falling through to Techno.
    ///
    /// A hole whose HOLEPURPOSE the rules know but whose status none of
    /// them accept (a FAILED hole) becomes FallbackCategory, "Other". A
    /// HOLEPURPOSE no rule mentions is new, and takes its DrillPurpose as
    /// its own category name so it shows up rather than hiding in Other.
    /// </summary>
    public string CategoryOf(Hole hole)
    {
        foreach (var rule in _options.CategoryRules)
        {
            if (rule.Matches(hole.HolePurpose, hole.HoleStatus, hole.HasCore))
                return rule.Category;
        }

        if (IsKnownPurpose(hole.HolePurpose)) return _options.FallbackCategory;

        if (!string.IsNullOrWhiteSpace(hole.DrillPurpose)) return hole.DrillPurpose;
        if (!string.IsNullOrWhiteSpace(hole.HolePurpose)) return hole.HolePurpose;

        return Unclassified;
    }

    /// <summary>True when some rule names this HOLEPURPOSE, whatever its status.</summary>
    private bool IsKnownPurpose(string? holePurpose)
        => _options.CategoryRules.Any(rule =>
               rule.HolePurposes.Any(p =>
                   string.Equals(p, holePurpose, StringComparison.OrdinalIgnoreCase)));

    /// <summary>
    /// An empty list means "no filter", matching an untouched slicer.
    /// The week window is the selection made on the bar chart.
    /// </summary>
    private IEnumerable<Hole> Filter(
        IEnumerable<Hole> holes,
        IReadOnlyList<string>? categories,
        IReadOnlyList<string>? rigs,
        int? fromWeek = null,
        int? toWeek = null)
    {
        if (categories is { Count: > 0 })
        {
            var wanted = categories.ToHashSet(StringComparer.OrdinalIgnoreCase);
            holes = holes.Where(h => wanted.Contains(CategoryOf(h)));
        }

        if (rigs is { Count: > 0 })
        {
            var wanted = rigs.ToHashSet(StringComparer.OrdinalIgnoreCase);
            holes = holes.Where(h => h.RigNumber is not null
                                     && wanted.Contains(h.RigNumber));
        }

        if (fromWeek is not null) holes = holes.Where(h => h.StartWeek >= fromWeek);
        if (toWeek is not null) holes = holes.Where(h => h.StartWeek <= toWeek);

        return holes;
    }

    /// <summary>
    /// Slicer contents, each narrowed by the other selection — picking a
    /// hole purpose leaves only the rigs that drilled it, and picking a
    /// rig leaves only the purposes it drilled. Donut specs come from
    /// configuration and are filtered to categories that actually have
    /// holes this year.
    /// </summary>
    public async Task<FiltersDto> GetFiltersAsync(
        int? year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct)
    {
        var resolved = year ?? LatestYear();
        var holes = await repository.GetYearAsync(resolved, ct);

        // Categories available given the rig selection, and vice versa.
        var categoryOptions = Filter(holes, null, rigs)
            .Select(CategoryOf)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct().Order().ToList();

        var rigOptions = Filter(holes, categories, null)
            .Where(h => !string.IsNullOrWhiteSpace(h.RigNumber))
            .Select(h => h.RigNumber!)
            .Distinct().Order().ToList();

        // Donuts reflect the current selection, so a category filtered
        // out does not leave an empty ring on the page.
        var present = Filter(holes, categories, rigs)
            .Select(CategoryOf).ToHashSet();

        return new FiltersDto(
            _options.Targets.OrderByDescending(t => t.Year).ToList(),
            categoryOptions,
            rigOptions,
            _options.Donuts.Where(d => present.Contains(d.Category)).ToList());
    }

    public async Task<SummaryDto> GetSummaryAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct)
    {
        var holes = await repository.GetYearAsync(year, ct);
        var target = TargetFor(year);

        // Campaign window only, so the card reconciles with the donuts
        // beneath it. The DAX counted the whole calendar year, which left
        // the card disagreeing with the charts above which it sits.
        var count = Filter(holes, categories, rigs, fromWeek, toWeek)
            .Where(h => target?.Contains(h.StartWeek) ?? true)
            .Select(h => h.HoleId)
            .Distinct()
            .Count();

        return new SummaryDto(
            count, target?.StartWeek, target?.EndWeek, target?.AnnualTarget);
    }

    /// <summary>
    /// Replaces Realized Drilling (m), Cumulative Drilling (m),
    /// Cumulative Target (m), % Cored, Average Deviation (%) and
    /// Average Total Recovery (%) in a single pass.
    ///
    /// Emits the full week spine, so weeks with no drilling still appear
    /// and the target line stays continuous across them. The original
    /// report's calendar was generated from the fact table's own date
    /// range, which is why early holes sometimes dropped out of it
    /// entirely.
    /// </summary>
    public async Task<IReadOnlyList<WeeklyPointDto>> GetWeeklyAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct)
    {
        var holes = await repository.GetYearAsync(year, ct);
        var target = TargetFor(year);

        // Deliberately not week filtered: this series is what the bar
        // chart draws, and the week selection is made from it.
        var byWeek = Filter(holes, categories, rigs)
            .GroupBy(h => h.StartWeek)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<WeeklyPointDto>();
        var running = 0m;

        for (var week = 1; week <= CampaignWeek.WeeksInYear(year); week++)
        {
            var inWeek = byWeek.TryGetValue(week, out var found) ? found : [];

            var realized = inWeek.Sum(h => h.TotalM);
            var inCampaign = target?.Contains(week) ?? false;

            // Accumulate inside the campaign window only.
            //
            // The DAX reset at 1 January, so a hole drilled before the
            // campaign opened was already in the total at week one of the
            // chart — and the chart only draws campaign weeks, so the
            // line started part-way up with no visible cause. It also put
            // the metres card out of step with the donuts. 2026 has one
            // such hole, in week 13.
            if (inCampaign) running += realized;

            var cored = inWeek.Sum(h => h.Cored);
            var total = inWeek.Sum(h => h.TotalM);
            var (monthNum, monthName) = CampaignWeek.MonthOfWeek(year, week);

            result.Add(new WeeklyPointDto(
                WeekNum: week,
                WeekLabel: CampaignWeek.Label(week),
                MonthNum: monthNum,
                MonthName: monthName,
                HoleCount: inWeek.Count,
                RealizedM: realized,
                CumulativeM: running,
                CumulativeTargetM: target?.CumulativeTarget(week),
                PctCored: total == 0 ? null : cored / total,
                // Averaged over holes that actually carry a value. A hole
                // that was never cored has no recovery figure and must
                // not be counted as zero.
                AvgDeviationPct: Mean(inWeek.Select(h => h.DeviationMaxPct)),
                AvgRecoveryPct: Mean(inWeek.Select(h => h.TotalRecoveryPct)),
                InCampaign: inCampaign));
        }

        return result;
    }

    public async Task<IReadOnlyList<WeeklyByRigDto>> GetWeeklyByRigAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct)
    {
        var holes = await repository.GetYearAsync(year, ct);

        return Filter(holes, categories, rigs)
            .Where(h => !string.IsNullOrWhiteSpace(h.RigNumber))
            .GroupBy(h => new { h.StartWeek, Rig = h.RigNumber! })
            .Select(g =>
            {
                var (monthNum, monthName) =
                    CampaignWeek.MonthOfWeek(year, g.Key.StartWeek);

                return new WeeklyByRigDto(
                    g.Key.StartWeek,
                    CampaignWeek.Label(g.Key.StartWeek),
                    monthNum, monthName,
                    g.Key.Rig,
                    g.Sum(h => h.TotalM));
            })
            .OrderBy(r => r.WeekNum)
            .ThenBy(r => r.Rig)
            .ToList();
    }

    /// <summary>
    /// The flat reference lines. Computed across the whole campaign
    /// window and ignoring the week axis — that is what makes them flat.
    ///
    /// PctCored is a RATIO OF SUMS over the campaign, not the mean of the
    /// weekly ratios. The two differ whenever weekly volumes vary, and
    /// the DAX used the former.
    /// </summary>
    public async Task<CampaignAveragesDto> GetCampaignAveragesAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct)
    {
        var target = TargetFor(year);
        if (target is null) return new CampaignAveragesDto(null, null, null);

        var holes = await repository.GetYearAsync(year, ct);

        var scoped = Filter(holes, categories, rigs, fromWeek, toWeek)
            .Where(h => target.Contains(h.StartWeek))
            .ToList();

        var cored = scoped.Sum(h => h.Cored);
        var total = scoped.Sum(h => h.TotalM);

        return new CampaignAveragesDto(
            Mean(scoped.Select(h => h.DeviationMaxPct)),
            Mean(scoped.Select(h => h.TotalRecoveryPct)),
            total == 0 ? null : cored / total);
    }

    /// <summary>
    /// The four donuts and their hole counts. Campaign-to-date totals:
    /// these deliberately do not respond to the week axis, matching the
    /// original Drilling Type Value Campaign measure.
    ///
    /// Every category is returned and the client binds each donut to the
    /// right one. In the original report the Techno donut was filtered to
    /// 'Hydro' — a copy-paste slip present on both pages.
    /// </summary>
    public async Task<IReadOnlyList<TypeSplitDto>> GetTypeSplitAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct)
    {
        var target = TargetFor(year);
        if (target is null) return [];

        var holes = await repository.GetYearAsync(year, ct);

        return Filter(holes, categories, rigs, fromWeek, toWeek)
            .Where(h => target.Contains(h.StartWeek))
            .GroupBy(CategoryOf)
            .Select(g => new TypeSplitDto(
                g.Key,
                g.Sum(h => h.Cored),
                g.Sum(h => h.Destructive),
                g.Count()))
            .OrderBy(s => s.Category)
            .ToList();
    }

    /// <summary>Mean of the values that are present, or null if none are.</summary>
    private static decimal? Mean(IEnumerable<decimal?> values)
    {
        var sum = 0m;
        var count = 0;

        foreach (var value in values)
        {
            if (!value.HasValue) continue;
            sum += value.Value;
            count++;
        }

        return count == 0 ? null : sum / count;
    }
}
