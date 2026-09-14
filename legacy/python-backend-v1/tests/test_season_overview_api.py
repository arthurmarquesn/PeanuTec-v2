from datetime import datetime, timedelta
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
        api_app.spray_applications_repository,
        "SPRAY_APPLICATIONS_FILE",
        tmp_path / "outputs" / "spray_applications.json",
    )
    monkeypatch.setattr(
        api_app.inspections_repository,
        "INSPECTIONS_FILE",
        tmp_path / "outputs" / "inspections.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
    )
    monkeypatch.setattr(
        api_app.calendar_events_repository,
        "CALENDAR_EVENTS_FILE",
        tmp_path / "outputs" / "calendar_events.json",
    )


def make_field(
    field_id: str,
    name: str,
    status_lavoura: str = "em_campo",
    diseases: list[str] | None = None,
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
        "doencas_monitoradas": diseases or ["Mancha-preta"],
    }


def make_analysis(
    disease_id: str = "Mancha-preta",
    classification: str = "ALTO",
    agronomic_index: int = 85,
) -> dict:
    return {
        "generated_at": "2026-06-17T10:00:00-03:00",
        "field": {
            "name": "Talhao",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 68,
            "crop_stage": "Fase critica",
        },
        "disease": "Mancha-preta do amendoim"
        if disease_id == "Mancha-preta"
        else "Mancha-castanha do amendoim",
        "pathogen": "Patogeno",
        "risk": {
            "climate_index": 80,
            "agronomic_index": agronomic_index,
            "classification": classification,
        },
        "management_relevance": {
            "status": "ATIVA",
            "description": "A lavoura esta em campo.",
        },
        "actions": ["Realizar acompanhamento operacional."],
    }


def patch_analysis(monkeypatch, analyses_by_name: dict[str, dict]) -> None:
    def fake_run_disease_analysis_compact(talhao: dict) -> dict:
        return analyses_by_name[talhao["nome"]]

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )


def make_spray(
    spray_id: str,
    field_id: str,
    field_name: str,
    days_since_application: int,
    planned_interval_days: int = 12,
    product: str = "Produto A",
    product_id: str | None = "product-a",
    product_type: str | None = "fungicida",
    target: str = "Mancha-preta",
) -> dict:
    application_date = datetime.now(TIMEZONE) - timedelta(
        days=days_since_application
    )

    return {
        "id": spray_id,
        "field_id": field_id,
        "field_name": field_name,
        "application_date": application_date.isoformat(timespec="seconds"),
        "product_id": product_id,
        "product": product,
        "product_type": product_type,
        "target": target,
        "dose": "1,5 L/ha",
        "responsible": "Tecnico responsavel",
        "planned_interval_days": planned_interval_days,
        "notes": "",
        "created_at": application_date.isoformat(timespec="seconds"),
    }


def make_inspection(
    inspection_id: str,
    field_id: str,
    field_name: str,
    days_ago: int = 1,
    symptoms_found: bool = False,
) -> dict:
    inspected_at = datetime.now(TIMEZONE) - timedelta(days=days_ago)

    return {
        "id": inspection_id,
        "field_id": field_id,
        "field_name": field_name,
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": symptoms_found,
        "visual_severity": "baixa",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "",
        "inspected_at": inspected_at.isoformat(timespec="seconds"),
        "created_at": inspected_at.isoformat(timespec="seconds"),
    }


def make_calendar_event(
    event_id: str,
    days_from_now: int = 2,
    event_type: str = "reaplicacao_prevista",
) -> dict:
    event_date = datetime.now(TIMEZONE).date() + timedelta(days=days_from_now)

    return {
        "id": event_id,
        "event_type": event_type,
        "title": "Reaplicacao prevista - Talhao Prioridade",
        "field_id": "field-priority",
        "field_name": "Talhao Prioridade",
        "date": event_date.isoformat(),
        "end_date": event_date.isoformat(),
        "product": "Produto A",
        "product_type": "fungicida",
        "target": "Mancha-preta",
        "planned_interval_days": 12,
        "notes": "",
        "color_key": "purple",
        "status": "previsto",
        "source_type": "spray_application",
        "source_id": "spray-priority",
        "created_at": datetime.now(TIMEZONE).isoformat(timespec="seconds"),
    }


