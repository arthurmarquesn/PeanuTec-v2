import math


SCORE_FEATURE_KEYS = {
    "temperature": "temperature_score",
    "leaf_wetness": "leaf_wetness_score",
    "rainfall_7d": "rainfall_7d_score",
    "rainfall_40d": "rainfall_40d_score",
    "dew_point": "dew_point_score",
    "drying": "drying_score",
}


def classify_risk(risk_index: int | float) -> str:
    if risk_index >= 76:
        return "CRÍTICO"
    if risk_index >= 51:
        return "ALTO"
    if risk_index >= 26:
        return "MODERADO"
    return "BAIXO"


def build_score_summary(features: dict) -> dict:
    return {
        score_name: features[feature_name]
        for score_name, feature_name in SCORE_FEATURE_KEYS.items()
    }


def calculate_black_spot_risk(features: dict) -> dict:
    scores = build_score_summary(features)
    climate_risk_index = sum(scores.values())

    crop_stage_factor = features.get("crop_stage_factor", 1.0)

    agronomic_risk_index = min(
        100,
        math.floor((climate_risk_index * crop_stage_factor) + 0.5)
    )

    risk_class = classify_risk(agronomic_risk_index)
    climate_risk_class = classify_risk(climate_risk_index)

    reasons = []

    if scores["temperature"] >= 20:
        reasons.append("Temperatura dentro da faixa favorável de 20 °C a 26 °C.")

    if scores["leaf_wetness"] >= 25:
        reasons.append("Molhamento foliar estimado igual ou superior a 10 horas contínuas.")

    if features["rainy_days_7d"] >= 3:
        reasons.append("Foram detectados 3 ou mais dias com chuva acima de 2,5 mm nos últimos 7 dias.")

    if scores["rainfall_40d"] >= 10:
        reasons.append("Chuva acumulada elevada nos últimos 40 dias, indicando pressão climática favorável.")

    if scores["dew_point"] >= 10:
        reasons.append("Temperatura muito próxima do ponto de orvalho, indicando alta chance de orvalho/molhamento.")

    if scores["drying"] >= 5:
        reasons.append("Condições de baixa secagem foliar detectadas.")

    infection_window_detected = (
        features["leaf_wetness_hours"] >= 10
        and features["temperature_favorable_hours"] >= 4
    )

    if infection_window_detected:
        reasons.append(
            "Janela climática compatível com infecção detectada: "
            "temperatura favorável + molhamento prolongado."
        )

    if crop_stage_factor != 1:
        reasons.append(
            f"O risco climático foi ajustado pelo estágio da cultura: "
            f"{features['crop_stage']}."
        )

    return {
        "disease": "Mancha-preta do amendoim",
        "pathogen": "Cercosporidium personatum / Nothopassalora personata",

        "climate_risk_index": climate_risk_index,
        "climate_risk_class": climate_risk_class,

        "risk_index": agronomic_risk_index,
        "risk_class": risk_class,

        "crop_stage_factor": crop_stage_factor,

        "scores": scores,
        "features": features,
        "reasons": reasons,
        "infection_window_detected": infection_window_detected,
    }
