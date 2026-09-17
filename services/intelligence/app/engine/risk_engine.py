from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.engine.actions import recommend_action
from app.engine.features import (
    count_hours_in_favorable_range,
    count_low_drying_hours,
    count_rainy_days_above_threshold,
    daily_precipitation_from_hourly,
    get_min_dew_point_difference,
    get_temperature_summary,
    score_dew_point,
    score_drying_condition,
    score_leaf_wetness,
    score_rainfall_7d,
    score_rainfall_40d,
    score_temperature,
    sum_daily_rainfall,
    estimate_max_leaf_wetness_hours,
)
from app.engine.models import calculate_black_spot_risk, calculate_brown_spot_risk
from app.engine.stages import get_brown_spot_stage_factor, get_crop_stage_factor
from app.engine.weather_window import split_recent_and_forecast_weather


BLACK_SPOT_TARGETS = {"mancha-preta", "mancha preta"}
BROWN_SPOT_TARGETS = {"mancha-castanha", "mancha castanha"}
TIMEZONE = "America/Sao_Paulo"


def calculate_days_after_planting(planting_date: str) -> int:
    planting = datetime.strptime(planting_date, "%Y-%m-%d").date()
    today = datetime.now().date()
    return (today - planting).days


def build_daily_rainfall_by_date(historical_daily_rainfall: dict[str, Any]) -> dict[str, Any]:
    return dict(
        zip(
            historical_daily_rainfall.get("time", []),
            historical_daily_rainfall.get("precipitation_sum", []),
        )
    )


def get_management_relevance(crop_status: str) -> dict[str, str]:
    if crop_status == "em_campo":
        return {
            "status": "ATIVA",
            "description": "A lavoura está em campo; o risco possui relevância para decisão de manejo.",
        }
    if crop_status == "pre_arranquio":
        return {
            "status": "CONDICIONAL",
            "description": "A lavoura está em pré-arranquio; qualquer manejo deve considerar tempo restante e custo-benefício.",
        }
    if crop_status == "arrancado":
        return {
            "status": "ENCERRADA PARA DOENÇA FOLIAR",
            "description": "A lavoura já foi arrancada; mancha-preta deixa de ser prioridade de manejo foliar.",
        }
    if crop_status == "colhido":
        return {
            "status": "ENCERRADA",
            "description": "A lavoura foi colhida; o risco deve ser usado apenas como histórico da safra.",
        }
    return {
        "status": "DESCONHECIDA",
        "description": "Status da lavoura inválido ou desconhecido; confirmar antes de interpretar a recomendação.",
    }


def build_features(
    talhao: dict[str, Any],
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
    crop_stage_function=get_crop_stage_factor,
    min_favorable_temperature: float = 20.0,
    max_favorable_temperature: float = 26.0,
) -> dict[str, Any]:
    daily_rainfall_7d = daily_precipitation_from_hourly(hourly_weather)
    rainy_days_7d = count_rainy_days_above_threshold(
        daily_rainfall= daily_rainfall_7d,
        threshold_mm=2.5,
        last_n_days=7,
    )
    rainfall_40d = sum_daily_rainfall(build_daily_rainfall_by_date(historical_daily_rainfall))
    temperature_favorable_hours = count_hours_in_favorable_range(
        hourly_weather,
        min_temp=min_favorable_temperature,
        max_temp=max_favorable_temperature,
    )
    temperature_summary = get_temperature_summary(hourly_weather)
    leaf_wetness_hours = estimate_max_leaf_wetness_hours(hourly_weather)
    min_dew_point_difference = get_min_dew_point_difference(hourly_weather)
    low_drying_hours = count_low_drying_hours(hourly_weather)
    days_after_planting = calculate_days_after_planting(talhao["data_plantio"])
    crop_stage = crop_stage_function(days_after_planting)

    return {
        "days_after_planting": days_after_planting,
        "crop_stage": crop_stage["stage"],
        "crop_stage_description": crop_stage["description"],
        "crop_stage_factor": crop_stage["factor"],
        "favorable_temperature_range": {
            "minimum": min_favorable_temperature,
            "maximum": max_favorable_temperature,
        },
        "temperature_favorable_hours": temperature_favorable_hours,
        "temperature_summary": temperature_summary,
        "temperature_score": score_temperature(temperature_favorable_hours),
        "leaf_wetness_hours": leaf_wetness_hours,
        "leaf_wetness_score": score_leaf_wetness(leaf_wetness_hours),
        "rainy_days_7d": rainy_days_7d,
        "rainfall_7d_score": score_rainfall_7d(rainy_days_7d),
        "rainfall_40d_mm": rainfall_40d,
        "rainfall_40d_score": score_rainfall_40d(rainfall_40d),
        "min_dew_point_difference": min_dew_point_difference,
        "dew_point_score": score_dew_point(min_dew_point_difference),
        "low_drying_hours": low_drying_hours,
        "drying_score": score_drying_condition(low_drying_hours),
    }


