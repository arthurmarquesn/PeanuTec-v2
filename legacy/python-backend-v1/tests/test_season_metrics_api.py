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
        api_app.spray_applications_repository,
        "SPRAY_APPLICATIONS_FILE",
        tmp_path / "outputs" / "spray_applications.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
    )


def make_field(
    field_id: str,
    name: str,
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


def make_product(
    product_id: str,
    name: str,
    product_type: str = "fungicida",
) -> dict:
    return {
        "id": product_id,
        "name": name,
        "product_type": product_type,
        "active_ingredient": None,
        "main_target": "Mancha-preta",
        "default_defense_days": 12,
        "notes": None,
        "is_active": True,
        "created_at": "2026-06-17T10:00:00-03:00",
        "updated_at": "2026-06-17T10:00:00-03:00",
    }


def make_spray(
    spray_id: str,
    field_id: str,
    field_name: str,
    month: int,
    product: str,
    product_id: str | None = None,
    product_type: str | None = "fungicida",
    target: str = "Mancha-preta",
    planned_interval_days: int | None = 12,
) -> dict:
    application_date = datetime(2026, month, 5, 8, 0, tzinfo=TIMEZONE)
    spray_application = {
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
        "notes": "",
        "days_since_application": 0,
        "interval_status": "em_dia",
        "created_at": application_date.isoformat(timespec="seconds"),
    }

    if planned_interval_days is not None:
        spray_application["planned_interval_days"] = planned_interval_days

    return spray_application


def seed_metrics_data() -> dict:
    fields = [
        make_field("field-1", "Talhao A1"),
        make_field("field-2", "Talhao B2"),
        make_field("field-3", "Talhao C3", status_lavoura="colhido"),
    ]
    products = [
        make_product("product-a", "Fungicida A", product_type="fungicida"),
        make_product("product-b", "Inseticida B", product_type="inseticida"),
    ]
    sprays = [
        make_spray(
            "spray-1",
            "field-1",
            "Talhao A1",
            6,
            "Fungicida A",
            product_id="product-a",
            product_type="fungicida",
            target="Mancha-preta",
            planned_interval_days=10,
        ),
        make_spray(
            "spray-2",
            "field-1",
            "Talhao A1",
            6,
            "Fungicida A",
            product_id="product-a",
            product_type="fungicida",
            target="Mancha-preta",
            planned_interval_days=12,
        ),
        make_spray(
            "spray-3",
            "field-2",
            "Talhao B2",
            7,
            "Inseticida B",
            product_id="product-b",
            product_type="inseticida",
            target="Lagarta",
            planned_interval_days=8,
        ),
        make_spray(
            "spray-legacy",
            "field-2",
            "Talhao B2",
            7,
            "Produto legado",
            product_id=None,
            product_type=None,
            target="Mancha-castanha",
            planned_interval_days=None,
        ),
    ]

    api_app.fields_repository.save_fields(fields)

    for product in products:
        api_app.products_repository.create_product(product)

    api_app.spray_applications_repository.save_spray_applications(sprays)

    return {
        "fields": fields,
        "products": products,
        "sprays": sprays,
    }


def test_metricas_safra_returns_expected_structure():
    response = client.get("/metricas/safra")

    assert response.status_code == 200
    data = response.json()
    assert data == {
        "summary": {
            "total_fields": 0,
            "active_fields": 0,
            "total_spray_applications": 0,
            "total_products_used": 0,
            "average_planned_interval_days": 0,
        },
        "top_products": [],
        "product_type_distribution": [],
        "top_fields_by_applications": [],
        "top_targets": [],
        "spray_applications_by_month": [],
    }


def test_metricas_safra_calculates_top_products():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["top_products"] == [
        {
            "product_id": "product-a",
            "product": "Fungicida A",
            "product_type": "fungicida",
            "applications_count": 2,
        },
        {
            "product_id": "product-b",
            "product": "Inseticida B",
            "product_type": "inseticida",
            "applications_count": 1,
        },
        {
            "product_id": None,
            "product": "Produto legado",
            "product_type": None,
            "applications_count": 1,
        },
    ]


def test_metricas_safra_calculates_product_type_distribution():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["product_type_distribution"] == [
        {"product_type": "fungicida", "applications_count": 2},
        {"product_type": "inseticida", "applications_count": 1},
    ]


def test_metricas_safra_calculates_top_fields_by_applications():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["top_fields_by_applications"] == [
        {
            "field_id": "field-1",
            "field_name": "Talhao A1",
            "applications_count": 2,
        },
        {
            "field_id": "field-2",
            "field_name": "Talhao B2",
            "applications_count": 2,
        },
    ]


def test_metricas_safra_calculates_top_targets():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["top_targets"] == [
        {"target": "Mancha-preta", "applications_count": 2},
        {"target": "Lagarta", "applications_count": 1},
        {"target": "Mancha-castanha", "applications_count": 1},
    ]


def test_metricas_safra_calculates_applications_by_month():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["spray_applications_by_month"] == [
        {"month": "2026-06", "applications_count": 2},
        {"month": "2026-07", "applications_count": 2},
    ]


def test_metricas_safra_summary_uses_valid_planned_intervals():
    seed_metrics_data()

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total_fields": 3,
        "active_fields": 2,
        "total_spray_applications": 4,
        "total_products_used": 3,
        "average_planned_interval_days": 10,
    }


def test_metricas_safra_handles_legacy_sprays_without_product_id():
    api_app.fields_repository.save_fields([make_field("field-legacy", "Talhao Legado")])
    api_app.spray_applications_repository.save_spray_applications(
        [
            make_spray(
                "spray-legacy",
                "field-legacy",
                "Talhao Legado",
                8,
                "Produto antigo",
                product_id=None,
                product_type=None,
                target="Mancha-preta",
                planned_interval_days=12,
            )
        ]
    )

    response = client.get("/metricas/safra")

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_products_used"] == 1
    assert data["top_products"] == [
        {
            "product_id": None,
            "product": "Produto antigo",
            "product_type": None,
            "applications_count": 1,
        }
    ]
