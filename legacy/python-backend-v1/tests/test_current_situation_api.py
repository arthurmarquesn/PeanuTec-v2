from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from src.api import app as api_app
from src.services.defense_estimator import calculate_estimated_defense


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
        api_app.inspections_repository,
        "INSPECTIONS_FILE",
        tmp_path / "outputs" / "inspections.json",
    )
    monkeypatch.setattr(
        api_app.users_repository,
        "USERS_FILE",
        tmp_path / "outputs" / "users.json",
    )
    monkeypatch.setattr(
        api_app.products_repository,
        "PRODUCTS_FILE",
        tmp_path / "outputs" / "products.json",
    )


def make_field(
    field_id: str = "field-1",
    status_lavoura: str = "em_campo",
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
        "status_lavoura": status_lavoura,
        "doencas_monitoradas": diseases or ["Mancha-preta"],
    }


def save_field(field: dict | None = None) -> dict:
    field = field or make_field()
    api_app.fields_repository.save_fields([field])
    return field


def make_analysis(
    disease_id: str = "Mancha-preta",
    agronomic_index: int = 94,
    climate_index: int = 88,
    classification: str = "CRITICO",
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
        "generated_at": "2026-06-17T10:00:00-03:00",
        "field": {
            "name": "Talhao A1",
            "city": "Tupa-SP",
            "crop": "Amendoim",
            "crop_status": "em_campo",
            "days_after_planting": 68,
            "crop_stage": disease_data["crop_stage"],
        },
        "disease": disease_data["disease"],
        "pathogen": disease_data["pathogen"],
        "risk": {
            "climate_index": climate_index,
            "agronomic_index": agronomic_index,
            "classification": classification,
        },
        "management_relevance": {
            "status": "ATIVA",
            "description": "A lavoura esta em campo.",
        },
        "actions": ["Realizar inspecao prioritaria no talhao."],
    }


def patch_analysis(monkeypatch, analysis_by_disease: dict[str, dict]) -> None:
    def fake_run_disease_analysis_compact(talhao: dict) -> dict:
        return analysis_by_disease[talhao["doenca_alvo"]]

    monkeypatch.setattr(
        api_app.risk_engine,
        "run_disease_analysis_compact",
        fake_run_disease_analysis_compact,
    )


def make_spray(days_since_application: int, **overrides) -> dict:
    application_date = datetime.now(TIMEZONE) - timedelta(
        days=days_since_application
    )
    spray_application = {
        "id": "spray-1",
        "field_id": "field-1",
        "field_name": "Talhao A1",
        "application_date": application_date.isoformat(timespec="seconds"),
        "product": "Clorotalonil",
        "target": "Mancha-preta",
        "dose": "1,5 L/ha",
        "responsible": "Tecnico responsavel",
        "planned_interval_days": 12,
        "notes": "",
        "created_at": application_date.isoformat(timespec="seconds"),
    }
    spray_application.update(overrides)
    return spray_application


def save_spray(spray_application: dict) -> None:
    api_app.spray_applications_repository.save_spray_applications(
        [spray_application]
    )


def make_product(
    product_id: str = "product-1",
    default_defense_days: int | None = 9,
    product_type: str = "fungicida",
) -> dict:
    return {
        "id": product_id,
        "name": "Produto cadastrado",
        "product_type": product_type,
        "active_ingredient": "Ingrediente ativo",
        "main_target": "Mancha-preta",
        "default_defense_days": default_defense_days,
        "notes": None,
        "is_active": True,
        "created_at": "2026-06-17T10:00:00-03:00",
        "updated_at": "2026-06-17T10:00:00-03:00",
    }


def save_product(product: dict | None = None) -> dict:
    product = product or make_product()
    api_app.products_repository.create_product(product)
    return product


def make_inspection(symptoms_found: bool = False, **overrides) -> dict:
    inspected_at = datetime.now(TIMEZONE) - timedelta(days=1)
    inspection = {
        "id": "inspection-1",
        "field_id": "field-1",
        "field_name": "Talhao A1",
        "disease": "Mancha-preta do amendoim",
        "symptoms_found": symptoms_found,
        "visual_severity": "baixa",
        "defoliation_level": "baixa",
        "action_taken": "monitorar",
        "notes": "",
        "inspected_at": inspected_at.isoformat(timespec="seconds"),
        "created_at": inspected_at.isoformat(timespec="seconds"),
    }
    inspection.update(overrides)
    return inspection


