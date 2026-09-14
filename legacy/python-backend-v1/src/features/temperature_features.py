def count_hours_in_favorable_range(hourly_weather: dict, min_temp: float = 20.0, max_temp: float = 26.0) -> int:
    temperatures = hourly_weather.get("temperature_2m", [])

    return sum(
        1 for temp in temperatures
        if temp is not None and min_temp <= temp <= max_temp
    )


def get_temperature_summary(hourly_weather: dict) -> dict:
    temperatures = [
        temp for temp in hourly_weather.get("temperature_2m", [])
        if temp is not None
    ]

    if not temperatures:
        return {
            "average": None,
            "minimum": None,
            "maximum": None,
        }

    return {
        "average": sum(temperatures) / len(temperatures),
        "minimum": min(temperatures),
        "maximum": max(temperatures),
    }


def score_temperature(hours_favorable: int) -> int:
    """
    Pontuação baseada em presença de horas dentro da faixa 20 °C a 26 °C.
    """

    if hours_favorable >= 10:
        return 20
    if hours_favorable >= 4:
        return 10
    return 0