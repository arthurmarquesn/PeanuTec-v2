import pytest

from src.features.crop_stage_features import get_crop_stage_factor


def test_fase_inicial():
    result = get_crop_stage_factor(20)

    assert result["factor"] == pytest.approx(0.30)
    assert result["stage"] == "Fase inicial"


def test_inicio_atencao_fitossanitaria():
    result = get_crop_stage_factor(40)

    assert result["factor"] == pytest.approx(0.60)
    assert result["stage"] == "Início de atenção fitossanitária"


def test_desenvolvimento_vegetativo_florescimento():
    result = get_crop_stage_factor(65)

    assert result["factor"] == pytest.approx(0.85)
    assert result["stage"] == "Desenvolvimento vegetativo / florescimento"


def test_fase_critica():
    result = get_crop_stage_factor(81)

    assert result["factor"] == pytest.approx(1.00)
    assert result["stage"] == "Fase crítica"


def test_final_ciclo_alta_atencao():
    result = get_crop_stage_factor(124)

    assert result["factor"] == pytest.approx(1.10)
    assert result["stage"] == "Final de ciclo com alta atenção"


def test_final_avancado_ciclo():
    result = get_crop_stage_factor(155)

    assert result["factor"] == pytest.approx(0.90)
    assert result["stage"] == "Final avançado de ciclo"


def test_pos_janela_manejo():
    result = get_crop_stage_factor(170)

    assert result["factor"] == pytest.approx(0.50)
    assert result["stage"] == "Possível pós-janela de manejo"


def test_data_plantio_invalida():
    result = get_crop_stage_factor(-1)

    assert result["factor"] == pytest.approx(0.0)
    assert result["stage"] == "Data de plantio inválida"