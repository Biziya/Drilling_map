using Backend.Models.Dashboard;

namespace Backend.Services.Interfaces;

/// <summary>
/// Every measure the Power BI report expressed in DAX, re-expressed over
/// an in-memory hole set.
///
/// Categories and rigs are lists: empty means "no filter", which is how
/// an unselected slicer behaves. A week range narrows the page to a
/// selection made on the bar chart; weekly data itself is never week
/// filtered, since it is what the selection is made from.
/// </summary>
public interface IDrillingService
{
    Task<FiltersDto> GetFiltersAsync(
        int? year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct);

    Task<SummaryDto> GetSummaryAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct);

    Task<IReadOnlyList<WeeklyPointDto>> GetWeeklyAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct);

    Task<IReadOnlyList<WeeklyByRigDto>> GetWeeklyByRigAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        CancellationToken ct);

    Task<CampaignAveragesDto> GetCampaignAveragesAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct);

    Task<IReadOnlyList<TypeSplitDto>> GetTypeSplitAsync(
        int year,
        IReadOnlyList<string> categories,
        IReadOnlyList<string> rigs,
        int? fromWeek,
        int? toWeek,
        CancellationToken ct);
}
