from datetime import date, timedelta

from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


def make_field_payload() -> dict:
    return {
        "nome": "Talhao A1",
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "data_plantio": "2026-04-10",
        "cultura": "Amendoim",
        "doenca_alvo": "Mancha-castanha",
        "status_lavoura": "em_campo",
    }


def make_compact_response() -> dict:
    return {
        "generated_at": "2026-06-14T21:30:00-03:00",
        "field": {
            "name": "Talhao A1",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 65,
            "crop_stage": "Fase critica para mancha-castanha",
        },
        "disease": "Mancha-castanha do amendoim",
        "pathogen": "Cercospora arachidicola",
        "risk": {
            "climate_index": 85,
            "agronomic_index": 85,
            "classification": "CRITICO",
        },
        "management_relevance": {
            "status": "ATIVA",
            "description": "A lavoura esta em campo.",
        },
        "actions": [
            "Realizar inspecao prioritaria no talhao.",
        ],
    }


def assert_validation_error(response):
    assert response.status_code == 422
    assert "detail" in response.json()


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "peanut-disease-risk-engine",
    }


def test_cors_allows_localhost_3000():
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_preflight_allows_crop_stage_patch():
    response = client.options(
        "/talhoes/field-123/fase-lavoura",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "PATCH" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_root_endpoint_returns_metadata():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "Peanut Disease Risk Engine",
        "version": "0.2",
        "supported_diseases": [
            "Mancha-preta",
            "Mancha-castanha",
        ],
    }


def test_doencas_endpoint_returns_supported_diseases():
    response = client.get("/doencas")

    assert response.status_code == 200
    assert response.json() == {
        "supported_diseases": [
            {
                "id": "Mancha-preta",
                "name": "Mancha-preta do amendoim",
                "pathogen": "Cercosporidium personatum / Nothopassalora personata",
                "status": "validated",
            },
            {
                "id": "Mancha-castanha",
                "name": "Mancha-castanha do amendoim",
                "pathogen": "Cercospora arachidicola",
                "status": "validated",
            },
        ],
    }


def test_analisar_endpoint_returns_compact_analysis(monkeypatch):
    compact_response = make_compact_response()

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        lambda talhao: compact_response,
    )

    response = client.post("/analisar", json=make_field_payload())

    assert response.status_code == 200
    data = response.json()
    assert "generated_at" in data
    assert "field" in data
    assert "disease" in data
    assert "pathogen" in data
    assert "risk" in data
    assert "management_relevance" in data
    assert "actions" in data
    assert data == compact_response


def test_analisar_endpoint_rejects_missing_required_field():
    payload = make_field_payload()
    del payload["doenca_alvo"]

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "doenca_alvo" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_invalid_disease():
    payload = make_field_payload()
    payload["doenca_alvo"] = "mancha preta"

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "doenca_alvo" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_invalid_crop():
    payload = make_field_payload()
    payload["cultura"] = "Soja"

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "cultura" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_invalid_crop_status():
    payload = make_field_payload()
    payload["status_lavoura"] = "plantado"

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "status_lavoura" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_invalid_latitude():
    payload = make_field_payload()
    payload["latitude"] = -91

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "latitude" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_invalid_longitude():
    payload = make_field_payload()
    payload["longitude"] = 181

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "longitude" in str(response.json()["detail"])


def test_analisar_endpoint_rejects_future_planting_date():
    payload = make_field_payload()
    payload["data_plantio"] = (date.today() + timedelta(days=1)).isoformat()

    response = client.post("/analisar", json=payload)

    assert_validation_error(response)
    assert "data_plantio" in str(response.json()["detail"])


def test_analisar_endpoint_accepts_extra_spaces(monkeypatch):
    compact_response = make_compact_response()
    captured_payload = {}

    def fake_run_disease_analysis_compact(talhao):
        captured_payload.update(talhao)
        return compact_response

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )

    payload = make_field_payload()
    payload.update(
        {
            "nome": "  Talhao A1  ",
            "cidade": "  Tupa-SP  ",
            "cultura": "  Amendoim  ",
            "doenca_alvo": "  Mancha-castanha  ",
            "status_lavoura": "  em_campo  ",
        }
    )

    response = client.post("/analisar", json=payload)

    assert response.status_code == 200
    assert captured_payload["nome"] == "Talhao A1"
    assert captured_payload["cidade"] == "Tupa-SP"
    assert captured_payload["cultura"] == "Amendoim"
    assert captured_payload["doenca_alvo"] == "Mancha-castanha"
    assert captured_payload["status_lavoura"] == "em_campo"
    assert captured_payload["data_plantio"] == "2026-04-10"
