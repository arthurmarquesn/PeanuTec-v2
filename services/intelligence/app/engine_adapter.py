from __future__ import annotations

import sys
import unicodedata
from pathlib import Path
from typing import Any


# ============================================================
# Legacy engine bootstrap
# ============================================================

CURRENT_FILE = Path(__file__).resolve()

# services/intelligence/app/engine_adapter.py
# -> app
# -> intelligence
# -> services
# -> raiz do PeanuTec-v2
REPOSITORY_ROOT = CURRENT_FILE.parents[3]


def _find_legacy_backend_root() -> Path:
    """
    Localiza o backend legado congelado.

    Aceitamos duas estruturas para facilitar a migração:

    legacy/python-backend-v1/src/...
    ou
    legacy/python-backend-v1/blackspot-risk-v01/src/...
    """

    candidates = [
        REPOSITORY_ROOT / "legacy" / "python-backend-v1",
        (
            REPOSITORY_ROOT
            / "legacy"
            / "python-backend-v1"
            / "blackspot-risk-v01"
        ),
    ]

    for candidate in candidates:
        risk_engine_file = (
            candidate
            / "src"
            / "engine"
            / "risk_engine.py"
        )

        if risk_engine_file.is_file():
            return candidate

    searched_paths = "\n".join(
        f"- {candidate}"
        for candidate in candidates
    )

    raise RuntimeError(
        "Não foi possível localizar o motor legado do PeanuTec.\n"
        "Foram verificados os seguintes caminhos:\n"
        f"{searched_paths}"
    )


LEGACY_BACKEND_ROOT = _find_legacy_backend_root()

legacy_path = str(LEGACY_BACKEND_ROOT)

if legacy_path not in sys.path:
    sys.path.insert(
        0,
        legacy_path,
    )


# O import deve acontecer somente depois de adicionar
# o backend legado ao sys.path.
from src.engine import risk_engine  # noqa: E402


# ============================================================
# Domain
# ============================================================

BLACK_SPOT_TARGETS = {
    "mancha-preta",
    "mancha preta",
}

BROWN_SPOT_TARGETS = {
    "mancha-castanha",
    "mancha castanha",
}


# ============================================================
# Helpers
# ============================================================


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFD",
        value.strip().lower(),
    )

    return "".join(
        character
        for character in normalized
        if unicodedata.category(character) != "Mn"
    )


def _validate_weather_snapshot(
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
) -> None:
    hourly_time = hourly_weather.get("time")

    if not isinstance(hourly_time, list) or not hourly_time:
        raise ValueError(
            "hourly_weather precisa conter uma lista 'time' válida."
        )

    historical_time = historical_daily_rainfall.get(
        "time"
    )

    precipitation_sum = historical_daily_rainfall.get(
        "precipitation_sum"
    )

    if (
        not isinstance(historical_time, list)
        or not historical_time
    ):
        raise ValueError(
            "historical_daily_rainfall precisa conter "
            "uma lista 'time' válida."
        )

    if not isinstance(
        precipitation_sum,
        list,
    ):
        raise ValueError(
            "historical_daily_rainfall precisa conter "
            "'precipitation_sum'."
        )


def _resolve_disease_configuration(
    disease_target: str,
):
    normalized = _normalize_text(
        disease_target
    )

    if normalized in BLACK_SPOT_TARGETS:
        return {
            "risk_calculator":
                risk_engine.calculate_black_spot_risk,

            "crop_stage_function":
                risk_engine.get_crop_stage_factor,

            "minimum_temperature":
                20.0,

            "maximum_temperature":
                26.0,
        }

    if normalized in BROWN_SPOT_TARGETS:
        return {
            "risk_calculator":
                risk_engine.calculate_brown_spot_risk,

            "crop_stage_function":
                risk_engine.get_brown_spot_stage_factor,

            "minimum_temperature":
                16.0,

            "maximum_temperature":
                25.0,
        }

    raise ValueError(
        "Doença-alvo não suportada. "
        "Use Mancha-preta ou Mancha-castanha."
    )


# ============================================================
# Pure intelligence execution
# ============================================================


def run_disease_analysis_from_snapshot(
    field: dict[str, Any],
    hourly_weather: dict[str, Any],
    historical_daily_rainfall: dict[str, Any],
) -> dict[str, Any]:
    """
    Executa a análise sem acessar serviços externos.

    O Next.js fornece:
    - snapshot do talhão;
    - dados horários recentes/futuros;
    - chuva histórica.

    O Python somente:
    - divide janelas meteorológicas;
    - extrai features;
    - executa o modelo;
    - classifica o risco;
    - produz as ações.
    """

    _validate_weather_snapshot(
        hourly_weather,
        historical_daily_rainfall,
    )

    disease_target = str(
        field.get(
            "doenca_alvo",
            "",
        )
    )

    configuration = (
        _resolve_disease_configuration(
            disease_target
        )
    )

    weather_windows = (
        risk_engine
        .split_recent_and_forecast_weather(
            hourly_weather
        )
    )

    recent_weather = (
        weather_windows["recent"]
    )

    forecast_weather = (
        weather_windows["forecast"]
    )

    risk_calculator = (
        configuration[
            "risk_calculator"
        ]
    )

    crop_stage_function = (
        configuration[
            "crop_stage_function"
        ]
    )

    minimum_temperature = float(
        configuration[
            "minimum_temperature"
        ]
    )

    maximum_temperature = float(
        configuration[
            "maximum_temperature"
        ]
    )

    # ========================================================
    # Current/recent window
    # ========================================================

    features = (
        risk_engine.build_features(
            talhao=field,
            hourly_weather=recent_weather,
            historical_daily_rainfall=(
                historical_daily_rainfall
            ),
            crop_stage_function=(
                crop_stage_function
            ),
            min_favorable_temperature=(
                minimum_temperature
            ),
            max_favorable_temperature=(
                maximum_temperature
            ),
        )
    )

    # ========================================================
    # Forecast window
    # ========================================================

    forecast_features = (
        risk_engine.build_features(
            talhao=field,
            hourly_weather=forecast_weather,
            historical_daily_rainfall=(
                historical_daily_rainfall
            ),
            crop_stage_function=(
                crop_stage_function
            ),
            min_favorable_temperature=(
                minimum_temperature
            ),
            max_favorable_temperature=(
                maximum_temperature
            ),
        )
    )

    # ========================================================
    # Disease model
    # ========================================================

    risk_result = risk_calculator(
        features
    )

    forecast_risk_result = (
        risk_calculator(
            forecast_features
        )
    )

    crop_status = str(
        field.get(
            "status_lavoura",
            "em_campo",
        )
    )

    management_relevance = (
        risk_engine
        .get_management_relevance(
            crop_status
        )
    )

    actions = (
        risk_engine.recommend_action(
            risk_class=(
                risk_result[
                    "risk_class"
                ]
            ),
            infection_window_detected=(
                risk_result[
                    "infection_window_detected"
                ]
            ),
            climate_risk_class=(
                risk_result[
                    "climate_risk_class"
                ]
            ),
            crop_stage=(
                features[
                    "crop_stage"
                ]
            ),
            crop_stage_factor=(
                features[
                    "crop_stage_factor"
                ]
            ),
            crop_status=(
                crop_status
            ),
            disease_name=(
                risk_result[
                    "disease"
                ]
            ),
        )
    )

    analysis_result = {
        "talhao":
            field,

        "risk":
            risk_result,

        "forecast_risk":
            forecast_risk_result,

        "management_relevance":
            management_relevance,

        "actions":
            actions,
    }

    return (
        risk_engine
        .build_compact_analysis_response(
            analysis_result
        )
    )