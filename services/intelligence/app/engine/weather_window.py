from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


TIMEZONE = "America/Sao_Paulo"


def parse_open_meteo_time(time_str: str) -> datetime:
    dt = datetime.fromisoformat(time_str)
    return dt.replace(tzinfo=ZoneInfo(TIMEZONE))


def filter_hourly_weather_by_time(
    hourly_weather: dict[str, Any],
    start: datetime,
    end: datetime,
) -> dict[str, list[Any]]:
    selected_indexes = []
    for index, time_str in enumerate(hourly_weather.get("time", [])):
        current_time = parse_open_meteo_time(time_str)
        if start <= current_time <= end:
            selected_indexes.append(index)

    filtered: dict[str, list[Any]] = {}
    for key, values in hourly_weather.items():
        if isinstance(values, list):
            filtered[key] = [
                values[index]
                for index in selected_indexes
                if index < len(values)
            ]
    return filtered


def split_recent_and_forecast_weather(
    hourly_weather: dict[str, Any],
    past_days: int = 7,
    forecast_days: int = 7,
) -> dict[str, dict[str, list[Any]]]:
    now = datetime.now(ZoneInfo(TIMEZONE))
    recent_start = now - timedelta(days=past_days)
    forecast_end = now + timedelta(days=forecast_days)

    return {
        "recent": filter_hourly_weather_by_time(
            hourly_weather,
            recent_start,
            now,
        ),
        "forecast": filter_hourly_weather_by_time(
            hourly_weather,
            now,
            forecast_end,
        ),
    }
