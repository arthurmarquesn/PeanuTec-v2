from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


def test_legacy_auth_register_route_is_removed():
    response = client.post(
        "/auth/register",
        json={
            "name": "Legacy User",
            "email": "legacy@peanutec.com",
            "password": "senha123",
        },
    )

    assert response.status_code == 404


def test_legacy_auth_login_route_is_removed():
    response = client.post(
        "/auth/login",
        json={
            "email": "legacy@peanutec.com",
            "password": "senha123",
        },
    )

    assert response.status_code == 404


def test_legacy_auth_me_route_is_removed():
    response = client.get("/auth/me")
    assert response.status_code == 404
