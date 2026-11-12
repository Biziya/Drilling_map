using Backend.Models.TechnoMap;
using Backend.Repositories.TechnoMap;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers.TechnoMap;

[ApiController]
[Route("api/techno-map")]
[Tags("TechnoMap")]
public sealed class TechnoMapController(TechnoMapRepository repository) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyList<TechnoMapDto>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TechnoMapDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var drillholes = await repository.GetAllAsync(cancellationToken);

        return Ok(drillholes);
    }
}
