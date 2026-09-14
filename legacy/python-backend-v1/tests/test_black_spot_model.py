from src.disease.black_spot_model import calculate_black_spot_risk


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

        "temperature_favorable_hours": temperature_favorable_hours,
        "temperature_summary": {
            "average": 19.7,
            "minimum": 13.4,
            "maximum": 27.9,
        },
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


def test_climate_risk_index_soma_dos_scores():
    features = make_features()

    result = calculate_black_spot_risk(features)

    assert result["climate_risk_index"] == 85
    assert result["climate_risk_class"] == "CRÍTICO"


def test_doenca_e_patogeno_corretos():
    result = calculate_black_spot_risk(make_features())

    assert result["disease"] == "Mancha-preta do amendoim"
    assert result["pathogen"] == "Cercosporidium personatum / Nothopassalora personata"


def test_fase_inicial_reduz_risco_agronomico():
    features = make_features(
        crop_stage_factor=0.30,
        crop_stage="Fase inicial",
    )

    result = calculate_black_spot_risk(features)

    assert result["climate_risk_index"] == 85
    assert result["risk_index"] == 26
    assert result["risk_class"] == "MODERADO"


def test_fase_critica_mantem_risco_climatico():
    features = make_features(
        crop_stage_factor=1.00,
        crop_stage="Fase crítica",
    )

    result = calculate_black_spot_risk(features)

    assert result["climate_risk_index"] == 85
    assert result["risk_index"] == 85
    assert result["risk_class"] == "CRÍTICO"


def test_final_alta_atencao_aumenta_risco_agronomico():
    features = make_features(
        crop_stage_factor=1.10,
        crop_stage="Final de ciclo com alta atenção",
    )

    result = calculate_black_spot_risk(features)

    assert result["climate_risk_index"] == 85
    assert result["risk_index"] == 94
    assert result["risk_class"] == "CRÍTICO"


def test_risco_agronomico_nao_passa_de_100():
    features = make_features(
        crop_stage_factor=1.10,
        temperature_score=20,
        leaf_wetness_score=25,
        rainfall_7d_score=20,
        rainfall_40d_score=15,
        dew_point_score=10,
        drying_score=10,
    )

    result = calculate_black_spot_risk(features)

    assert result["climate_risk_index"] == 100
    assert result["risk_index"] == 100
    assert result["risk_class"] == "CRÍTICO"


def test_detecta_janela_climatica_de_infeccao():
    features = make_features(
        temperature_favorable_hours=56,
        leaf_wetness_hours=15,
    )

    result = calculate_black_spot_risk(features)

    assert result["infection_window_detected"] is True


def test_nao_detecta_janela_de_infeccao_sem_molhamento_suficiente():
    features = make_features(
        temperature_favorable_hours=56,
        leaf_wetness_hours=5,
        leaf_wetness_score=0,
    )

    result = calculate_black_spot_risk(features)

    assert result["infection_window_detected"] is False
