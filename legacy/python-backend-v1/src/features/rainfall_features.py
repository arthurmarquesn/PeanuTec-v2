from collections import defaultdict


def daily_precipitation_from_hourly(hourly_weather: dict) -> dict:
    """
    Converte precipitação horária em precipitação diária.
    """

    times = hourly_weather.get("time", [])
    precipitation = hourly_weather.get("precipitation", [])

    daily = defaultdict(float)

    for time_str, rain in zip(times, precipitation):
        date_str = time_str.split("T")[0]
        daily[date_str] += rain or 0.0

    return dict(daily)


def count_rainy_days_above_threshold(daily_rainfall: dict, threshold_mm: float = 2.5, last_n_days: int = 7) -> int:
    """
    Conta quantos dias tiveram chuva acima do limite definido.
    """

    sorted_days = sorted(daily_rainfall.keys())
    selected_days = sorted_days[-last_n_days:]

    return sum(1 for day in selected_days if daily_rainfall[day] > threshold_mm)


def sum_daily_rainfall(daily_rainfall: dict) -> float:
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