def save_inspection(inspection: dict) -> None:
    api_app.inspections_repository.save_inspections([inspection])


def test_situacao_atual_returns_404_for_missing_field(monkeypatch):
    patch_analysis(monkeypatch, {})

    response = client.get("/talhoes/missing-field/situacao-atual")

    assert response.status_code == 404
    assert response.json()["detail"] == "Talhao nao encontrado"


def test_situacao_atual_returns_situation_for_valid_field(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    save_spray(make_spray(days_since_application=3))
    save_inspection(make_inspection(symptoms_found=True))

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    data = response.json()
    assert data["field_id"] == field["id"]
    assert data["field_name"] == "Talhao A1"
    assert data["current_situation"] == "monitorar_resposta"
    assert data["risk_context"]["main_disease"] == "Mancha-preta do amendoim"
    assert data["spray_context"]["estimated_defense_percent"] == 75
    assert data["spray_context"]["defense_reference_days"] == 12
    assert (
        data["spray_context"]["defense_reference_source"]
        == "intervalo_planejado"
    )
    assert data["inspection_context"]["has_inspection_record"] is True
    assert data["recommended_next_action"]
    assert data["reasons"]


def test_situacao_atual_uses_field_2_inspection_fields_in_priority(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(
                agronomic_index=25,
                climate_index=20,
                classification="BAIXO",
            ),
        },
    )
    save_spray(make_spray(days_since_application=2))
    save_inspection(
        make_inspection(
            symptoms_found=False,
            visual_severity="nenhuma",
            defoliation_level="nenhuma",
            action_taken="nenhuma",
            general_status="critica",
            problem_distribution="generalizado",
            pests_found=True,
            pest_notes="Insetos observados na bordadura.",
            weeds_found=True,
            weed_pressure="alta",
            soil_condition="compactado",
            return_needed=True,
            return_days=3,
            observed_area="area baixa",
            responsible="Tecnico de campo",
        )
    )

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    data = response.json()
    inspection_context = data["inspection_context"]
    assert inspection_context["general_status"] == "critica"
    assert inspection_context["problem_distribution"] == "generalizado"
    assert inspection_context["pests_found"] is True
    assert inspection_context["pest_notes"] == "Insetos observados na bordadura."
    assert inspection_context["weeds_found"] is True
    assert inspection_context["weed_pressure"] == "alta"
    assert inspection_context["soil_condition"] == "compactado"
    assert inspection_context["return_needed"] is True
    assert inspection_context["return_days"] == 3
    assert inspection_context["observed_area"] == "area baixa"
    assert inspection_context["responsible"] == "Tecnico de campo"
    reason_codes = {reason["code"] for reason in data["main_reasons"]}
    assert {
        "status_geral_critica",
        "distribuicao_problema_generalizado",
        "retorno_inspecao_necessario",
        "pragas_observadas",
        "plantas_daninhas_observadas",
    }.issubset(reason_codes)
    assert data["metrics"]["block_scores"]["inspection"] >= 20
    assert data["metrics"]["block_scores"]["operational"] >= 6


