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
        api_app.calendar_events_repository,
        "CALENDAR_EVENTS_FILE",
        tmp_path / "outputs" / "calendar_events.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
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


def create_field(field_id: str = "field-1", name: str = "Talhao A1") -> dict:
    field = make_field(field_id=field_id, name=name)
    fields = api_app.fields_repository.list_fields()
    fields.append(field)
    api_app.fields_repository.save_fields(fields)
    return field


def make_spray_payload(**overrides) -> dict:
    payload = {
        "application_date": (
            datetime.now(TIMEZONE) - timedelta(days=2)
        ).isoformat(timespec="seconds"),
        "product": " Clorotalonil ",
        "target": " Mancha-preta ",
        "dose": " 1,5 L/ha ",
        "responsible": " Tecnico responsavel ",
        "planned_interval_days": 12,
        "notes": " Aplicacao preventiva realizada. ",
    }
    payload.update(overrides)
    return payload


def make_product_payload(**overrides) -> dict:
    payload = {
        "name": "Produto cadastrado",
        "product_type": "inseticida",
        "active_ingredient": "Ingrediente ativo",
        "main_target": "Lagarta",
        "default_defense_days": 7,
        "notes": "Produto para rastreabilidade.",
    }
    payload.update(overrides)
    return payload


def create_product(**overrides) -> dict:
    response = client.post("/produtos", json=make_product_payload(**overrides))
    assert response.status_code == 200
    return response.json()


def test_post_pulverizacoes_creates_valid_spray_application():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(application_date=None),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"]
    assert data["field_id"] == field["id"]
    assert data["field_name"] == "Talhao A1"
    assert data["product_id"] is None
    assert data["product"] == "Clorotalonil"
    assert data.get("product_type") is None
    assert data["target"] == "Mancha-preta"
    assert data["dose"] == "1,5 L/ha"
    assert data["responsible"] == "Tecnico responsavel"
    assert data["planned_interval_days"] == 12
    assert data["notes"] == "Aplicacao preventiva realizada."
    assert data["generate_reapplication"] is False
    assert data["reapplication_interval_days"] is None
    assert data["reapplication_date"] is None
    assert data["reapplication_notes"] is None
    assert data["days_since_application"] == 0
    assert data["interval_status"] == "em_dia"
    assert data["application_date"].endswith("-03:00")
    assert data["created_at"].endswith("-03:00")


def test_post_pulverizacoes_tracks_selected_product_defaults():
    field = create_field()
    product = create_product()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(
            product_id=product["id"],
            product="Nome digitado antes da selecao",
            product_type=product["product_type"],
            target=product["main_target"],
            planned_interval_days=product["default_defense_days"],
        ),
    )
    events_response = client.get(
        "/calendario/eventos",
        params={"event_type": "pulverizacao"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["product_id"] == product["id"]
    assert data["product"] == product["name"]
    assert data["product_type"] == "inseticida"
    assert data["target"] == "Lagarta"
    assert data["planned_interval_days"] == 7

    events = events_response.json()["events"]
    assert len(events) == 1
    assert events[0]["product"] == product["name"]
    assert events[0]["product_type"] == "inseticida"


def test_post_pulverizacoes_rejects_missing_selected_product():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(product_id="produto-inexistente"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Produto nao encontrado"


def test_post_pulverizacoes_returns_404_for_missing_field():
    response = client.post(
        "/talhoes/missing-field/pulverizacoes",
        json=make_spray_payload(),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_post_pulverizacoes_rejects_empty_product():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(product="   "),
    )

    assert response.status_code == 422
    assert "product" in str(response.json()["detail"])


def test_post_pulverizacoes_rejects_empty_target():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(target="   "),
    )

    assert response.status_code == 422
    assert "target" in str(response.json()["detail"])


def test_post_pulverizacoes_rejects_empty_dose():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(dose="   "),
    )

    assert response.status_code == 422
    assert "dose" in str(response.json()["detail"])


def test_post_pulverizacoes_rejects_non_positive_planned_interval_days():
    field = create_field()

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(planned_interval_days=0),
    )

    assert response.status_code == 422
    assert "planned_interval_days" in str(response.json()["detail"])


def test_post_pulverizacoes_rejects_future_application_date():
    field = create_field()
    future_date = (datetime.now(TIMEZONE) + timedelta(days=1)).isoformat(
        timespec="seconds"
    )

    response = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(application_date=future_date),
    )

    assert response.status_code == 422
    assert "application_date" in str(response.json()["detail"])


