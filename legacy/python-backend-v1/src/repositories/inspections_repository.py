import json
from pathlib import Path

from src.database.models import Inspection
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_INSPECTIONS_FILE = Path("outputs/inspections.json")
INSPECTIONS_FILE = DEFAULT_INSPECTIONS_FILE
OPTIONAL_INSPECTION_FIELDS = [
    "general_status",
    "problem_distribution",
    "pests_found",
    "pest_notes",
    "weeds_found",
    "weed_pressure",
    "soil_condition",
    "return_needed",
    "return_days",
    "observed_area",
    "responsible",
]


def _use_json_storage() -> bool:
    return should_use_json_storage(INSPECTIONS_FILE, DEFAULT_INSPECTIONS_FILE)


def _inspection_to_dict(inspection: Inspection) -> dict:
    inspection_dict = {
        "id": inspection.id,
        "field_id": inspection.field_id,
        "field_name": inspection.field_name,
        "disease": inspection.disease,
        "symptoms_found": inspection.symptoms_found,
        "visual_severity": inspection.visual_severity,
        "defoliation_level": inspection.defoliation_level,
        "action_taken": inspection.action_taken,
        "notes": inspection.notes,
        "inspected_at": inspection.inspected_at,
        "created_at": inspection.created_at,
    }

    for field in OPTIONAL_INSPECTION_FIELDS:
        inspection_dict[field] = getattr(inspection, field)

    return inspection_dict


def _inspection_from_dict(inspection: dict) -> Inspection:
    return Inspection(
        id=inspection["id"],
        field_id=inspection["field_id"],
        field_name=inspection["field_name"],
        disease=inspection["disease"],
        symptoms_found=inspection["symptoms_found"],
        visual_severity=inspection["visual_severity"],
        defoliation_level=inspection["defoliation_level"],
        action_taken=inspection["action_taken"],
        notes=inspection.get("notes", ""),
        inspected_at=inspection.get("inspected_at") or inspection.get("inspection_date"),
        created_at=inspection.get("created_at"),
        **{
            field: inspection.get(field)
            for field in OPTIONAL_INSPECTION_FIELDS
        },
    )


def normalize_inspection_record(inspection: dict) -> dict:
    return {
        **inspection,
        **{
            field: inspection.get(field)
            for field in OPTIONAL_INSPECTION_FIELDS
        },
    }


def _load_inspections_json() -> list[dict]:
    if not INSPECTIONS_FILE.exists():
        return []

    with open(INSPECTIONS_FILE, "r", encoding="utf-8") as file:
        return [
            normalize_inspection_record(inspection)
            for inspection in json.load(file)
        ]


def _save_inspections_json(inspections: list[dict]) -> None:
    INSPECTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(INSPECTIONS_FILE, "w", encoding="utf-8") as file:
        json.dump(inspections, file, ensure_ascii=False, indent=2)


def load_inspections() -> list[dict]:
    if _use_json_storage():
        return _load_inspections_json()

    with database_session_scope() as session:
        inspections = session.query(Inspection).all()
        return [_inspection_to_dict(inspection) for inspection in inspections]


def save_inspections(inspections: list[dict]) -> None:
    if _use_json_storage():
        _save_inspections_json(inspections)
        return

    with database_session_scope() as session:
        session.query(Inspection).delete()
        session.add_all(
            [_inspection_from_dict(inspection) for inspection in inspections]
        )


def list_inspections_by_field(field_id: str) -> list[dict]:
    return [
        normalize_inspection_record(inspection)
        for inspection in load_inspections()
        if inspection["field_id"] == field_id
    ]


def create_inspection(inspection: dict) -> dict:
    inspection = normalize_inspection_record(inspection)

    if _use_json_storage():
        inspections = load_inspections()
        inspections.append(inspection)
        save_inspections(inspections)
        return inspection

    with database_session_scope() as session:
        session.add(_inspection_from_dict(inspection))

    return inspection
