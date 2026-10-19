using Backend.Models.TechnoMap;

namespace Backend.Repositories.TechnoMap;

public interface ITechnoMapRepository
{
    Task<IReadOnlyList<TechnoMapDto>> GetAllAsync(
        CancellationToken cancellationToken = default);
}
