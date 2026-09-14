"""spray product traceability

Revision ID: 20260620_0004
Revises: 20260618_0003
Create Date: 2026-06-20
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260620_0004"
down_revision: str | Sequence[str] | None = "20260618_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "spray_applications",
        sa.Column("product_id", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("spray_applications", "product_id")
