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
        api_app.calendar_events_repository,
        "CALENDAR_EVENTS_FILE",
        tmp_path / "outputs" / "calendar_events.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
    )


def make_field(
    field_id: str = "field-1",
    name: str = "Talhao A1",
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
        "status_lavoura": "em_campo",
        "doencas_monitoradas": diseases or ["Mancha-preta"],
    }


def make_analysis(
    disease_id: str,
    agronomic_index: int,
    classification: str,
    management_status: str = "ATIVA",
    climate_index: int = 85,
    crop_stage: str | None = None,
) -> dict:
    disease_data = {
        "Mancha-preta": {
            "disease": "Mancha-preta do amendoim",
            "pathogen": "Cercosporidium personatum / Nothopassalora personata",
            "crop_stage": crop_stage or "Final de ciclo",
        },
        "Mancha-castanha": {
            "disease": "Mancha-castanha do amendoim",
            "pathogen": "Cercospora arachidicola",
            "crop_stage": crop_stage or "Fase critica para mancha-castanha",
        },
    }[disease_id]

    return {
        "generated_at": "2026-06-14T22:00:00-03:00",
        "field": {
            "name": "Talhao A1",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 65,
            "crop_stage": disease_data["crop_stage"],
        },
        "disease": disease_data["disease"],
        "pathogen": disease_data["pathogen"],
        "risk": {
            "climate_index": climate_index,
            "agronomic_index": agronomic_index,
            "classification": classification,
        },
        "management_relevance": {
            "status": management_status,
            "description": "A lavoura esta em campo.",
        },
        "actions": [
            "Realizar inspecao prioritaria no talhao.",
        ],
    }


def make_spray(
    field_id: str,
    field_name: str = "Talhao A1",
    days_since_application: int = 2,
    planned_interval_days: int = 12,
) -> dict:
    application_date = datetime.now(TIMEZONE) - timedelta(
        days=days_since_application
    )

    return {
        "id": f"spray-{field_id}",
        "field_id": field_id,
        "field_name": field_name,
        "application_date": application_date.isoformat(timespec="seconds"),
        "product_id": None,
        "product": "Produto A",
        "product_type": "fungicida",
        "target": "Mancha-preta",
        "dose": "1,5 L/ha",
        "responsible": "Tecnico",
        "planned_interval_days": planned_interval_days,
        "notes": "",
        "generate_reapplication": False,
        "reapplication_interval_days": None,
        "reapplication_date": None,
        "reapplication_notes": None,
        "created_at": application_date.isoformat(timespec="seconds"),
    }


def make_inspection(
    field_id: str,
    field_name: str = "Talhao A1",
    days_ago: int = 1,
    symptoms_found: bool = False,
    visual_severity: str = "baixa",
    defoliation_level: str = "baixa",
    action_taken: str = "monitorar",
) -> dict:
    inspected_at = datetime.now(TIMEZONE) - timedelta(days=days_ago)

    return {
        "id": f"inspection-{field_id}",
        "field_id": field_id,
        "field_name": field_name,
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": symptoms_found,
        "visual_severity": visual_severity,
        "defoliation_level": defoliation_level,
        "action_taken": action_taken,
        "notes": "",
        "inspected_at": inspected_at.isoformat(timespec="seconds"),
        "created_at": inspected_at.isoformat(timespec="seconds"),
    }


def make_calendar_event(
    field_id: str,
    field_name: str,
    days_from_now: int,
    event_type: str = "reaplicacao_prevista",
) -> dict:
    event_date = datetime.now(TIMEZONE).date() + timedelta(days=days_from_now)

    return {
        "id": f"event-{field_id}-{days_from_now}",
        "event_type": event_type,
        "title": "Reaplicacao prevista",
        "field_id": field_id,
        "field_name": field_name,
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
        "source_id": f"spray-{field_id}",
        "created_at": datetime.now(TIMEZONE).isoformat(timespec="seconds"),
    }


def patch_analysis(monkeypatch, analysis_by_disease: dict[str, dict]) -> None:
    def fake_run_disease_analysis_compact(talhao: dict) -> dict:
        return analysis_by_disease[talhao["doenca_alvo"]]

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )


