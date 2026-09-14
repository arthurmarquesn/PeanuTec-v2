"""products

Revision ID: 20260618_0003
Revises: 20260618_0002
Create Date: 2026-06-18
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260618_0003"
down_revision: str | Sequence[str] | None = "20260618_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("product_type", sa.String(length=64), nullable=False),
        sa.Column("active_ingredient", sa.String(length=255), nullable=True),
        sa.Column("main_target", sa.String(length=255), nullable=True),
        sa.Column("default_defense_days", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.String(length=64), nullable=True),
        sa.Column("updated_at", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_products_product_type", "products", ["product_type"])


def downgrade() -> None:
    op.drop_index("ix_products_product_type", table_name="products")
    op.drop_table("products")
