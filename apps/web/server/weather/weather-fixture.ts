function startOfCurrentHour(
  timestamp = Date.now(),
): Date {
  const date = new Date(
    timestamp,
  );

  date.setMinutes(0, 0, 0);

  return date;
}

function buildHourlyTimes(): string[] {
  const start =
    startOfCurrentHour(
      Date.now() -
        7 * 24 * 60 * 60 * 1000,
    );

  return Array.from(
    {
      length:
        14 * 24 + 1,
    },
    (_, index) =>
      new Date(
        start.getTime() +
          index *
            60 *
            60 *
            1000,
      )
        .toISOString()
        .slice(0, 16),
  );
}

function buildHistoricalDates(): string[] {
  const today =
    startOfCurrentHour()
      .toISOString()
      .slice(0, 10);

  return Array.from(
    {
      length: 40,
    },
    (_, index) => {
      const date = new Date(
        `${today}T00:00:00.000Z`,
      );

      date.setUTCDate(
        date.getUTCDate() -
          (39 - index),
      );

      return date
        .toISOString()
        .slice(0, 10);
    },
  );
}

export function buildWeatherFixture() {
  const hourlyTime =
    buildHourlyTimes();

  const historicalTime =
    buildHistoricalDates();

  return {
    forecast: {
      time: hourlyTime,
      temperature_2m:
        Array(
          hourlyTime.length,
        ).fill(23),
      relative_humidity_2m:
        Array(
          hourlyTime.length,
        ).fill(90),
      dew_point_2m:
        Array(
          hourlyTime.length,
        ).fill(22),
      precipitation:
        Array(
          hourlyTime.length,
        ).fill(0.8),
      surface_pressure:
        Array(
          hourlyTime.length,
        ).fill(950),
      pressure_msl:
        Array(
          hourlyTime.length,
        ).fill(1010),
      wind_speed_10m:
        Array(
          hourlyTime.length,
        ).fill(4),
      shortwave_radiation:
        Array(
          hourlyTime.length,
        ).fill(150),
    },
    historical: {
      time: historicalTime,
      precipitation_sum:
        Array(
          historicalTime.length,
        ).fill(3),
    },
  };
}
