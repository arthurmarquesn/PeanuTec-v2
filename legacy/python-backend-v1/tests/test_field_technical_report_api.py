from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)
TIMEZONE = ZoneInfo(api_app.TIMEZONE)


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
        api_app.spray_applications_repository,
        "SPRAY_APPLICATIONS_FILE",
        tmp_path / "outputs" / "spray_applications.json",
    )
    monkeypatch.setattr(
        api_app.calendar_events_repository,
        "CALENDAR_EVENTS_FILE",
        tmp_path / "outputs" / "calendar_events.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
    )


@pytest.fixture(autouse=True)
def deterministic_analysis(monkeypatch):
    def fake_run_disease_analysis_compact(talhao: dict) -> dict:
        return {
            "generated_at": "2026-06-17T10:00:00-03:00",
            "field": {
                "name": talhao["nome"],
                "city": talhao["cidade"],
                "crop": talhao["cultura"],
                "crop_status": talhao["status_lavoura"],
                "days_after_planting": 68,
                "crop_stage": "Final de ciclo com atenção operacional",
            },
            "disease": "Mancha-preta do amendoim",
            "pathogen": "Cercosporidium personatum / Nothopassalora personata",
            "risk": {
                "climate_index": 74,
                "agronomic_index": 81,
                "classification": "ALTO",
            },
            "management_relevance": {
                "status": "ATIVA",
                "description": "A lavoura está em campo.",
            },
            "actions": ["Realizar inspeção operacional no talhão."],
        }

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )


def make_field(field_id: str = "field-1") -> dict:
    return {
        "id": field_id,
        "nome": "Talhao A1",
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta"],
        "previous_crop": "Soja",
        "crop_rotation": True,
        "peanut_repetition_years": 0,
        "had_disease_incidence": False,
        "previous_diseases": None,
        "disease_incidence_level": None,
        "historical_pressure": "baixa",
        "agronomic_history_notes": "Área com rotação recente.",
    }


def create_field(field_id: str = "field-1") -> dict:
    field = make_field(field_id)
    api_app.fields_repository.save_fields([field])
    return field


def make_inspection_payload(**overrides) -> dict:
    payload = {
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": True,
        "visual_severity": "media",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "Lesões observadas em folhas baixeiras.",
        "inspected_at": "2026-06-16T08:30:00-03:00",
    }
    payload.update(overrides)
    return payload


def make_spray_payload(**overrides) -> dict:
    payload = {
        "application_date": "2026-06-15T09:00:00-03:00",
        "product": "Clorotalonil",
        "target": "Mancha-preta",
        "dose": "1,5 L/ha",
        "responsible": "Equipe técnica",
        "planned_interval_days": 12,
        "notes": "Registro operacional de pulverização.",
    }
    payload.update(overrides)
    return payload


def test_get_relatorio_tecnico_missing_field_returns_404():
    response = client.get("/talhoes/missing-field/relatorio-tecnico")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_get_relatorio_tecnico_without_inspections_or_sprays_returns_null_latest_records():
    field = create_field()

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico")

    assert response.status_code == 200
    data = response.json()
    assert data["field"]["id"] == field["id"]
    assert data["latest_inspection"] is None
    assert data["latest_spray_application"] is None
    assert data["inspections_summary"]["total"] == 0
    assert data["spray_summary"]["total"] == 0
    assert data["current_situation"]["field_id"] == field["id"]
    assert data["safety_note"] == api_app.TECHNICAL_REPORT_SAFETY_NOTE
    assert [item["type"] for item in data["timeline"]] == ["planting"]


