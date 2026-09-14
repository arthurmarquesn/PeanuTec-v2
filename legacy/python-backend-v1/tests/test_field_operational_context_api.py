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
                "climate_index": 70,
                "agronomic_index": 80,
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


def make_weather_context(**overrides) -> dict:
    weather = {
        "available": True,
        "source": "open_meteo",
        "current_temperature_c": 27.4,
        "current_precipitation_mm": 0.0,
        "current_relative_humidity": 62.0,
        "recent_rain_7d_mm": 18.0,
        "forecast_rain_7d_mm": 24.0,
        "forecast_max_temp_avg_c": 30.0,
        "forecast_min_temp_avg_c": 19.0,
        "reference_et0_7d_mm": 22.0,
        "soil_moisture_latest": 0.18,
        "soil_temperature_latest_c": 24.0,
        "summary": "Dados meteorologicos cruzados pela localizacao do talhao.",
    }
    weather.update(overrides)
    return weather


@pytest.fixture(autouse=True)
def deterministic_weather(monkeypatch):
    monkeypatch.setattr(
        api_app,
        "fetch_weather_context",
        lambda latitude, longitude: make_weather_context(
            available=False,
            source="unavailable",
            current_temperature_c=None,
            current_precipitation_mm=None,
            current_relative_humidity=None,
            recent_rain_7d_mm=None,
            forecast_rain_7d_mm=None,
            forecast_max_temp_avg_c=None,
            forecast_min_temp_avg_c=None,
            reference_et0_7d_mm=None,
            soil_moisture_latest=None,
            soil_temperature_latest_c=None,
            summary="Dados meteorologicos externos indisponiveis no momento.",
        ),
    )


def make_field(field_id: str = "field-1", **overrides) -> dict:
    field = {
        "id": field_id,
        "nome": "Talhao A1",
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta"],
        "previous_crop": None,
        "crop_rotation": None,
        "peanut_repetition_years": None,
        "had_disease_incidence": None,
        "previous_diseases": None,
        "disease_incidence_level": None,
        "historical_pressure": None,
        "agronomic_history_notes": None,
    }
    field.update(overrides)
    return field


def create_field(**overrides) -> dict:
    field = make_field(**overrides)
    api_app.fields_repository.save_fields([field])
    return field


def make_inspection_payload(**overrides) -> dict:
    payload = {
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": True,
        "visual_severity": "media",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "Observacao operacional em campo.",
        "inspected_at": datetime.now(TIMEZONE).isoformat(timespec="seconds"),
    }
    payload.update(overrides)
    return payload


def make_spray_payload(**overrides) -> dict:
    payload = {
        "application_date": "2026-06-15T09:00:00-03:00",
        "product": "Clorotalonil",
        "target": "Mancha-preta",
        "dose": "1,5 L/ha",
        "responsible": "Equipe tecnica",
        "planned_interval_days": 12,
        "notes": "Registro operacional de pulverizacao.",
    }
    payload.update(overrides)
    return payload


def test_contexto_operacional_missing_field_returns_404():
    response = client.get("/talhoes/missing-field/contexto-operacional")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_contexto_operacional_without_inspection_or_spray_returns_missing_contexts():
    field = create_field(data_plantio=None)

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    data = response.json()
    assert data["field"]["id"] == field["id"]
    assert data["crop_stage_context"]["source"] == "missing"
    assert data["water_context"]["status"] == "sem_dados"
    assert data["water_context"]["weather"]["available"] is False
    assert data["water_context"]["weather"]["source"] == "unavailable"
    assert data["application_response_context"]["status"] == "sem_aplicacao"
    assert data["data_quality_context"]["label"] in {"baixa", "media"}
    assert "Inspeção de campo" in data["data_quality_context"]["missing_items"]
    assert data["safety_note"] == api_app.OPERATIONAL_CONTEXT_SAFETY_NOTE
    assert data["farmer_summary"]["headline"]
    assert data["farmer_summary"]["suggested_follow_up"]


def test_contexto_operacional_without_location_returns_missing_weather_context():
    field = create_field(latitude=None, longitude=None)

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    water_context = response.json()["water_context"]
    assert water_context["weather"]["available"] is False
    assert water_context["weather"]["source"] == "missing_location"
    assert "localizacao suficiente" in water_context["farmer_message"]


