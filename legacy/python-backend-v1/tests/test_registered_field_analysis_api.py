import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app


client = TestClient(api_app.app)


@pytest.fixture(autouse=True)
def isolated_files(tmp_path, monkeypatch):
    monkeypatch.setattr(
        api_app.fields_repository,
        "FIELDS_FILE",
        tmp_path / "outputs" / "fields.json",
    )
    monkeypatch.setattr(
        api_app.analysis_history_repository,
        "ANALYSIS_HISTORY_FILE",
        tmp_path / "outputs" / "analysis_history.json",
    )


def make_field(
    field_id: str = "field-1",
    diseases: list[str] | None = None,
) -> dict:
    return {
        "id": field_id,
        "nome": "Talhao A1",
        "cidade": "Tupa-SP",
        "latitude": -21.9347,
        "longitude": -50.5136,
        "cultura": "Amendoim",
        "data_plantio": "2026-04-10",
        "status_lavoura": "em_campo",
        "doencas_monitoradas": diseases or ["Mancha-preta"],
    }


def make_analysis(
    disease_id: str,
    agronomic_index: int,
    classification: str,
) -> dict:
    disease_data = {
        "Mancha-preta": {
            "disease": "Mancha-preta do amendoim",
            "pathogen": "Cercosporidium personatum / Nothopassalora personata",
            "crop_stage": "Final de ciclo com alta atencao",
        },
        "Mancha-castanha": {
            "disease": "Mancha-castanha do amendoim",
            "pathogen": "Cercospora arachidicola",
            "crop_stage": "Fase critica para mancha-castanha",
        },
    }[disease_id]

    return {
        "generated_at": "2026-06-14T22:00:00-03:00",
        "field": {
            "name": "Talhao A1",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 65,
            "crop_stage": disease_data["crop_stage"],
        },
        "disease": disease_data["disease"],
        "pathogen": disease_data["pathogen"],
        "risk": {
            "climate_index": 85,
            "agronomic_index": agronomic_index,
            "classification": classification,
        },
        "management_relevance": {
            "status": "ATIVA",
            "description": "A lavoura esta em campo.",
        },
        "actions": [
            "Realizar inspecao prioritaria no talhao.",
        ],
    }


def patch_analysis(monkeypatch, analysis_by_disease: dict[str, dict]) -> None:
    def fake_run_disease_analysis_compact(talhao: dict) -> dict:
        return analysis_by_disease[talhao["doenca_alvo"]]

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )


def test_analyze_registered_field_returns_200_for_existing_field(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=94,
                classification="CRITICO",
            ),
        },
    )

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "field-1"
    assert data["field_name"] == "Talhao A1"
    assert data["city"] == "Tupa-SP"
    assert data["total_analyses"] == 1
    assert len(data["analyses"]) == 1


def test_analyze_registered_field_returns_404_for_missing_field(monkeypatch):
    patch_analysis(monkeypatch, {})

    response = client.post("/talhoes/missing-field/analisar")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_analyze_registered_field_returns_two_analyses(monkeypatch):
    api_app.fields_repository.save_fields(
        [make_field(diseases=["Mancha-preta", "Mancha-castanha"])]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=70,
                classification="ALTO",
            ),
            "Mancha-castanha": make_analysis(
                "Mancha-castanha",
                agronomic_index=85,
                classification="CRITICO",
            ),
        },
    )

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    data = response.json()
    assert data["total_analyses"] == 2
    assert {analysis["disease"] for analysis in data["analyses"]} == {
        "Mancha-preta do amendoim",
        "Mancha-castanha do amendoim",
    }


def test_analyze_registered_field_orders_highest_risk_first(monkeypatch):
    api_app.fields_repository.save_fields(
        [make_field(diseases=["Mancha-preta", "Mancha-castanha"])]
    )
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=45,
                classification="MODERADO",
            ),
            "Mancha-castanha": make_analysis(
                "Mancha-castanha",
                agronomic_index=92,
                classification="CRITICO",
            ),
        },
    )

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    analyses = response.json()["analyses"]
    assert analyses[0]["disease"] == "Mancha-castanha do amendoim"
    assert analyses[0]["risk"]["agronomic_index"] == 92
    assert analyses[1]["disease"] == "Mancha-preta do amendoim"


def test_analyze_registered_field_includes_compact_analysis_fields(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                "Mancha-preta",
                agronomic_index=94,
                classification="CRITICO",
            ),
        },
    )

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    analysis = response.json()["analyses"][0]
    for key in [
        "generated_at",
        "field",
        "disease",
        "pathogen",
        "risk",
        "management_relevance",
        "actions",
    ]:
        assert key in analysis
