import json
from pathlib import Path
from uuid import uuid4

from src.database.models import AnalysisHistory
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_ANALYSIS_HISTORY_FILE = Path("outputs/analysis_history.json")
ANALYSIS_HISTORY_FILE = DEFAULT_ANALYSIS_HISTORY_FILE


def _use_json_storage() -> bool:
    return should_use_json_storage(
        ANALYSIS_HISTORY_FILE,
        DEFAULT_ANALYSIS_HISTORY_FILE,
    )


def _analysis_history_to_dict(record: AnalysisHistory) -> dict:
    history = {
        "id": record.id,
        "field_id": record.field_id,
        "field_name": record.field_name,
        "city": record.city,
        "disease": record.disease,
        "pathogen": record.pathogen,
        "generated_at": record.generated_at,
        "climate_index": record.climate_risk_index,
        "agronomic_index": record.agronomic_risk_index,
        "classification": record.classification,
        "management_relevance": record.management_relevance,
        "main_action": record.main_action,
        "raw_compact_analysis": record.result_json,
    }

    if record.created_at is not None:
        history["created_at"] = record.created_at

    return history


def _analysis_history_from_dict(record: dict) -> AnalysisHistory:
    return AnalysisHistory(
        id=record["id"],
        field_id=record["field_id"],
        field_name=record["field_name"],
        city=record.get("city"),
        disease=record["disease"],
        pathogen=record.get("pathogen"),
        generated_at=record.get("generated_at") or record.get("created_at"),
        climate_risk_index=record.get("climate_index")
        or record.get("climate_risk_index"),
        agronomic_risk_index=record.get("agronomic_index")
        or record.get("agronomic_risk_index"),
        classification=record.get("classification"),
        management_relevance=record.get("management_relevance"),
        main_action=record.get("main_action"),
        result_json=record.get("raw_compact_analysis") or record.get("result_json"),
        created_at=record.get("created_at"),
    )


def _load_analysis_history_json() -> list[dict]:
    if not ANALYSIS_HISTORY_FILE.exists():
        return []

    with open(ANALYSIS_HISTORY_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_analysis_history_json(history: list[dict]) -> None:
    ANALYSIS_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(ANALYSIS_HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(history, file, ensure_ascii=False, indent=2)


def load_analysis_history() -> list[dict]:
    if _use_json_storage():
        return _load_analysis_history_json()

    with database_session_scope() as session:
        history = session.query(AnalysisHistory).all()
        return [_analysis_history_to_dict(record) for record in history]


def save_analysis_history(history: list[dict]) -> None:
    if _use_json_storage():
        _save_analysis_history_json(history)
        return

    with database_session_scope() as session:
        session.query(AnalysisHistory).delete()
        session.add_all([_analysis_history_from_dict(record) for record in history])


def create_analysis_history_record(
    field_id: str,
    field_name: str,
    compact_analysis: dict,
) -> dict:
    risk = compact_analysis["risk"]
    management_relevance = compact_analysis["management_relevance"]["status"]
    actions = compact_analysis.get("actions", [])

    record = {
        "id": str(uuid4()),
        "field_id": field_id,
        "field_name": field_name,
        "city": compact_analysis["field"]["city"],
        "disease": compact_analysis["disease"],
        "pathogen": compact_analysis["pathogen"],
        "generated_at": compact_analysis["generated_at"],
        "climate_index": risk["climate_index"],
        "agronomic_index": risk["agronomic_index"],
        "classification": risk["classification"],
        "management_relevance": management_relevance,
        "main_action": actions[0] if actions else None,
        "raw_compact_analysis": compact_analysis,
    }

    if _use_json_storage():
        history = load_analysis_history()
        history.append(record)
        save_analysis_history(history)
        return record

    with database_session_scope() as session:
        session.add(_analysis_history_from_dict(record))

    return record


def list_analysis_history_by_field(field_id: str) -> list[dict]:
    return [
        record
        for record in load_analysis_history()
        if record["field_id"] == field_id
    ]
