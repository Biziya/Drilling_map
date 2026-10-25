using Microsoft.AspNetCore.Mvc;
using Backend.Services.Interfaces;
using Backend.Models.Dashboard;

namespace Backend.Controllers.Dashboard;

[ApiController]
[Route("api/[controller]/[action]")]
[ResponseCache(Duration = 300, VaryByQueryKeys = ["year", "categories", "rigs", "fromWeek", "toWeek", "groupBy"])]

public sealed class DashboardController(IDrillingService drilling) : ControllerBase
{
    /// <summary>
    /// Slicer contents. Each list is narrowed by the other selection,
    /// so choosing a hole purpose leaves only the rigs that drilled it.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<FiltersDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FiltersDto>> Filters(
        [FromQuery] int? year,
        [FromQuery] string[]? categories,
        [FromQuery] string[]? rigs,
        CancellationToken ct)
        => Ok(await drilling.GetFiltersAsync(year, categories ?? [], rigs ?? [], ct));

    /// <summary>Hole count plus the campaign window for the banner.</summary>
    [HttpGet]
    [ProducesResponseType<SummaryDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SummaryDto>> Summary(
        [FromQuery] int year,
        [FromQuery] string[]? categories,
        [FromQuery] string[]? rigs,
        [FromQuery] int? fromWeek,
        [FromQuery] int? toWeek,
        CancellationToken ct)
        => Ok(await drilling.GetSummaryAsync(
            year, categories ?? [], rigs ?? [], fromWeek, toWeek, ct));

    /// <summary>
    /// The column chart and all three line charts. groupBy=rig returns
    /// the per-rig series instead; the shape differs, so the client
    /// branches on the parameter it sent.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> Weekly(
        [FromQuery] int year,
        [FromQuery] string[]? categories,
        [FromQuery] string[]? rigs,
        [FromQuery] string? groupBy,
        CancellationToken ct)
    {
        if (string.Equals(groupBy, "rig", StringComparison.OrdinalIgnoreCase))
            return Ok(await drilling.GetWeeklyByRigAsync(
                year, categories ?? [], rigs ?? [], ct));

        return Ok(await drilling.GetWeeklyAsync(
            year, categories ?? [], rigs ?? [], ct));
    }

    /// <summary>The flat reference lines on the deviation and recovery charts.</summary>
    [HttpGet]
    [ProducesResponseType<CampaignAveragesDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CampaignAveragesDto>> CampaignAverages(
        [FromQuery] int year,
        [FromQuery] string[]? categories,
        [FromQuery] string[]? rigs,
        [FromQuery] int? fromWeek,
        [FromQuery] int? toWeek,
        CancellationToken ct)
        => Ok(await drilling.GetCampaignAveragesAsync(
            year, categories ?? [], rigs ?? [], fromWeek, toWeek, ct));

    /// <summary>The donuts and their hole counts.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<TypeSplitDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TypeSplitDto>>> TypeSplit(
        [FromQuery] int year,
        [FromQuery] string[]? categories,
        [FromQuery] string[]? rigs,
        [FromQuery] int? fromWeek,
        [FromQuery] int? toWeek,
        CancellationToken ct)
        => Ok(await drilling.GetTypeSplitAsync(
            year, categories ?? [], rigs ?? [], fromWeek, toWeek, ct));
}
