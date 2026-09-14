def count_low_drying_hours(hourly_weather: dict) -> int:
    """
    Conta horas em que a secagem foliar tende a ser baixa.

    Baixa secagem:
    - radiação baixa
    - vento baixo
    - umidade alta
    """

    radiations = hourly_weather.get("shortwave_radiation", [])
    wind_speeds = hourly_weather.get("wind_speed_10m", [])
    humidities = hourly_weather.get("relative_humidity_2m", [])

    count = 0

    for radiation, wind_speed, humidity in zip(radiations, wind_speeds, humidities):
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