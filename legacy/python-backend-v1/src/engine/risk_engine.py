import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from src.features.weather_window import split_recent_and_forecast_weather
from src.features.crop_stage_features import get_crop_stage_factor
from src.features.brown_spot_stage_features import get_brown_spot_stage_factor

from src.data_sources.open_meteo_client import (
    fetch_forecast_weather,
    fetch_historical_daily_rainfall,
)

from src.features.rainfall_features import (
    daily_precipitation_from_hourly,
    count_rainy_days_above_threshold,
    sum_daily_rainfall,
    score_rainfall_7d,
    score_rainfall_40d,
)

from src.features.temperature_features import (
    count_hours_in_favorable_range,
    get_temperature_summary,
    score_temperature,
)

from src.features.leaf_wetness_features import (
    estimate_max_leaf_wetness_hours,
    score_leaf_wetness,
)

from src.features.dew_point_features import (
    get_min_dew_point_difference,
    score_dew_point,
)

from src.features.drying_features import (
    count_low_drying_hours,
    score_drying_condition,
)

from src.disease.black_spot_model import calculate_black_spot_risk
from src.disease.brown_spot_model import calculate_brown_spot_risk
from src.engine.action_recommender import recommend_action


BLACK_SPOT_TARGETS = {"mancha-preta", "mancha preta"}
BROWN_SPOT_TARGETS = {"mancha-castanha", "mancha castanha"}
TIMEZONE = "America/Sao_Paulo"


def calculate_days_after_planting(planting_date: str) -> int:
    planting = datetime.strptime(planting_date, "%Y-%m-%d").date()
    today = datetime.now().date()

    return (today - planting).days


def build_daily_rainfall_by_date(historical_daily_rainfall: dict) -> dict:
    return dict(
        zip(
            historical_daily_rainfall.get("time", []),
            historical_daily_rainfall.get("precipitation_sum", []),
        )
    )


def get_management_relevance(crop_status: str) -> dict:
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
    talhao: dict,
    hourly_weather: dict,
    historical_daily_rainfall: dict,
    crop_stage_function=get_crop_stage_factor,
    min_favorable_temperature: float = 20.0,
    max_favorable_temperature: float = 26.0,
) -> dict:
    daily_rainfall_7d = daily_precipitation_from_hourly(hourly_weather)

    rainy_days_7d = count_rainy_days_above_threshold(
        daily_rainfall=daily_rainfall_7d,
        threshold_mm=2.5,
        last_n_days=7,
    )

    rainfall_40d = sum_daily_rainfall(
        build_daily_rainfall_by_date(historical_daily_rainfall)
    )

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


def run_spot_analysis(
    talhao: dict,
    risk_calculator,
    crop_stage_function,
    min_favorable_temperature: float,
    max_favorable_temperature: float,
) -> dict:
    latitude = talhao["latitude"]
    longitude = talhao["longitude"]

    hourly_weather = fetch_forecast_weather(latitude, longitude)
    historical_daily_rainfall = fetch_historical_daily_rainfall(
        latitude,
        longitude,
    )

    weather_windows = split_recent_and_forecast_weather(hourly_weather)

    recent_weather = weather_windows["recent"]
    forecast_weather = weather_windows["forecast"]

    features = build_features(
        talhao=talhao,
        hourly_weather=recent_weather,
        historical_daily_rainfall=historical_daily_rainfall,
        crop_stage_function=crop_stage_function,
        min_favorable_temperature=min_favorable_temperature,
        max_favorable_temperature=max_favorable_temperature,
    )

    forecast_features = build_features(
        talhao=talhao,
        hourly_weather=forecast_weather,
        historical_daily_rainfall=historical_daily_rainfall,
        crop_stage_function=crop_stage_function,
        min_favorable_temperature=min_favorable_temperature,
        max_favorable_temperature=max_favorable_temperature,
    )

    risk_result = risk_calculator(features)
    forecast_risk_result = risk_calculator(forecast_features)

    crop_status = talhao.get("status_lavoura", "em_campo")

    management_relevance = get_management_relevance(crop_status)

    actions = recommend_action(
        risk_class=risk_result["risk_class"],
        infection_window_detected=risk_result["infection_window_detected"],
        climate_risk_class=risk_result["climate_risk_class"],
        crop_stage=features["crop_stage"],
        crop_stage_factor=features["crop_stage_factor"],
        crop_status=crop_status,
        disease_name=risk_result["disease"],
    )

    return {
        "talhao": talhao,
        "risk": risk_result,
        "forecast_risk": forecast_risk_result,
        "management_relevance": management_relevance,
        "actions": actions,
    }


def run_black_spot_analysis(talhao: dict) -> dict:
    return run_spot_analysis(
        talhao=talhao,
        risk_calculator=calculate_black_spot_risk,
        crop_stage_function=get_crop_stage_factor,
        min_favorable_temperature=20.0,
        max_favorable_temperature=26.0,
    )


def run_brown_spot_analysis(talhao: dict) -> dict:
    return run_spot_analysis(
        talhao=talhao,
        risk_calculator=calculate_brown_spot_risk,
        crop_stage_function=get_brown_spot_stage_factor,
        min_favorable_temperature=16.0,
        max_favorable_temperature=25.0,
    )


def run_disease_analysis(talhao: dict) -> dict:
    disease_target = talhao.get("doenca_alvo", "Mancha-preta").strip().lower()

    if disease_target in BLACK_SPOT_TARGETS:
        return run_black_spot_analysis(talhao)

    if disease_target in BROWN_SPOT_TARGETS:
        return run_brown_spot_analysis(talhao)

    raise ValueError(
        "Doenca-alvo nao suportada. Use Mancha-preta ou Mancha-castanha."
    )


def build_compact_analysis_response(analysis_result: dict) -> dict:
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


def run_disease_analysis_compact(talhao: dict) -> dict:
    analysis_result = run_disease_analysis(talhao)

    return build_compact_analysis_response(analysis_result)


def save_compact_analysis_to_json(compact_analysis: dict, output_path: str | Path) -> Path:
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(compact_analysis, file, ensure_ascii=False, indent=2)

    return output_file
