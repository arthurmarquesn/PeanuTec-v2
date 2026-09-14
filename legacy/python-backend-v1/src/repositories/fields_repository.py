import json
from pathlib import Path

from src.database.models import Field
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_FIELDS_FILE = Path("outputs/fields.json")
FIELDS_FILE = DEFAULT_FIELDS_FILE
FIELD_AGRONOMIC_HISTORY_DEFAULTS = {
    "previous_crop": None,
    "crop_rotation": None,
    "peanut_repetition_years": None,
    "had_disease_incidence": None,
    "previous_diseases": None,
    "disease_incidence_level": None,
    "historical_pressure": None,
    "agronomic_history_notes": None,
    "manual_crop_stage": None,
    "crop_stage_updated_at": None,
    "crop_stage_notes": None,
}


def _use_json_storage() -> bool:
    return should_use_json_storage(FIELDS_FILE, DEFAULT_FIELDS_FILE)


def _field_to_dict(field: Field) -> dict:
    record = {
        "id": field.id,
        "nome": field.name,
        "cidade": field.city,
        "latitude": field.latitude,
        "longitude": field.longitude,
        "cultura": field.crop,
        "data_plantio": field.planting_date,
        "status_lavoura": field.crop_status,
        "doencas_monitoradas": field.monitored_diseases or [],
        "previous_crop": field.previous_crop,
        "crop_rotation": field.crop_rotation,
        "peanut_repetition_years": field.peanut_repetition_years,
        "had_disease_incidence": field.had_disease_incidence,
        "previous_diseases": field.previous_diseases,
        "disease_incidence_level": field.disease_incidence_level,
        "historical_pressure": field.historical_pressure,
        "agronomic_history_notes": field.agronomic_history_notes,
        "manual_crop_stage": field.manual_crop_stage,
        "crop_stage_updated_at": field.crop_stage_updated_at,
        "crop_stage_notes": field.crop_stage_notes,
    }

    if field.created_at is not None:
        record["created_at"] = field.created_at

    if field.updated_at is not None:
        record["updated_at"] = field.updated_at

    return record


def normalize_field_record(field: dict) -> dict:
    return {
        **FIELD_AGRONOMIC_HISTORY_DEFAULTS,
        **field,
    }


def _field_from_dict(field: dict) -> Field:
    field = normalize_field_record(field)

    return Field(
        id=field["id"],
        name=field["nome"],
        city=field["cidade"],
        latitude=field.get("latitude"),
        longitude=field.get("longitude"),
        crop=field["cultura"],
        planting_date=field["data_plantio"],
        crop_status=field["status_lavoura"],
        monitored_diseases=field.get("doencas_monitoradas", []),
        previous_crop=field.get("previous_crop"),
        crop_rotation=field.get("crop_rotation"),
        peanut_repetition_years=field.get("peanut_repetition_years"),
        had_disease_incidence=field.get("had_disease_incidence"),
        previous_diseases=field.get("previous_diseases"),
        disease_incidence_level=field.get("disease_incidence_level"),
        historical_pressure=field.get("historical_pressure"),
        agronomic_history_notes=field.get("agronomic_history_notes"),
        manual_crop_stage=field.get("manual_crop_stage"),
        crop_stage_updated_at=field.get("crop_stage_updated_at"),
        crop_stage_notes=field.get("crop_stage_notes"),
        created_at=field.get("created_at"),
        updated_at=field.get("updated_at"),
    )


def _load_fields_json() -> list[dict]:
    if not FIELDS_FILE.exists():
        return []

    with open(FIELDS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_fields_json(fields: list[dict]) -> None:
    FIELDS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(FIELDS_FILE, "w", encoding="utf-8") as file:
        json.dump(fields, file, ensure_ascii=False, indent=2)


def list_fields() -> list[dict]:
    if _use_json_storage():
        return [normalize_field_record(field) for field in _load_fields_json()]

    with database_session_scope() as session:
        fields = session.query(Field).all()
        return [_field_to_dict(field) for field in fields]


def save_fields(fields: list[dict]) -> None:
    if _use_json_storage():
        _save_fields_json(fields)
        return

    with database_session_scope() as session:
        session.query(Field).delete()
        session.add_all([_field_from_dict(field) for field in fields])


def get_field(field_id: str) -> dict | None:
    if _use_json_storage():
        for field in list_fields():
            if field["id"] == field_id:
                return normalize_field_record(field)

        return None

    with database_session_scope() as session:
        field = session.get(Field, field_id)

        if field is None:
            return None

        return _field_to_dict(field)

    return None


def create_field(field: dict) -> dict:
    if _use_json_storage():
        fields = list_fields()
        fields.append(field)
        save_fields(fields)
        return field

    with database_session_scope() as session:
        session.add(_field_from_dict(field))

    return field


def update_field(field_id: str, updated_field: dict) -> dict | None:
    if _use_json_storage():
        fields = list_fields()

        for index, field in enumerate(fields):
            if field["id"] == field_id:
                fields[index] = updated_field
                save_fields(fields)
                return updated_field

        return None

    with database_session_scope() as session:
        current_field = session.get(Field, field_id)

        if current_field is None:
            return None

        session.merge(_field_from_dict(updated_field))
        return updated_field


def delete_field(field_id: str) -> bool:
    if _use_json_storage():
        fields = list_fields()
        remaining_fields = [field for field in fields if field["id"] != field_id]

        if len(remaining_fields) == len(fields):
            return False

        save_fields(remaining_fields)
        return True

    with database_session_scope() as session:
        field = session.get(Field, field_id)

        if field is None:
            return False

        session.delete(field)
        return True
