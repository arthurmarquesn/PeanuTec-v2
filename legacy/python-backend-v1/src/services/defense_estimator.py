DEFAULT_PLANNED_INTERVAL_DAYS = 12


def calculate_estimated_defense(
    days_since_application: int | None,
    planned_interval_days: int | None,
) -> dict:
    if days_since_application is None:
        return {
            "estimated_defense_percent": None,
            "defense_status": "sem_registro",
        }

    if not planned_interval_days or planned_interval_days <= 0:
        planned_interval_days = DEFAULT_PLANNED_INTERVAL_DAYS

    if days_since_application > planned_interval_days:
        return {
            "estimated_defense_percent": 0,
            "defense_status": "vencida",
        }

    estimated = max(
        0,
        round(100 * (1 - days_since_application / planned_interval_days)),
    )

    if estimated >= 80:
        defense_status = "muito_alta"
    elif estimated >= 60:
        defense_status = "alta"
    elif estimated >= 35:
        defense_status = "media"
    elif estimated >= 10:
        defense_status = "baixa"
    else:
        defense_status = "vencida"

    return {
        "estimated_defense_percent": estimated,
        "defense_status": defense_status,
    }