def seed_overview_data(monkeypatch) -> None:
    fields = [
        make_field("field-stable", "Talhao Estavel"),
        make_field("field-priority", "Talhao Prioridade"),
        make_field("field-attention", "Talhao Atencao"),
        make_field("field-monitor", "Talhao Monitorar"),
        make_field("field-closed", "Talhao Colhido", status_lavoura="colhido"),
    ]
    api_app.fields_repository.save_fields(fields)
    api_app.products_repository.create_product(
        {
            "id": "product-a",
            "name": "Produto A",
            "product_type": "fungicida",
            "active_ingredient": None,
            "main_target": "Mancha-preta",
            "default_defense_days": 12,
            "notes": None,
            "is_active": True,
            "created_at": "2026-06-17T10:00:00-03:00",
            "updated_at": "2026-06-17T10:00:00-03:00",
        }
    )
    api_app.spray_applications_repository.save_spray_applications(
        [
            make_spray(
                "spray-stable",
                "field-stable",
                "Talhao Estavel",
                days_since_application=2,
            ),
            make_spray(
                "spray-priority",
                "field-priority",
                "Talhao Prioridade",
                days_since_application=13,
            ),
            make_spray(
                "spray-attention",
                "field-attention",
                "Talhao Atencao",
                days_since_application=10,
            ),
        ]
    )
    api_app.inspections_repository.save_inspections(
        [
            make_inspection("inspection-stable", "field-stable", "Talhao Estavel"),
            make_inspection(
                "inspection-priority",
                "field-priority",
                "Talhao Prioridade",
            ),
            make_inspection(
                "inspection-attention",
                "field-attention",
                "Talhao Atencao",
            ),
        ]
    )
    api_app.calendar_events_repository.save_calendar_events(
        [make_calendar_event("event-reapplication")]
    )
    patch_analysis(
        monkeypatch,
        {
            "Talhao Estavel": make_analysis(classification="BAIXO", agronomic_index=25),
            "Talhao Prioridade": make_analysis(
                classification="CRITICO",
                agronomic_index=95,
            ),
            "Talhao Atencao": make_analysis(
                classification="ALTO",
                agronomic_index=88,
            ),
            "Talhao Monitorar": make_analysis(
                classification="MODERADO",
                agronomic_index=60,
            ),
        },
    )


def test_safra_resumo_returns_expected_structure():
    response = client.get("/safra/resumo")

    assert response.status_code == 200
    assert response.json() == {
        "summary": {
            "total_fields": 0,
            "active_fields": 0,
            "stable_fields": 0,
            "monitoring_fields": 0,
            "high_attention_fields": 0,
            "maximum_priority_fields": 0,
            "low_or_expired_defense_fields": 0,
            "fields_without_spray": 0,
            "fields_without_recent_inspection": 0,
            "average_estimated_defense_percent": 0,
        },
        "status_distribution": [],
        "defense_distribution": [],
        "critical_fields": [],
        "operational_alerts": [],
        "top_product": None,
        "top_target": None,
        "upcoming_calendar_events": [],
    }


def test_safra_resumo_calculates_active_fields(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["total_fields"] == 5
    assert summary["active_fields"] == 4


def test_safra_resumo_calculates_status_distribution(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    assert response.json()["status_distribution"] == [
        {
            "current_situation": "estavel",
            "fields_count": 1,
            "situation_label": "Estavel",
        },
        {
            "current_situation": "monitorar",
            "fields_count": 1,
            "situation_label": "Monitorar",
        },
        {
            "current_situation": "alta_atencao",
            "fields_count": 1,
            "situation_label": "Alta atencao",
        },
        {
            "current_situation": "prioridade_maxima",
            "fields_count": 1,
            "situation_label": "Prioridade maxima",
        },
    ]


def test_safra_resumo_calculates_average_estimated_defense(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    assert response.json()["summary"]["average_estimated_defense_percent"] == 33.33


def test_safra_resumo_lists_critical_fields(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    critical_fields = response.json()["critical_fields"]
    assert [field["field_id"] for field in critical_fields] == [
        "field-priority",
        "field-attention",
    ]
    assert critical_fields[0]["current_situation"] == "prioridade_maxima"
    assert critical_fields[0]["main_disease"] == "Mancha-preta do amendoim"
    assert critical_fields[0]["defense_status"] == "vencida"
    assert critical_fields[0]["recommended_next_action"]


def test_safra_resumo_generates_operational_alerts(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    alert_types = {alert["type"] for alert in response.json()["operational_alerts"]}
    assert {
        "prioridade_maxima",
        "defesa_vencida",
        "defesa_baixa",
        "sem_pulverizacao",
        "sem_inspecao_recente",
        "reaplicacao_proxima",
    }.issubset(alert_types)


def test_safra_resumo_uses_metrics_and_calendar(monkeypatch):
    seed_overview_data(monkeypatch)

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    data = response.json()
    assert data["top_product"] == {
        "product_id": "product-a",
        "product": "Produto A",
        "product_type": "fungicida",
        "applications_count": 3,
    }
    assert data["top_target"] == {
        "target": "Mancha-preta",
        "applications_count": 3,
    }
    assert len(data["upcoming_calendar_events"]) == 1
    assert data["upcoming_calendar_events"][0]["event_type"] == "reaplicacao_prevista"


def test_safra_resumo_works_without_data():
    response = client.get("/safra/resumo")

    assert response.status_code == 200
    assert response.json()["summary"]["total_fields"] == 0
    assert response.json()["operational_alerts"] == []


def test_safra_resumo_works_with_legacy_fields(monkeypatch):
    api_app.fields_repository.save_fields(
        [
            {
                "id": "field-legacy",
                "nome": "Talhao Legado",
                "cidade": "Tupa-SP",
                "latitude": -21.9347,
                "longitude": -50.5136,
                "cultura": "Amendoim",
                "data_plantio": "2026-04-10",
                "status_lavoura": "em_campo",
            }
        ]
    )
    patch_analysis(monkeypatch, {})

    response = client.get("/safra/resumo")

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["active_fields"] == 1
    assert data["status_distribution"] == [
        {
            "current_situation": "monitorar",
            "fields_count": 1,
            "situation_label": "Monitorar",
        }
    ]
    assert data["summary"]["fields_without_spray"] == 1
