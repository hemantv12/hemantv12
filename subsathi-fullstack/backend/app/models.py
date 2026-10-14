from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    display_name: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    google_connection: Mapped["GoogleConnection | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)


class GoogleConnection(Base):
    __tablename__ = "google_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320))
    encrypted_credentials: Mapped[str] = mapped_column(Text)
    granted_scopes: Mapped[str] = mapped_column(Text, default="")
    last_history_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_deep_scan_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(back_populates="google_connection")


class OAuthState(Base):
    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)
    redirect_target: Mapped[str] = mapped_column(String(20), default="mobile")
    code_verifier: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # A secure OAuth state can link a secondary Gmail account to an authenticated user.
    link_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class LinkedGmailAccount(Base):
    __tablename__ = "linked_gmail_accounts"
    __table_args__ = (UniqueConstraint("user_id", "email", name="uq_linked_gmail_user_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320))
    google_sub: Mapped[str] = mapped_column(String(255), default="")
    encrypted_credentials: Mapped[str] = mapped_column(Text)
    granted_scopes: Mapped[str] = mapped_column(Text, default="")
    last_history_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_deep_scan_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class ScanCandidate(Base):
    __tablename__ = "scan_candidates"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint", name="uq_scan_candidate_user_fingerprint"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(300))
    service_name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(40), default="Other")
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    cycle: Mapped[str] = mapped_column(String(20), default="Monthly")
    next_renewal: Mapped[str] = mapped_column(String(10), default="")
    confidence: Mapped[int] = mapped_column(Integer, default=50)
    evidence_count: Mapped[int] = mapped_column(Integer, default=1)
    evidence_date: Mapped[str] = mapped_column(String(40), default="")
    source_accounts: Mapped[str] = mapped_column(Text, default="[]")
    billing_source: Mapped[str] = mapped_column(String(40), default="provider")
    manage_url: Mapped[str] = mapped_column(Text, default="")
    imported: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class OAuthLoginTicket(Base):
    __tablename__ = "oauth_login_tickets"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)