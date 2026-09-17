from __future__ import annotations

from collections import defaultdict
from typing import Any


def daily_precipitation_from_hourly(hourly_weather: dict[str, Any]) -> dict[str, float]:
    times = hourly_weather.get("time", [])
    precipitation = hourly_weather.get("precipitation", [])
    daily: defaultdict[str, float] = defaultdict(float)

    for time_str, rain in zip(times, precipitation):
        date_str = time_str.split("T")[0]
        daily[date_str] += rain or 0.0

    return dict(daily)


def count_rainy_days_above_threshold(
    daily_rainfall: dict[str, float],
    threshold_mm: float = 2.5,
    last_n_days: int = 7,
) -> int:
    sorted_days = sorted(daily_rainfall.keys())
    selected_days = sorted_days[-last_n_days:]
    return sum(1 for day in selected_days if daily_rainfall[day] > threshold_mm)


def sum_daily_rainfall(daily_rainfall: dict[str, float]) -> float:
    return sum(value or 0.0 for value in daily_rainfall.values())


def score_rainfall_7d(rainy_days: int) -> int:
    if rainy_days >= 3:
        return 20
    if rainy_days == 2:
        return 14
    if rainy_days == 1:
        return 7
    return 0


def score_rainfall_40d(total_rainfall_mm: float) -> int:
    if total_rainfall_mm > 450:
        return 15
    if total_rainfall_mm >= 300:
        return 10
    if total_rainfall_mm >= 150:
        return 5
    return 0


def count_hours_in_favorable_range(
    hourly_weather: dict[str, Any],
    min_temp: float = 20.0,
    max_temp: float = 26.0,
) -> int:
    temperatures = hourly_weather.get("temperature_2m", [])
    return sum(
        1
        for temp in temperatures
        if temp is not None and min_temp <= temp <= max_temp
    )


def get_temperature_summary(hourly_weather: dict[str, Any]) -> dict[str, float | None]:
    temperatures = [
        temp
        for temp in hourly_weather.get("temperature_2m", [])
        if temp is not None
    ]
    if not temperatures:
        return {"average": None, "minimum": None, "maximum": None}
    return {
        "average": sum(temperatures) / len(temperatures),
        "minimum": min(temperatures),
        "maximum": max(temperatures),
    }


def score_temperature(hours_favorable: int) -> int:
    if hours_favorable >= 10:
        return 20
    if hours_favorable >= 4:
        return 10
    return 0


def is_probably_wet_hour(
    humidity: float | None,
    temperature: float | None,
    dew_point: float | None,
    radiation: float | None,
) -> bool:
    if humidity is None or temperature is None or dew_point is None or radiation is None:
        return False
    return (
        humidity >= 90
        and temperature - dew_point <= 2
        and radiation < 100
    )


def estimate_max_leaf_wetness_hours(hourly_weather: dict[str, Any]) -> int:
    humidities = hourly_weather.get("relative_humidity_2m", [])
    temperatures = hourly_weather.get("temperature_2m", [])
    dew_points = hourly_weather.get("dew_point_2m", [])
    radiations = hourly_weather.get("shortwave_radiation", [])

    longest = 0
    current = 0
    for humidity, temperature, dew_point, radiation in zip(
        humidities, temperatures, dew_points, radiations
    ):
        if is_probably_wet_hour(humidity, temperature, dew_point, radiation):
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def score_leaf_wetness(max_wetness_hours: int) -> int:
    if max_wetness_hours >= 10:
        return 25
    if max_wetness_hours >= 6:
        return 15
    return 0


def get_min_dew_point_difference(hourly_weather: dict[str, Any]) -> float | None:
    differences = [
        temp - dew_point
        for temp, dew_point in zip(
            hourly_weather.get("temperature_2m", []),
            hourly_weather.get("dew_point_2m", []),
        )
        if temp is not None and dew_point is not None
    ]
    return min(differences) if differences else None


def score_dew_point(min_difference: float | None) -> int:
    if min_difference is None:
        return 0
    if min_difference <= 2:
        return 10
    if min_difference <= 5:
        return 7
    if min_difference <= 8:
        return 3
    return 0


def count_low_drying_hours(hourly_weather: dict[str, Any]) -> int:
    count = 0
    for radiation, wind_speed, humidity in zip(
        hourly_weather.get("shortwave_radiation", []),
        hourly_weather.get("wind_speed_10m", []),
        hourly_weather.get("relative_humidity_2m", []),
    ):
        if radiation is None or wind_speed is None or humidity is None:
            continue
        if radiation < 150 and wind_speed < 8 and humidity >= 85:
            count += 1
    return count


def score_drying_condition(low_drying_hours: int) -> int:
    if low_drying_hours >= 10:
        return 10
    if low_drying_hours >= 5:
        return 5
    if low_drying_hours >= 2:
        return 3
    return 0
