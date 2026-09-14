from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from app.main import app
from src.engine import risk_engine


client = TestClient(app)


def _hourly_weather() -> dict:
    timezone = ZoneInfo("America/Sao_Paulo")
    start = datetime.now(timezone) - timedelta(days=8)
    times = [
        (start + timedelta(hours=6 * index)).replace(
            minute=0,
            second=0,
            microsecond=0,
        )
        for index in range(60)
    ]

    return {
        "time": [
            item.strftime("%Y-%m-%dT%H:%M")
            for item in times
        ],
        "temperature_2m": [23.0] * len(times),
        "relative_humidity_2m": [92.0] * len(times),
        "dew_point_2m": [22.0] * len(times),
        "precipitation": [0.8] * len(times),
        "surface_pressure": [950.0] * len(times),
        "pressure_msl": [1010.0] * len(times),
        "wind_speed_10m": [4.0] * len(times),
        "shortwave_radiation": [150.0] * len(times),
    }


def _historical_rainfall() -> dict:
    today = date.today()
    days = [
        today - timedelta(days=40 - index)
        for index in range(40)
    ]

    return {
        "time": [
            item.isoformat()
            for item in days
        ],
        "precipitation_sum": [3.0] * len(days),
    }


def _payload(
    disease: str = "Mancha-preta",
    planting_date: str | None = None,
    status: str = "em_campo",
) -> dict:
    return {
        "field": {
            "nome": "Talhao Teste",
            "cidade": "Tupa-SP",
            "latitude": -21.9347,
            "longitude": -50.5136,
            "data_plantio": (
                planting_date
                or (date.today() - timedelta(days=90)).isoformat()
            ),
            "cultura": "Amendoim",
            "doenca_alvo": disease,
            "status_lavoura": status,
        },
        "weather": {
            "hourly_weather": _hourly_weather(),
            "historical_daily_rainfall": _historical_rainfall(),
            "fetched_at": datetime.now().isoformat(),
        },
    }


def _assert_compact_response(
    body: dict,
    disease_prefix: str,
) -> None:
    assert body["field"]["name"] == "Talhao Teste"
    assert body["disease"].startswith(disease_prefix)
    assert isinstance(body["actions"], list)
    assert set(body["risk"]) == {
        "climate_index",
        "agronomic_index",
        "classification",
    }
    assert "management_relevance" in body


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_black_spot_valid_snapshot() -> None:
    response = client.post(
        "/analisar",
        json=_payload("Mancha-preta"),
    )

    assert response.status_code == 200
    _assert_compact_response(
        response.json(),
        "Mancha-preta",
    )


def test_brown_spot_valid_snapshot() -> None:
    response = client.post(
        "/analisar",
        json=_payload("Mancha-castanha"),
    )

    assert response.status_code == 200
    _assert_compact_response(
        response.json(),
        "Mancha-castanha",
    )


def test_invalid_disease() -> None:
    response = client.post(
        "/analisar",
        json=_payload("Ferrugem"),
    )

    assert response.status_code == 422


def test_future_planting_date() -> None:
    response = client.post(
        "/analisar",
        json=_payload(
            planting_date=(
                date.today() + timedelta(days=1)
            ).isoformat(),
        ),
    )

    assert response.status_code == 422


def test_snapshot_without_hourly_weather() -> None:
    payload = _payload()
    del payload["weather"]["hourly_weather"]

    response = client.post(
        "/analisar",
        json=payload,
    )

    assert response.status_code == 422


def test_snapshot_without_precipitation_sum() -> None:
    payload = _payload()
    del payload["weather"]["historical_daily_rainfall"][
        "precipitation_sum"
    ]

    response = client.post(
        "/analisar",
        json=payload,
    )

    assert response.status_code == 400


def test_invalid_coordinates() -> None:
    payload = _payload()
    payload["field"]["latitude"] = -120

    response = client.post(
        "/analisar",
        json=payload,
    )

    assert response.status_code == 422


def test_field_out_of_field_status() -> None:
    response = client.post(
        "/analisar",
        json=_payload(status="arrancado"),
    )

    assert response.status_code == 200
    assert (
        response.json()["management_relevance"]["status"]
        == "ENCERRADA PARA DOENCA FOLIAR"
    ) or (
        response.json()["management_relevance"]["status"]
        == "ENCERRADA PARA DOENÇA FOLIAR"
    )


def test_analysis_does_not_fetch_open_meteo(
    monkeypatch,
) -> None:
    def fail_fetch(*_args, **_kwargs):
        raise AssertionError(
            "Open-Meteo must not be called by the intelligence service"
        )

    monkeypatch.setattr(
        risk_engine,
        "fetch_forecast_weather",
        fail_fetch,
    )
    monkeypatch.setattr(
        risk_engine,
        "fetch_historical_daily_rainfall",
        fail_fetch,
    )

    response = client.post(
        "/analisar",
        json=_payload("Mancha-preta"),
    )

    assert response.status_code == 200
