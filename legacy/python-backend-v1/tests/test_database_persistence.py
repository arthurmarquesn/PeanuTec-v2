import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from scripts import migrate_json_to_db
from src.api import app as api_app
from src.database import connection
from src.database.session import initialize_database


client = TestClient(api_app.app)
TIMEZONE = ZoneInfo(api_app.TIMEZONE)


@pytest.fixture(autouse=True)
def database_storage(tmp_path, monkeypatch):
    database_path = tmp_path / "peanutec-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

    api_app.fields_repository.FIELDS_FILE = api_app.fields_repository.DEFAULT_FIELDS_FILE
    api_app.inspections_repository.INSPECTIONS_FILE = (
        api_app.inspections_repository.DEFAULT_INSPECTIONS_FILE
    )
    api_app.spray_applications_repository.SPRAY_APPLICATIONS_FILE = (
        api_app.spray_applications_repository.DEFAULT_SPRAY_APPLICATIONS_FILE
    )
    api_app.calendar_events_repository.CALENDAR_EVENTS_FILE = (
        api_app.calendar_events_repository.DEFAULT_CALENDAR_EVENTS_FILE
    )
    api_app.users_repository.USERS_FILE = api_app.users_repository.DEFAULT_USERS_FILE
    api_app.analysis_history_repository.ANALYSIS_HISTORY_FILE = (
        api_app.analysis_history_repository.DEFAULT_ANALYSIS_HISTORY_FILE
    )
    api_app.products_repository.PRODUCTS_FILE = (
        api_app.products_repository.DEFAULT_PRODUCTS_FILE
    )

    connection.reset_engine()

    yield

    connection.reset_engine()


@pytest.fixture
def mock_geocoding(monkeypatch):
    monkeypatch.setattr(
        api_app.geocoding_service,
        "fetch_city_coordinates",
        lambda city: {"latitude": -21.9347, "longitude": -50.5136},
    )


def make_field_payload(**overrides) -> dict:
    payload = {
        "nome": "Talhao DB",
        "cidade": "Tupa-SP",
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": ["Mancha-preta"],
    }
    payload.update(overrides)
    return payload


def create_field(mock_geocoding) -> dict:
    response = client.post("/talhoes", json=make_field_payload())
    assert response.status_code == 200
    return response.json()


def make_inspection_payload(**overrides) -> dict:
    payload = {
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": True,
        "visual_severity": "baixa",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "Inspecao no talhao.",
    }
    payload.update(overrides)
    return payload


def make_spray_payload(**overrides) -> dict:
    payload = {
        "application_date": datetime(2026, 6, 1, 8, 0, tzinfo=TIMEZONE).isoformat(
            timespec="seconds"
        ),
        "product_id": None,
        "product": "Clorotalonil",
        "product_type": "fungicida",
        "target": "Mancha-preta",
        "dose": "1,5 L/ha",
        "responsible": "Tecnico responsavel",
        "planned_interval_days": 12,
        "notes": "Aplicacao preventiva realizada.",
    }
    payload.update(overrides)
    return payload


def test_database_initializes_tables():
    initialize_database()
    inspector = inspect(connection.get_engine())

    assert {
        "users",
        "fields",
        "inspections",
        "spray_applications",
        "calendar_events",
        "products",
        "analysis_history",
    }.issubset(set(inspector.get_table_names()))