def test_get_pulverizacoes_returns_field_spray_applications():
    field = create_field()
    created = client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(),
    ).json()

    response = client.get(f"/talhoes/{field['id']}/pulverizacoes")

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == field["id"]
    assert data["field_name"] == "Talhao A1"
    assert data["total"] == 1
    assert data["spray_applications"] == [created]


def test_get_pulverizacoes_orders_newest_first():
    field = create_field()
    old_date = (datetime.now(TIMEZONE) - timedelta(days=5)).isoformat(
        timespec="seconds"
    )
    new_date = (datetime.now(TIMEZONE) - timedelta(days=1)).isoformat(
        timespec="seconds"
    )

    client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(application_date=old_date, notes="Antiga"),
    )
    client.post(
        f"/talhoes/{field['id']}/pulverizacoes",
        json=make_spray_payload(application_date=new_date, notes="Recente"),
    )

    response = client.get(f"/talhoes/{field['id']}/pulverizacoes")

    assert response.status_code == 200
    spray_applications = response.json()["spray_applications"]
    assert [item["notes"] for item in spray_applications] == ["Recente", "Antiga"]


def test_get_pulverizacoes_does_not_mix_fields():
    field_a = create_field(field_id="field-1", name="Talhao A1")
    field_b = create_field(field_id="field-2", name="Talhao B2")

    client.post(
        f"/talhoes/{field_a['id']}/pulverizacoes",
        json=make_spray_payload(notes="Talhao A"),
    )
    client.post(
        f"/talhoes/{field_b['id']}/pulverizacoes",
        json=make_spray_payload(notes="Talhao B"),
    )

    response = client.get(f"/talhoes/{field_a['id']}/pulverizacoes")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["spray_applications"][0]["field_id"] == field_a["id"]
    assert data["spray_applications"][0]["notes"] == "Talhao A"


def test_get_pulverizacoes_keeps_legacy_records_without_reapplication_fields_working():
    field = create_field()
    application_date = (datetime.now(TIMEZONE) - timedelta(days=2)).isoformat(
        timespec="seconds"
    )
    api_app.spray_applications_repository.save_spray_applications(
        [
            {
                "id": "spray-legacy",
                "field_id": field["id"],
                "field_name": field["nome"],
                "application_date": application_date,
                "product": "Clorotalonil",
                "target": "Mancha-preta",
                "dose": "1,5 L/ha",
                "responsible": "Tecnico responsavel",
                "planned_interval_days": 12,
                "notes": "Registro anterior ao campo de reaplicacao.",
                "days_since_application": 2,
                "interval_status": "em_dia",
                "created_at": application_date,
            }
        ]
    )

    response = client.get(f"/talhoes/{field['id']}/pulverizacoes")

    assert response.status_code == 200
    spray_application = response.json()["spray_applications"][0]
    assert spray_application["id"] == "spray-legacy"
    assert spray_application["generate_reapplication"] is False
    assert spray_application["reapplication_interval_days"] is None
    assert spray_application["reapplication_date"] is None
    assert spray_application["reapplication_notes"] is None


def test_days_since_application_is_calculated_correctly():
    now = datetime(2026, 6, 17, 10, 30, tzinfo=TIMEZONE)
    application_date = now - timedelta(days=4)

    interval = api_app.calculate_spray_interval(application_date, 12, now=now)

    assert interval["days_since_application"] == 4


def test_interval_status_returns_em_dia():
    now = datetime(2026, 6, 17, 10, 30, tzinfo=TIMEZONE)
    application_date = now - timedelta(days=9)

    interval = api_app.calculate_spray_interval(application_date, 12, now=now)

    assert interval["interval_status"] == "em_dia"


def test_interval_status_returns_atencao():
    now = datetime(2026, 6, 17, 10, 30, tzinfo=TIMEZONE)
    application_date = now - timedelta(days=10)

    interval = api_app.calculate_spray_interval(application_date, 12, now=now)

    assert interval["interval_status"] == "atencao"


def test_interval_status_returns_atrasado():
    now = datetime(2026, 6, 17, 10, 30, tzinfo=TIMEZONE)
    application_date = now - timedelta(days=13)

    interval = api_app.calculate_spray_interval(application_date, 12, now=now)

    assert interval["interval_status"] == "atrasado"
