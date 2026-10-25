using Backend.Models.Dashboard;

namespace Backend.Repositories.Dashboard.Interfaces;

public interface IHoleRepository
{
    /// <summary>
    /// Every hole whose StartingDate falls in the given campaign year.
    /// A year is a few hundred rows, so the whole set is fetched once and
    /// every endpoint aggregates over it in memory.
    /// </summary>
    Task<IReadOnlyList<Hole>> GetYearAsync(int year, CancellationToken ct);
}
