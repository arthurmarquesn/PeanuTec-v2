from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


@pytest.fixture(autouse=True)
def isolated_files(tmp_path, monkeypatch):
    monkeypatch.setattr(
        api_app.fields_repository,
        "FIELDS_FILE",
        tmp_path / "outputs" / "fields.json",
    )
    monkeypatch.setattr(
        api_app.inspections_repository,
        "INSPECTIONS_FILE",
        tmp_path / "outputs" / "inspections.json",
    )
    monkeypatch.setattr(
        api_app.calendar_events_repository,
        "CALENDAR_EVENTS_FILE",
        tmp_path / "outputs" / "calendar_events.json",
    )


def make_field(field_id: str = "field-1", name: str = "Talhao A1") -> dict:
    return {
        "id": field_id,
        "nome": name,
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta"],
    }


def make_inspection_payload() -> dict:
    return {
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": True,
        "visual_severity": "media",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "Lesoes observadas em folhas baixeiras.",
    }


def create_field(field_id: str = "field-1", name: str = "Talhao A1") -> dict:
    field = make_field(field_id=field_id, name=name)
    api_app.fields_repository.save_fields([field])
    return field


def test_post_inspecoes_creates_inspection_for_existing_field():
    field = create_field()

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=make_inspection_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["id"]
    assert data["field_id"] == field["id"]
    assert data["field_name"] == "Talhao A1"
    assert data["disease"] == "Mancha-preta do amendoim"
    assert data["symptoms_found"] is True
    assert data["visual_severity"] == "media"
    assert data["defoliation_level"] == "baixa"
    assert data["action_taken"] == "monitorar"
    assert data["notes"] == "Lesoes observadas em folhas baixeiras."
    assert data["general_status"] is None
    assert data["problem_distribution"] is None
    assert data["pests_found"] is None
    assert data["pest_notes"] is None
    assert data["weeds_found"] is None
    assert data["weed_pressure"] is None
    assert data["soil_condition"] is None
    assert data["return_needed"] is None
    assert data["return_days"] is None
    assert data["observed_area"] is None
    assert data["responsible"] is None
    assert data["created_at"].endswith("-03:00")


def test_post_inspecoes_creates_inspection_with_field_2_fields():
    field = create_field()
    payload = {
        **make_inspection_payload(),
        "general_status": "atencao",
        "problem_distribution": "espalhado",
        "pests_found": True,
        "pest_notes": "Insetos observados em reboleira oeste.",
        "weeds_found": True,
        "weed_pressure": "media",
        "soil_condition": "umido",
        "return_needed": True,
        "return_days": 4,
        "observed_area": "bordadura oeste",
        "responsible": "Tecnico de campo",
    }

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["general_status"] == "atencao"
    assert data["problem_distribution"] == "espalhado"
    assert data["pests_found"] is True
    assert data["pest_notes"] == "Insetos observados em reboleira oeste."
    assert data["weeds_found"] is True
    assert data["weed_pressure"] == "media"
    assert data["soil_condition"] == "umido"
    assert data["return_needed"] is True
    assert data["return_days"] == 4
    assert data["observed_area"] == "bordadura oeste"
    assert data["responsible"] == "Tecnico de campo"


def test_post_inspecoes_returns_404_for_missing_field():
    response = client.post("/talhoes/missing-field/inspecoes", json=make_inspection_payload())

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_get_inspecoes_returns_field_inspections():
    field = create_field()
    payload = {
        **make_inspection_payload(),
        "general_status": "regular",
        "problem_distribution": "localizado",
        "return_needed": False,
        "observed_area": "centro",
    }
    created = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload).json()

    response = client.get(f"/talhoes/{field['id']}/inspecoes")

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == field["id"]
    assert data["field_name"] == "Talhao A1"
    assert data["total"] == 1
    assert data["inspections"] == [created]
    assert data["inspections"][0]["general_status"] == "regular"
    assert data["inspections"][0]["problem_distribution"] == "localizado"
    assert data["inspections"][0]["return_needed"] is False
    assert data["inspections"][0]["observed_area"] == "centro"


def test_get_inspecoes_returns_404_for_missing_field():
    response = client.get("/talhoes/missing-field/inspecoes")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_post_inspecoes_rejects_invalid_visual_severity():
    field = create_field()
    payload = make_inspection_payload()
    payload["visual_severity"] = "grave"

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 422
    assert "visual_severity" in str(response.json()["detail"])


def test_post_inspecoes_rejects_invalid_defoliation_level():
    field = create_field()
    payload = make_inspection_payload()
    payload["defoliation_level"] = "intensa"

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 422
    assert "defoliation_level" in str(response.json()["detail"])


def test_post_inspecoes_rejects_invalid_action_taken():
    field = create_field()
    payload = make_inspection_payload()
    payload["action_taken"] = "pulverizar"

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 422
    assert "action_taken" in str(response.json()["detail"])


def test_post_inspecoes_rejects_invalid_symptoms_found():
    field = create_field()
    payload = make_inspection_payload()
    payload["symptoms_found"] = "sim"

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 422
    assert "symptoms_found" in str(response.json()["detail"])


def test_post_inspecoes_rejects_negative_return_days():
    field = create_field()
    payload = make_inspection_payload()
    payload["return_days"] = -1

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 422
    assert "return_days" in str(response.json()["detail"])


def test_post_inspecoes_strips_notes():
    field = create_field()
    payload = make_inspection_payload()
    payload["notes"] = "  Lesoes novas.  "

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 200
    assert response.json()["notes"] == "Lesoes novas."


def test_post_inspecoes_creates_inspected_at_when_missing():
    field = create_field()
    payload = make_inspection_payload()

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 200
    inspected_at = response.json()["inspected_at"]
    assert inspected_at.endswith("-03:00")
    datetime.fromisoformat(inspected_at)


def test_get_inspecoes_orders_newest_first():
    field = create_field()
    old_payload = make_inspection_payload()
    old_payload["inspected_at"] = "2026-06-15T08:00:00-03:00"
    old_payload["notes"] = "Primeira vistoria"
    new_payload = make_inspection_payload()
    new_payload["inspected_at"] = "2026-06-15T10:30:00-03:00"
    new_payload["notes"] = "Segunda vistoria"

    client.post(f"/talhoes/{field['id']}/inspecoes", json=old_payload)
    client.post(f"/talhoes/{field['id']}/inspecoes", json=new_payload)

    response = client.get(f"/talhoes/{field['id']}/inspecoes")

    assert response.status_code == 200
    inspections = response.json()["inspections"]
    assert [inspection["notes"] for inspection in inspections] == [
        "Segunda vistoria",
        "Primeira vistoria",
    ]