def test_situacao_atual_without_spray_returns_sem_registro(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["has_spray_record"] is False
    assert spray_context["estimated_defense_percent"] is None
    assert spray_context["defense_status"] == "sem_registro"
    assert spray_context["defense_reference_days"] == 12
    assert spray_context["defense_reference_source"] == "fallback"


def test_situacao_atual_uses_planned_interval_before_product_default(monkeypatch):
    field = save_field()
    product = save_product(make_product(default_defense_days=20))
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    save_spray(
        make_spray(
            days_since_application=5,
            product_id=product["id"],
            product=product["name"],
            product_type=product["product_type"],
            planned_interval_days=10,
        )
    )

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["product_id"] == product["id"]
    assert spray_context["product"] == product["name"]
    assert spray_context["product_type"] == product["product_type"]
    assert spray_context["product_default_defense_days"] == 20
    assert spray_context["defense_reference_days"] == 10
    assert spray_context["defense_reference_source"] == "intervalo_planejado"
    assert spray_context["estimated_defense_percent"] == 50


def test_situacao_atual_uses_product_default_without_planned_interval(monkeypatch):
    field = save_field()
    product = save_product(make_product(default_defense_days=8, product_type="acaricida"))
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    spray = make_spray(
        days_since_application=2,
        product_id=product["id"],
        product=product["name"],
        product_type=None,
    )
    spray.pop("planned_interval_days")
    save_spray(spray)

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["planned_interval_days"] is None
    assert spray_context["product_type"] == "acaricida"
    assert spray_context["product_default_defense_days"] == 8
    assert spray_context["defense_reference_days"] == 8
    assert spray_context["defense_reference_source"] == "produto"
    assert spray_context["estimated_defense_percent"] == 75


def test_situacao_atual_uses_fallback_without_planned_or_product_default(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    spray = make_spray(days_since_application=3)
    spray.pop("planned_interval_days")
    save_spray(spray)

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["product_default_defense_days"] is None
    assert spray_context["defense_reference_days"] == 12
    assert spray_context["defense_reference_source"] == "fallback"
    assert spray_context["estimated_defense_percent"] == 75


def test_situacao_atual_keeps_legacy_spray_records_working(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    legacy_spray = make_spray(days_since_application=3)

    for key in [
        "product_id",
        "product_type",
        "planned_interval_days",
        "generate_reapplication",
        "reapplication_date",
        "reapplication_interval_days",
        "reapplication_notes",
    ]:
        legacy_spray.pop(key, None)

    save_spray(legacy_spray)

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["product"] == "Clorotalonil"
    assert spray_context["product_id"] is None
    assert spray_context["product_type"] is None
    assert spray_context["defense_reference_days"] == 12
    assert spray_context["defense_reference_source"] == "fallback"


def test_situacao_atual_returns_days_until_reapplication(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="ALTO"),
        },
    )
    reapplication_date = datetime.now(TIMEZONE).date() + timedelta(days=4)
    save_spray(
        make_spray(
            days_since_application=2,
            generate_reapplication=True,
            reapplication_date=reapplication_date.isoformat(),
        )
    )

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    spray_context = response.json()["spray_context"]
    assert spray_context["generate_reapplication"] is True
    assert spray_context["reapplication_date"] == reapplication_date.isoformat()
    assert spray_context["days_until_reapplication"] == 4


def test_calculate_estimated_defense_calculates_percent_correctly():
    defense = calculate_estimated_defense(
        days_since_application=3,
        planned_interval_days=12,
    )

    assert defense == {
        "estimated_defense_percent": 75,
        "defense_status": "alta",
    }


@pytest.mark.parametrize(
    ("days_since_application", "planned_interval_days", "expected_status"),
    [
        (1, 12, "muito_alta"),
        (3, 12, "alta"),
        (6, 12, "media"),
        (10, 12, "baixa"),
        (12, 12, "vencida"),
        (13, 12, "vencida"),
    ],
)
def test_calculate_estimated_defense_statuses(
    days_since_application,
    planned_interval_days,
    expected_status,
):
    defense = calculate_estimated_defense(
        days_since_application=days_since_application,
        planned_interval_days=planned_interval_days,
    )

    assert defense["defense_status"] == expected_status


def test_risco_critico_with_expired_defense_generates_prioridade_maxima(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="CRITICO"),
        },
    )
    save_spray(make_spray(days_since_application=13))

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    data = response.json()
    assert data["current_situation"] == "prioridade_maxima"
    assert data["spray_context"]["defense_status"] == "vencida"


def test_risco_critico_with_high_defense_generates_monitorar_resposta(monkeypatch):
    field = save_field()
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="CRITICO"),
        },
    )
    save_spray(make_spray(days_since_application=3))

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    data = response.json()
    assert data["current_situation"] == "monitorar_resposta"
    assert data["spray_context"]["defense_status"] == "alta"


def test_closed_field_generates_sem_prioridade_operacional(monkeypatch):
    field = save_field(make_field(status_lavoura="colhido"))
    patch_analysis(
        monkeypatch,
        {
            "Mancha-preta": make_analysis(classification="CRITICO"),
        },
    )
    save_spray(make_spray(days_since_application=13))

    response = client.get(f"/talhoes/{field['id']}/situacao-atual")

    assert response.status_code == 200
    data = response.json()
    assert data["current_situation"] == "sem_prioridade_operacional"
    assert (
        data["recommended_next_action"]
        == "Talhão sem prioridade operacional imediata para manejo foliar."
    )


def test_auth_register_continues_working():
    response = client.post(
        "/auth/register",
        json={
            "name": "Arthur",
            "email": "arthur@peanutec.com",
            "password": "senha123",
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "arthur@peanutec.com"
