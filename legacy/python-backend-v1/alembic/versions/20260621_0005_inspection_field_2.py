"""inspection field 2 optional fields

Revision ID: 20260621_0005
Revises: 20260620_0004
Create Date: 2026-06-21
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260621_0005"
down_revision: str | Sequence[str] | None = "20260620_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "inspections",
        sa.Column("general_status", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("problem_distribution", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("pests_found", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("pest_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("weeds_found", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("weed_pressure", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("soil_condition", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("return_needed", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("return_days", sa.Integer(), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("observed_area", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "inspections",
        sa.Column("responsible", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inspections", "responsible")
    op.drop_column("inspections", "observed_area")
    op.drop_column("inspections", "return_days")
    op.drop_column("inspections", "return_needed")
    op.drop_column("inspections", "soil_condition")
    op.drop_column("inspections", "weed_pressure")
    op.drop_column("inspections", "weeds_found")
    op.drop_column("inspections", "pest_notes")
    op.drop_column("inspections", "pests_found")
    op.drop_column("inspections", "problem_distribution")
    op.drop_column("inspections", "general_status")