def test_contexto_operacional_with_weather_success_fills_weather(monkeypatch):
    field = create_field()
    captured_coordinates = {}

    def fake_fetch_weather_context(latitude: float, longitude: float) -> dict:
        captured_coordinates["latitude"] = latitude
        captured_coordinates["longitude"] = longitude
        return make_weather_context(
            recent_rain_7d_mm=16.5,
            forecast_rain_7d_mm=28.0,
            forecast_max_temp_avg_c=31.2,
            soil_moisture_latest=0.215,
        )

    monkeypatch.setattr(api_app, "fetch_weather_context", fake_fetch_weather_context)

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    weather = response.json()["water_context"]["weather"]
    assert captured_coordinates == {
        "latitude": field["latitude"],
        "longitude": field["longitude"],
    }
    assert weather["available"] is True
    assert weather["source"] == "open_meteo"
    assert weather["recent_rain_7d_mm"] == 16.5
    assert weather["forecast_rain_7d_mm"] == 28.0
    assert weather["soil_moisture_latest"] == 0.215


def test_contexto_operacional_weather_failure_keeps_endpoint_working(monkeypatch):
    field = create_field()

    def fake_fetch_weather_context(latitude: float, longitude: float) -> dict:
        raise RuntimeError("open meteo offline")

    monkeypatch.setattr(api_app, "fetch_weather_context", fake_fetch_weather_context)

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    data = response.json()
    assert data["water_context"]["weather"]["available"] is False
    assert data["water_context"]["weather"]["source"] == "unavailable"
    assert data["safety_note"] == api_app.OPERATIONAL_CONTEXT_SAFETY_NOTE
    assert data["farmer_summary"]["headline"]


def test_patch_fase_lavoura_updates_manual_stage_successfully():
    field = create_field()

    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={
            "stage": "florescimento",
            "notes": "Fase ajustada conforme observacao de campo.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == field["id"]
    assert data["manual_crop_stage"] == "florescimento"
    assert data["crop_stage_notes"] == "Fase ajustada conforme observacao de campo."
    assert data["crop_stage_updated_at"]
    assert data["crop_stage_context"]["stage"] == "florescimento"
    assert data["crop_stage_context"]["source"] == "manual"

    saved_field = api_app.fields_repository.get_field(field["id"])
    assert saved_field["manual_crop_stage"] == "florescimento"


def test_contexto_operacional_uses_manual_crop_stage_when_available():
    field = create_field()
    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": "enchimento_vagens", "notes": "Ajuste de campo."},
    )
    assert response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    crop_stage_context = response.json()["crop_stage_context"]
    assert crop_stage_context["stage"] == "enchimento_vagens"
    assert crop_stage_context["label"] == "Enchimento de vagens"
    assert crop_stage_context["source"] == "manual"
    assert crop_stage_context["notes"] == "Ajuste de campo."
    assert crop_stage_context["updated_at"]


def test_patch_fase_lavoura_removes_manual_stage_and_returns_to_estimated():
    field = create_field()
    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": "florescimento", "notes": "Ajuste temporario."},
    )
    assert response.status_code == 200

    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": None, "notes": "Remover ajuste."},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["manual_crop_stage"] is None
    assert data["crop_stage_notes"] is None
    assert data["crop_stage_updated_at"] is None
    assert data["crop_stage_context"]["source"] == "estimated"

    context_response = client.get(f"/talhoes/{field['id']}/contexto-operacional")
    assert context_response.status_code == 200
    assert context_response.json()["crop_stage_context"]["source"] == "estimated"


def test_patch_fase_lavoura_returns_missing_after_removing_manual_without_planting_date():
    field = create_field(data_plantio=None)
    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": "vegetativo", "notes": None},
    )
    assert response.status_code == 200

    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": None, "notes": None},
    )

    assert response.status_code == 200
    assert response.json()["crop_stage_context"]["source"] == "missing"

    context_response = client.get(f"/talhoes/{field['id']}/contexto-operacional")
    assert context_response.status_code == 200
    assert context_response.json()["crop_stage_context"]["source"] == "missing"


def test_patch_fase_lavoura_missing_field_returns_404():
    response = client.patch(
        "/talhoes/missing-field/fase-lavoura",
        json={"stage": "vegetativo", "notes": "Teste."},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_patch_fase_lavoura_invalid_stage_returns_422():
    field = create_field()

    response = client.patch(
        f"/talhoes/{field['id']}/fase-lavoura",
        json={"stage": "fase_invalida", "notes": None},
    )

    assert response.status_code == 422


def test_contexto_operacional_with_dry_soil_flags_water_attention_or_critical():
    field = create_field()
    response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(
            soil_condition="seco",
            general_status="atencao",
            problem_distribution="espalhado",
            responsible="Tecnico de campo",
        ),
    )
    assert response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    water_context = response.json()["water_context"]
    assert water_context["latest_soil_condition"] == "seco"
    assert water_context["status"] in {"atencao", "critico"}
    assert water_context["farmer_message"]


