from src.engine.action_recommender import recommend_action


def test_em_campo_com_risco_critico_recomenda_inspecao_prioritaria():
    actions = recommend_action(
        risk_class="CRÍTICO",
        infection_window_detected=True,
        climate_risk_class="CRÍTICO",
        crop_stage="Fase crítica",
        crop_stage_factor=1.0,
        crop_status="em_campo",
    )

    joined_actions = " ".join(actions)

    assert "Realizar inspeção prioritária" in joined_actions
    assert "responsável técnico" in joined_actions
    assert "janela climática compatível com infecção" in joined_actions


def test_pre_arranquio_recomenda_cautela_e_custo_beneficio():
    actions = recommend_action(
        risk_class="CRÍTICO",
        infection_window_detected=True,
        climate_risk_class="CRÍTICO",
        crop_stage="Final avançado de ciclo",
        crop_stage_factor=0.9,
        crop_status="pre_arranquio",
    )

    joined_actions = " ".join(actions)

    assert "pré-arranquio" in joined_actions
    assert "tempo restante até o arranquio" in joined_actions
    assert "custo-benefício" in joined_actions


def test_arrancado_nao_recomenda_manejo_foliar():
    actions = recommend_action(
        risk_class="CRÍTICO",
        infection_window_detected=True,
        climate_risk_class="CRÍTICO",
        crop_stage="Final avançado de ciclo",
        crop_stage_factor=0.9,
        crop_status="arrancado",
    )

    joined_actions = " ".join(actions)

    assert "arrancada" in joined_actions
    assert "Doenças foliares já não são prioridade" in joined_actions
    assert "Evitar recomendação de aplicação" in joined_actions


def test_colhido_registra_apenas_historico():
    actions = recommend_action(
        risk_class="CRÍTICO",
        infection_window_detected=True,
        climate_risk_class="CRÍTICO",
        crop_stage="Final avançado de ciclo",
        crop_stage_factor=0.9,
        crop_status="colhido",
    )

    joined_actions = " ".join(actions)

    assert "colhida" in joined_actions
    assert "não possui relevância de manejo" in joined_actions
    assert "histórico da safra" in joined_actions


def test_status_invalido_bloqueia_interpretacao_operacional():
    actions = recommend_action(
        risk_class="CRÍTICO",
        infection_window_detected=True,
        climate_risk_class="CRÍTICO",
        crop_stage="Fase crítica",
        crop_stage_factor=1.0,
        crop_status="teste_invalido",
    )

    joined_actions = " ".join(actions)

    assert "Status da lavoura desconhecido" in joined_actions
    assert "em_campo" in joined_actions
    assert "pre_arranquio" in joined_actions
    assert "arrancado" in joined_actions
    assert "colhido" in joined_actions