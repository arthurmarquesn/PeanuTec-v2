def get_brown_spot_stage_factor(days_after_planting: int) -> dict:
    """
    Fator agronômico para mancha-castanha do amendoim.

    A mancha-castanha tende a ter maior relevância no início/meio do ciclo
    em relação à janela usada para mancha-preta.
    """

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
