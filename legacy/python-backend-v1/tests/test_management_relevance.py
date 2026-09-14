from src.engine.risk_engine import get_management_relevance


def test_relevancia_em_campo():
    result = get_management_relevance("em_campo")

    assert result["status"] == "ATIVA"
    assert "decisão de manejo" in result["description"]


def test_relevancia_pre_arranquio():
    result = get_management_relevance("pre_arranquio")

    assert result["status"] == "CONDICIONAL"
    assert "custo-benefício" in result["description"]


def test_relevancia_arrancado():
    result = get_management_relevance("arrancado")

    assert result["status"] == "ENCERRADA PARA DOENÇA FOLIAR"
    assert "mancha-preta deixa de ser prioridade" in result["description"]


def test_relevancia_colhido():
    result = get_management_relevance("colhido")

    assert result["status"] == "ENCERRADA"
    assert "histórico da safra" in result["description"]


def test_relevancia_status_invalido():
    result = get_management_relevance("teste_invalido")

    assert result["status"] == "DESCONHECIDA"
    assert "Status da lavoura inválido" in result["description"]