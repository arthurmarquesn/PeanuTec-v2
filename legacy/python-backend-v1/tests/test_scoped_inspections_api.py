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


def make_field(
    field_id: str = "field-1",
    name: str = "Talhao A1",
    status_lavoura: str = "em_campo",
) -> dict:
    return {
        "id": field_id,
        "nome": name,
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": status_lavoura,
        "doencas_monitoradas": ["Mancha-preta"],
    }


def save_fields(fields: list[dict]) -> None:
    api_app.fields_repository.save_fields(fields)


def make_scoped_payload(**overrides) -> dict:
    payload = {
        "scope": "selected",
        "field_ids": ["field-1"],
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": True,
        "visual_severity": "baixa",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "Inspecao geral da area.",
    }
    payload.update(overrides)
    return payload


def test_post_inspecoes_selected_creates_inspection_for_one_field():
    field = make_field()
    save_fields([field])

    response = client.post("/inspecoes", json=make_scoped_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["scope"] == "selected"
    assert data["created_count"] == 1
    assert data["field_ids"] == [field["id"]]
    assert data["inspections"][0]["field_id"] == field["id"]
    assert data["inspections"][0]["field_name"] == field["nome"]


def test_post_inspecoes_selected_creates_inspections_for_multiple_fields():
    field_a = make_field(field_id="field-1", name="Talhao A1")
    field_b = make_field(field_id="field-2", name="Talhao B2")
    save_fields([field_a, field_b])

    response = client.post(
        "/inspecoes",
        json=make_scoped_payload(field_ids=["field-1", "field-2"]),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["created_count"] == 2
    assert data["field_ids"] == ["field-1", "field-2"]
    assert {inspection["field_id"] for inspection in data["inspections"]} == {
        "field-1",
        "field-2",
    }


def test_post_inspecoes_selected_without_field_ids_returns_400():
    save_fields([make_field()])

    response = client.post(
        "/inspecoes",
        json=make_scoped_payload(field_ids=[]),
    )

    assert response.status_code == 400
    assert "field_ids" in response.json()["detail"]


def test_post_inspecoes_all_creates_inspections_for_active_fields_only():
    active_a = make_field(field_id="field-1", name="Talhao A1")
    active_b = make_field(field_id="field-2", name="Talhao B2")
    harvested = make_field(
        field_id="field-3",
        name="Talhao Colhido",
        status_lavoura="colhido",
    )
    save_fields([active_a, active_b, harvested])

    response = client.post(
        "/inspecoes",
        json=make_scoped_payload(scope="all", field_ids=["field-3"]),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["scope"] == "all"
    assert data["created_count"] == 2
    assert data["field_ids"] == ["field-1", "field-2"]
    assert {inspection["field_id"] for inspection in data["inspections"]} == {
        "field-1",
        "field-2",
    }


def test_post_inspecoes_all_without_active_fields_returns_400():
    save_fields(
        [
            make_field(field_id="field-1", status_lavoura="colhido"),
            make_field(field_id="field-2", status_lavoura="arrancado"),
        ]
    )

    response = client.post(
        "/inspecoes",
        json=make_scoped_payload(scope="all"),
    )

    assert response.status_code == 400
    assert "ativos" in response.json()["detail"]


def test_post_inspecoes_invalid_scope_returns_validation_error():
    save_fields([make_field()])

    response = client.post(
        "/inspecoes",
        json=make_scoped_payload(scope="invalid"),
    )

    assert response.status_code == 422
    assert "scope" in str(response.json()["detail"])


def test_old_field_inspection_endpoint_continues_working():
    field = make_field()
    save_fields([field])
    payload = make_scoped_payload()
    payload.pop("scope")
    payload.pop("field_ids")

    response = client.post(f"/talhoes/{field['id']}/inspecoes", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == field["id"]
    assert data["disease"] == "Mancha-preta do amendoim"
