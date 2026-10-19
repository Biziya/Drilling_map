using Backend.Models.TechnoMap;
using Backend.Repositories.TechnoMap;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers.TechnoMap;

[ApiController]
[Route("api/techno-map")]
[Tags("TechnoMap")]
public sealed class TechnoMapController : ControllerBase
{
    private readonly ITechnoMapRepository _repository;

    public TechnoMapController(ITechnoMapRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyList<TechnoMapDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TechnoMapDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var drillholes = await _repository.GetAllAsync(cancellationToken);

        return Ok(drillholes);
    }
}
