from __future__ import annotations

import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


SCORE_FEATURE_KEYS = {
    "temperature": "temperature_score",
    "leaf_wetness": "leaf_wetness_score",
    "rainfall_7d": "rainfall_7d_score",
    "rainfall_40d": "rainfall_40d_score",
    "dew_point": "dew_point_score",
    "drying": "drying_score",
}


def build_score_summary(features: dict[str, Any]) -> dict[str, Any]:
    return {
        score_name: features[feature_name]
        for score_name, feature_name in SCORE_FEATURE_KEYS.items()
    }


def classify_risk(risk_index: int | float) -> str:
    if risk_index >= 76:
        return "CRÍTICO"
    if risk_index >= 51:
        return "ALTO"
    if risk_index >= 26:
        return "MODERADO"
    return "BAIXO"


def _infection_window(features: dict[str, Any]) -> bool:
    return (
        features["leaf_wetness_hours"] >= 10
        and features["temperature_favorable_hours"] >= 4
    )


def _reasons(features: dict[str, Any], min_temp: float, max_temp: float) -> list[str]:
    scores = build_score_summary(features)
    reasons: list[str] = []

    if scores["temperature"] >= 20:
        reasons.append(
            f"Temperatura dentro da faixa favorável de {min_temp:g} °C a {max_temp:g} °C."
        )

    if scores["leaf_wetness"] >= 25:
        reasons.append(
            "Molhamento foliar estimado igual ou superior a 10 horas contínuas."
        )

    if features["rainy_days_7d"] >= 3:
        reasons.append(
            "Foram detectados 3 ou mais dias com chuva acima de 2,5 mm nos últimos 7 dias."
        )

    if scores["rainfall_40d"] >= 10:
        reasons.append(
            "Chuva acumulada elevada nos últimos 40 dias, indicando pressão climática favorável."
        )

    if scores["dew_point"] >= 10:
        reasons.append(
            "Temperatura muito próxima do ponto de orvalho, indicando alta chance de orvalho/molhamento."
        )

    if scores["drying"] >= 5:
        reasons.append("Condições de baixa secagem foliar detectadas.")

    if _infection_window(features):
        reasons.append(
            "Janela climática compatível com infecção detectada: "
            "temperatura favorável + molhamento prolongado."
        )

    if features.get("crop_stage_factor", 1.0) != 1:
        reasons.append(
            f"O risco climático foi ajustado pelo estágio da cultura: {features['crop_stage']}."
        )

    return reasons


def calculate_black_spot_risk(features: dict[str, Any]) -> dict[str, Any]:
    scores = build_score_summary(features)
    climate_risk_index = sum(scores.values())
    crop_stage_factor = features.get("crop_stage_factor", 1.0)
    agronomic_risk_index = min(
        100,
        math.floor((climate_risk_index * crop_stage_factor) + 0.5),
    )

    return {
        "disease": "Mancha-preta do amendoim",
        "pathogen": "Cercosporidium personatum / Nothopassalora personata",
        "climate_risk_index": climate_risk_index,
        "climate_risk_class": classify_risk(climate_risk_index),
        "risk_index": agronomic_risk_index,
        "risk_class": classify_risk(agronomic_risk_index),
        "crop_stage_factor": crop_stage_factor,
        "scores": scores,
        "features": features,
        "reasons": _reasons(features, 20.0, 26.0),
        "infection_window_detected": _infection_window(features),
    }


def calculate_agronomic_risk_index(
    climate_risk_index: int | float,
    crop_stage_factor: int | float,
) -> int:
    adjusted_risk = Decimal(str(climate_risk_index)) * Decimal(str(crop_stage_factor))
    rounded_risk = adjusted_risk.to_integral_value(rounding=ROUND_HALF_UP)
    return min(100, int(rounded_risk))


def calculate_brown_spot_risk(features: dict[str, Any]) -> dict[str, Any]:
    scores = build_score_summary(features)
    climate_risk_index = sum(scores.values())
    crop_stage_factor = features.get("crop_stage_factor", 1.0)
    agronomic_risk_index = calculate_agronomic_risk_index(
        climate_risk_index,
        crop_stage_factor,
    )

    return {
        "disease": "Mancha-castanha do amendoim",
        "pathogen": "Cercospora arachidicola",
        "climate_risk_index": climate_risk_index,
        "climate_risk_class": classify_risk(climate_risk_index),
        "risk_index": agronomic_risk_index,
        "risk_class": classify_risk(agronomic_risk_index),
        "crop_stage_factor": crop_stage_factor,
        "scores": scores,
        "features": features,
        "reasons": _reasons(features, 16.0, 25.0),
        "infection_window_detected": _infection_window(features),
    }
