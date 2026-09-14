def recommend_action(
    risk_class: str,
    infection_window_detected: bool,
    climate_risk_class: str | None = None,
    crop_stage: str | None = None,
    crop_stage_factor: float = 1.0,
    crop_status: str = "em_campo",
    disease_name: str = "Mancha-preta",
) -> list[str]:
    high_risk_classes = ["ALTO", "CRÃTICO", "CRÍTICO"]
    climate_is_high = climate_risk_class in high_risk_classes
    stage_was_adjusted = crop_stage_factor != 1.0
    disease_label = disease_name.lower()

    if crop_status == "colhido":
        return [
            "A lavoura está marcada como colhida.",
            f"O risco de {disease_label} não possui relevância de manejo para a safra atual.",
            "Registrar o evento climático apenas como histórico da safra.",
            "Usar os dados para calibração futura do modelo.",
        ]

    if crop_status == "arrancado":
        return [
            "A lavoura está marcada como arrancada.",
            "Doenças foliares já não são prioridade de manejo químico neste estágio.",
            f"Evitar recomendação de aplicação para {disease_label}.",
            "Registrar o risco climático como histórico e acompanhar condições de secagem/colheita.",
        ]

    if crop_status == "pre_arranquio":
        actions = [
            "A lavoura está em pré-arranquio.",
            "Confirmar o tempo restante até o arranquio antes de qualquer decisão de manejo.",
        ]

        if climate_is_high:
            actions.append(
                f"O risco climático está alto/crítico, indicando ambiente favorável à {disease_label}."
            )

        if risk_class in high_risk_classes:
            actions.append("Realizar inspeção no talhão para verificar severidade e desfolha.")
            actions.append(
                "Avaliar custo-benefício de qualquer intervenção com responsável técnico, "
                "considerando a proximidade do arranquio."
            )
        else:
            actions.append("Manter acompanhamento, mas evitar decisão de manejo sem confirmação de campo.")

        if infection_window_detected:
            actions.append(
                "Foi detectada janela climática compatível com infecção; "
                "caso ainda exista janela produtiva, priorizar inspeção."
            )

        return actions

    if crop_status != "em_campo":
        return [
            f"Status da lavoura desconhecido: {crop_status}.",
            "Usar preferencialmente: em_campo, pre_arranquio, arrancado ou colhido.",
            "Confirmar o status real da lavoura antes de interpretar a recomendação.",
        ]

    # Status: em_campo
    if risk_class == "BAIXO":
        return [
            "Manter acompanhamento climático.",
            "Não há indicação de condição crítica no momento.",
            "Continuar registrando dados para histórico do talhão.",
        ]

    if risk_class == "MODERADO":
        actions = [
            "Monitorar o talhão nos próximos dias.",
            "Observar evolução de umidade, chuva e temperatura.",
            "Registrar qualquer sintoma inicial nas folhas.",
            "Acompanhar se o risco previsto aumenta nos próximos dias.",
        ]

        if climate_is_high and stage_was_adjusted:
            actions.insert(
                0,
                f"O clima apresentou condição favorável à {disease_label}, mas o risco final foi ajustado pelo estágio da cultura."
            )

        return actions

    if risk_class == "ALTO":
        actions = [
            "Intensificar inspeção no talhão.",
            "Registrar fotos das folhas em pontos diferentes da área.",
            "Verificar histórico de aplicações.",
            "Acompanhar previsão climática dos próximos dias.",
            "Avaliar necessidade de manejo com responsável técnico.",
        ]

        if stage_was_adjusted and crop_stage:
            actions.insert(
                0,
                f"O estágio da cultura foi considerado no cálculo: {crop_stage}."
            )

        return actions

    if risk_class in ["CRÃTICO", "CRÍTICO"]:
        actions = [
            "Realizar inspeção prioritária no talhão.",
            "Registrar evidências visuais das folhas em diferentes pontos da área.",
            "Verificar histórico de aplicações de fungicida.",
            "Avaliar manejo com responsável técnico com prioridade.",
            f"Considerar que o ambiente recente foi altamente favorável à {disease_label}.",
        ]

        if crop_stage:
            actions.append(f"Estágio considerado pelo modelo: {crop_stage}.")

        if infection_window_detected:
            actions.append(
                "Foi detectada janela climática compatível com infecção. "
                "Sintomas podem aparecer posteriormente, portanto a inspeção deve ser antecipada."
            )

        return actions

    return ["Classificação de risco desconhecida. Revisar entrada de dados."]