def test_alembic_migration_adds_agronomic_history_columns(tmp_path, monkeypatch):
    database_path = tmp_path / "alembic-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    connection.reset_engine()
    alembic_config = Config(str(migrate_json_to_db.PROJECT_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "head")

    inspector = inspect(connection.get_engine())
    assert "products" in inspector.get_table_names()
    field_columns = {column["name"] for column in inspector.get_columns("fields")}
    assert {
        "previous_crop",
        "crop_rotation",
        "peanut_repetition_years",
        "had_disease_incidence",
        "previous_diseases",
        "disease_incidence_level",
        "historical_pressure",
        "agronomic_history_notes",
        "manual_crop_stage",
        "crop_stage_updated_at",
        "crop_stage_notes",
    }.issubset(field_columns)


def test_alembic_migration_creates_products_table(tmp_path, monkeypatch):
    database_path = tmp_path / "alembic-products-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    connection.reset_engine()
    alembic_config = Config(str(migrate_json_to_db.PROJECT_ROOT / "alembic.ini"))

    command.upgrade(alembic_config, "head")

    inspector = inspect(connection.get_engine())
    product_columns = {column["name"] for column in inspector.get_columns("products")}
    assert {
        "id",
        "name",
        "product_type",
        "active_ingredient",
        "main_target",
        "default_defense_days",
        "notes",
        "is_active",
        "created_at",
        "updated_at",
    }.issubset(product_columns)
    spray_columns = {
        column["name"] for column in inspector.get_columns("spray_applications")
    }
    assert "product_id" in spray_columns


def test_create_and_list_fields_using_database(mock_geocoding):
    created = create_field(mock_geocoding)

    response = client.get("/talhoes")

    assert response.status_code == 200
    assert response.json() == [created]


def test_create_and_list_inspections_using_database(mock_geocoding):
    field = create_field(mock_geocoding)

    created = client.post(
        f"/talhoes/{field['id']}/inspecoes",
        json=make_inspection_payload(),
    ).json()
    response = client.get(f"/talhoes/{field['id']}/inspecoes")

    assert response.status_code == 200
    assert response.json()["inspections"] == [created]


def test_create_and_list_spray_applications_using_database(mock_geocoding):
    field = create_field(mock_geocoding)

    created = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(generate_reapplication=False),
    ).json()
    response = client.get(f"/talhoes/{field['id']}/pulverizacoes")

    assert response.status_code == 200
    assert response.json()["spray_applications"] == [created]


def test_create_and_list_spray_applications_with_product_id_using_database(
    mock_geocoding,
):
    field = create_field(mock_geocoding)
    product = client.post(
        "/produtos",
        json={
            "name": "Produto rastreado",
            "product_type": "acaricida",
            "main_target": "Acaro",
            "default_defense_days": 9,
        },
    ).json()

    created = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(
            product_id=product["id"],
            product=product["name"],
            product_type=product["product_type"],
            target=product["main_target"],
            planned_interval_days=product["default_defense_days"],
        ),
    ).json()
    response = client.get(f"/talhoes/{field['id']}/pulverizacoes")

    assert response.status_code == 200
    assert created["product_id"] == product["id"]
    assert created["product"] == "Produto rastreado"
    assert created["product_type"] == "acaricida"
    assert response.json()["spray_applications"] == [created]


def test_create_and_list_calendar_events_using_database(mock_geocoding):
    field = create_field(mock_geocoding)

    created = client.post(
        "/calendario/eventos",
        json={
            "event_type": "monitoramento",
            "title": "Monitoramento pos-chuva",
            "field_id": field["id"],
            "date": "2026-06-17",
            "end_date": "2026-06-17",
            "product_type": "outro",
            "target": "Mancha-preta",
            "planned_interval_days": 12,
            "notes": "Revisar folhas baixeiras.",
        },
    ).json()
    response = client.get("/calendario/eventos")

    assert response.status_code == 200
    assert response.json()["events"] == [created]


def test_configurable_reapplication_continues_working_with_database(mock_geocoding):
    field = create_field(mock_geocoding)

    spray_response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(
            generate_reapplication=True,
            reapplication_interval_days=7,
            reapplication_notes="Retornar para reaplicacao.",
        ),
    )
    events_response = client.get(
        "/calendario/eventos",
        params={"event_type": "reaplicacao_prevista"},
    )

    assert spray_response.status_code == 200
    events = events_response.json()["events"]
    assert len(events) == 1
    assert events[0]["date"] == "2026-06-08"
    assert events[0]["color_key"] == "purple"
    assert events[0]["notes"] == "Retornar para reaplicacao."


def test_migrated_legacy_json_fields_remain_api_compatible(tmp_path, monkeypatch):
    outputs_dir = tmp_path / "outputs"
    outputs_dir.mkdir()
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

    with open(outputs_dir / "fields.json", "w", encoding="utf-8") as file:
        json.dump([legacy_field], file)

    monkeypatch.setattr(migrate_json_to_db, "OUTPUTS_DIR", outputs_dir)
    migrate_json_to_db.main()

    response = client.get("/talhoes/field-legacy")

    assert response.status_code == 200
    data = response.json()
    assert data == {
        **legacy_field,
        "previous_crop": None,
        "crop_rotation": None,
        "peanut_repetition_years": None,
        "had_disease_incidence": None,
        "previous_diseases": None,
            "disease_incidence_level": None,
            "historical_pressure": None,
            "agronomic_history_notes": None,
            "manual_crop_stage": None,
            "crop_stage_updated_at": None,
            "crop_stage_notes": None,
        }
