from __future__ import annotations

from typing import Any

from app.engine.risk_engine import run_disease_analysis_from_snapshot


__all__ = ["run_disease_analysis_from_snapshot"]


def validate_weather_snapshot(
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
) -> None:
    hourly_time = hourly_weather.get("time")
    if not isinstance(hourly_time, list) or not hourly_time:
        raise ValueError("hourly_weather precisa conter uma lista 'time' válida.")

    historical_time = historical_daily_rainfall.get("time")
    precipitation_sum = historical_daily_rainfall.get("precipitation_sum")
    if not isinstance(historical_time, list) or not historical_time:
        raise ValueError(
            "historical_daily_rainfall precisa conter uma lista 'time' válida."
        )
    if not isinstance(precipitation_sum, list):
        raise ValueError(
            "historical_daily_rainfall precisa conter 'precipitation_sum'."
        )


def run_snapshot_analysis(
    field: dict[str, Any],
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
) -> dict[str, Any]:
    """Compatibility facade for the pure V2 intelligence engine."""
    validate_weather_snapshot(hourly_weather, historical_daily_rainfall)
    return run_disease_analysis_from_snapshot(
        field=field,
        hourly_weather=hourly_weather,
        historical_daily_rainfall=historical_daily_rainfall,
    )