def test_get_relatorio_tecnico_returns_latest_inspection_with_field_2_fields():
    field = create_field()
    payload = make_inspection_payload(
        general_status="atencao",
        problem_distribution="espalhado",
        pests_found=True,
        pest_notes="Insetos observados em reboleira oeste.",
        weeds_found=True,
        weed_pressure="media",
        soil_condition="umido",
        return_needed=True,
        return_days=4,
        observed_area="bordadura oeste",
        responsible="Tecnico de campo",
    )

    create_response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=payload,
    )
    assert create_response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico")

    assert response.status_code == 200
    latest_inspection = response.json()["latest_inspection"]
    assert latest_inspection["general_status"] == "atencao"
    assert latest_inspection["problem_distribution"] == "espalhado"
    assert latest_inspection["pests_found"] is True
    assert latest_inspection["pest_notes"] == "Insetos observados em reboleira oeste."
    assert latest_inspection["weeds_found"] is True
    assert latest_inspection["weed_pressure"] == "media"
    assert latest_inspection["soil_condition"] == "umido"
    assert latest_inspection["return_needed"] is True
    assert latest_inspection["return_days"] == 4
    assert latest_inspection["observed_area"] == "bordadura oeste"
    assert latest_inspection["responsible"] == "Tecnico de campo"

    summary = response.json()["inspections_summary"]
    assert summary["total"] == 1
    assert summary["symptoms_found_count"] == 1
    assert summary["return_needed_count"] == 1
    assert summary["last_responsible"] == "Tecnico de campo"
    assert summary["last_general_status"] == "atencao"
    assert summary["last_problem_distribution"] == "espalhado"


def test_get_relatorio_tecnico_returns_latest_spray_application():
    field = create_field()

    create_response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(),
    )
    assert create_response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico")

    assert response.status_code == 200
    data = response.json()
    latest_spray = data["latest_spray_application"]
    assert latest_spray["product"] == "Clorotalonil"
    assert latest_spray["target"] == "Mancha-preta"
    assert latest_spray["dose"] == "1,5 L/ha"
    assert latest_spray["responsible"] == "Equipe técnica"
    assert latest_spray["planned_interval_days"] == 12
    assert latest_spray["application_date"] == "2026-06-15T09:00:00-03:00"
    assert latest_spray["interval_status"] in {"em_dia", "atencao", "atrasado"}

    summary = data["spray_summary"]
    assert summary["total"] == 1
    assert summary["latest_date"] == "2026-06-15T09:00:00-03:00"
    assert summary["last_product"] == "Clorotalonil"
    assert summary["last_target"] == "Mancha-preta"
    assert summary["last_interval_status"] in {"em_dia", "atencao", "atrasado"}
    assert isinstance(summary["days_since_last_application"], int)


def test_get_relatorio_tecnico_timeline_returns_planting_inspection_and_spray():
    field = create_field()

    inspection_response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(),
    )
    assert inspection_response.status_code == 200

    spray_response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(),
    )
    assert spray_response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico")

    assert response.status_code == 200
    data = response.json()
    assert data["current_situation"]["field_id"] == field["id"]
    assert data["safety_note"] == api_app.TECHNICAL_REPORT_SAFETY_NOTE
    assert datetime.fromisoformat(data["generated_at"])

    timeline = data["timeline"]
    assert [item["type"] for item in timeline] == [
        "inspection",
        "spray",
        "planting",
    ]
    assert [item["title"] for item in timeline] == [
        "Inspeção registrada",
        "Pulverização registrada",
        "Plantio registrado",
    ]
    assert timeline[0]["metadata"]["symptoms_found"] is True
    assert timeline[1]["metadata"]["product"] == "Clorotalonil"
    assert timeline[2]["metadata"]["crop"] == "Amendoim"


def test_get_relatorio_tecnico_pdf_missing_field_returns_404():
    response = client.get("/talhoes/missing-field/relatorio-tecnico/pdf")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_get_relatorio_tecnico_pdf_existing_field_without_inspection_returns_pdf():
    field = create_field()

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico/pdf")

    assert response.status_code == 200
    assert "application/pdf" in response.headers["content-type"]
    content_disposition = response.headers["content-disposition"]
    assert "attachment" in content_disposition
    assert content_disposition.endswith('.pdf"')
    assert response.content.startswith(b"%PDF")


def test_get_relatorio_tecnico_pdf_with_field_2_inspection_and_spray_returns_pdf():
    field = create_field()
    inspection_response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(
            general_status="atencao",
            problem_distribution="generalizado",
            pests_found=True,
            pest_notes="Pragas observadas na bordadura.",
            weeds_found=True,
            weed_pressure="alta",
            soil_condition="umido",
            return_needed=True,
            return_days=3,
            observed_area="área baixa",
            responsible="Equipe técnica",
        ),
    )
    assert inspection_response.status_code == 200
    spray_response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(),
    )
    assert spray_response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico/pdf")

    assert response.status_code == 200
    assert "application/pdf" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert ".pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")
