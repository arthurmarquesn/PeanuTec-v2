"""manual crop stage override

Revision ID: 20260621_0006
Revises: 20260621_0005
Create Date: 2026-06-21
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260621_0006"
down_revision: str | Sequence[str] | None = "20260621_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fields",
        sa.Column("manual_crop_stage", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "fields",
        sa.Column("crop_stage_updated_at", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "fields",
        sa.Column("crop_stage_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fields", "crop_stage_notes")
    op.drop_column("fields", "crop_stage_updated_at")
    op.drop_column("fields", "manual_crop_stage")
