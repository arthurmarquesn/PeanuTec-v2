from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests


TIMEZONE = "America/Sao_Paulo"

HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "surface_pressure",
    "pressure_msl",
    "wind_speed_10m",
    "shortwave_radiation",
]


def _request_json(url: str, params: dict, timeout: int = 30) -> dict:
    response = requests.get(url, params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _to_float(value) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _round_or_none(value: float | None, digits: int = 1) -> float | None:
    if value is None:
        return None

    return round(value, digits)


def _sum_values(values: list) -> float | None:
    numeric_values = [_to_float(value) for value in values]
    numeric_values = [value for value in numeric_values if value is not None]

    if not numeric_values:
        return None

    return sum(numeric_values)


def _avg_values(values: list) -> float | None:
    numeric_values = [_to_float(value) for value in values]
    numeric_values = [value for value in numeric_values if value is not None]

    if not numeric_values:
        return None

    return sum(numeric_values) / len(numeric_values)


def _parse_open_meteo_date(value) -> date | None:
    if not value:
        return None

    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _split_daily_values(daily: dict, variable: str) -> tuple[list, list]:
    times = daily.get("time") or []
    values = daily.get(variable) or []
    today = datetime.now(ZoneInfo(TIMEZONE)).date()
    recent_values = []
    forecast_values = []

    for index, day_value in enumerate(times):
        parsed_day = _parse_open_meteo_date(day_value)

        if parsed_day is None or index >= len(values):
            continue

        if parsed_day < today:
            recent_values.append(values[index])
        elif parsed_day >= today:
            forecast_values.append(values[index])

    return recent_values[-7:], forecast_values[:7]


def _parse_open_meteo_datetime(value) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _latest_hourly_value(hourly: dict, variable: str) -> float | None:
    times = hourly.get("time") or []
    values = hourly.get(variable) or []
    now = datetime.now(ZoneInfo(TIMEZONE)).replace(tzinfo=None)
    latest_value = None

    for index, time_value in enumerate(times):
        if index >= len(values):
            continue

        parsed_time = _parse_open_meteo_datetime(time_value)

        if parsed_time is None:
            continue

        if parsed_time <= now:
            candidate = _to_float(values[index])

            if candidate is not None:
                latest_value = candidate

    if latest_value is not None:
        return latest_value

    for value in reversed(values):
        candidate = _to_float(value)

        if candidate is not None:
            return candidate

    return None


def fetch_weather_context(latitude: float, longitude: float) -> dict:
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
        "forecast_days": 7,
        "past_days": 7,
        "daily": ",".join(
            [
                "precipitation_sum",
                "temperature_2m_max",
                "temperature_2m_min",
                "et0_fao_evapotranspiration",
            ]
        ),
        "hourly": ",".join(
            [
                "soil_moisture_0_to_1cm",
                "soil_moisture_1_to_3cm",
                "soil_temperature_0cm",
            ]
        ),
        "current": ",".join(
            [
                "temperature_2m",
                "precipitation",
                "relative_humidity_2m",
            ]
        ),
    }

    try:
        data = _request_json(url, params=params, timeout=5)
    except (requests.RequestException, ValueError):
        return {
            "available": False,
            "source": "unavailable",
            "current_temperature_c": None,
            "current_precipitation_mm": None,
            "current_relative_humidity": None,
            "recent_rain_7d_mm": None,
            "forecast_rain_7d_mm": None,
            "forecast_max_temp_avg_c": None,
            "forecast_min_temp_avg_c": None,
            "reference_et0_7d_mm": None,
            "soil_moisture_latest": None,
            "soil_temperature_latest_c": None,
            "summary": "Dados meteorologicos externos indisponiveis no momento.",
        }

    current = data.get("current") or {}
    daily = data.get("daily") or {}
    hourly = data.get("hourly") or {}
    recent_rain_values, forecast_rain_values = _split_daily_values(
        daily,
        "precipitation_sum",
    )
    _, forecast_max_temp_values = _split_daily_values(daily, "temperature_2m_max")
    _, forecast_min_temp_values = _split_daily_values(daily, "temperature_2m_min")
    _, forecast_et0_values = _split_daily_values(
        daily,
        "et0_fao_evapotranspiration",
    )
    soil_moisture_latest = _latest_hourly_value(hourly, "soil_moisture_0_to_1cm")

    if soil_moisture_latest is None:
        soil_moisture_latest = _latest_hourly_value(
            hourly,
            "soil_moisture_1_to_3cm",
        )

    return {
        "available": True,
        "source": "open_meteo",
        "current_temperature_c": _round_or_none(_to_float(current.get("temperature_2m"))),
        "current_precipitation_mm": _round_or_none(
            _to_float(current.get("precipitation")),
        ),
        "current_relative_humidity": _round_or_none(
            _to_float(current.get("relative_humidity_2m")),
        ),
        "recent_rain_7d_mm": _round_or_none(_sum_values(recent_rain_values)),
        "forecast_rain_7d_mm": _round_or_none(_sum_values(forecast_rain_values)),
        "forecast_max_temp_avg_c": _round_or_none(_avg_values(forecast_max_temp_values)),
        "forecast_min_temp_avg_c": _round_or_none(_avg_values(forecast_min_temp_values)),
        "reference_et0_7d_mm": _round_or_none(_sum_values(forecast_et0_values)),
        "soil_moisture_latest": _round_or_none(soil_moisture_latest, digits=3),
        "soil_temperature_latest_c": _round_or_none(
            _latest_hourly_value(hourly, "soil_temperature_0cm"),
        ),
        "summary": "Dados meteorologicos cruzados pela localizacao do talhao.",
    }


def fetch_forecast_weather(latitude: float, longitude: float) -> dict:
    """
    Busca dados horários recentes e previstos.
    Usaremos:
    - últimos 7 dias
    - próximos 7 dias

    Isso permite analisar tanto o risco recente quanto a tendência climática.
    """

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(HOURLY_VARIABLES),
        "past_days": 7,
        "forecast_days": 7,
        "timezone": TIMEZONE,
    }

    data = _request_json(url, params)

    if "hourly" not in data:
        raise ValueError("Resposta do Open-Meteo não contém dados horários.")

    return data["hourly"]


def fetch_historical_daily_rainfall(latitude: float, longitude: float, days_back: int = 40) -> dict:
    """
    Busca chuva diária histórica para cálculo da pressão climática acumulada.
    """

    today = datetime.now(ZoneInfo(TIMEZONE)).date()

    # Arquivo histórico costuma ser mais estável até o dia anterior.
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=days_back - 1)

    url = "https://archive-api.open-meteo.com/v1/archive"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "precipitation_sum",
        "timezone": TIMEZONE,
    }

    data = _request_json(url, params)

    if "daily" not in data:
        raise ValueError("Resposta do Open-Meteo histórico não contém dados diários.")

    return data["daily"]
