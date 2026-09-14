import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.database.models import (  # noqa: E402
    AnalysisHistory,
    CalendarEvent,
    Field,
    Inspection,
    Product,
    SprayApplication,
    User,
)
from src.database.session import initialize_database, session_scope  # noqa: E402
from src.repositories.analysis_history_repository import (  # noqa: E402
    _analysis_history_from_dict,
)
from src.repositories.calendar_events_repository import _calendar_event_from_dict  # noqa: E402
from src.repositories.fields_repository import _field_from_dict  # noqa: E402
from src.repositories.inspections_repository import _inspection_from_dict  # noqa: E402
from src.repositories.products_repository import _product_from_dict  # noqa: E402
from src.repositories.spray_applications_repository import (  # noqa: E402
    _spray_application_from_dict,
)
from src.repositories.users_repository import _user_from_dict  # noqa: E402


OUTPUTS_DIR = PROJECT_ROOT / "outputs"


def load_json_file(path: Path) -> list[dict]:
    if not path.exists():
        return []

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def insert_missing_records(session, model, records: list[dict], factory) -> int:
    migrated_count = 0

    for record in records:
        record_id = record.get("id")

        if not record_id or session.get(model, record_id) is not None:
            continue

        session.add(factory(record))
        migrated_count += 1

    return migrated_count


def main() -> None:
    initialize_database()

    sources = [
        (
            "usuarios",
            User,
            OUTPUTS_DIR / "users.json",
            _user_from_dict,
        ),
        (
            "talhoes",
            Field,
            OUTPUTS_DIR / "fields.json",
            _field_from_dict,
        ),
        (
            "inspecoes",
            Inspection,
            OUTPUTS_DIR / "inspections.json",
            _inspection_from_dict,
        ),
        (
            "pulverizacoes",
            SprayApplication,
            OUTPUTS_DIR / "spray_applications.json",
            _spray_application_from_dict,
        ),
        (
            "eventos",
            CalendarEvent,
            OUTPUTS_DIR / "calendar_events.json",
            _calendar_event_from_dict,
        ),
        (
            "produtos",
            Product,
            OUTPUTS_DIR / "products.json",
            _product_from_dict,
        ),
        (
            "analises",
            AnalysisHistory,
            OUTPUTS_DIR / "analysis_history.json",
            _analysis_history_from_dict,
        ),
    ]

    summary = {}

    with session_scope() as session:
        for label, model, path, factory in sources:
            records = load_json_file(path)
            summary[label] = insert_missing_records(session, model, records, factory)

    print(f"usuarios migrados: {summary['usuarios']}")
    print(f"talhoes migrados: {summary['talhoes']}")
    print(f"inspecoes migradas: {summary['inspecoes']}")
    print(f"pulverizacoes migradas: {summary['pulverizacoes']}")
    print(f"eventos migrados: {summary['eventos']}")
    print(f"produtos migrados: {summary['produtos']}")
    print(f"analises migradas: {summary['analises']}")


if __name__ == "__main__":
    main()