def test_contexto_operacional_dry_soil_and_low_forecast_rain_increases_attention(monkeypatch):
    field = create_field(manual_crop_stage="florescimento")
    monkeypatch.setattr(
        api_app,
        "fetch_weather_context",
        lambda latitude, longitude: make_weather_context(
            recent_rain_7d_mm=3.0,
            forecast_rain_7d_mm=2.5,
            forecast_max_temp_avg_c=34.0,
            reference_et0_7d_mm=32.0,
        ),
    )
    response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(
            soil_condition="seco",
            general_status="atencao",
            problem_distribution="espalhado",
            responsible="Tecnico de campo",
        ),
    )
    assert response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    water_context = response.json()["water_context"]
    assert water_context["is_sensitive_stage"] is True
    assert water_context["weather"]["forecast_rain_7d_mm"] == 2.5
    assert water_context["status"] == "critico"
    assert "pouca chuva" in water_context["farmer_message"]


def test_contexto_operacional_relevant_forecast_rain_keeps_coherent_message(monkeypatch):
    field = create_field()
    monkeypatch.setattr(
        api_app,
        "fetch_weather_context",
        lambda latitude, longitude: make_weather_context(
            recent_rain_7d_mm=6.0,
            forecast_rain_7d_mm=34.0,
        ),
    )
    response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(
            soil_condition="seco",
            general_status="atencao",
            problem_distribution="localizado",
            responsible="Tecnico de campo",
        ),
    )
    assert response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    water_context = response.json()["water_context"]
    assert water_context["status"] == "atencao"
    assert "previsao de chuva" in water_context["farmer_message"]
    assert "Mantenha o acompanhamento" in water_context["farmer_message"]


def test_contexto_operacional_with_history_returns_historical_memory():
    field = create_field(
        previous_crop="Soja",
        crop_rotation=False,
        peanut_repetition_years=2,
        had_disease_incidence=True,
        previous_diseases=["Mancha-preta"],
        disease_incidence_level="alta",
        historical_pressure="alta",
        agronomic_history_notes="Historico de pressão no talhao.",
    )

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    historical_memory = response.json()["historical_memory"]
    assert historical_memory["has_history"] is True
    assert historical_memory["pressure_level"] == "alta"
    assert historical_memory["rotation_attention"] is True
    assert historical_memory["recurrent_diseases"] == ["Mancha-preta"]
    assert historical_memory["attention_points"]


def test_contexto_operacional_spray_without_later_inspection_is_not_verified():
    field = create_field()
    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(),
    )
    assert response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    application_context = response.json()["application_response_context"]
    assert application_context["has_spray"] is True
    assert application_context["has_inspection_after_spray"] is False
    assert application_context["status"] == "resposta_nao_verificada"


def test_contexto_operacional_spray_with_later_inspection_is_verified():
    field = create_field()
    spray_response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(application_date="2026-06-15T09:00:00-03:00"),
    )
    assert spray_response.status_code == 200
    inspection_response = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(
            inspected_at="2026-06-16T08:30:00-03:00",
            soil_condition="adequado",
            responsible="Tecnico de campo",
        ),
    )
    assert inspection_response.status_code == 200

    response = client.get(f"/talhoes/{field['id']}/contexto-operacional")

    assert response.status_code == 200
    application_context = response.json()["application_response_context"]
    assert application_context["has_inspection_after_spray"] is True
    assert application_context["status"] == "verificada_por_inspecao"


def test_contexto_operacional_keeps_current_situation_and_technical_report_working():
    field = create_field()

    context_response = client.get(f"/talhoes/{field['id']}/contexto-operacional")
    situation_response = client.get(f"/talhoes/{field['id']}/situacao-atual")
    report_response = client.get(f"/talhoes/{field['id']}/relatorio-tecnico")

    assert context_response.status_code == 200
    assert situation_response.status_code == 200
    assert report_response.status_code == 200
    assert situation_response.json()["field_id"] == field["id"]
    assert report_response.json()["current_situation"]["field_id"] == field["id"]
