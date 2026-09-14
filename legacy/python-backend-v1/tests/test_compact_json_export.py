import json

from src.engine.risk_engine import save_compact_analysis_to_json


def test_save_compact_analysis_to_json(tmp_path):
    compact_analysis = {
        "generated_at": "2026-06-14T21:30:00-03:00",
        "field": {
            "name": "Talhao 01",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 70,
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
    output_path = tmp_path / "outputs" / "analysis_result.json"

    saved_path = save_compact_analysis_to_json(compact_analysis, output_path)

    assert saved_path == output_path
    assert output_path.exists()

    with open(output_path, "r", encoding="utf-8") as file:
        saved_content = json.load(file)

    assert saved_content == compact_analysis
