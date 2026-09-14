def calculate_temperature_dew_point_differences(hourly_weather: dict) -> list[float]:
    temperatures = hourly_weather.get("temperature_2m", [])
    dew_points = hourly_weather.get("dew_point_2m", [])

    differences = []

    for temp, dew_point in zip(temperatures, dew_points):
        if temp is None or dew_point is None:
            continue

        differences.append(temp - dew_point)

    return differences


def get_min_dew_point_difference(hourly_weather: dict) -> float | None:
    differences = calculate_temperature_dew_point_differences(hourly_weather)

    if not differences:
        return None

    return min(differences)


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