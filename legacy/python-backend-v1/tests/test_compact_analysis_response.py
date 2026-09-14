from datetime import datetime

from src.engine.risk_engine import build_compact_analysis_response


def test_build_compact_analysis_response_for_brown_spot():
    analysis_result = {
        "talhao": {
            "nome": "Talhao 01",
            "cidade": "Tupa-SP",
            "cultura": "Amendoim",
            "status_lavoura": "em_campo",
        },
        "risk": {
            "disease": "Mancha-castanha do amendoim",
            "pathogen": "Cercospora arachidicola",
            "climate_risk_index": 85,
            "risk_index": 85,
            "risk_class": "CRÃTICO",
            "features": {
                "days_after_planting": 70,
                "crop_stage": "Fase crÃ­tica para mancha-castanha",
            },
        },
        "management_relevance": {
            "status": "ATIVA",
            "description": "A lavoura estÃ¡ em campo; o risco possui relevÃ¢ncia para decisÃ£o de manejo.",
        },
        "actions": [
            "Realizar inspeÃ§Ã£o prioritÃ¡ria no talhÃ£o.",
        ],
    }

    response = build_compact_analysis_response(analysis_result)

    assert "generated_at" in response
    assert isinstance(response["generated_at"], str)

    generated_at = datetime.fromisoformat(response["generated_at"])
    assert generated_at.tzinfo is not None

    assert response["field"]["name"] == "Talhao 01"
    assert response["field"]["city"] == "Tupa-SP"
    assert response["field"]["crop"] == "Amendoim"
    assert response["field"]["crop_status"] == "em_campo"
    assert response["field"]["days_after_planting"] == 70
    assert response["field"]["crop_stage"] == "Fase crÃ­tica para mancha-castanha"

    assert response["disease"] == "Mancha-castanha do amendoim"
    assert response["pathogen"] == "Cercospora arachidicola"
    assert response["risk"] == {
        "climate_index": 85,
        "agronomic_index": 85,
        "classification": "CRÃTICO",
    }
    assert response["management_relevance"] == {
        "status": "ATIVA",
        "description": "A lavoura estÃ¡ em campo; o risco possui relevÃ¢ncia para decisÃ£o de manejo.",
    }
    assert response["actions"] == [
        "Realizar inspeÃ§Ã£o prioritÃ¡ria no talhÃ£o.",
    ]
