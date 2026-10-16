"""Add worker-owned saved shifts.

Revision ID: 71dca93e5a21
Revises: e3b90a71c6d2
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "71dca93e5a21"
down_revision = "e3b90a71c6d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_shifts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("worker_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("worker_id", "job_id", name="uq_saved_shift_worker_job"),
    )
    op.create_index("ix_saved_shifts_worker_id", "saved_shifts", ["worker_id"], unique=False)
    op.create_index("ix_saved_shifts_job_id", "saved_shifts", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_shifts_job_id", table_name="saved_shifts")
    op.drop_index("ix_saved_shifts_worker_id", table_name="saved_shifts")
    op.drop_table("saved_shifts")
