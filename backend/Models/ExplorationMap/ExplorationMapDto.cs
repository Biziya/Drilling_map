namespace Backend.Models.ExplorationMap;

public sealed class ExplorationMapDto
{
    public string? HoleId { get; init; }

    public string? CoordinateType { get; init; }

    public decimal? X { get; init; }

    public decimal? Y { get; init; }

    public decimal? Z { get; init; }

    public int Year { get; init; }

    public string? Campaign { get; init; }

    public decimal? GT { get; init; }

    public decimal? MaxDepth { get; init; }

    public decimal? Azimuth { get; init; }

    public decimal? FinalDeviation { get; init; }

    public string? HolePurpose { get; init; }

    public string? HoleStatus { get; init; }
}
