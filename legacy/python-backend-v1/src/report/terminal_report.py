SEPARATOR_WIDTH = 60


def format_float(value, decimals: int = 1) -> str:
    if value is None:
        return "N/A"

    return f"{value:.{decimals}f}"


def print_separator(character: str = "-") -> None:
    print(character * SEPARATOR_WIDTH)


def format_temperature_range(features: dict) -> str:
    temperature_range = features.get(
        "favorable_temperature_range",
        {"minimum": 20.0, "maximum": 26.0},
    )

    minimum = format_float(temperature_range["minimum"], decimals=0)
    maximum = format_float(temperature_range["maximum"], decimals=0)

    return f"{minimum}-{maximum} C"


def print_scores(scores: dict) -> None:
    print(f"Temperatura: {scores['temperature']}/20")
    print(f"Molhamento foliar: {scores['leaf_wetness']}/25")
    print(f"Chuva 7 dias: {scores['rainfall_7d']}/20")
    print(f"Chuva 40 dias: {scores['rainfall_40d']}/15")
    print(f"Ponto de orvalho: {scores['dew_point']}/10")
    print(f"Radiacao/Vento/Secagem: {scores['drying']}/10")


def print_reasons(reasons: list[str]) -> None:
    if reasons:
        for reason in reasons:
            print(f"- {reason}")
    else:
        print("- Nenhum fator critico dominante foi detectado.")


def print_terminal_report(result: dict) -> None:
    talhao = result["talhao"]

    risk = result["risk"]
    features = risk["features"]
    scores = risk["scores"]
    actions = result["actions"]

    forecast_risk = result.get("forecast_risk")
    management_relevance = result.get("management_relevance")

    temp_summary = features["temperature_summary"]
    disease_name = risk["disease"]
    temperature_range_label = format_temperature_range(features)

    print()
    print_separator("=")
    print("MOTOR DE RISCO FITOSSANITARIO - V0.2")
    print(f"DOENCA: {disease_name.upper()}")
    print_separator("=")

    print()
    print("TALHAO")
    print_separator()
    print(f"Nome: {talhao['nome']}")
    print(f"Cidade: {talhao['cidade']}")
    print(f"Cultura: {talhao['cultura']}")
    print(f"Doenca-alvo: {talhao['doenca_alvo']}")
    print(f"Patogeno: {risk['pathogen']}")
    print(f"Status da lavoura: {talhao.get('status_lavoura', 'em_campo')}")
    print(f"Dias apos plantio: {features['days_after_planting']}")
    print(f"Estagio da cultura: {features['crop_stage']}")
    print(f"Fator agronomico aplicado: {features['crop_stage_factor']}")
    print(f"Observacao: {features['crop_stage_description']}")

    print()
    print("VARIAVEIS CLIMATICAS DERIVADAS - PERIODO RECENTE")
    print_separator()
    print(f"Horas com temperatura favoravel {temperature_range_label}: {features['temperature_favorable_hours']} h")
    print(f"Temperatura media: {format_float(temp_summary['average'])} C")
    print(f"Temperatura minima: {format_float(temp_summary['minimum'])} C")
    print(f"Temperatura maxima: {format_float(temp_summary['maximum'])} C")
    print(f"Maior molhamento foliar estimado: {features['leaf_wetness_hours']} h")
    print(f"Dias com chuva > 2,5 mm nos ultimos 7 dias: {features['rainy_days_7d']}")
    print(f"Chuva acumulada nos ultimos 40 dias: {format_float(features['rainfall_40d_mm'])} mm")
    print(f"Menor diferenca T - ponto de orvalho: {format_float(features['min_dew_point_difference'])} C")
    print(f"Horas com baixa condicao de secagem foliar: {features['low_drying_hours']} h")

    print()
    print("PONTUACAO - RISCO RECENTE")
    print_separator()
    print_scores(scores)

    print()
    print("RESULTADO - RISCO RECENTE")
    print_separator()
    print(f"INDICE CLIMATICO BRUTO: {risk['climate_risk_index']}/100")
    print(f"CLASSIFICACAO CLIMATICA: {risk['climate_risk_class']}")
    print(f"INDICE AGRONOMICO FINAL: {risk['risk_index']}/100")
    print(f"CLASSIFICACAO FINAL: {risk['risk_class']}")

    if management_relevance:
        print(f"RELEVANCIA DE MANEJO: {management_relevance['status']}")
        print(f"INTERPRETACAO OPERACIONAL: {management_relevance['description']}")

    print()
    print("MOTIVOS DO RISCO RECENTE")
    print_separator()
    print_reasons(risk["reasons"])

    if forecast_risk:
        forecast_features = forecast_risk["features"]
        forecast_scores = forecast_risk["scores"]
        forecast_temp_summary = forecast_features["temperature_summary"]
        forecast_temperature_range_label = format_temperature_range(forecast_features)

        print()
        print_separator("=")
        print("TENDENCIA FUTURA - PROXIMOS DIAS")
        print_separator("=")

        print()
        print("VARIAVEIS CLIMATICAS DERIVADAS - PREVISAO")
        print_separator()
        print(f"Horas com temperatura favoravel {forecast_temperature_range_label}: {forecast_features['temperature_favorable_hours']} h")
        print(f"Temperatura media prevista: {format_float(forecast_temp_summary['average'])} C")
        print(f"Temperatura minima prevista: {format_float(forecast_temp_summary['minimum'])} C")
        print(f"Temperatura maxima prevista: {format_float(forecast_temp_summary['maximum'])} C")
        print(f"Maior molhamento foliar estimado previsto: {forecast_features['leaf_wetness_hours']} h")
        print(f"Dias com chuva > 2,5 mm na previsao: {forecast_features['rainy_days_7d']}")
        print(f"Chuva acumulada nos ultimos 40 dias: {format_float(forecast_features['rainfall_40d_mm'])} mm")
        print(f"Menor diferenca T - ponto de orvalho prevista: {format_float(forecast_features['min_dew_point_difference'])} C")
        print(f"Horas com baixa condicao de secagem foliar prevista: {forecast_features['low_drying_hours']} h")

        print()
        print("PONTUACAO - RISCO PREVISTO")
        print_separator()
        print_scores(forecast_scores)

        print()
        print("RESULTADO - RISCO PREVISTO")
        print_separator()
        print(f"INDICE CLIMATICO PREVISTO: {forecast_risk['climate_risk_index']}/100")
        print(f"CLASSIFICACAO CLIMATICA PREVISTA: {forecast_risk['climate_risk_class']}")
        print(f"INDICE AGRONOMICO PREVISTO: {forecast_risk['risk_index']}/100")
        print(f"CLASSIFICACAO FINAL PREVISTA: {forecast_risk['risk_class']}")

        if management_relevance:
            print(f"RELEVANCIA DE MANEJO: {management_relevance['status']}")

        print()
        print("MOTIVOS DO RISCO PREVISTO")
        print_separator()
        print_reasons(forecast_risk["reasons"])

    print()
    print_separator("=")
    print("ACAO RECOMENDADA")
    print_separator("=")

    for index, action in enumerate(actions, start=1):
        print(f"{index}. {action}")

    print()
    print_separator("=")
    print()
