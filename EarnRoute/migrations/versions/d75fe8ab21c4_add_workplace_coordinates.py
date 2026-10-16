"""Add real workplace coordinates for hyperlocal nearby jobs.

Revision ID: d75fe8ab21c4
Revises: b3d5964806dc
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "d75fe8ab21c4"
down_revision = "b3d5964806dc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("jobs", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_index("ix_jobs_workplace_coordinates", "jobs", ["latitude", "longitude"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_jobs_workplace_coordinates", table_name="jobs")
    op.drop_column("jobs", "longitude")
    op.drop_column("jobs", "latitude")
