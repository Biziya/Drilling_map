using Backend.Models.ExplorationMap;
using Backend.Repositories.ExplorationMap;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers.ExplorationMap;

[ApiController]
[Route("api/exploration-map")]
[Tags("ExplorationMap")]
public sealed class ExplorationMapController : ControllerBase
{
    private readonly IExplorationMapRepository _repository;

    public ExplorationMapController(IExplorationMapRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyList<ExplorationMapDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ExplorationMapDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var drillholes = await _repository.GetAllAsync(cancellationToken);

        return Ok(drillholes);
    }
}