def test_ranking_empty_when_no_fields(monkeypatch):
    patch_analysis(monkeypatch, {})

    response = client.get("/ranking")

    assert response.status_code == 200
    data = response.json()
    assert "generated_at" in data
    assert data["total_fields"] == 0
    assert data["total_items"] == 0
    assert data["ranking"] == []


def test_ranking_with_one_field_builds_attention_priority(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=94,
                classification="CRITICO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    data = response.json()
    assert data["total_fields"] == 1
    assert data["total_items"] == 1
    item = data["ranking"][0]
    assert item["rank"] == 1
    assert item["field_id"] == "field-1"
    assert item["field_name"] == "Talhao A1"
    assert item["disease"] == "Mancha-preta do amendoim"
    assert item["risk_classification"] == "CRITICO"
    assert item["agronomic_index"] == 94
    assert item["agronomic_index_with_history"] == 94
    assert item["historical_risk_bonus"] == 0
    assert item["historical_risk_reasons"] == []
    assert item["priority_score"] >= 50
    assert item["priority_label"] == "Alta atencao"
    assert item["priority"] == "ALTA PRIORIDADE"
    assert item["confidence_score"] == 35
    assert item["confidence_label"] == "Baixa"
    assert item["main_reasons"][0] == {
        "code": "sem_pulverizacao_registrada",
        "label": "Sem pulverização registrada",
        "impact": "defesa",
        "points": 24,
        "description": "Não há registro de pulverização para estimar a janela operacional do talhão.",
    }
    assert item["metrics"]["block_scores"]["defense"] == 24
    assert item["main_action"] == "Realizar inspecao prioritaria no talhao."


def test_ranking_uses_one_attention_item_per_field(monkeypatch):
    api_app.fields_repository.save_fields(
        [make_field(diseases=["Mancha-preta", "Mancha-castanha"])]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=94,
                classification="CRITICO",
            ),
            "Mancha-castanha": make_analysis(
                "Mancha-castanha",
                agronomic_index=60,
                classification="ALTO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    data = response.json()
    assert data["total_fields"] == 1
    assert data["total_items"] == 1
    assert data["ranking"][0]["rank"] == 1
    assert data["ranking"][0]["disease"] == "Mancha-preta do amendoim"


def test_ranking_orders_highest_attention_first(monkeypatch):
    api_app.fields_repository.save_fields(
        [
            make_field(field_id="field-stable", name="Talhao Estavel"),
            make_field(field_id="field-attention", name="Talhao Atencao"),
        ]
    )
    api_app.spray_applications_repository.save_spray_applications(
        [
            make_spray(
                "field-stable",
                field_name="Talhao Estavel",
                days_since_application=2,
            ),
            make_spray(
                "field-attention",
                field_name="Talhao Atencao",
                days_since_application=16,
            ),
        ]
    )
    api_app.inspections_repository.save_inspections(
        [
            make_inspection(
                "field-stable",
                field_name="Talhao Estavel",
                symptoms_found=False,
            ),
            make_inspection(
                "field-attention",
                field_name="Talhao Atencao",
                symptoms_found=True,
                visual_severity="alta",
                defoliation_level="media",
                action_taken="consultar_responsavel",
            ),
        ]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=40,
                classification="MODERADO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    ranking = response.json()["ranking"]
    assert ranking[0]["field_id"] == "field-attention"
    assert ranking[0]["priority_score"] > ranking[1]["priority_score"]


def test_ranking_with_symptoms_never_displays_stable_priority(monkeypatch):
    field = make_field()
    api_app.fields_repository.save_fields([field])
    api_app.spray_applications_repository.save_spray_applications(
        [
            make_spray(
                field["id"],
                field_name=field["nome"],
                days_since_application=1,
            )
        ]
    )
    api_app.inspections_repository.save_inspections(
        [
            make_inspection(
                field["id"],
                field_name=field["nome"],
                symptoms_found=True,
                visual_severity="baixa",
                defoliation_level="baixa",
                action_taken="monitorar",
            )
        ]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=20,
                classification="BAIXO",
                climate_index=20,
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    item = response.json()["ranking"][0]
    assert item["priority_score"] >= 25
    assert item["priority_label"] == "Monitoramento"
    assert any(
        reason["code"] == "sintomas_presentes"
        for reason in item["main_reasons"]
    )


def test_ranking_keeps_legacy_historical_risk_fields(monkeypatch):
    field_with_history = make_field(field_id="field-history")
    field_with_history.update(
        {
            "nome": "Talhao com historico",
            "historical_pressure": "alta",
            "had_disease_incidence": True,
            "peanut_repetition_years": 3,
        }
    )
    field_without_history = make_field(field_id="field-current")
    field_without_history["nome"] = "Talhao risco atual"
    api_app.fields_repository.save_fields([field_with_history, field_without_history])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=60,
                classification="MODERADO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    ranking = response.json()["ranking"]
    assert ranking[0]["field_id"] == "field-history"
    assert ranking[0]["historical_risk_bonus"] == 30
    assert ranking[0]["agronomic_index"] == 60
    assert ranking[0]["agronomic_index_with_history"] == 90
    assert "Pressao historica alta da area" in ranking[0]["historical_risk_reasons"]


def test_historical_risk_bonus_is_capped_at_30(monkeypatch):
    field = make_field()
    field.update(
        {
            "historical_pressure": "alta",
            "disease_incidence_level": "alta",
            "had_disease_incidence": True,
            "peanut_repetition_years": 4,
            "crop_rotation": False,
        }
    )
    api_app.fields_repository.save_fields([field])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=80,
                classification="ALTO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    item = response.json()["ranking"][0]
    assert item["historical_risk_bonus"] == 30
    assert item["agronomic_index_with_history"] == 100


def test_ranking_attention_priority_uses_all_blocks(monkeypatch):
    field = make_field()
    field.update(
        {
            "historical_pressure": "alta",
            "peanut_repetition_years": 3,
            "crop_rotation": False,
            "disease_incidence_level": "media",
        }
    )
    api_app.fields_repository.save_fields([field])
    api_app.spray_applications_repository.save_spray_applications(
        [
            make_spray(
                field["id"],
                field_name=field["nome"],
                days_since_application=15,
                planned_interval_days=12,
            )
        ]
    )
    api_app.inspections_repository.save_inspections(
        [
            make_inspection(
                field["id"],
                field_name=field["nome"],
                days_ago=20,
                symptoms_found=True,
                visual_severity="alta",
                defoliation_level="alta",
                action_taken="consultar_responsavel",
            )
        ]
    )
    api_app.calendar_events_repository.save_calendar_events(
        [
            make_calendar_event(field["id"], field["nome"], days_from_now=-1),
            make_calendar_event(
                field["id"],
                field["nome"],
                days_from_now=0,
                event_type="monitoramento",
            ),
        ]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=88,
                classification="ALTO",
                crop_stage="Fase critica",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    item = response.json()["ranking"][0]
    assert item["priority_score"] == 100
    assert item["priority_label"] == "Prioridade maxima"
    assert item["confidence_score"] == 100
    assert item["confidence_label"] == "Alta"
    assert item["metrics"]["block_scores"] == {
        "defense": 30,
        "inspection": 25,
        "operational": 20,
        "history": 15,
        "risk": 10,
    }
    reason_codes = {reason["code"] for reason in item["main_reasons"]}
    assert {
        "defesa_vencida",
        "sem_inspecao_recente",
        "evento_calendario_vencido",
        "pressao_historica_alta",
    }.issubset(reason_codes)


def test_ranking_includes_required_fields(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=94,
                classification="CRITICO",
            ),
        },
    )

    response = client.get("/ranking")

    assert response.status_code == 200
    item = response.json()["ranking"][0]
    for key in [
        "field_id",
        "field_name",
        "disease",
        "risk_classification",
        "agronomic_index",
        "agronomic_index_with_history",
        "historical_risk_bonus",
        "historical_risk_reasons",
        "priority",
        "priority_score",
        "priority_label",
        "confidence_score",
        "confidence_label",
        "main_reasons",
        "metrics",
        "main_action",
    ]:
        assert key in item
