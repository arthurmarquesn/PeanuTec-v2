def is_probably_wet_hour(
    humidity: float | None,
    temperature: float | None,
    dew_point: float | None,
    radiation: float | None,
) -> bool:
    """
    Estimativa simples de molhamento foliar.

    Consideramos molhamento provável quando:
    - umidade >= 90%
    - temperatura próxima do ponto de orvalho
    - radiação solar baixa
    """

    if humidity is None or temperature is None or dew_point is None or radiation is None:
        return False

    dew_point_difference = temperature - dew_point

    return (
        humidity >= 90
        and dew_point_difference <= 2
        and radiation < 100
    )


def estimate_wet_hours_sequence(hourly_weather: dict) -> list[bool]:
    humidities = hourly_weather.get("relative_humidity_2m", [])
    temperatures = hourly_weather.get("temperature_2m", [])
    dew_points = hourly_weather.get("dew_point_2m", [])
    radiations = hourly_weather.get("shortwave_radiation", [])

    wet_sequence = []

    for humidity, temperature, dew_point, radiation in zip(
        humidities,
        temperatures,
        dew_points,
        radiations
    ):
        wet_sequence.append(
            is_probably_wet_hour(
                humidity=humidity,
                temperature=temperature,
                dew_point=dew_point,
                radiation=radiation,
            )
        )

    return wet_sequence


def longest_continuous_true_sequence(values: list[bool]) -> int:
    max_count = 0
    current_count = 0

    for value in values:
        if value:
            current_count += 1
            max_count = max(max_count, current_count)
        else:
            current_count = 0

    return max_count


def estimate_max_leaf_wetness_hours(hourly_weather: dict) -> int:
    wet_sequence = estimate_wet_hours_sequence(hourly_weather)
    return longest_continuous_true_sequence(wet_sequence)


def score_leaf_wetness(max_wetness_hours: int) -> int:
    if max_wetness_hours >= 10:
        return 25
    if max_wetness_hours >= 6:
        return 15
    return 0