from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


@pytest.fixture(autouse=True)
def isolated_fields_file(tmp_path, monkeypatch):
    monkeypatch.setattr(
        api_app.fields_repository,
        "FIELDS_FILE",
        tmp_path / "outputs" / "fields.json",
    )


@pytest.fixture
def mock_geocoding(monkeypatch):
    def fake_fetch_city_coordinates(city: str) -> dict:
        if city == "Cidade Invalida":
            raise ValueError("Cidade nao encontrada no geocoding: Cidade Invalida")

        if city == "Marilia-SP":
            return {
                "latitude": -22.2171,
                "longitude": -49.9501,
            }

        return {
            "latitude": -21.9347,
            "longitude": -50.5136,
        }

    monkeypatch.setattr(
        api_app.geocoding_service,
        "fetch_city_coordinates",
        fake_fetch_city_coordinates,
    )


def make_field_payload() -> dict:
    return {
        "nome": "Talhao A1",
        "cidade": "Tupa-SP",
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta", "Mancha-castanha"],
    }


def make_agronomic_history_payload() -> dict:
    payload = make_field_payload()
    payload.update(
        {
            "previous_crop": "Milho",
            "crop_rotation": True,
            "peanut_repetition_years": 1,
            "had_disease_incidence": True,
            "previous_diseases": ["Mancha-preta"],
            "disease_incidence_level": "media",
            "historical_pressure": "alta",
            "agronomic_history_notes": "Area com historico de pressao foliar.",
        }
    )
    return payload


def create_field(mock_geocoding) -> dict:
    response = client.post("/talhoes", json=make_field_payload())
    assert response.status_code == 200
    return response.json()


def assert_validation_error(response):
    assert response.status_code == 422
    assert "detail" in response.json()


def test_get_talhoes_returns_list():
    response = client.get("/talhoes")

    assert response.status_code == 200
    assert response.json() == []


def test_post_talhoes_creates_field_with_mocked_coordinates(mock_geocoding):
    response = client.post("/talhoes", json=make_field_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["id"]
    assert data["nome"] == "Talhao A1"
    assert data["cidade"] == "Tupa-SP"
    assert data["latitude"] == -21.9347
    assert data["longitude"] == -50.5136
    assert data["cultura"] == "Amendoim"
    assert data["data_plantio"] == "2026-04-10"
    assert data["status_lavoura"] == "em_campo"
    assert data["doencas_monitoradas"] == ["Mancha-preta", "Mancha-castanha"]
    assert data["previous_crop"] is None
    assert data["crop_rotation"] is None
    assert data["peanut_repetition_years"] is None
    assert data["had_disease_incidence"] is None
    assert data["previous_diseases"] is None
    assert data["disease_incidence_level"] is None
    assert data["historical_pressure"] is None
    assert data["agronomic_history_notes"] is None


def test_post_talhoes_creates_field_with_agronomic_history(mock_geocoding):
    response = client.post("/talhoes", json=make_agronomic_history_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["previous_crop"] == "Milho"
    assert data["crop_rotation"] is True
    assert data["peanut_repetition_years"] == 1
    assert data["had_disease_incidence"] is True
    assert data["previous_diseases"] == ["Mancha-preta"]
    assert data["disease_incidence_level"] == "media"
    assert data["historical_pressure"] == "alta"
    assert data["agronomic_history_notes"] == "Area com historico de pressao foliar."


def test_get_talhao_by_id_returns_existing_field(mock_geocoding):
    field = create_field(mock_geocoding)

    response = client.get(f"/talhoes/{field['id']}")

    assert response.status_code == 200
    assert response.json() == field


def test_get_talhoes_returns_agronomic_history_fields(mock_geocoding):
    created = client.post("/talhoes", json=make_agronomic_history_payload()).json()

    response = client.get("/talhoes")

    assert response.status_code == 200
    assert response.json() == [created]
    assert response.json()[0]["historical_pressure"] == "alta"


def test_put_talhao_updates_field_and_recalculates_coordinates(mock_geocoding):
    field = create_field(mock_geocoding)
    payload = make_field_payload()
    payload["nome"] = "Talhao Atualizado"
    payload["cidade"] = "Marilia-SP"
    payload["doencas_monitoradas"] = ["Mancha-castanha"]

    response = client.put(f"/talhoes/{field['id']}", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == field["id"]
    assert data["nome"] == "Talhao Atualizado"
    assert data["cidade"] == "Marilia-SP"
    assert data["latitude"] == -22.2171
    assert data["longitude"] == -49.9501
    assert data["doencas_monitoradas"] == ["Mancha-castanha"]


def test_put_talhao_updates_agronomic_history(mock_geocoding):
    field = create_field(mock_geocoding)
    payload = make_agronomic_history_payload()
    payload["previous_crop"] = "Soja"
    payload["crop_rotation"] = False
    payload["peanut_repetition_years"] = 3
    payload["disease_incidence_level"] = "alta"
    payload["historical_pressure"] = "media"

    response = client.put(f"/talhoes/{field['id']}", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == field["id"]
    assert data["previous_crop"] == "Soja"
    assert data["crop_rotation"] is False
    assert data["peanut_repetition_years"] == 3
    assert data["disease_incidence_level"] == "alta"
    assert data["historical_pressure"] == "media"


def test_legacy_field_without_agronomic_history_keeps_working():
    legacy_field = {
        "id": "field-legacy",
        "nome": "Talhao legado",
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta"],
    }
    api_app.fields_repository.save_fields([legacy_field])

    response = client.get("/talhoes/field-legacy")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "field-legacy"
    assert data["previous_crop"] is None
    assert data["historical_pressure"] is None


def test_delete_talhao_removes_field(mock_geocoding):
    field = create_field(mock_geocoding)

    response = client.delete(f"/talhoes/{field['id']}")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Talhao removido com sucesso",
        "id": field["id"],
    }
    assert client.get(f"/talhoes/{field['id']}").status_code == 404


def test_invalid_city_returns_error(mock_geocoding):
    payload = make_field_payload()
    payload["cidade"] = "Cidade Invalida"

    response = client.post("/talhoes", json=payload)

    assert response.status_code == 400
    assert "Cidade nao encontrada" in response.json()["detail"]


def test_talhao_rejects_invalid_crop(mock_geocoding):
    payload = make_field_payload()
    payload["cultura"] = "Soja"

    response = client.post("/talhoes", json=payload)

    assert_validation_error(response)
    assert "cultura" in str(response.json()["detail"])


def test_talhao_rejects_invalid_disease(mock_geocoding):
    payload = make_field_payload()
    payload["doencas_monitoradas"] = ["Ferrugem"]

    response = client.post("/talhoes", json=payload)

    assert_validation_error(response)
    assert "doencas_monitoradas" in str(response.json()["detail"])


def test_talhao_rejects_invalid_status(mock_geocoding):
    payload = make_field_payload()
    payload["status_lavoura"] = "plantado"

    response = client.post("/talhoes", json=payload)

    assert_validation_error(response)
    assert "status_lavoura" in str(response.json()["detail"])


def test_talhao_rejects_future_planting_date(mock_geocoding):
    payload = make_field_payload()
    payload["data_plantio"] = (date.today() + timedelta(days=1)).isoformat()

    response = client.post("/talhoes", json=payload)

    assert_validation_error(response)
    assert "data_plantio" in str(response.json()["detail"])
