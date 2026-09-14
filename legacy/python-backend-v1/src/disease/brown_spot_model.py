from decimal import Decimal, ROUND_HALF_UP

from src.disease.black_spot_model import build_score_summary


def classify_brown_spot_risk(risk_index: int | float) -> str:
    if risk_index >= 76:
        return "CRÍTICO"
    if risk_index >= 51:
        return "ALTO"
    if risk_index >= 26:
        return "MODERADO"
    return "BAIXO"


def calculate_agronomic_risk_index(
    climate_risk_index: int | float,
    crop_stage_factor: int | float,
) -> int:
    adjusted_risk = Decimal(str(climate_risk_index)) * Decimal(str(crop_stage_factor))
    rounded_risk = adjusted_risk.to_integral_value(rounding=ROUND_HALF_UP)

    return min(100, int(rounded_risk))


def calculate_brown_spot_risk(features: dict) -> dict:
    scores = build_score_summary(features)
    climate_risk_index = sum(scores.values())

    crop_stage_factor = features.get("crop_stage_factor", 1.0)

    agronomic_risk_index = calculate_agronomic_risk_index(
        climate_risk_index,
        crop_stage_factor,
    )

    risk_class = classify_brown_spot_risk(agronomic_risk_index)
    climate_risk_class = classify_brown_spot_risk(climate_risk_index)

    reasons = []

    if scores["temperature"] >= 20:
        reasons.append("Temperatura dentro da faixa favorável de 16 °C a 25 °C.")

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
        "disease": "Mancha-castanha do amendoim",
        "pathogen": "Cercospora arachidicola",

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
