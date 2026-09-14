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
    generated_at: str = "2026-06-15T10:30:00-03:00",
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
        "generated_at": generated_at,
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


def test_post_analisar_saves_analysis_history(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    analysis = make_analysis("Mancha-preta", agronomic_index=94, classification="CRITICO")
    patch_analysis(monkeypatch, {"Mancha-preta": analysis})

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    history = api_app.analysis_history_repository.load_analysis_history()
    assert len(history) == 1
    assert history[0]["field_id"] == "field-1"
    assert history[0]["field_name"] == "Talhao A1"
    assert history[0]["disease"] == "Mancha-preta do amendoim"


def test_post_analisar_saves_two_history_records_for_two_diseases(monkeypatch):
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
    history = api_app.analysis_history_repository.load_analysis_history()
    assert len(history) == 2
    assert {record["disease"] for record in history} == {
        "Mancha-preta do amendoim",
        "Mancha-castanha do amendoim",
    }


def test_get_historico_analises_returns_field_history(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    patch_analysis(
        monkeypatch,
        {"Mancha-preta": make_analysis("Mancha-preta", 94, "CRITICO")},
    )
    client.post("/talhoes/field-1/analisar")

    response = client.get("/talhoes/field-1/historico-analises")

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == "field-1"
    assert data["field_name"] == "Talhao A1"
    assert data["total"] == 1
    assert len(data["history"]) == 1


def test_get_historico_analises_returns_404_for_missing_field():
    response = client.get("/talhoes/missing-field/historico-analises")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_get_historico_analises_orders_newest_first():
    api_app.fields_repository.save_fields([make_field()])
    old_record = api_app.analysis_history_repository.create_analysis_history_record(
        field_id="field-1",
        field_name="Talhao A1",
        compact_analysis=make_analysis(
            "Mancha-preta",
            agronomic_index=50,
            classification="MODERADO",
            generated_at="2026-06-15T08:00:00-03:00",
        ),
    )
    new_record = api_app.analysis_history_repository.create_analysis_history_record(
        field_id="field-1",
        field_name="Talhao A1",
        compact_analysis=make_analysis(
            "Mancha-preta",
            agronomic_index=94,
            classification="CRITICO",
            generated_at="2026-06-15T10:30:00-03:00",
        ),
    )

    response = client.get("/talhoes/field-1/historico-analises")

    assert response.status_code == 200
    history = response.json()["history"]
    assert [record["id"] for record in history] == [
        new_record["id"],
        old_record["id"],
    ]


def test_saved_history_record_contains_required_fields(monkeypatch):
    api_app.fields_repository.save_fields([make_field()])
    analysis = make_analysis("Mancha-preta", agronomic_index=94, classification="CRITICO")
    patch_analysis(monkeypatch, {"Mancha-preta": analysis})

    response = client.post("/talhoes/field-1/analisar")

    assert response.status_code == 200
    record = api_app.analysis_history_repository.load_analysis_history()[0]
    for key in [
        "id",
        "field_id",
        "field_name",
        "disease",
        "pathogen",
        "generated_at",
        "climate_index",
        "agronomic_index",
        "classification",
        "management_relevance",
        "main_action",
        "raw_compact_analysis",
    ]:
        assert key in record

    assert record["pathogen"] == "Cercosporidium personatum / Nothopassalora personata"
    assert record["climate_index"] == 85
    assert record["agronomic_index"] == 94
    assert record["classification"] == "CRITICO"
    assert record["management_relevance"] == "ATIVA"
    assert record["main_action"] == "Realizar inspecao prioritaria no talhao."
    assert record["raw_compact_analysis"] == analysis
