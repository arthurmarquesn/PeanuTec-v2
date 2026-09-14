"""initial database

Revision ID: 20260618_0001
Revises:
Create Date: 2026-06-18
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260618_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "fields",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("crop", sa.String(length=120), nullable=False),
        sa.Column("planting_date", sa.String(length=32), nullable=False),
        sa.Column("crop_status", sa.String(length=64), nullable=False),
        sa.Column("monitored_diseases", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.String(length=64), nullable=True),
    )

    op.create_table(
        "inspections",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("field_id", sa.String(length=64), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("disease", sa.String(length=255), nullable=False),
        sa.Column("symptoms_found", sa.Boolean(), nullable=False),
        sa.Column("visual_severity", sa.String(length=64), nullable=False),
        sa.Column("defoliation_level", sa.String(length=64), nullable=False),
        sa.Column("action_taken", sa.String(length=120), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("inspected_at", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_inspections_field_id", "inspections", ["field_id"])

    op.create_table(
        "spray_applications",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("field_id", sa.String(length=64), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("application_date", sa.String(length=64), nullable=False),
        sa.Column("product", sa.String(length=255), nullable=False),
        sa.Column("product_type", sa.String(length=64), nullable=True),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("dose", sa.String(length=120), nullable=False),
        sa.Column("responsible", sa.String(length=255), nullable=False),
        sa.Column("planned_interval_days", sa.Integer(), nullable=False),
        sa.Column("days_since_application", sa.Integer(), nullable=True),
        sa.Column("interval_status", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("generate_reapplication", sa.Boolean(), nullable=False),
        sa.Column("reapplication_interval_days", sa.Integer(), nullable=True),
        sa.Column("reapplication_date", sa.String(length=32), nullable=True),
        sa.Column("reapplication_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_spray_applications_field_id",
        "spray_applications",
        ["field_id"],
    )

    op.create_table(
        "calendar_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("field_id", sa.String(length=64), nullable=True),
        sa.Column("field_name", sa.String(length=255), nullable=True),
        sa.Column("date", sa.String(length=32), nullable=False),
        sa.Column("end_date", sa.String(length=32), nullable=False),
        sa.Column("product", sa.String(length=255), nullable=False),
        sa.Column("product_type", sa.String(length=64), nullable=True),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("planned_interval_days", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("color_key", sa.String(length=64), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=True),
        sa.Column("source_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_calendar_events_date", "calendar_events", ["date"])
    op.create_index(
        "ix_calendar_events_event_type",
        "calendar_events",
        ["event_type"],
    )
    op.create_index("ix_calendar_events_field_id", "calendar_events", ["field_id"])

    op.create_table(
        "analysis_history",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("field_id", sa.String(length=64), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=255), nullable=True),
        sa.Column("disease", sa.String(length=255), nullable=False),
        sa.Column("pathogen", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.String(length=64), nullable=True),
        sa.Column("climate_risk_index", sa.Float(), nullable=True),
        sa.Column("agronomic_risk_index", sa.Float(), nullable=True),
        sa.Column("classification", sa.String(length=64), nullable=True),
        sa.Column("management_relevance", sa.String(length=64), nullable=True),
        sa.Column("main_action", sa.Text(), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_analysis_history_field_id", "analysis_history", ["field_id"])


def downgrade() -> None:
    op.drop_index("ix_analysis_history_field_id", table_name="analysis_history")
    op.drop_table("analysis_history")
    op.drop_index("ix_calendar_events_field_id", table_name="calendar_events")
    op.drop_index("ix_calendar_events_event_type", table_name="calendar_events")
    op.drop_index("ix_calendar_events_date", table_name="calendar_events")
    op.drop_table("calendar_events")
    op.drop_index("ix_spray_applications_field_id", table_name="spray_applications")
    op.drop_table("spray_applications")
    op.drop_index("ix_inspections_field_id", table_name="inspections")
    op.drop_table("inspections")
    op.drop_table("fields")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
