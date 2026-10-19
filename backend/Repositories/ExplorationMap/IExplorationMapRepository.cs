using Backend.Models.ExplorationMap;

namespace Backend.Repositories.ExplorationMap;

public interface IExplorationMapRepository
{
    Task<IReadOnlyList<ExplorationMapDto>> GetAllAsync(
        CancellationToken cancellationToken = default);
}
