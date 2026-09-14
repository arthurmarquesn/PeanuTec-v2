import json
from pathlib import Path

from src.database.models import SprayApplication
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_SPRAY_APPLICATIONS_FILE = Path("outputs/spray_applications.json")
SPRAY_APPLICATIONS_FILE = DEFAULT_SPRAY_APPLICATIONS_FILE


def _use_json_storage() -> bool:
    return should_use_json_storage(
        SPRAY_APPLICATIONS_FILE,
        DEFAULT_SPRAY_APPLICATIONS_FILE,
    )


def _spray_application_to_dict(spray_application: SprayApplication) -> dict:
    record = {
        "id": spray_application.id,
        "field_id": spray_application.field_id,
        "field_name": spray_application.field_name,
        "application_date": spray_application.application_date,
        "product_id": spray_application.product_id,
        "product": spray_application.product,
        "target": spray_application.target,
        "dose": spray_application.dose,
        "responsible": spray_application.responsible,
        "planned_interval_days": spray_application.planned_interval_days,
        "days_since_application": spray_application.days_since_application,
        "interval_status": spray_application.interval_status,
        "notes": spray_application.notes,
        "generate_reapplication": spray_application.generate_reapplication,
        "reapplication_interval_days": spray_application.reapplication_interval_days,
        "reapplication_date": spray_application.reapplication_date,
        "reapplication_notes": spray_application.reapplication_notes,
        "created_at": spray_application.created_at,
    }

    if spray_application.product_type is not None:
        record["product_type"] = spray_application.product_type

    return record


def _spray_application_from_dict(spray_application: dict) -> SprayApplication:
    return SprayApplication(
        id=spray_application["id"],
        field_id=spray_application["field_id"],
        field_name=spray_application["field_name"],
        application_date=spray_application["application_date"],
        product_id=spray_application.get("product_id"),
        product=spray_application["product"],
        product_type=spray_application.get("product_type"),
        target=spray_application["target"],
        dose=spray_application["dose"],
        responsible=spray_application.get("responsible", ""),
        planned_interval_days=spray_application["planned_interval_days"],
        days_since_application=spray_application.get("days_since_application"),
        interval_status=spray_application.get("interval_status"),
        notes=spray_application.get("notes", ""),
        generate_reapplication=spray_application.get("generate_reapplication", False),
        reapplication_interval_days=spray_application.get(
            "reapplication_interval_days"
        ),
        reapplication_date=spray_application.get("reapplication_date"),
        reapplication_notes=spray_application.get("reapplication_notes"),
        created_at=spray_application.get("created_at"),
    )


def _load_spray_applications_json() -> list[dict]:
    if not SPRAY_APPLICATIONS_FILE.exists():
        return []

    with open(SPRAY_APPLICATIONS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_spray_applications_json(spray_applications: list[dict]) -> None:
    SPRAY_APPLICATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(SPRAY_APPLICATIONS_FILE, "w", encoding="utf-8") as file:
        json.dump(spray_applications, file, ensure_ascii=False, indent=2)


def load_spray_applications() -> list[dict]:
    if _use_json_storage():
        return _load_spray_applications_json()

    with database_session_scope() as session:
        spray_applications = session.query(SprayApplication).all()
        return [
            _spray_application_to_dict(spray_application)
            for spray_application in spray_applications
        ]


def save_spray_applications(spray_applications: list[dict]) -> None:
    if _use_json_storage():
        _save_spray_applications_json(spray_applications)
        return

    with database_session_scope() as session:
        session.query(SprayApplication).delete()
        session.add_all(
            [
                _spray_application_from_dict(spray_application)
                for spray_application in spray_applications
            ]
        )


def list_spray_applications_by_field(field_id: str) -> list[dict]:
    return [
        spray_application
        for spray_application in load_spray_applications()
        if spray_application["field_id"] == field_id
    ]


def create_spray_application(spray_application: dict) -> dict:
    if _use_json_storage():
        spray_applications = load_spray_applications()
        spray_applications.append(spray_application)
        save_spray_applications(spray_applications)
        return spray_application

    with database_session_scope() as session:
        session.add(_spray_application_from_dict(spray_application))

    return spray_application
