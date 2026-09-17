from __future__ import annotations


def get_crop_stage_factor(days_after_planting: int) -> dict[str, object]:
    if days_after_planting < 0:
        return {
            "factor": 0.0,
            "stage": "Data de plantio inválida",
            "description": "A data de plantio está no futuro.",
        }
    if days_after_planting <= 30:
        return {
            "factor": 0.30,
            "stage": "Fase inicial",
            "description": "A cultura ainda está em fase inicial; risco econômico da mancha-preta reduzido.",
        }
    if days_after_planting <= 45:
        return {
            "factor": 0.60,
            "stage": "Início de atenção fitossanitária",
            "description": "A cultura começa a entrar em fase de atenção para doenças foliares.",
        }
    if days_after_planting <= 70:
        return {
            "factor": 0.85,
            "stage": "Desenvolvimento vegetativo / florescimento",
            "description": "A cultura já apresenta maior sensibilidade a doenças foliares.",
        }
    if days_after_planting <= 110:
        return {
            "factor": 1.00,
            "stage": "Fase crítica",
            "description": "A cultura está em fase de alto interesse para monitoramento da mancha-preta.",
        }
    if days_after_planting <= 140:
        return {
            "factor": 1.10,
            "stage": "Final de ciclo com alta atenção",
            "description": "A mancha-preta pode ter grande impacto por desfolha no final do ciclo.",
        }
    if days_after_planting <= 160:
        return {
            "factor": 0.90,
            "stage": "Final avançado de ciclo",
            "description": "A doença ainda pode ser relevante, mas a decisão de manejo depende da proximidade do arranquio/colheita.",
        }
    return {
        "factor": 0.50,
        "stage": "Possível pós-janela de manejo",
        "description": "A cultura pode estar fora da principal janela de manejo químico; confirmar estágio real da lavoura.",
    }


def get_brown_spot_stage_factor(days_after_planting: int) -> dict[str, object]:
    if days_after_planting < 0:
        return {
            "factor": 0.0,
            "stage": "Data de plantio inválida",
            "description": "A data de plantio está no futuro.",
        }
    if days_after_planting <= 25:
        return {
            "factor": 0.30,
            "stage": "Fase inicial",
            "description": "A cultura ainda está em fase inicial; risco econômico da mancha-castanha reduzido.",
        }
    if days_after_planting <= 40:
        return {
            "factor": 0.70,
            "stage": "Início de atenção para mancha-castanha",
            "description": "A cultura entra em fase de atenção para mancha-castanha.",
        }
    if days_after_planting <= 90:
        return {
            "factor": 1.00,
            "stage": "Fase crítica para mancha-castanha",
            "description": "A cultura está na principal janela de monitoramento da mancha-castanha.",
        }
    if days_after_planting <= 130:
        return {
            "factor": 0.90,
            "stage": "Fase avançada com atenção",
            "description": "A doença ainda pode ser relevante, com atenção ao estágio real da lavoura.",
        }
    return {
        "factor": 0.60,
        "stage": "Possível redução de relevância para mancha-castanha",
        "description": "A lavoura pode estar em fase de menor relevância para manejo de mancha-castanha.",
    }
