using System.Globalization;

namespace Backend.Services;

/// <summary>
/// Week numbering identical to the DAX the report used: WEEKNUM(d, 2).
///
/// This is NOT ISO 8601. Weeks start on Monday, but week 1 is whichever
/// week contains 1 January, so a year can hold 53 weeks and the weeks at
/// each year boundary are partial.
///
/// Deliberately done here rather than in SQL. DATEPART(week, ...) follows
/// the connection's DATEFIRST setting, so the same query can return
/// different week numbers from different sessions — a difference that
/// shows up as a handful of wrong weeks a year and nothing else.
/// </summary>
public static class CampaignWeek
{
    // 1 January 1900 was a Monday, which makes it a usable fixed anchor.
    private static readonly DateOnly MondayAnchor = new(1900, 1, 1);

    private static DateOnly MondayOnOrBefore(DateOnly d)
        => d.AddDays(-((d.DayNumber - MondayAnchor.DayNumber) % 7));

    /// <summary>Week number of a date within its own year.</summary>
    public static int Of(DateOnly d)
    {
        var jan1 = new DateOnly(d.Year, 1, 1);
        return (MondayOnOrBefore(d).DayNumber - MondayOnOrBefore(jan1).DayNumber) / 7 + 1;
    }

    /// <summary>"S01" … "S53" — the week labels the report used.</summary>
    public static string Label(int weekNumber)
        => string.Create(CultureInfo.InvariantCulture, $"S{weekNumber:00}");

    /// <summary>Weeks in a year under this scheme: 52 or 53.</summary>
    public static int WeeksInYear(int year) => Of(new DateOnly(year, 12, 31));

    /// <summary>
    /// The month a week belongs to, for the chart's second axis. Taken
    /// from the week's Monday, so a week straddling a month boundary is
    /// attributed to the month it started in.
    /// </summary>
    public static (int Number, string Name) MonthOfWeek(int year, int week)
    {
        var jan1 = new DateOnly(year, 1, 1);
        var monday = MondayOnOrBefore(jan1).AddDays((week - 1) * 7);

        // Weeks 1 and 53 can begin in the neighbouring year; clamp so the
        // axis never labels a month outside the year being viewed.
        if (monday.Year < year) monday = jan1;
        if (monday.Year > year) monday = new DateOnly(year, 12, 31);

        return (monday.Month,
                CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(monday.Month));
    }

    /// <summary>
    /// Half-open date range covering a campaign year, for the SQL
    /// parameters: 1 January to 1 January.
    ///
    /// It is tempting to start this at the Monday of week 1, since that
    /// is where week 1 begins — but that Monday falls in the previous
    /// December, and the Power BI model bucketed holes by Date[Year],
    /// a plain calendar year. Starting a week early pulled late-December
    /// holes from the previous year into this one AND dropped the last
    /// few days of this one, so hole counts and metres both drifted.
    ///
    /// Week numbering is unaffected: a hole on 31 December 2025 is week
    /// 53 of 2025, and belongs to the 2025 fetch.
    /// </summary>
    public static (DateOnly From, DateOnly To) YearRange(int year)
        => (new DateOnly(year, 1, 1), new DateOnly(year + 1, 1, 1));
}