def _resolve_disease_configuration(disease_target: str) -> dict[str, Any]:
    normalized = disease_target.strip().lower()
    if normalized in BLACK_SPOT_TARGETS:
        return {
            "risk_calculator": calculate_black_spot_risk,
            "crop_stage_function": get_crop_stage_factor,
            "minimum_temperature": 20.0,
            "maximum_temperature": 26.0,
        }
    if normalized in BROWN_SPOT_TARGETS:
        return {
            "risk_calculator": calculate_brown_spot_risk,
            "crop_stage_function": get_brown_spot_stage_factor,
            "minimum_temperature": 16.0,
            "maximum_temperature": 25.0,
        }
    raise ValueError(
        "Doença-alvo não suportada. Use Mancha-preta ou Mancha-castanha."
    )


def run_disease_analysis_from_snapshot(
    field: dict[str, Any],
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
) -> dict[str, Any]:
    configuration = _resolve_disease_configuration(str(field.get("doenca_alvo", "")))
    weather_windows = split_recent_and_forecast_weather(hourly_weather)

    features = build_features(
        talhao=field,
        hourly_weather=weather_windows["recent"],
        historical_daily_rainfall=historical_daily_rainfall,
        crop_stage_function=configuration["crop_stage_function"],
        min_favorable_temperature=configuration["minimum_temperature"],
        max_favorable_temperature=configuration["maximum_temperature"],
    )
    forecast_features = build_features(
        talhao=field,
        hourly_weather=weather_windows["forecast"],
        historical_daily_rainfall=historical_daily_rainfall,
        crop_stage_function=configuration["crop_stage_function"],
        min_favorable_temperature=configuration["minimum_temperature"],
        max_favorable_temperature=configuration["maximum_temperature"],
    )

    risk_calculator = configuration["risk_calculator"]
    risk_result = risk_calculator(features)
    forecast_risk_result = risk_calculator(forecast_features)
    crop_status = str(field.get("status_lavoura", "em_campo"))

    analysis_result = {
        "talhao": field,
        "risk": risk_result,
        "forecast_risk": forecast_risk_result,
        "management_relevance": get_management_relevance(crop_status),
        "actions": recommend_action(
            risk_class=risk_result["risk_class"],
            infection_window_detected=risk_result["infection_window_detected"],
            climate_risk_class=risk_result["climate_risk_class"],
            crop_stage=features["crop_stage"],
            crop_stage_factor=features["crop_stage_factor"],
            crop_status=crop_status,
            disease_name=risk_result["disease"],
        ),
    }
    return build_compact_analysis_response(analysis_result)


def build_compact_analysis_response(analysis_result: dict[str, Any]) -> dict[str, Any]:
    talhao = analysis_result["talhao"]
    risk_result = analysis_result["risk"]
    features = risk_result["features"]
    return {
        "generated_at": datetime.now(ZoneInfo(TIMEZONE)).isoformat(timespec="seconds"),
        "field": {
            "name": talhao["nome"],
            "city": talhao["cidade"],
            "crop": talhao["cultura"],
            "crop_status": talhao.get("status_lavoura", "em_campo"),
            "days_after_planting": features["days_after_planting"],
            "crop_stage": features["crop_stage"],
        },
        "disease": risk_result["disease"],
        "pathogen": risk_result["pathogen"],
        "risk": {
            "climate_index": risk_result["climate_risk_index"],
            "agronomic_index": risk_result["risk_index"],
            "classification": risk_result["risk_class"],
        },
        "management_relevance": analysis_result["management_relevance"],
        "actions": analysis_result["actions"],
    }
