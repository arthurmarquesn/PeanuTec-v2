import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


@pytest.fixture(autouse=True)
def isolated_users_file(tmp_path, monkeypatch):
    monkeypatch.setattr(
        api_app.users_repository,
        "USERS_FILE",
        tmp_path / "outputs" / "users.json",
    )


def make_user_payload() -> dict:
    return {
        "name": "Arthur",
        "email": "arthur@peanutec.com",
        "password": "senha123",
    }


def register_user(payload: dict | None = None):
    return client.post("/auth/register", json=payload or make_user_payload())


def test_register_creates_user():
    response = register_user()

    assert response.status_code == 200
    data = response.json()
    assert data["id"]
    assert data["name"] == "Arthur"
    assert data["email"] == "arthur@peanutec.com"


def test_register_does_not_return_password_hash():
    response = register_user()

    assert response.status_code == 200
    assert "password_hash" not in response.json()
    assert "password" not in response.json()


def test_register_rejects_duplicate_email():
    first_response = register_user()
    assert first_response.status_code == 200

    second_response = register_user()

    assert second_response.status_code == 400
    assert "Email ja cadastrado" in second_response.json()["detail"]


def test_register_rejects_short_password():
    payload = make_user_payload()
    payload["password"] = "12345"

    response = register_user(payload)

    assert response.status_code == 422
    assert "password" in str(response.json()["detail"])


def test_login_returns_token_with_correct_credentials():
    register_response = register_user()
    assert register_response.status_code == 200

    response = client.post(
        "/auth/login",
        json={
            "email": "arthur@peanutec.com",
            "password": "senha123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "arthur@peanutec.com"
    assert "password_hash" not in data["user"]


def test_login_with_wrong_password_returns_401():
    register_response = register_user()
    assert register_response.status_code == 200

    response = client.post(
        "/auth/login",
        json={
            "email": "arthur@peanutec.com",
            "password": "errada123",
        },
    )

    assert response.status_code == 401


def test_login_with_unknown_email_returns_401():
    response = client.post(
        "/auth/login",
        json={
            "email": "ninguem@peanutec.com",
            "password": "senha123",
        },
    )

    assert response.status_code == 401


def test_auth_me_with_valid_token_returns_user():
    register_response = register_user()
    assert register_response.status_code == 200
    login_response = client.post(
        "/auth/login",
        json={
            "email": "arthur@peanutec.com",
            "password": "senha123",
        },
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Arthur"
    assert data["email"] == "arthur@peanutec.com"
    assert "password_hash" not in data


def test_auth_me_without_token_returns_401():
    response = client.get("/auth/me")

    assert response.status_code == 401
