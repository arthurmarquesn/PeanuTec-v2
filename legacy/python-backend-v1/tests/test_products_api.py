import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app
from src.database import connection


client = TestClient(api_app.app)


@pytest.fixture(autouse=True)
def database_storage(tmp_path, monkeypatch):
    database_path = tmp_path / "peanutec-products-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    api_app.products_repository.PRODUCTS_FILE = (
        api_app.products_repository.DEFAULT_PRODUCTS_FILE
    )
    connection.reset_engine()

    yield

    connection.reset_engine()


def make_product_payload(**overrides) -> dict:
    payload = {
        "name": "Produto Teste",
        "product_type": "fungicida",
        "active_ingredient": "Ingrediente ativo",
        "main_target": "Mancha-preta",
        "default_defense_days": 12,
        "notes": "Uso registrado apenas para rastreabilidade.",
    }
    payload.update(overrides)
    return payload


def create_product(**overrides) -> dict:
    response = client.post("/produtos", json=make_product_payload(**overrides))
    assert response.status_code == 200
    return response.json()


def test_create_valid_product():
    response = client.post("/produtos", json=make_product_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["id"]
    assert data["name"] == "Produto Teste"
    assert data["product_type"] == "fungicida"
    assert data["active_ingredient"] == "Ingrediente ativo"
    assert data["main_target"] == "Mancha-preta"
    assert data["default_defense_days"] == 12
    assert data["is_active"] is True
    assert data["created_at"]
    assert data["updated_at"]


def test_do_not_create_product_without_name():
    payload = make_product_payload()
    payload.pop("name")

    response = client.post("/produtos", json=payload)

    assert response.status_code == 422


def test_do_not_create_product_without_product_type():
    payload = make_product_payload()
    payload.pop("product_type")

    response = client.post("/produtos", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize("default_defense_days", [0, -1])
def test_do_not_accept_non_positive_default_defense_days(default_defense_days):
    response = client.post(
        "/produtos",
        json=make_product_payload(default_defense_days=default_defense_days),
    )

    assert response.status_code == 422


def test_list_products():
    first = create_product(name="Fungicida A")
    second = create_product(name="Inseticida B", product_type="inseticida")

    response = client.get("/produtos")

    assert response.status_code == 200
    assert response.json() == [first, second]


def test_get_product_by_id():
    created = create_product()

    response = client.get(f"/produtos/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_update_product():
    created = create_product()

    response = client.put(
        f"/produtos/{created['id']}",
        json=make_product_payload(
            name="Produto editado",
            product_type="herbicida",
            active_ingredient="Novo ingrediente",
            main_target="Plantas daninhas",
            default_defense_days=8,
            notes="Registro operacional atualizado.",
            is_active=False,
        ),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == created["id"]
    assert data["name"] == "Produto editado"
    assert data["product_type"] == "herbicida"
    assert data["active_ingredient"] == "Novo ingrediente"
    assert data["main_target"] == "Plantas daninhas"
    assert data["default_defense_days"] == 8
    assert data["is_active"] is False
    assert data["created_at"] == created["created_at"]
    assert data["updated_at"] >= created["updated_at"]


def test_delete_deactivates_product_without_removing():
    created = create_product()

    delete_response = client.delete(f"/produtos/{created['id']}")
    get_response = client.get(f"/produtos/{created['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json()["is_active"] is False
    assert get_response.status_code == 200
    assert get_response.json()["is_active"] is False


def test_active_only_returns_only_active_products():
    active = create_product(name="Produto ativo")
    inactive = create_product(name="Produto inativo")
    client.delete(f"/produtos/{inactive['id']}")

    response = client.get("/produtos", params={"active_only": "true"})

    assert response.status_code == 200
    assert response.json() == [active]
