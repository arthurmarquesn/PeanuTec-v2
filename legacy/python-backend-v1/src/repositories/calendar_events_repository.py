import json
from pathlib import Path

from src.database.models import CalendarEvent
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_CALENDAR_EVENTS_FILE = Path("outputs/calendar_events.json")
CALENDAR_EVENTS_FILE = DEFAULT_CALENDAR_EVENTS_FILE


def _use_json_storage() -> bool:
    return should_use_json_storage(CALENDAR_EVENTS_FILE, DEFAULT_CALENDAR_EVENTS_FILE)


def _calendar_event_to_dict(event: CalendarEvent) -> dict:
    return {
        "id": event.id,
        "event_type": event.event_type,
        "title": event.title,
        "field_id": event.field_id,
        "field_name": event.field_name,
        "date": event.date,
        "end_date": event.end_date,
        "product": event.product,
        "product_type": event.product_type,
        "target": event.target,
        "planned_interval_days": event.planned_interval_days,
        "notes": event.notes,
        "color_key": event.color_key,
        "status": event.status,
        "source_type": event.source_type,
        "source_id": event.source_id,
        "created_at": event.created_at,
    }


def _calendar_event_from_dict(event: dict) -> CalendarEvent:
    return CalendarEvent(
        id=event["id"],
        event_type=event["event_type"],
        title=event["title"],
        field_id=event.get("field_id"),
        field_name=event.get("field_name"),
        date=event["date"],
        end_date=event.get("end_date") or event["date"],
        product=event.get("product", ""),
        product_type=event.get("product_type"),
        target=event.get("target", ""),
        planned_interval_days=event.get("planned_interval_days"),
        notes=event.get("notes", ""),
        color_key=event["color_key"],
        status=event["status"],
        source_type=event.get("source_type"),
        source_id=event.get("source_id"),
        created_at=event.get("created_at"),
    )


def _load_calendar_events_json() -> list[dict]:
    if not CALENDAR_EVENTS_FILE.exists():
        return []

    with open(CALENDAR_EVENTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_calendar_events_json(events: list[dict]) -> None:
    CALENDAR_EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(CALENDAR_EVENTS_FILE, "w", encoding="utf-8") as file:
        json.dump(events, file, ensure_ascii=False, indent=2)


def load_calendar_events() -> list[dict]:
    if _use_json_storage():
        return _load_calendar_events_json()

    with database_session_scope() as session:
        events = session.query(CalendarEvent).all()
        return [_calendar_event_to_dict(event) for event in events]


def save_calendar_events(events: list[dict]) -> None:
    if _use_json_storage():
        _save_calendar_events_json(events)
        return

    with database_session_scope() as session:
        session.query(CalendarEvent).delete()
        session.add_all([_calendar_event_from_dict(event) for event in events])


def list_calendar_events() -> list[dict]:
    return load_calendar_events()


def create_calendar_event(event: dict) -> dict:
    if _use_json_storage():
        events = load_calendar_events()
        events.append(event)
        save_calendar_events(events)
        return event

    with database_session_scope() as session:
        session.add(_calendar_event_from_dict(event))

    return event


def calendar_event_exists(
    source_type: str,
    source_id: str,
    event_type: str,
) -> bool:
    if not _use_json_storage():
        with database_session_scope() as session:
            return (
                session.query(CalendarEvent)
                .filter(
                    CalendarEvent.source_type == source_type,
                    CalendarEvent.source_id == source_id,
                    CalendarEvent.event_type == event_type,
                )
                .first()
                is not None
            )

    return any(
        event.get("source_type") == source_type
        and event.get("source_id") == source_id
        and event.get("event_type") == event_type
        for event in load_calendar_events()
    )
