"""field agronomic history

Revision ID: 20260618_0002
Revises: 20260618_0001
Create Date: 2026-06-18
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260618_0002"
down_revision: str | Sequence[str] | None = "20260618_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("fields", sa.Column("previous_crop", sa.String(length=120), nullable=True))
    op.add_column("fields", sa.Column("crop_rotation", sa.Boolean(), nullable=True))
    op.add_column("fields", sa.Column("peanut_repetition_years", sa.Integer(), nullable=True))
    op.add_column("fields", sa.Column("had_disease_incidence", sa.Boolean(), nullable=True))
    op.add_column("fields", sa.Column("previous_diseases", sa.JSON(), nullable=True))
    op.add_column("fields", sa.Column("disease_incidence_level", sa.String(length=64), nullable=True))
    op.add_column("fields", sa.Column("historical_pressure", sa.String(length=64), nullable=True))
    op.add_column("fields", sa.Column("agronomic_history_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("fields", "agronomic_history_notes")
    op.drop_column("fields", "historical_pressure")
    op.drop_column("fields", "disease_incidence_level")
    op.drop_column("fields", "previous_diseases")
    op.drop_column("fields", "had_disease_incidence")
    op.drop_column("fields", "peanut_repetition_years")
    op.drop_column("fields", "crop_rotation")
    op.drop_column("fields", "previous_crop")
