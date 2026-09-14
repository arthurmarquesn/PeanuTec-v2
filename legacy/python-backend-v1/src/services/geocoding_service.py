import requests


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


def fetch_city_coordinates(city: str) -> dict:
    response = requests.get(
        GEOCODING_URL,
        params={
            "name": city,
            "count": 1,
            "language": "pt",
            "format": "json",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()

    results = data.get("results", [])

    if not results:
        raise ValueError(f"Cidade nao encontrada no geocoding: {city}")

    first_result = results[0]

    return {
        "latitude": first_result["latitude"],
        "longitude": first_result["longitude"],
    }
