from datetime import datetime, timedelta

from src.disease.brown_spot_model import calculate_brown_spot_risk
from src.engine import risk_engine
from src.engine.risk_engine import build_features
from src.features.brown_spot_stage_features import get_brown_spot_stage_factor


def make_features(
    crop_stage_factor=1.0,
    crop_stage="Fase crítica para mancha-castanha",
    temperature_score=20,
    leaf_wetness_score=25,
    rainfall_7d_score=20,
    rainfall_40d_score=0,
    dew_point_score=10,
    drying_score=10,
    temperature_favorable_hours=56,
    leaf_wetness_hours=15,
    rainy_days_7d=4,
):
    return {
        "days_after_planting": 70,
        "crop_stage": crop_stage,
        "crop_stage_description": "Teste automatizado.",
        "crop_stage_factor": crop_stage_factor,
        "favorable_temperature_range": {
            "minimum": 16.0,
            "maximum": 25.0,
        },

        "temperature_favorable_hours": temperature_favorable_hours,
        "temperature_summary": {
            "average": 20.0,
            "minimum": 16.0,
            "maximum": 25.0,
        },
        "temperature_score": temperature_score,

        "leaf_wetness_hours": leaf_wetness_hours,
        "leaf_wetness_score": leaf_wetness_score,

        "rainy_days_7d": rainy_days_7d,
        "rainfall_7d_score": rainfall_7d_score,

        "rainfall_40d_mm": 80.7,
        "rainfall_40d_score": rainfall_40d_score,

        "min_dew_point_difference": 0.1,
        "dew_point_score": dew_point_score,

        "low_drying_hours": 17,
        "drying_score": drying_score,
    }


def test_brown_spot_doenca_e_patogeno_corretos():
    result = calculate_brown_spot_risk(make_features())

    assert result["disease"] == "Mancha-castanha do amendoim"
    assert result["pathogen"] == "Cercospora arachidicola"


def test_brown_spot_climate_risk_index_soma_dos_scores():
    result = calculate_brown_spot_risk(make_features())

    assert result["climate_risk_index"] == 85
    assert result["climate_risk_class"] == "CRÍTICO"


def test_brown_spot_ajuste_por_fator_agronomico():
    features = make_features(
        crop_stage_factor=0.70,
        crop_stage="Início de atenção para mancha-castanha",
    )

    result = calculate_brown_spot_risk(features)

    assert result["climate_risk_index"] == 85
    assert result["risk_index"] == 60
    assert result["risk_class"] == "ALTO"


def test_brown_spot_risco_agronomico_nao_passa_de_100():
    features = make_features(
        crop_stage_factor=1.10,
        temperature_score=20,
        leaf_wetness_score=25,
        rainfall_7d_score=20,
        rainfall_40d_score=15,
        dew_point_score=10,
        drying_score=10,
    )

    result = calculate_brown_spot_risk(features)

    assert result["climate_risk_index"] == 100
    assert result["risk_index"] == 100
    assert result["risk_class"] == "CRÍTICO"


def test_brown_spot_detecta_janela_climatica_de_infeccao():
    features = make_features(
        temperature_favorable_hours=4,
        leaf_wetness_hours=10,
    )

    result = calculate_brown_spot_risk(features)

    assert result["infection_window_detected"] is True


def test_brown_spot_nao_detecta_janela_sem_temperatura_suficiente():
    features = make_features(
        temperature_favorable_hours=3,
        leaf_wetness_hours=10,
    )

    result = calculate_brown_spot_risk(features)

    assert result["infection_window_detected"] is False


def test_brown_spot_usa_faixa_temperatura_16_25_diferente_da_mancha_preta():
    planting_date = (datetime.now().date() - timedelta(days=70)).isoformat()
    talhao = {
        "data_plantio": planting_date,
    }
    hourly_weather = {
        "time": [
            "2026-06-01T00:00",
            "2026-06-01T01:00",
            "2026-06-01T02:00",
            "2026-06-01T03:00",
        ],
        "temperature_2m": [16.0, 19.0, 25.0, 26.0],
        "precipitation": [0.0, 0.0, 0.0, 0.0],
        "relative_humidity_2m": [80, 80, 80, 80],
        "dew_point_2m": [10.0, 10.0, 10.0, 10.0],
        "shortwave_radiation": [200, 200, 200, 200],
        "wind_speed_10m": [10, 10, 10, 10],
    }
    historical_daily_rainfall = {
        "time": [],
        "precipitation_sum": [],
    }

    black_spot_features = build_features(
        talhao=talhao,
        hourly_weather=hourly_weather,
        historical_daily_rainfall=historical_daily_rainfall,
    )
    brown_spot_features = build_features(
        talhao=talhao,
        hourly_weather=hourly_weather,
        historical_daily_rainfall=historical_daily_rainfall,
        crop_stage_function=get_brown_spot_stage_factor,
        min_favorable_temperature=16.0,
        max_favorable_temperature=25.0,
    )

    assert black_spot_features["temperature_favorable_hours"] == 2
    assert brown_spot_features["temperature_favorable_hours"] == 3
    assert brown_spot_features["favorable_temperature_range"] == {
        "minimum": 16.0,
        "maximum": 25.0,
    }


def test_run_disease_analysis_seleciona_mancha_castanha(monkeypatch):
    expected = {"risk": {"disease": "Mancha-castanha do amendoim"}}

    monkeypatch.setattr(
        risk_engine,
        "run_brown_spot_analysis",
        lambda talhao: expected,
    )

    result = risk_engine.run_disease_analysis({"doenca_alvo": "Mancha-castanha"})

    assert result == expected
