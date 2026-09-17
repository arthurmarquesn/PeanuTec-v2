from datetime import datetime, timedelta

from app.engine.features import count_hours_in_favorable_range
from app.engine.models import calculate_black_spot_risk, calculate_brown_spot_risk
from app.engine.risk_engine import build_features, run_disease_analysis_from_snapshot
from app.engine.stages import get_brown_spot_stage_factor


def make_features(
    crop_stage_factor=1.0,
    crop_stage="Fase crítica",
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
        "days_after_planting": 81,
        "crop_stage": crop_stage,
        "crop_stage_description": "Teste automatizado.",
        "crop_stage_factor": crop_stage_factor,
        "favorable_temperature_range": {"minimum": 20.0, "maximum": 26.0},
        "temperature_favorable_hours": temperature_favorable_hours,
        "temperature_summary": {"average": 19.7, "minimum": 13.4, "maximum": 27.9},
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


def test_black_spot_climate_risk_is_preserved():
    result = calculate_black_spot_risk(make_features())
    assert result["climate_risk_index"] == 85
    assert result["climate_risk_class"] == "CRÍTICO"


def test_black_spot_identity_is_preserved():
    result = calculate_black_spot_risk(make_features())
    assert result["disease"] == "Mancha-preta do amendoim"
    assert result["pathogen"] == "Cercosporidium personatum / Nothopassalora personata"


def test_black_spot_stage_adjustment_is_preserved():
    result = calculate_black_spot_risk(
        make_features(crop_stage_factor=0.30, crop_stage="Fase inicial")
    )
    assert result["risk_index"] == 26
    assert result["risk_class"] == "MODERADO"


def test_black_spot_high_stage_adjustment_is_preserved():
    result = calculate_black_spot_risk(
        make_features(crop_stage_factor=1.10, crop_stage="Final de ciclo com alta atenção")
    )
    assert result["risk_index"] == 94
    assert result["risk_class"] == "CRÍTICO"


def test_black_spot_caps_risk_at_100():
    result = calculate_black_spot_risk(
        make_features(
            crop_stage_factor=1.10,
            temperature_score=20,
            leaf_wetness_score=25,
            rainfall_7d_score=20,
            rainfall_40d_score=15,
            dew_point_score=10,
            drying_score=10,
        )
    )
    assert result["risk_index"] == 100


def test_black_spot_infection_window_requires_temperature_and_wetness():
    assert calculate_black_spot_risk(
        make_features(temperature_favorable_hours=56, leaf_wetness_hours=15)
    )["infection_window_detected"] is True
    assert calculate_black_spot_risk(
        make_features(temperature_favorable_hours=56, leaf_wetness_hours=5, leaf_wetness_score=0)
    )["infection_window_detected"] is False


def test_brown_spot_identity_and_stage_adjustment_are_preserved():
    features = make_features(crop_stage_factor=0.70, crop_stage="Início de atenção para mancha-castanha")
    result = calculate_brown_spot_risk(features)
    assert result["disease"] == "Mancha-castanha do amendoim"
    assert result["pathogen"] == "Cercospora arachidicola"
    assert result["risk_index"] == 60
    assert result["risk_class"] == "ALTO"


def test_brown_spot_temperature_range_differs_from_black_spot():
    hourly_weather = {
        "temperature_2m": [16.0, 19.0, 25.0, 26.0],
    }
    assert count_hours_in_favorable_range(hourly_weather, 20.0, 26.0) == 2
    assert count_hours_in_favorable_range(hourly_weather, 16.0, 25.0) == 3


def test_brown_spot_stage_factor_preserves_critical_window():
    stage = get_brown_spot_stage_factor(70)
    assert stage["factor"] == 1.0
    assert stage["stage"] == "Fase crítica para mancha-castanha"


def test_brown_spot_risk_is_capped_at_100():
    result = calculate_brown_spot_risk(
        make_features(
            crop_stage_factor=1.10,
            temperature_score=20,
            leaf_wetness_score=25,
            rainfall_7d_score=20,
            rainfall_40d_score=15,
            dew_point_score=10,
            drying_score=10,
        )
    )
    assert result["risk_index"] == 100


def test_snapshot_engine_returns_black_spot_without_external_fetch():
    timezone = "2026-06-01T00:00"
    hourly = {
        "time": [timezone, "2026-06-01T01:00", "2026-06-01T02:00", "2026-06-01T03:00"],
        "temperature_2m": [23.0] * 4,
        "relative_humidity_2m": [80.0] * 4,
        "dew_point_2m": [20.0] * 4,
        "precipitation": [0.0] * 4,
        "shortwave_radiation": [200.0] * 4,
        "wind_speed_10m": [10.0] * 4,
    }
    historical = {"time": ["2026-05-01"], "precipitation_sum": [1.0]}
    field = {
        "nome": "Talhao Teste",
        "cidade": "Tupa-SP",
        "cultura": "Amendoim",
        "data_plantio": (datetime.now().date() - timedelta(days=90)).isoformat(),
        "doenca_alvo": "Mancha-preta",
        "status_lavoura": "em_campo",
    }
    result = run_disease_analysis_from_snapshot(field, hourly, historical)
    assert result["disease"] == "Mancha-preta do amendoim"
    assert isinstance(result["actions"], list)
