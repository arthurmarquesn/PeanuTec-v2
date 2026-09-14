def get_crop_stage_factor(days_after_planting: int) -> dict:
    """
    Fator agronômico para mancha-preta do amendoim.

    Ideia central:
    - A mancha-preta tende a ganhar importância no avanço do ciclo.
    - O risco econômico é menor no início.
    - O risco é alto no meio/final do ciclo.
    - Só reduzimos fortemente se a lavoura provavelmente já passou da janela de manejo.
    """

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