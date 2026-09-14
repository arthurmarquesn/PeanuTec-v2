import pytest

from src.features.brown_spot_stage_features import get_brown_spot_stage_factor


def test_brown_spot_fase_inicial():
    result = get_brown_spot_stage_factor(25)

    assert result["factor"] == pytest.approx(0.30)
    assert result["stage"] == "Fase inicial"


def test_brown_spot_inicio_atencao():
    result = get_brown_spot_stage_factor(40)

    assert result["factor"] == pytest.approx(0.70)
    assert result["stage"] == "Início de atenção para mancha-castanha"


def test_brown_spot_fase_critica():
    result = get_brown_spot_stage_factor(90)

    assert result["factor"] == pytest.approx(1.00)
    assert result["stage"] == "Fase crítica para mancha-castanha"


def test_brown_spot_fase_avancada():
    result = get_brown_spot_stage_factor(130)

    assert result["factor"] == pytest.approx(0.90)
    assert result["stage"] == "Fase avançada com atenção"


def test_brown_spot_reducao_relevancia():
    result = get_brown_spot_stage_factor(131)

    assert result["factor"] == pytest.approx(0.60)
    assert result["stage"] == "Possível redução de relevância para mancha-castanha"


def test_brown_spot_data_plantio_invalida():
    result = get_brown_spot_stage_factor(-1)

    assert result["factor"] == pytest.approx(0.0)
    assert result["stage"] == "Data de plantio inválida"
