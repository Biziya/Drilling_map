using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Backend.Models.Dashboard;
using Backend.Services;

namespace Backend.Repositories.Dashboard;

/// <summary>
/// Read-only access to the drilling table named by SourceTable
/// (DTM_MINEACQMN.DRILLING_PROGRESS by default).
///
/// This application has no write permission on that database and never
/// asks for any: a single SELECT, no DDL, no temp tables, no session
/// settings. Everything the dashboard needs beyond the raw rows —
/// week numbering, weekly rollups, cumulative totals, the target ramp —
/// happens in DrillingService.
/// </summary>
public sealed class HoleRepository(
    IConfiguration configuration,
    IOptions<CampaignOptions> options,
    IOptions<SourceTableOptions> source,
    IMemoryCache cache,
    ILogger<HoleRepository> logger)
{
    private readonly CampaignOptions _options = options.Value;

    /// <summary>
    /// Built once from configuration. The table name is validated and
    /// bracketed in SourceTableOptions.QualifiedName; every value in the
    /// WHERE clause is still a real parameter.
    /// </summary>
    private readonly string _sql =
        BuildQuery(source.Value.QualifiedName);

    private readonly string _connectionString =
        configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Connection string 'DefaultConnection' is not configured. In development use " +
            "user-secrets; in production use a managed identity rather than a " +
            "username and password.");

    /// <summary>
    /// The source refreshes at most daily, so five minutes is already far
    /// fresher than the data. One database round trip per year per
    /// window, shared by every endpoint.
    /// </summary>
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(5);

    public async Task<IReadOnlyList<Hole>> GetYearAsync(int year, CancellationToken ct)
    {
        var cached = await cache.GetOrCreateAsync($"holes:{year}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheFor;

            var (from, to) = CampaignWeek.YearRange(year);

            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(ct);

            var rows = await connection.QueryAsync<Hole>(new CommandDefinition(
                _sql,
                new
                {
                    from = from.ToDateTime(TimeOnly.MinValue),
                    to = to.ToDateTime(TimeOnly.MinValue),
                    statuses = _options.IncludeStatuses.Count == 0
                        ? null
                        : string.Join(',', _options.IncludeStatuses),
                    projects = _options.IncludeProjects.Count == 0
                        ? null
                        : string.Join(',', _options.IncludeProjects),
                },
                cancellationToken: ct));

            var list = rows.ToList();

            // When the API and a hand-run query disagree about row counts,
            // the cause is usually the database or a configured filter.
            logger.LogInformation(
                "Loaded {Count} holes for {Year} from [{Database}] on {Server}. "
                + "Status filter: {StatusFilter}. Project filter: {ProjectFilter}.",
                list.Count,
                year,
                connection.Database,
                connection.DataSource,
                _options.IncludeStatuses.Count == 0
                    ? "(none)" : string.Join('/', _options.IncludeStatuses),
                _options.IncludeProjects.Count == 0
                    ? "(none)" : string.Join('/', _options.IncludeProjects));

            return (IReadOnlyList<Hole>)list;
        });

        return cached ?? [];
    }

    // Column aliases match the Hole property names so Dapper maps them
    // without configuration.
    private static string BuildQuery(string qualifiedTable) => $"""
        SELECT HOLEID              AS HoleId,
               RigNumber,
               DrillPurpose,
               HOLEPURPOSE         AS HolePurpose,
               HoleStatus,
               CoreLength_m        AS CoreLengthM,
               DestructiveLength_m AS DestructiveLengthM,
               TotalRecovery_per   AS TotalRecoveryPct,
               DeviationMax_per    AS DeviationMaxPct,
               StartingDate
        FROM   {qualifiedTable}
        WHERE  StartingDate >= @from
          AND  StartingDate <  @to
          AND  (@statuses IS NULL
                OR HoleStatus IN (SELECT value FROM STRING_SPLIT(@statuses, ',')))
          AND  (@projects IS NULL
                OR PROJECTCODE IN (SELECT value FROM STRING_SPLIT(@projects, ',')));
        """;
}
