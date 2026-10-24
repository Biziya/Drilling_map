namespace Backend.Models.TechnoMap;

/// <summary>
/// The Techno Map filter a drillhole belongs to. The returned ids are the
/// frontend's filter ids (technoMap.yaml drillholeTypes).
///
/// Priority, one category per hole:
///   1. Ra_Grade_Sampling = 1  -> ra-grade-sampling
///   2. Sediment_Sampling = 1  -> sediment-sampling
///   3. SQL Type               -> the mapping below
/// A Type with no mapping (CONTROLE, HYDRO_WELL, SEDIMENT, SER, ...) has no
/// category, and no filter shows it.
/// </summary>
public static class TechnoMapCategory
{
    private static readonly Dictionary<string, string> ByType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["DEVELOP"] = "development",
        ["EAU"] = "water",
        ["EXPLO"] = "exploration",
        ["GEOTECHNICAL"] = "geotechnical",
        ["INJECT"] = "injector",
        ["PIEZO"] = "monitoring",
        ["PRODUCT"] = "producer",
        ["WATER_WELL"] = "water",
    };

    public static string? Resolve(string? type, bool? raGradeSampling, bool? sedimentSampling)
    {
        if (raGradeSampling == true) return "ra-grade-sampling";
        if (sedimentSampling == true) return "sediment-sampling";
        if (string.IsNullOrWhiteSpace(type)) return null;

        return ByType.GetValueOrDefault(type.Trim());
    }
}
