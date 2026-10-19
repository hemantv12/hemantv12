from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Generator, Literal
from zoneinfo import ZoneInfo

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, JSON,
    create_engine, func, select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from sqlalchemy.pool import StaticPool

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
APP_ENV = os.getenv("APP_ENV", "development").lower()
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-this-before-production")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))
TRAVEL_BUFFER_MINUTES = max(0, min(int(os.getenv("TRAVEL_BUFFER_MINUTES", "45")), 240))
MARKET_TIMEZONE = ZoneInfo(os.getenv("MARKET_TIMEZONE", "Asia/Kolkata"))
DEFAULT_PLATFORM_FEE_PERCENT = max(0.0, min(float(os.getenv("DEFAULT_PLATFORM_FEE_PERCENT", "12")), 40.0))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./earnroute.db")

# Revision IDs are recorded for new sign-ups only; these draft notices are not legal approval.
TERMS_POLICY_VERSION = "1.1-draft-2026-10-19"
PRIVACY_POLICY_VERSION = "1.1-draft-2026-10-19"

if APP_ENV == "production" and (len(JWT_SECRET) < 32 or JWT_SECRET.startswith("dev-only")):
    raise RuntimeError("Set JWT_SECRET to a unique random value of at least 32 characters in production.")


def normalize_database_url(url: str) -> str:
    """Prefer psycopg 3 for PostgreSQL URLs from managed hosts such as Render."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def make_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    options: dict[str, Any] = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if url in {"sqlite://", "sqlite:///:memory:"}:
            options["poolclass"] = StaticPool
    return create_engine(url, **options)


engine = make_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)  # worker, business, admin
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    adult_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    worker_profile: Mapped[WorkerProfile | None] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)
    business_profile: Mapped[BusinessProfile | None] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    city: Mapped[str] = mapped_column(String(100), default="")
    skills: Mapped[list] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    preferred_categories: Mapped[list] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    availability: Mapped[list] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    travel_radius_km: Mapped[int] = mapped_column(Integer, default=3)
    min_pay: Mapped[float] = mapped_column(Float, default=0.0)
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    profile_photo_url: Mapped[str] = mapped_column(String(500), default="")
    user: Mapped[User] = relationship(back_populates="worker_profile")


class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(150), default="")
    category: Mapped[str] = mapped_column(String(100), default="Other")
    city: Mapped[str] = mapped_column(String(100), default="")
    address: Mapped[str] = mapped_column(String(300), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    verification_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    verification_reason: Mapped[str] = mapped_column(String(500), default="")
    terms_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User] = relationship(back_populates="business_profile")


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(70), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str] = mapped_column(String(300), default="")
    # Public workplace coordinates come from the business-set pin. Worker GPS is never stored here.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    slots: Mapped[int] = mapped_column(Integer, default=1)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    pay_amount: Mapped[float] = mapped_column(Float)
    pay_basis: Mapped[str] = mapped_column(String(20), default="shift")
    payment_terms: Mapped[str] = mapped_column(String(300), default="Payment terms confirmed before the shift")
    requirements: Mapped[list] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list)
    min_experience: Mapped[int] = mapped_column(Integer, default=0)
    breaks_info: Mapped[str] = mapped_column(String(300), default="")
    equipment_info: Mapped[str] = mapped_column(String(300), default="")
    safety_info: Mapped[str] = mapped_column(String(500), default="")
    application_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cancellation_policy: Mapped[str] = mapped_column(String(500), default="Contact the business as early as possible.")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)  # draft, published, paused, closed, cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    business: Mapped[User] = relationship(foreign_keys=[business_id])
    applications: Mapped[list[Application]] = relationship(back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_jobs_status_city_start", "status", "city", "start_at"), Index("ix_jobs_workplace_coordinates", "latitude", "longitude"))


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="applied", index=True)  # applied, shortlisted, offered, accepted, declined, withdrawn, rejected
    note: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    job: Mapped[Job] = relationship(back_populates="applications")
    worker: Mapped[User] = relationship(foreign_keys=[worker_id])
    __table_args__ = (UniqueConstraint("job_id", "worker_id", name="uq_application_job_worker"),)


class SavedShift(Base):
    __tablename__ = "saved_shifts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("worker_id", "job_id", name="uq_saved_shift_worker_job"),)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="RESTRICT"), index=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="RESTRICT"), unique=True)
    status: Mapped[str] = mapped_column(String(24), default="confirmed", index=True)  # confirmed, checked_in, checked_out, completed, cancelled, disputed
    checkin_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checkout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gross_pay: Mapped[float] = mapped_column(Float)
    platform_fee: Mapped[float] = mapped_column(Float, default=0.0)
    net_pay: Mapped[float] = mapped_column(Float)
    payout_status: Mapped[str] = mapped_column(String(20), default="not_due", index=True)  # not_due, pending, paid, disputed
    payout_reference: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job: Mapped[Job] = relationship(foreign_keys=[job_id])
    worker: Mapped[User] = relationship(foreign_keys=[worker_id])


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="RESTRICT"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("assignment_id", "reviewer_id", name="uq_review_assignment_reviewer"),)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    body: Mapped[str] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    subject: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(40), default="other", index=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SupportMessage(Base):
    __tablename__ = "support_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True)
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Dispute(Base):
    __tablename__ = "disputes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="RESTRICT"), index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    reason: Mapped[str] = mapped_column(String(1200))
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    assignment_status_before: Mapped[str] = mapped_column(String(24), default="checked_in")
    payout_status_before: Mapped[str] = mapped_column(String(20), default="not_due")
    resolution_note: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(80))
    detail: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProviderEvent(Base):
    __tablename__ = "provider_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider_event_id: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String(120))
    payload_sha256: Mapped[str] = mapped_column(String(64))
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))




def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    # SQLite may return naive datetimes even for DateTime(timezone=True).
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(actual, digest_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    now = utc_now()
    payload = {"sub": str(user.id), "role": user.role, "iat": now, "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    token = authorization.split(" ", 1)[1].strip()
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = int(data.get("sub", "0"))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.")
    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="This account is unavailable.")
    return user


def require_role(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return user
    return dependency


def log_event(db: Session, actor_id: int | None, action: str, entity_type: str, entity_id: Any, detail: dict | None = None) -> None:
    db.add(AuditEvent(actor_user_id=actor_id, action=action, entity_type=entity_type, entity_id=str(entity_id), detail=detail or {}))


def notify(db: Session, user_id: int, title: str, body: str) -> None:
    db.add(Notification(user_id=user_id, title=title[:140], body=body[:500]))


def serialize_support_ticket(db: Session, ticket: SupportTicket, include_messages: bool = False) -> dict[str, Any]:
    owner = db.get(User, ticket.user_id)
    messages = db.scalars(
        select(SupportMessage).where(SupportMessage.ticket_id == ticket.id)
        .order_by(SupportMessage.created_at.asc()).limit(100)
    ).all()
    last = messages[-1] if messages else None
    last_sender = db.get(User, last.sender_user_id) if last else None
    result = {
        "id": ticket.id, "user_id": ticket.user_id,
        "requester_name": owner.full_name if owner else "Account",
        "requester_email": owner.email if owner else "",
        "requester_role": owner.role if owner else "",
        "subject": ticket.subject, "category": ticket.category, "status": ticket.status,
        "message_count": len(messages), "latest_message": last.message[:240] if last else "",
        "latest_sender_role": last_sender.role if last_sender else "",
        "created_at": as_utc(ticket.created_at).isoformat(),
        "updated_at": as_utc(ticket.updated_at).isoformat(),
        "closed_at": as_utc(ticket.closed_at).isoformat() if ticket.closed_at else None,
    }
    if include_messages:
        result["messages"] = [{
            "id": item.id, "sender_user_id": item.sender_user_id,
            "sender_name": (db.get(User, item.sender_user_id).full_name if db.get(User, item.sender_user_id) else "Account"),
            "sender_role": (db.get(User, item.sender_user_id).role if db.get(User, item.sender_user_id) else ""),
            "message": item.message, "created_at": as_utc(item.created_at).isoformat(),
        } for item in messages]
    return result


# ----- Input schemas -----
class RegisterBody(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    full_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=10, max_length=128)
    role: Literal["worker", "business"] = "worker"
    terms_accepted: bool = False
    adult_confirmed: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.strip().split())
        if len(v) < 2:
            raise ValueError("Please enter your name.")
        return v

    @model_validator(mode="after")
    def consent_checks(self):
        if not self.terms_accepted:
            raise ValueError("Accept the platform terms before creating an account.")
        if self.role == "worker" and not self.adult_confirmed:
            raise ValueError("Workers must confirm that they are 18 or older.")
        return self


class LoginBody(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class WorkerProfileBody(BaseModel):
    city: str = Field(default="", max_length=100)
    skills: list[str] = Field(default_factory=list, max_length=30)
    preferred_categories: list[str] = Field(default_factory=list, max_length=20)
    availability: list[dict[str, Any]] = Field(default_factory=list, max_length=21)
    travel_radius_km: int = Field(default=3, ge=1, le=15)
    min_pay: float = Field(default=0, ge=0, le=1_000_000)
    experience_years: int = Field(default=0, ge=0, le=60)

    @field_validator("travel_radius_km")
    @classmethod
    def validate_travel_radius(cls, value: int) -> int:
        if value not in {1, 3, 5, 8, 10, 15}:
            raise ValueError("Choose 1, 3, 5, 8, 10 or 15 km.")
        return value

    @field_validator("skills", "preferred_categories")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        clean = []
        for value in values:
            value = " ".join(str(value).split()).strip()[:70]
            if value and value.lower() not in {x.lower() for x in clean}:
                clean.append(value)
        return clean

    @field_validator("availability")
    @classmethod
    def validate_availability(cls, values: list[dict[str, Any]]) -> list[dict[str, Any]]:
        clean: list[dict[str, Any]] = []
        for entry in values:
            try:
                day = int(entry.get("day"))
                start = str(entry.get("start", ""))
                end = str(entry.get("end", ""))
                datetime.strptime(start, "%H:%M")
                datetime.strptime(end, "%H:%M")
            except (TypeError, ValueError):
                raise ValueError("Availability uses a weekday (0-6) and 24-hour start/end time.")
            if day < 0 or day > 6 or start >= end:
                raise ValueError("Each availability window must have a valid weekday and start before end.")
            clean.append({"day": day, "start": start, "end": end})
        return clean


class BusinessProfileBody(BaseModel):
    legal_name: str = Field(default="", max_length=150)
    category: str = Field(default="Other", max_length=100)
    city: str = Field(default="", max_length=100)
    address: str = Field(default="", max_length=300)
    phone: str = Field(default="", max_length=20)
    description: str = Field(default="", max_length=3000)


class SupportTicketCreateBody(BaseModel):
    subject: str = Field(min_length=5, max_length=140)
    category: Literal["account", "privacy", "payments", "shift", "safety", "technical", "other"] = "other"
    message: str = Field(min_length=20, max_length=4000)

    @field_validator("subject", "message")
    @classmethod
    def clean_support_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a subject and a message.")
        return value


class PrivacyRequestBody(BaseModel):
    request_type: Literal["access", "correction", "deletion"]
    message: str = Field(min_length=10, max_length=2000)

    @field_validator("message")
    @classmethod
    def clean_privacy_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Please describe your privacy request in at least 10 characters.")
        return value


class SupportMessageBody(BaseModel):
    message: str = Field(min_length=2, max_length=4000)

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Please enter a message.")
        return value


class SupportTicketStatusBody(BaseModel):
    status: Literal["open", "in_progress", "waiting_user", "resolved", "closed"]


class AdminUserStatusBody(BaseModel):
    active: bool
    reason: str = Field(min_length=5, max_length=500)

    @field_validator("reason")
    @classmethod
    def clean_admin_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Provide a reason of at least 5 characters.")
        return value


class JobBody(BaseModel):
    title: str = Field(min_length=5, max_length=140)
    description: str = Field(min_length=20, max_length=6000)
    category: str = Field(min_length=2, max_length=70)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(default="", max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    slots: int = Field(default=1, ge=1, le=500)
    start_at: datetime
    end_at: datetime
    pay_amount: float = Field(gt=0, le=1_000_000)
    pay_basis: Literal["hour", "shift", "project"] = "shift"
    payment_terms: str = Field(default="Payment terms confirmed before the shift", max_length=300)
    requirements: list[str] = Field(default_factory=list, max_length=30)
    min_experience: int = Field(default=0, ge=0, le=60)
    breaks_info: str = Field(default="", max_length=300)
    equipment_info: str = Field(default="", max_length=300)
    safety_info: str = Field(default="", max_length=500)
    application_deadline: datetime
    cancellation_policy: str = Field(default="Contact the business as early as possible.", max_length=500)
    publish: bool = False

    @field_validator("requirements")
    @classmethod
    def clean_requirements(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(" ".join(str(v).split()).strip()[:70] for v in values if str(v).strip()))

    @model_validator(mode="after")
    def validate_dates(self):
        start = as_utc(self.start_at)
        end = as_utc(self.end_at)
        deadline = as_utc(self.application_deadline)
        if end <= start:
            raise ValueError("Shift end must be after shift start.")
        if start <= utc_now() + timedelta(minutes=5):
            raise ValueError("The shift must start at least five minutes in the future.")
        if deadline >= start or deadline <= utc_now():
            raise ValueError("The application deadline must be in the future and before the shift starts.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Set both workplace coordinates together.")
        if self.publish and (self.latitude is None or self.longitude is None):
            raise ValueError("Set the workplace location before publishing so nearby workers can find this shift.")
        return self


class NearbyJobsSearchBody(BaseModel):
    """Nearby search criteria in a POST body so precise worker coordinates aren't placed in URL query logs."""
    city: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=70)
    search: str | None = Field(default=None, max_length=120)
    min_pay: float | None = Field(default=None, ge=0, le=1_000_000)
    max_pay: float | None = Field(default=None, ge=0, le=1_000_000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=15)
    page: int = Field(default=1, ge=1, le=10000)
    page_size: int = Field(default=12, ge=1, le=50)

    @model_validator(mode="after")
    def validate_nearby_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both latitude and longitude for nearby search.")
        if self.radius_km is not None and self.latitude is None:
            raise ValueError("Nearby search requires a selected location.")
        return self


class WorkplaceLocationBody(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ApplyBody(BaseModel):
    note: str = Field(default="", max_length=1000)


class ApplicationStatusBody(BaseModel):
    status: Literal["shortlisted", "rejected"]


class RespondOfferBody(BaseModel):
    decision: Literal["accepted", "declined"]


class DisputeBody(BaseModel):
    reason: str = Field(min_length=10, max_length=1200)


class CancelAssignmentBody(BaseModel):
    reason: str = Field(default="", max_length=500)


class ResolveDisputeBody(BaseModel):
    status: Literal["resolved", "rejected"]
    resolution_note: str = Field(min_length=5, max_length=1000)


class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class ReconcilePayoutBody(BaseModel):
    provider_reference: str = Field(min_length=4, max_length=160)
    confirmation_note: str = Field(min_length=10, max_length=500)


# ----- Helpers -----
def serialize_user(user: User, db: Session) -> dict[str, Any]:
    profile: dict[str, Any] = {}
    if user.role == "worker":
        p = db.get(WorkerProfile, user.id)
        if p:
            profile = {"city": p.city, "skills": p.skills or [], "preferred_categories": p.preferred_categories or [],
                       "availability": p.availability or [], "travel_radius_km": min((1, 3, 5, 8, 10, 15), key=lambda radius: (abs(radius - int(p.travel_radius_km or 3)), radius != 3, radius)),
                       "min_pay": p.min_pay, "experience_years": p.experience_years}
    elif user.role == "business":
        p = db.get(BusinessProfile, user.id)
        if p:
            profile = {"legal_name": p.legal_name, "category": p.category, "city": p.city, "address": p.address,
                       "phone": p.phone, "description": p.description, "verification_status": p.verification_status,
                       "verification_reason": p.verification_reason}
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role,
            "email_verified": user.email_verified, "created_at": as_utc(user.created_at).isoformat(), "profile": profile}


def get_worker_profile(db: Session, user_id: int) -> WorkerProfile:
    profile = db.get(WorkerProfile, user_id)
    if not profile:
        raise HTTPException(status_code=409, detail="Complete your worker profile first.")
    return profile


def get_business_profile(db: Session, user_id: int) -> BusinessProfile:
    profile = db.get(BusinessProfile, user_id)
    if not profile:
        raise HTTPException(status_code=409, detail="Complete your business profile first.")
    return profile


def ensure_business_can_publish(db: Session, user_id: int) -> BusinessProfile:
    profile = get_business_profile(db, user_id)
    if profile.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Business verification is required before publishing jobs.")
    return profile


def assignment_conflict(db: Session, worker_id: int, job: Job, exclude_assignment_id: int | None = None) -> str | None:
    start, end = as_utc(job.start_at), as_utc(job.end_at)
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    assignments = db.scalars(select(Assignment).where(
        Assignment.worker_id == worker_id,
        Assignment.status.in_(["confirmed", "checked_in", "checked_out", "disputed"]),
        Assignment.id != (exclude_assignment_id or -1),
    )).all()
    for assignment in assignments:
        other = assignment.job
        other_start, other_end = as_utc(other.start_at), as_utc(other.end_at)
        if start < other_end + buffer and end > other_start - buffer:
            return f"This shift conflicts with another confirmed assignment (job #{other.id}), including the {TRAVEL_BUFFER_MINUTES}-minute safety buffer."
        if other.city.strip().lower() != job.city.strip().lower():
            gap = min(abs((start - other_end).total_seconds()), abs((other_start - end).total_seconds()))
            if gap < 2 * 60 * 60:
                return f"Another assignment is in {other.city}; there is not enough verified travel-time information to safely confirm this cross-city schedule."
    return None


def expected_gross_pay(job: Job) -> float:
    """Return the estimated gross pay for the whole shift, not the hourly rate."""
    duration_hours = (as_utc(job.end_at) - as_utc(job.start_at)).total_seconds() / 3600
    amount = float(job.pay_amount) * duration_hours if job.pay_basis == "hour" else float(job.pay_amount)
    return round(amount, 2)


def availability_compatible(profile: WorkerProfile, job: Job) -> bool | None:
    """Check weekly availability in the marketplace's configured local timezone.

    None means the worker has not provided an availability calendar yet; that is
    different from an explicit schedule mismatch.
    """
    if not profile.availability:
        return None
    start = as_utc(job.start_at).astimezone(MARKET_TIMEZONE)
    end = as_utc(job.end_at).astimezone(MARKET_TIMEZONE)
    if start.date() != end.date():
        return False
    for window in profile.availability:
        if (int(window.get("day", -1)) == start.weekday()
            and window.get("start", "00:00") <= start.strftime("%H:%M")
            and window.get("end", "00:00") >= end.strftime("%H:%M")):
            return True
    return False


def match_job(profile: WorkerProfile, job: Job) -> dict[str, Any]:
    points = 0
    reasons: list[str] = []
    worker_skills = {str(x).strip().lower() for x in (profile.skills or [])}
    needed = {str(x).strip().lower() for x in (job.requirements or [])}
    missing_skills = sorted(needed - worker_skills)
    experience_ok = int(profile.experience_years or 0) >= int(job.min_experience or 0)
    schedule = availability_compatible(profile, job)
    category_fit = job.category.lower() in {x.lower() for x in (profile.preferred_categories or [])}
    if needed and not missing_skills:
        points += 30
        reasons.append("Matches all required skills")
    elif needed:
        points += max(0, round(30 * (len(needed) - len(missing_skills)) / len(needed)))
        reasons.append(f"Missing required skills: {', '.join(missing_skills[:4])}")
    else:
        points += 18
    if profile.city and profile.city.strip().lower() == job.city.strip().lower():
        points += 15
        reasons.append("In your selected city")
    if category_fit:
        points += 15
        reasons.append("Matches your preferred category")
    else:
        points += 5
    gross_total = expected_gross_pay(job)
    if float(profile.min_pay or 0) <= gross_total:
        points += 15
        reasons.append("Meets your preferred gross shift pay")
    else:
        reasons.append("Below your preferred gross shift pay")
    if experience_ok:
        points += 10
    else:
        reasons.append(f"Requires {job.min_experience} year(s) of relevant experience")
    if schedule is True:
        points += 15
        reasons.append("Fits your selected availability")
    elif schedule is False:
        reasons.append("Does not fit your saved availability window")
    else:
        reasons.append("Add availability to improve schedule matches")
    return {
        "score": min(100, points), "reasons": reasons,
        "eligible": not missing_skills and experience_ok and schedule is not False,
        "missing_skills": missing_skills, "experience_ok": experience_ok,
        "availability_fit": "unknown" if schedule is None else ("yes" if schedule else "no"),
        "gross_shift_pay": gross_total,
    }


def serialize_job(db: Session, job: Job, worker_profile: WorkerProfile | None = None) -> dict[str, Any]:
    business = db.get(User, job.business_id)
    business_profile = db.get(BusinessProfile, job.business_id)
    rating_row = db.execute(select(func.avg(Review.rating), func.count(Review.id)).where(Review.reviewee_id == job.business_id)).first()
    business_rating = round(float(rating_row[0]), 1) if rating_row and rating_row[0] is not None else None
    business_review_count = int(rating_row[1] or 0) if rating_row else 0
    filled = db.scalar(select(func.count(Assignment.id)).where(
        Assignment.job_id == job.id,
        Assignment.status != "cancelled",
    )) or 0
    result = {
        "id": job.id, "business_id": job.business_id,
        "business_name": business_profile.legal_name if business_profile and business_profile.legal_name else (business.full_name if business else "Business"),
        "business_verified": bool(business_profile and business_profile.verification_status == "verified"),
        "business_rating": business_rating, "business_review_count": business_review_count,
        "title": job.title, "description": job.description, "category": job.category, "city": job.city,
        "address": job.address, "has_workplace_pin": job.latitude is not None and job.longitude is not None,
        # Workplace pins are public listing data by design; worker GPS is never serialized or stored.
        "latitude": job.latitude, "longitude": job.longitude,
        "slots": job.slots, "positions_filled": filled,
        "start_at": as_utc(job.start_at).isoformat(), "end_at": as_utc(job.end_at).isoformat(),
        "duration_hours": round((as_utc(job.end_at) - as_utc(job.start_at)).total_seconds() / 3600, 2),
        "pay_amount": job.pay_amount, "pay_basis": job.pay_basis, "payment_terms": job.payment_terms,
        "gross_shift_pay_estimate": expected_gross_pay(job),
        "platform_fee_percent": DEFAULT_PLATFORM_FEE_PERCENT,
        "estimated_platform_fee": round(expected_gross_pay(job) * DEFAULT_PLATFORM_FEE_PERCENT / 100, 2),
        "estimated_net_pay": round(expected_gross_pay(job) * (1 - DEFAULT_PLATFORM_FEE_PERCENT / 100), 2),
        "requirements": job.requirements or [], "min_experience": job.min_experience, "breaks_info": job.breaks_info,
        "equipment_info": job.equipment_info, "safety_info": job.safety_info,
        "application_deadline": as_utc(job.application_deadline).isoformat(), "cancellation_policy": job.cancellation_policy,
        "status": job.status, "created_at": as_utc(job.created_at).isoformat(),
    }
    if worker_profile:
        result["match"] = match_job(worker_profile, job)
    return result


def serialize_application(db: Session, app: Application) -> dict[str, Any]:
    worker = db.get(User, app.worker_id)
    profile = db.get(WorkerProfile, app.worker_id)
    job = db.get(Job, app.job_id)
    assignment = db.scalar(select(Assignment).where(Assignment.application_id == app.id))
    rating_row = db.execute(select(func.avg(Review.rating), func.count(Review.id)).where(Review.reviewee_id == app.worker_id)).first()
    worker_rating = round(float(rating_row[0]), 1) if rating_row and rating_row[0] is not None else None
    worker_review_count = int(rating_row[1] or 0) if rating_row else 0
    return {
        "id": app.id, "job_id": app.job_id, "job_title": job.title if job else "",
        "worker_id": app.worker_id, "worker_name": worker.full_name if worker else "Worker",
        "worker_city": profile.city if profile else "", "worker_skills": profile.skills if profile else [],
        "worker_experience_years": profile.experience_years if profile else 0,
        "worker_rating": worker_rating, "worker_review_count": worker_review_count,
        "status": app.status, "note": app.note, "created_at": as_utc(app.created_at).isoformat(),
        "assignment_id": assignment.id if assignment else None,
    }


def serialize_assignment(db: Session, assignment: Assignment) -> dict[str, Any]:
    job = db.get(Job, assignment.job_id)
    business_profile = db.get(BusinessProfile, job.business_id) if job else None
    worker = db.get(User, assignment.worker_id)
    reviews = db.scalars(select(Review).where(Review.assignment_id == assignment.id).order_by(Review.created_at.asc())).all()
    return {
        "id": assignment.id, "job_id": assignment.job_id, "job_title": job.title if job else "",
        "business_name": (business_profile.legal_name if business_profile and business_profile.legal_name else "Business") if job else "Business",
        "worker_name": worker.full_name if worker else "Worker",
        "city": job.city if job else "", "address": job.address if job else "",
        "latitude": job.latitude if job else None, "longitude": job.longitude if job else None,
        "description": job.description if job else "", "requirements": job.requirements or [] if job else [],
        "breaks_info": job.breaks_info if job else "", "equipment_info": job.equipment_info if job else "",
        "safety_info": job.safety_info if job else "", "payment_terms": job.payment_terms if job else "",
        "cancellation_policy": job.cancellation_policy if job else "",
        "start_at": as_utc(job.start_at).isoformat() if job else "",
        "end_at": as_utc(job.end_at).isoformat() if job else "", "status": assignment.status,
        "checkin_at": as_utc(assignment.checkin_at).isoformat() if assignment.checkin_at else None,
        "checkout_at": as_utc(assignment.checkout_at).isoformat() if assignment.checkout_at else None,
        "completed_at": as_utc(assignment.completed_at).isoformat() if assignment.completed_at else None,
        "worker_reviewed": any(r.reviewer_id == assignment.worker_id for r in reviews),
        "business_reviewed": bool(job and any(r.reviewer_id == job.business_id for r in reviews)),
        "reviews": [{"reviewer_name": (db.get(User, r.reviewer_id).full_name if db.get(User, r.reviewer_id) else "Participant"),
                     "reviewee_id": r.reviewee_id, "rating": r.rating, "comment": r.comment,
                     "created_at": as_utc(r.created_at).isoformat()} for r in reviews],
        "gross_pay": assignment.gross_pay, "platform_fee": assignment.platform_fee, "net_pay": assignment.net_pay,
        "payout_status": assignment.payout_status, "payout_reference": assignment.payout_reference,
    }


def get_owned_job(db: Session, job_id: int, user_id: int) -> Job:
    job = db.get(Job, job_id)
    if not job or job.business_id != user_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


# Basic persistent auth throttling; use a shared gateway/rate limiter for multi-instance deployments.
_RATE_BUCKETS: dict[str, tuple[int, float]] = {}

def enforce_rate_limit(request: Request, bucket: str, limit: int, message: str) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"{bucket}:{ip}"
    now = time.monotonic()
    # Bound memory when requests originate from many distinct addresses.
    if len(_RATE_BUCKETS) > 10_000:
        for old_key, (_, reset_at) in list(_RATE_BUCKETS.items()):
            if now > reset_at:
                _RATE_BUCKETS.pop(old_key, None)
    count, reset = _RATE_BUCKETS.get(key, (0, now + 60))
    if now > reset:
        count, reset = 0, now + 60
    if count >= limit:
        raise HTTPException(status_code=429, detail=message)
    _RATE_BUCKETS[key] = (count + 1, reset)


def enforce_login_rate(request: Request) -> None:
    enforce_rate_limit(request, "login", 15, "Too many sign-in attempts. Please wait a minute.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if APP_ENV != "production":
        Base.metadata.create_all(bind=engine)
    yield


# Optional error reporting: disabled until the owner configures SENTRY_DSN.
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=APP_ENV,
        release=os.getenv("APP_RELEASE") or None,
        send_default_pii=False,
        traces_sample_rate=0.0,
    )

app = FastAPI(title="EarnRoute API", version="0.1.0", description="India-first marketplace for genuine paid shifts.", lifespan=lifespan)

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()]
if origins:
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type", "X-Razorpay-Signature"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self' https:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
    except Exception:
        raise HTTPException(status_code=503, detail="Database health check failed.")
    return {"status": "ok", "service": "EarnRoute API", "time": utc_now().isoformat()}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterBody, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "register", 10, "Too many account creation attempts. Please wait a minute.")
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(email=body.email, full_name=body.full_name, password_hash=hash_password(body.password), role=body.role,
                adult_confirmed_at=utc_now() if body.role == "worker" and body.adult_confirmed else None)
    if body.role == "worker":
        user.worker_profile = WorkerProfile()
    else:
        user.business_profile = BusinessProfile(legal_name=body.full_name, terms_accepted=True)
    db.add(user)
    db.flush()
    log_event(db, user.id, "account_registered", "user", user.id, {"role": user.role})
    # Record the exact policy revisions accepted at signup. Do not backdate consent for existing accounts.
    log_event(db, user.id, "legal_policies_accepted", "user", user.id, {
        "terms_version": TERMS_POLICY_VERSION,
        "privacy_notice_version": PRIVACY_POLICY_VERSION,
        "accepted_via": "registration_checkbox",
        "role_at_acceptance": user.role,
    })
    notify(db, user.id, "Welcome to EarnRoute", "Complete your profile to receive better work matches.")
    db.commit()
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": serialize_user(user, db)}


@app.post("/api/auth/login")
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)):
    enforce_login_rate(request)
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash) or not user.active:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": serialize_user(user, db)}


@app.get("/api/auth/me")
def auth_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"user": serialize_user(user, db)}




@app.get("/api/account/data-export")
def export_account_data(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export this authenticated user's own marketplace data without credentials or tokens."""
    enforce_rate_limit(request, "account_data_export", 5, "Too many export requests. Please wait and try again.")
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"

    record_limit = 500
    truncated_sections: list[str] = []

    def limited(section: str, rows: list[Any]) -> list[Any]:
        if len(rows) > record_limit:
            truncated_sections.append(section)
        return rows[:record_limit]

    def iso(value: datetime | None) -> str | None:
        return as_utc(value).isoformat() if value else None

    def job_record(job: Job | None) -> dict[str, Any] | None:
        if job is None:
            return None
        business = db.get(User, job.business_id)
        return {
            "id": job.id,
            "business_name": business.full_name if business else None,
            "title": job.title,
            "description": job.description,
            "category": job.category,
            "city": job.city,
            "address": job.address,
            "latitude": job.latitude,
            "longitude": job.longitude,
            "slots": job.slots,
            "start_at": iso(job.start_at),
            "end_at": iso(job.end_at),
            "pay_amount": job.pay_amount,
            "pay_basis": job.pay_basis,
            "payment_terms": job.payment_terms,
            "requirements": job.requirements or [],
            "min_experience": job.min_experience,
            "breaks_info": job.breaks_info,
            "equipment_info": job.equipment_info,
            "safety_info": job.safety_info,
            "application_deadline": iso(job.application_deadline),
            "cancellation_policy": job.cancellation_policy,
            "status": job.status,
            "created_at": iso(job.created_at),
        }

    data: dict[str, Any] = {
        "schema_version": "1.0",
        "exported_at": utc_now().isoformat(),
        "account": serialize_user(user, db),
        "privacy_notes": [
            "This file contains personal information; store and share it carefully.",
            "Passwords, password hashes, authentication tokens, and raw device-location history are never included.",
            "Device-selected nearby-search points are temporary in device session storage and are not persisted to the profile.",
            f"Each activity section is limited to {record_limit} records. Any section that exceeds the limit is listed in truncated_sections.",
        ],
        "policy_acceptance_events": [],
        "applications": [],
        "saved_shifts": [],
        "posted_jobs": [],
        "assignments": [],
        "notifications": [],
        "support_tickets": [],
        "reviews": [],
        "truncated_sections": truncated_sections,
    }

    policy_rows = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.actor_user_id == user.id, AuditEvent.action == "legal_policies_accepted")
        .order_by(AuditEvent.created_at.desc()).limit(record_limit + 1)
    ).all()
    data["policy_acceptance_events"] = [
        {
            "accepted_at": iso(item.created_at),
            "terms_version": (item.detail or {}).get("terms_version"),
            "privacy_notice_version": (item.detail or {}).get("privacy_notice_version"),
            "role_at_acceptance": (item.detail or {}).get("role_at_acceptance"),
            "accepted_via": (item.detail or {}).get("accepted_via"),
        }
        for item in limited("policy_acceptance_events", policy_rows)
    ]

    if user.role == "worker":
        application_rows = db.scalars(
            select(Application).where(Application.worker_id == user.id)
            .order_by(Application.created_at.desc()).limit(record_limit + 1)
        ).all()
        data["applications"] = [
            {
                "id": item.id,
                "status": item.status,
                "note": item.note,
                "created_at": iso(item.created_at),
                "updated_at": iso(item.updated_at),
                "job": job_record(db.get(Job, item.job_id)),
            }
            for item in limited("applications", application_rows)
        ]

        saved_rows = db.scalars(
            select(SavedShift).where(SavedShift.worker_id == user.id)
            .order_by(SavedShift.created_at.desc()).limit(record_limit + 1)
        ).all()
        data["saved_shifts"] = [
            {"saved_at": iso(item.created_at), "job": job_record(db.get(Job, item.job_id))}
            for item in limited("saved_shifts", saved_rows)
        ]

        assignment_rows = db.scalars(
            select(Assignment).where(Assignment.worker_id == user.id)
            .order_by(Assignment.created_at.desc()).limit(record_limit + 1)
        ).all()
        data["assignments"] = [
            {
                "id": item.id,
                "status": item.status,
                "checkin_at": iso(item.checkin_at),
                "checkout_at": iso(item.checkout_at),
                "completion_approved_at": iso(item.completion_approved_at),
                "completed_at": iso(item.completed_at),
                "gross_pay": item.gross_pay,
                "platform_fee": item.platform_fee,
                "net_pay": item.net_pay,
                "payout_status": item.payout_status,
                "created_at": iso(item.created_at),
                "job": job_record(db.get(Job, item.job_id)),
            }
            for item in limited("assignments", assignment_rows)
        ]

    elif user.role == "business":
        job_rows = db.scalars(
            select(Job).where(Job.business_id == user.id)
            .order_by(Job.created_at.desc()).limit(record_limit + 1)
        ).all()
        data["posted_jobs"] = [job_record(item) for item in limited("posted_jobs", job_rows)]

        assignment_rows = db.scalars(
            select(Assignment).join(Job, Assignment.job_id == Job.id)
            .where(Job.business_id == user.id)
            .order_by(Assignment.created_at.desc()).limit(record_limit + 1)
        ).all()
        data["assignments"] = [
            {
                "id": item.id,
                "status": item.status,
                "gross_pay": item.gross_pay,
                "created_at": iso(item.created_at),
                "checkin_at": iso(item.checkin_at),
                "checkout_at": iso(item.checkout_at),
                "completed_at": iso(item.completed_at),
                "job": job_record(db.get(Job, item.job_id)),
            }
            for item in limited("assignments", assignment_rows)
        ]

    notification_rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc()).limit(record_limit + 1)
    ).all()
    data["notifications"] = [
        {
            "title": item.title,
            "body": item.body,
            "created_at": iso(item.created_at),
            "read_at": iso(item.read_at),
        }
        for item in limited("notifications", notification_rows)
    ]

    ticket_rows = db.scalars(
        select(SupportTicket).where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc()).limit(101)
    ).all()
    if len(ticket_rows) > 100:
        truncated_sections.append("support_tickets")
    data["support_tickets"] = [
        serialize_support_ticket(db, item, include_messages=True)
        for item in ticket_rows[:100]
    ]

    review_rows = db.scalars(
        select(Review).where((Review.reviewer_id == user.id) | (Review.reviewee_id == user.id))
        .order_by(Review.created_at.desc()).limit(record_limit + 1)
    ).all()
    data["reviews"] = [
        {
            "direction": "given" if item.reviewer_id == user.id else "received",
            "rating": item.rating,
            "comment": item.comment,
            "created_at": iso(item.created_at),
        }
        for item in limited("reviews", review_rows)
    ]
    return data


@app.post("/api/account/privacy-requests", status_code=201)
def create_privacy_request(
    body: PrivacyRequestBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a private, auditable support ticket; requests never erase records automatically."""
    enforce_rate_limit(
        request, f"privacy_request_{user.id}", 5,
        "Too many privacy requests. Please wait and try again."
    )
    subjects = {
        "access": "Privacy request: account data copy",
        "correction": "Privacy request: data correction",
        "deletion": "Privacy request: account closure / data deletion",
    }
    ticket = SupportTicket(user_id=user.id, subject=subjects[body.request_type], category="privacy", status="open")
    db.add(ticket)
    db.flush()
    message = body.message.strip()
    if body.request_type == "deletion":
        message += (
            "\n\nEarnRoute system note: this request does not automatically delete the account or records. "
            "The operator must review active assignments, disputes, security/audit needs, and applicable retention obligations."
        )
    db.add(SupportMessage(ticket_id=ticket.id, sender_user_id=user.id, message=message))
    log_event(db, user.id, "privacy_request_created", "support_ticket", ticket.id,
              {"request_type": body.request_type, "category": "privacy"})
    for administrator in db.scalars(select(User).where(User.role == "admin", User.active.is_(True))).all():
        notify(db, administrator.id, "New privacy request", f"{subjects[body.request_type]} · submitted by {user.full_name}.")
    db.commit()
    db.refresh(ticket)
    return {"ticket": serialize_support_ticket(db, ticket, include_messages=True)}


@app.patch("/api/worker/profile")
def update_worker_profile(body: WorkerProfileBody, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    profile = get_worker_profile(db, user.id)
    profile.city = body.city.strip()
    profile.skills = body.skills
    profile.preferred_categories = body.preferred_categories
    profile.availability = body.availability
    profile.travel_radius_km = body.travel_radius_km
    profile.min_pay = body.min_pay
    profile.experience_years = body.experience_years
    log_event(db, user.id, "worker_profile_updated", "worker_profile", user.id)
    db.commit()
    return {"user": serialize_user(user, db)}


@app.patch("/api/business/profile")
def update_business_profile(body: BusinessProfileBody, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    profile = get_business_profile(db, user.id)
    profile.legal_name = body.legal_name.strip()
    profile.category = body.category.strip()
    profile.city = body.city.strip()
    profile.address = body.address.strip()
    profile.phone = body.phone.strip()
    profile.description = body.description.strip()
    log_event(db, user.id, "business_profile_updated", "business_profile", user.id)
    db.commit()
    return {"user": serialize_user(user, db)}


def haversine_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    """Straight-line surface distance in kilometres, using the Haversine formula."""
    earth_radius_km = 6371.0088
    lat1, lat2 = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return earth_radius_km * 2 * math.asin(math.sqrt(min(1.0, max(0.0, a))))


@app.get("/api/jobs")
def list_jobs(
    city: str | None = None, category: str | None = None, search: str | None = None,
    min_pay: float | None = Query(default=None, ge=0), max_pay: float | None = Query(default=None, ge=0),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=15),
    page: int = Query(default=1, ge=1, le=10000), page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db), authorization: str | None = Header(default=None),
):
    if (latitude is None) != (longitude is None):
        raise HTTPException(status_code=422, detail="Provide both latitude and longitude for nearby search.")
    if radius_km is not None and latitude is None:
        raise HTTPException(status_code=422, detail="Nearby search requires your device location.")
    if latitude is not None and radius_km is None:
        radius_km = 3.0
    worker_profile = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            possible_user = db.get(User, int(data.get("sub", "0")))
            if possible_user and possible_user.active and possible_user.role == "worker":
                worker_profile = db.get(WorkerProfile, possible_user.id)
        except (jwt.InvalidTokenError, ValueError, TypeError):
            worker_profile = None
    query = select(Job).where(Job.status == "published", Job.start_at > utc_now())
    if city:
        query = query.where(Job.city.ilike(f"%{city.strip()[:100]}%"))
    if category and category.strip().lower() != "all":
        query = query.where(Job.category.ilike(f"%{category.strip()[:70]}%"))
    if search:
        needle = f"%{search.strip()[:120]}%"
        query = query.where((Job.title.ilike(needle)) | (Job.description.ilike(needle)) | (Job.category.ilike(needle)))
    if min_pay is not None:
        query = query.where(Job.pay_amount >= min_pay)
    if max_pay is not None:
        query = query.where(Job.pay_amount <= max_pay)
    if latitude is not None and longitude is not None:
        # Bounding-box filter reduces database rows before exact distance math.
        lat_delta = radius_km / 110.574
        cos_lat = max(0.01, abs(math.cos(math.radians(latitude))))
        lon_delta = min(180.0, radius_km / (111.320 * cos_lat))
        query = query.where(Job.latitude.is_not(None), Job.longitude.is_not(None))
        query = query.where(Job.latitude >= latitude - lat_delta, Job.latitude <= latitude + lat_delta)
        query = query.where(Job.longitude >= longitude - lon_delta, Job.longitude <= longitude + lon_delta)
        candidates = db.scalars(query.order_by(Job.start_at.asc()).limit(2500)).all()
        nearby = []
        for job in candidates:
            distance = haversine_km(latitude, longitude, float(job.latitude), float(job.longitude))
            if distance <= radius_km + 0.0001:
                item = serialize_job(db, job, worker_profile)
                item["distance_km"] = round(distance, 2)
                nearby.append((distance, as_utc(job.start_at), item))
        nearby.sort(key=lambda row: (row[0], row[1]))
        total = len(nearby)
        start = (page - 1) * page_size
        return {"items": [row[2] for row in nearby[start:start + page_size]], "total": total,
                "page": page, "page_size": page_size, "nearby": True, "radius_km": radius_km}
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    jobs = db.scalars(query.order_by(Job.start_at.asc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [serialize_job(db, job, worker_profile) for job in jobs], "total": total,
            "page": page, "page_size": page_size, "nearby": False}


@app.post("/api/jobs/nearby")
def list_nearby_jobs(
    body: NearbyJobsSearchBody,
    request: Request,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Search public nearby jobs without putting precise coordinates into URL query strings."""
    enforce_rate_limit(
        request,
        "nearby_jobs",
        90,
        "Too many nearby searches. Please wait a moment and try again.",
    )
    return list_jobs(
        city=body.city,
        category=body.category,
        search=body.search,
        min_pay=body.min_pay,
        max_pay=body.max_pay,
        latitude=body.latitude,
        longitude=body.longitude,
        radius_km=body.radius_km,
        page=body.page,
        page_size=body.page_size,
        db=db,
        authorization=authorization,
    )


@app.get("/api/jobs/{job_id}")
def job_detail(job_id: int, db: Session = Depends(get_db), authorization: str | None = Header(default=None)):
    job = db.get(Job, job_id)
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="This opportunity is not available.")
    profile = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            claims = jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
            u = db.get(User, int(claims["sub"]))
            if u and u.active and u.role == "worker":
                profile = db.get(WorkerProfile, u.id)
        except Exception:
            pass
    return {"job": serialize_job(db, job, profile)}


@app.post("/api/jobs", status_code=201)
def create_job(body: JobBody, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    profile = get_business_profile(db, user.id)
    if body.publish and profile.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Business verification is required before publishing jobs. Save it as a draft while verification is pending.")
    job = Job(
        business_id=user.id, title=body.title.strip(), description=body.description.strip(), category=body.category.strip(),
        city=body.city.strip(), address=body.address.strip(), latitude=body.latitude, longitude=body.longitude, slots=body.slots, start_at=as_utc(body.start_at), end_at=as_utc(body.end_at),
        pay_amount=body.pay_amount, pay_basis=body.pay_basis, payment_terms=body.payment_terms.strip(), requirements=body.requirements,
        min_experience=body.min_experience, breaks_info=body.breaks_info.strip(), equipment_info=body.equipment_info.strip(),
        safety_info=body.safety_info.strip(), application_deadline=as_utc(body.application_deadline),
        cancellation_policy=body.cancellation_policy.strip(), status="published" if body.publish else "draft",
    )
    db.add(job)
    db.flush()
    log_event(db, user.id, "job_created", "job", job.id, {"status": job.status})
    if job.status == "published":
        db.add(Notification(user_id=user.id, title="Job published", body=f"{job.title} is now visible to eligible workers."))
    db.commit()
    return {"job": serialize_job(db, job)}


@app.get("/api/business/jobs")
def business_jobs(user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).where(Job.business_id == user.id).order_by(Job.created_at.desc()).limit(100)).all()
    return {"items": [serialize_job(db, j) for j in jobs]}


@app.patch("/api/jobs/{job_id}/location")
def update_job_location(job_id: int, body: WorkplaceLocationBody,
                        user: User = Depends(require_role("business", "admin")), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or (user.role != "admin" and job.business_id != user.id):
        raise HTTPException(status_code=404, detail="Job not found.")
    job.latitude = body.latitude
    job.longitude = body.longitude
    job.updated_at = utc_now()
    log_event(db, user.id, "job_workplace_pin_updated", "job", job.id)
    db.commit()
    return {"job": serialize_job(db, job)}


@app.post("/api/jobs/{job_id}/publish")
def publish_job(job_id: int, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    job = get_owned_job(db, job_id, user.id)
    ensure_business_can_publish(db, user.id)
    if job.status not in {"draft", "paused"}:
        raise HTTPException(status_code=409, detail="Only draft or paused jobs can be published.")
    if as_utc(job.start_at) <= utc_now() or as_utc(job.application_deadline) <= utc_now():
        raise HTTPException(status_code=409, detail="This job's deadline or shift time has passed.")
    if job.latitude is None or job.longitude is None:
        raise HTTPException(status_code=409, detail="Set the workplace pin first so workers within 1–5 km can find this shift.")
    job.status = "published"
    log_event(db, user.id, "job_published", "job", job.id)
    db.commit()
    return {"job": serialize_job(db, job)}


@app.patch("/api/jobs/{job_id}/status")
def set_job_status(job_id: int, body: dict[str, str], user: User = Depends(require_role("business", "admin")), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or (user.role != "admin" and job.business_id != user.id):
        raise HTTPException(status_code=404, detail="Job not found.")
    desired = body.get("status")
    if desired not in {"paused", "closed", "cancelled"}:
        raise HTTPException(status_code=422, detail="Status must be paused, closed, or cancelled.")
    if desired == "cancelled":
        active = db.scalars(select(Assignment).where(Assignment.job_id == job.id, Assignment.status.in_(["confirmed", "checked_in", "checked_out", "disputed"]))).all()
        if active and user.role != "admin":
            raise HTTPException(status_code=409, detail="This job has confirmed workers. Contact support to cancel it safely.")
        for assignment in active:
            assignment.status = "cancelled"
            notify(db, assignment.worker_id, "Shift cancelled", f"The shift '{job.title}' has been cancelled. Please review your schedule.")
    job.status = desired
    log_event(db, user.id, "job_status_changed", "job", job.id, {"status": desired})
    db.commit()
    return {"job": serialize_job(db, job)}


@app.post("/api/jobs/{job_id}/apply", status_code=201)
def apply_for_job(job_id: int, body: ApplyBody, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job or job.status != "published" or as_utc(job.application_deadline) <= utc_now():
        raise HTTPException(status_code=404, detail="Applications for this opportunity are closed.")
    conflict = assignment_conflict(db, user.id, job)
    if conflict:
        raise HTTPException(status_code=409, detail=conflict)
    profile = get_worker_profile(db, user.id)
    match = match_job(profile, job)
    if match["missing_skills"]:
        raise HTTPException(status_code=409, detail=f"This shift requires skills not listed on your profile: {', '.join(match['missing_skills'][:5])}. Update your skills or choose another shift.")
    if not match["experience_ok"]:
        raise HTTPException(status_code=409, detail=f"This shift requires at least {job.min_experience} year(s) of relevant experience.")
    if match["availability_fit"] == "no":
        raise HTTPException(status_code=409, detail="This shift falls outside your saved availability. Update your availability if the schedule has changed, then review the shift terms again.")
    if (db.scalar(select(func.count(Assignment.id)).where(Assignment.job_id == job.id, Assignment.status != "cancelled")) or 0) >= job.slots:
        raise HTTPException(status_code=409, detail="All positions for this shift are filled.")
    app_exists = db.scalar(select(Application.id).where(Application.job_id == job.id, Application.worker_id == user.id))
    if app_exists:
        raise HTTPException(status_code=409, detail="You have already applied for this shift.")
    application = Application(job_id=job.id, worker_id=user.id, note=body.note.strip())
    db.add(application)
    db.flush()
    notify(db, job.business_id, "New application received", f"{user.full_name} applied for {job.title}.")
    notify(db, user.id, "Application submitted", f"Your application for {job.title} was sent to the business.")
    log_event(db, user.id, "application_submitted", "application", application.id, {"job_id": job.id})
    db.commit()
    return {"application": serialize_application(db, application)}


@app.post("/api/applications/{application_id}/withdraw")
def withdraw_application(application_id: int, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    if not application or application.worker_id != user.id:
        raise HTTPException(status_code=404, detail="Application not found.")
    if application.status not in {"applied", "shortlisted"}:
        raise HTTPException(status_code=409, detail="An application can only be withdrawn before an offer is sent.")
    job = db.get(Job, application.job_id)
    application.status = "withdrawn"
    if job:
        notify(db, job.business_id, "Application withdrawn", f"{user.full_name} withdrew the application for {job.title}.")
    log_event(db, user.id, "application_withdrawn", "application", application.id, {"job_id": application.job_id})
    db.commit()
    return {"application": serialize_application(db, application)}


@app.get("/api/worker/saved-shifts")
def list_saved_shifts(user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    """Return only this worker's saved, still-published future shifts."""
    now = utc_now()
    rows = db.execute(
        select(SavedShift, Job)
        .join(Job, Job.id == SavedShift.job_id)
        .where(
            SavedShift.worker_id == user.id,
            Job.status == "published",
            Job.start_at > now,
            Job.application_deadline > now,
        )
        .order_by(SavedShift.created_at.desc())
        .limit(100)
    ).all()
    profile = get_worker_profile(db, user.id)
    items = []
    for saved, job in rows:
        item = serialize_job(db, job, profile)
        item["saved_at"] = as_utc(saved.created_at).isoformat()
        items.append(item)
    return {"items": items, "total": len(items)}


@app.post("/api/jobs/{job_id}/save")
def save_shift(job_id: int, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    """Idempotently save a shift to the authenticated worker's private list."""
    job = db.get(Job, job_id)
    if not job or job.status != "published" or as_utc(job.start_at) <= utc_now() or as_utc(job.application_deadline) <= utc_now():
        raise HTTPException(status_code=404, detail="This shift is no longer available to save.")
    saved = db.scalar(select(SavedShift).where(SavedShift.worker_id == user.id, SavedShift.job_id == job_id))
    if not saved:
        db.add(SavedShift(worker_id=user.id, job_id=job_id))
        try:
            db.commit()
        except IntegrityError:
            # Two fast requests can race; the uniqueness constraint makes the second save idempotent.
            db.rollback()
            saved = db.scalar(select(SavedShift).where(SavedShift.worker_id == user.id, SavedShift.job_id == job_id))
            if not saved:
                raise
    return {"saved": True, "job_id": job_id}


@app.delete("/api/jobs/{job_id}/save")
def unsave_shift(job_id: int, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    """Idempotently remove a shift from the authenticated worker's private list."""
    saved = db.scalar(select(SavedShift).where(SavedShift.worker_id == user.id, SavedShift.job_id == job_id))
    if saved:
        db.delete(saved)
        db.commit()
    return {"saved": False, "job_id": job_id}


@app.get("/api/applications/me")
def my_applications(user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    items = db.scalars(select(Application).where(Application.worker_id == user.id).order_by(Application.created_at.desc()).limit(100)).all()
    return {"items": [serialize_application(db, a) for a in items]}


@app.get("/api/business/applications")
def list_applications(job_id: int | None = None, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    query = select(Application).join(Job).where(Job.business_id == user.id)
    if job_id is not None:
        query = query.where(Application.job_id == job_id)
    apps = db.scalars(query.order_by(Application.created_at.desc()).limit(200)).all()
    return {"items": [serialize_application(db, a) for a in apps]}


@app.patch("/api/applications/{application_id}/status")
def update_application_status(application_id: int, body: ApplicationStatusBody, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    job = db.scalar(select(Job).where(Job.id == application.job_id).with_for_update()) if application else None
    if not application or not job or job.business_id != user.id:
        raise HTTPException(status_code=404, detail="Application not found.")
    if application.status not in {"applied", "shortlisted"}:
        raise HTTPException(status_code=409, detail="This application can no longer be changed at this stage.")
    application.status = body.status
    notify(db, application.worker_id, "Application updated", f"Your application for {job.title} is now {body.status}.")
    log_event(db, user.id, "application_status_changed", "application", application.id, {"status": body.status})
    db.commit()
    return {"application": serialize_application(db, application)}


@app.post("/api/applications/{application_id}/offer")
def send_offer(application_id: int, user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    job = db.get(Job, application.job_id) if application else None
    if not application or not job or job.business_id != user.id:
        raise HTTPException(status_code=404, detail="Application not found.")
    if application.status not in {"applied", "shortlisted"}:
        raise HTTPException(status_code=409, detail="An offer cannot be sent at this stage.")
    if job.status != "published":
        raise HTTPException(status_code=409, detail="The job must still be published to send offers.")
    filled = db.scalar(select(func.count(Assignment.id)).where(Assignment.job_id == job.id, Assignment.status != "cancelled")) or 0
    offers = db.scalar(select(func.count(Application.id)).where(Application.job_id == job.id, Application.status == "offered")) or 0
    if filled + offers >= job.slots:
        raise HTTPException(status_code=409, detail="All positions are already filled or offered.")
    application.status = "offered"
    notify(db, application.worker_id, "You have a work offer", f"{job.title} in {job.city}: ₹{job.pay_amount:,.0f} per {job.pay_basis}. Review and respond.")
    log_event(db, user.id, "offer_sent", "application", application.id)
    db.commit()
    return {"application": serialize_application(db, application)}


@app.post("/api/applications/{application_id}/respond")
def respond_to_offer(application_id: int, body: RespondOfferBody, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    if not application or application.worker_id != user.id:
        raise HTTPException(status_code=404, detail="Offer not found.")
    if application.status != "offered":
        raise HTTPException(status_code=409, detail="This application does not have a pending offer.")
    job = db.scalar(select(Job).where(Job.id == application.job_id).with_for_update())
    if not job:
        raise HTTPException(status_code=404, detail="The shift for this offer no longer exists.")
    if body.decision == "declined":
        application.status = "declined"
        notify(db, job.business_id, "Offer declined", f"{user.full_name} declined the offer for {job.title}.")
        log_event(db, user.id, "offer_declined", "application", application.id)
        db.commit()
        return {"application": serialize_application(db, application), "assignment": None}
    if job.status != "published" or as_utc(job.application_deadline) <= utc_now() or as_utc(job.start_at) <= utc_now():
        raise HTTPException(status_code=409, detail="This shift is no longer open for acceptance. Contact the business if you believe this is an error.")
    profile = get_worker_profile(db, user.id)
    match = match_job(profile, job)
    if match["missing_skills"]:
        raise HTTPException(status_code=409, detail=f"Your profile no longer lists the required skills: {', '.join(match['missing_skills'][:5])}.")
    if not match["experience_ok"]:
        raise HTTPException(status_code=409, detail=f"This shift requires at least {job.min_experience} year(s) of relevant experience.")
    if match["availability_fit"] == "no":
        raise HTTPException(status_code=409, detail="The shift is outside your saved availability. Update your profile before accepting this offer.")
    conflict = assignment_conflict(db, user.id, job)
    if conflict:
        raise HTTPException(status_code=409, detail=conflict)
    filled = db.scalar(select(func.count(Assignment.id)).where(Assignment.job_id == job.id, Assignment.status != "cancelled")) or 0
    if filled >= job.slots:
        raise HTTPException(status_code=409, detail="The shift has already been filled. Contact the business for help.")
    gross = expected_gross_pay(job)
    fee = round(gross * DEFAULT_PLATFORM_FEE_PERCENT / 100, 2)
    assignment = Assignment(job_id=job.id, worker_id=user.id, application_id=application.id,
                            status="confirmed", gross_pay=gross, platform_fee=fee, net_pay=round(gross-fee, 2))
    application.status = "accepted"
    db.add(assignment)
    db.flush()
    notify(db, user.id, "Shift confirmed", f"You're confirmed for {job.title}. Review location, instructions and check-in rules before travelling.")
    notify(db, job.business_id, "Worker confirmed", f"{user.full_name} accepted the offer for {job.title}.")
    log_event(db, user.id, "assignment_confirmed", "assignment", assignment.id, {"job_id": job.id})
    db.commit()
    return {"application": serialize_application(db, application), "assignment": serialize_assignment(db, assignment)}


@app.get("/api/assignments/me")
def my_assignments(user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    items = db.scalars(select(Assignment).where(Assignment.worker_id == user.id).order_by(Assignment.created_at.desc()).limit(100)).all()
    return {"items": [serialize_assignment(db, a) for a in items]}


@app.get("/api/business/assignments")
def business_assignments(user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    items = db.scalars(select(Assignment).join(Job).where(Job.business_id == user.id).order_by(Assignment.created_at.desc()).limit(200)).all()
    return {"items": [serialize_assignment(db, a) for a in items]}


@app.post("/api/assignments/{assignment_id}/cancel")
def cancel_assignment(assignment_id: int, body: CancelAssignmentBody,
                     user: User = Depends(require_role("worker", "business")), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    job = db.get(Job, assignment.job_id) if assignment else None
    if not assignment or not job:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if user.role == "worker" and assignment.worker_id != user.id:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if user.role == "business" and job.business_id != user.id:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if assignment.status != "confirmed":
        raise HTTPException(status_code=409, detail="Only a not-yet-started confirmed assignment can be cancelled here. Use the dispute/support flow after attendance begins.")
    if as_utc(job.start_at) <= utc_now():
        raise HTTPException(status_code=409, detail="The shift has started or is too close to start. Contact the other party and support instead of silently cancelling it.")
    assignment.status = "cancelled"
    assignment.payout_status = "not_due"
    other_user_id = job.business_id if user.role == "worker" else assignment.worker_id
    actor_kind = "worker" if user.role == "worker" else "business"
    reason = body.reason.strip()[:500]
    notify(db, other_user_id, "Assignment cancelled", f"The assignment for {job.title} was cancelled by the {actor_kind}. Review the published cancellation terms. {reason}".strip())
    log_event(db, user.id, "assignment_cancelled", "assignment", assignment.id, {"reason": reason, "cancelled_by_role": actor_kind})
    db.commit()
    return {"assignment": serialize_assignment(db, assignment)}


@app.post("/api/assignments/{assignment_id}/check-in")
def check_in(assignment_id: int, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or assignment.worker_id != user.id:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if assignment.status != "confirmed":
        raise HTTPException(status_code=409, detail="This assignment is not ready for check-in.")
    job = db.get(Job, assignment.job_id)
    now, start = utc_now(), as_utc(job.start_at)
    if now < start - timedelta(hours=2) or now > as_utc(job.end_at):
        raise HTTPException(status_code=409, detail="Check-in is available from two hours before the shift until the scheduled shift ends. Use your published workplace verification instructions.")
    assignment.status = "checked_in"
    assignment.checkin_at = now
    log_event(db, user.id, "assignment_checked_in", "assignment", assignment.id)
    notify(db, job.business_id, "Worker checked in", f"{user.full_name} checked in for {job.title}.")
    db.commit()
    return {"assignment": serialize_assignment(db, assignment)}


@app.post("/api/assignments/{assignment_id}/check-out")
def check_out(assignment_id: int, user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    if not assignment or assignment.worker_id != user.id:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if assignment.status != "checked_in":
        raise HTTPException(status_code=409, detail="Check-in is required before check-out.")
    job = db.get(Job, assignment.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Assignment shift not found.")
    now = utc_now()
    if now < as_utc(job.end_at):
        raise HTTPException(status_code=409, detail="Check-out is available after the scheduled shift end. If the work ended early, ask the business or support to document the exception.")
    assignment.status = "checked_out"
    assignment.checkout_at = now
    log_event(db, user.id, "assignment_checked_out", "assignment", assignment.id)
    db.commit()
    return {"assignment": serialize_assignment(db, assignment)}


@app.post("/api/assignments/{assignment_id}/complete")
def approve_completion(assignment_id: int, user: User = Depends(require_role("business", "admin")), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    job = db.get(Job, assignment.job_id) if assignment else None
    if not assignment or not job or (user.role != "admin" and job.business_id != user.id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if assignment.status != "checked_out":
        raise HTTPException(status_code=409, detail="The worker must check out after the scheduled shift end before completion can be approved.")
    assignment.status = "completed"
    assignment.completed_at = utc_now()
    assignment.completion_approved_at = utc_now()
    assignment.payout_status = "pending"
    log_event(db, user.id, "work_completion_approved", "assignment", assignment.id, {"payout_status": "pending"})
    notify(db, assignment.worker_id, "Work marked complete", f"{job.title} was marked complete. Payment is pending provider-verified settlement.")
    db.commit()
    return {"assignment": serialize_assignment(db, assignment)}


@app.post("/api/assignments/{assignment_id}/dispute", status_code=201)
def open_dispute(assignment_id: int, body: DisputeBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    job = db.get(Job, assignment.job_id) if assignment else None
    if not assignment or not job or (user.id not in {assignment.worker_id, job.business_id} and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if assignment.status not in {"checked_in", "checked_out", "completed", "disputed"}:
        raise HTTPException(status_code=409, detail="This assignment is not eligible for a dispute.")
    existing = db.scalar(select(Dispute.id).where(Dispute.assignment_id == assignment.id, Dispute.status == "open"))
    if existing:
        raise HTTPException(status_code=409, detail="An open dispute already exists for this assignment.")
    dispute = Dispute(
        assignment_id=assignment.id, reporter_id=user.id, reason=body.reason.strip(),
        assignment_status_before=assignment.status, payout_status_before=assignment.payout_status,
    )
    assignment.status = "disputed"
    if assignment.payout_status == "pending":
        assignment.payout_status = "disputed"
    db.add(dispute)
    other = job.business_id if user.id == assignment.worker_id else assignment.worker_id
    notify(db, other, "Assignment dispute opened", f"A dispute was raised for {job.title}. Check the support and admin process for next steps.")
    log_event(db, user.id, "dispute_opened", "dispute", "pending", {"assignment_id": assignment.id})
    db.commit()
    return {"dispute": {"id": dispute.id, "assignment_id": assignment.id, "status": dispute.status}}


@app.get("/api/notifications")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)).all()
    return {"items": [{"id": n.id, "title": n.title, "body": n.body, "read": bool(n.read_at), "created_at": as_utc(n.created_at).isoformat()} for n in items]}


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(Notification, notification_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found.")
    item.read_at = utc_now()
    db.commit()
    return {"ok": True}


@app.get("/api/worker/earnings")
def worker_earnings(user: User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    assignments = db.scalars(select(Assignment).where(Assignment.worker_id == user.id).order_by(Assignment.created_at.desc()).limit(200)).all()
    assignment_ids = [a.id for a in assignments]
    previous_status: dict[int, str] = {}
    if assignment_ids:
        disputes = db.scalars(select(Dispute).where(Dispute.assignment_id.in_(assignment_ids)).order_by(Dispute.created_at.desc())).all()
        for dispute in disputes:
            previous_status.setdefault(dispute.assignment_id, dispute.assignment_status_before)
    is_completed_work = lambda a: a.status == "completed" or (a.status == "disputed" and previous_status.get(a.id) == "completed")
    sum_by = lambda predicate, attr: round(sum(getattr(a, attr) for a in assignments if predicate(a)), 2)
    return {
        "completed_assignments": len([a for a in assignments if is_completed_work(a)]),
        "gross_completed": sum_by(is_completed_work, "gross_pay"),
        "net_completed": sum_by(is_completed_work, "net_pay"),
        "pending_settlement": sum_by(lambda a: a.payout_status == "pending", "net_pay"),
        "verified_paid": sum_by(lambda a: a.payout_status == "paid", "net_pay"),
        "items": [serialize_assignment(db, a) for a in assignments],
        "notice": "Amounts are based on recorded assignments. A pending amount is not a completed payout.",
    }


@app.post("/api/reviews/assignments/{assignment_id}", status_code=201)
def create_review(assignment_id: int, body: ReviewBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    assignment = db.get(Assignment, assignment_id)
    job = db.get(Job, assignment.job_id) if assignment else None
    if not assignment or not job or user.id not in {assignment.worker_id, job.business_id} or user.role not in {"worker", "business"}:
        raise HTTPException(status_code=404, detail="Completed assignment not found for this account.")
    if assignment.status != "completed":
        raise HTTPException(status_code=409, detail="Reviews open only after the assignment is completed and any active dispute is closed.")
    existing = db.scalar(select(Review.id).where(Review.assignment_id == assignment.id, Review.reviewer_id == user.id))
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this assignment.")
    reviewee_id = job.business_id if user.id == assignment.worker_id else assignment.worker_id
    review = Review(assignment_id=assignment.id, reviewer_id=user.id, reviewee_id=reviewee_id,
                    rating=body.rating, comment=body.comment.strip())
    db.add(review)
    db.flush()
    notify(db, reviewee_id, "New assignment review", f"You received a {body.rating}-star review for {job.title}.")
    log_event(db, user.id, "review_created", "review", review.id, {"assignment_id": assignment.id, "reviewee_id": reviewee_id, "rating": body.rating})
    db.commit()
    db.refresh(review)
    log_review = {"id": review.id, "assignment_id": review.assignment_id, "reviewee_id": review.reviewee_id,
                  "rating": review.rating, "comment": review.comment, "created_at": as_utc(review.created_at).isoformat()}
    return {"review": log_review}


# ----- Founder admin console API -----
@app.get("/api/admin/users")
def admin_users(
    role_filter: Literal["all", "worker", "business", "admin"] = "all",
    status_filter: Literal["all", "active", "inactive"] = "all",
    search: str = Query(default="", max_length=120),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Return a minimal, searchable account inventory for authorised admins only."""
    query = select(User)
    if role_filter != "all":
        query = query.where(User.role == role_filter)
    if status_filter == "active":
        query = query.where(User.active.is_(True))
    elif status_filter == "inactive":
        query = query.where(User.active.is_(False))
    term = search.strip().lower()
    if term:
        query = query.where(
            func.lower(User.email).contains(term) | func.lower(User.full_name).contains(term)
        )
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    accounts = db.scalars(query.order_by(User.created_at.desc(), User.id.desc()).limit(200)).all()
    items = []
    for account in accounts:
        item = {
            "id": account.id,
            "email": account.email,
            "full_name": account.full_name,
            "role": account.role,
            "active": account.active,
            "email_verified": account.email_verified,
            "created_at": as_utc(account.created_at).isoformat(),
        }
        if account.role == "business":
            profile = db.get(BusinessProfile, account.id)
            item["business_name"] = profile.legal_name if profile else ""
            item["city"] = profile.city if profile else ""
            item["verification_status"] = profile.verification_status if profile else "pending"
        elif account.role == "worker":
            profile = db.get(WorkerProfile, account.id)
            item["city"] = profile.city if profile else ""
        items.append(item)
    return {"items": items, "total": total, "limit": 200, "truncated": total > len(items)}


@app.patch("/api/admin/users/{target_user_id}/status")
def update_admin_user_status(
    target_user_id: int,
    body: AdminUserStatusBody,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Suspend/reactivate an account without deleting it; protect the current and final admin."""
    target = db.get(User, target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Account not found.")
    if target.id == user.id and not body.active:
        raise HTTPException(status_code=409, detail="You cannot suspend your own active admin session.")
    if target.role == "admin" and target.active and not body.active:
        active_admins = int(db.scalar(
            select(func.count()).select_from(User).where(User.role == "admin", User.active.is_(True))
        ) or 0)
        if active_admins <= 1:
            raise HTTPException(status_code=409, detail="The last active admin account cannot be suspended.")
    if target.active == body.active:
        return {"id": target.id, "active": target.active, "changed": False, "message": "Account already has that status."}

    target.active = body.active
    paused_jobs = 0
    if target.role == "business" and not body.active:
        # Prevent a suspended business's unfilled public listings from accepting more applicants.
        active_jobs = db.scalars(select(Job).where(Job.business_id == target.id, Job.status == "published")).all()
        for job in active_jobs:
            job.status = "paused"
            paused_jobs += 1
        if paused_jobs:
            log_event(db, user.id, "business_jobs_paused_on_suspension", "user", target.id, {"job_ids": [job.id for job in active_jobs]})

    log_event(db, user.id, "account_status_changed", "user", target.id, {
        "active": body.active,
        "reason": body.reason,
        "role": target.role,
        "paused_published_jobs": paused_jobs,
    })
    notify(
        db,
        target.id,
        "Account access updated",
        "Your account access was restored by EarnRoute support." if body.active
        else "Your EarnRoute account has been temporarily suspended. Contact support if you believe this is an error.",
    )
    db.commit()
    return {"id": target.id, "active": target.active, "changed": True, "paused_published_jobs": paused_jobs}


@app.get("/api/admin/system")
def admin_system(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Expose operational readiness without returning environment values or provider secrets."""
    started = time.perf_counter()
    db_status = "ok"
    db_message = "Database query succeeded."
    try:
        db.execute(select(1))
    except Exception:
        db_status = "error"
        db_message = "Database query failed."
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    count = lambda model, *conditions: int(db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0)
    open_support = count(SupportTicket, SupportTicket.status.in_(("open", "in_progress", "waiting_user")))
    open_safety = count(
        SupportTicket,
        SupportTicket.category == "safety",
        SupportTicket.status.in_(("open", "in_progress", "waiting_user")),
    )
    return {
        "api": "ok",
        "database": {"status": db_status, "latency_ms": latency_ms, "message": db_message},
        "environment": APP_ENV,
        "release": os.getenv("APP_RELEASE", "not set"),
        "accounts": {"total": count(User), "active": count(User, User.active.is_(True)), "inactive": count(User, User.active.is_(False))},
        "marketplace": {"published_jobs": count(Job, Job.status == "published"), "open_disputes": count(Dispute, Dispute.status == "open")},
        "support": {"open_tickets": open_support, "open_safety_reports": open_safety},
        "integrations": {
            "razorpay_webhook": {"configured": bool(os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()), "secret_exposed": False},
            "error_monitoring": {"configured": bool(os.getenv("SENTRY_DSN", "").strip()), "secret_exposed": False},
            "email_delivery": {"configured": False, "note": "No email-delivery provider is wired into the current backend."},
            "sms_otp": {"configured": False, "note": "No SMS/OTP provider is wired into the current backend."},
        },
        "note": "Readiness indicators report configuration presence only; they do not prove that an external provider is approved or delivering successfully.",
    }


@app.get("/api/admin/overview")
def admin_overview(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    count = lambda model, *conditions: int(db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0)
    active_workers = count(User, User.role == "worker", User.active.is_(True))
    businesses = count(User, User.role == "business", User.active.is_(True))
    verified = count(BusinessProfile, BusinessProfile.verification_status == "verified")
    published_jobs = count(Job, Job.status == "published")
    assignments = count(Assignment)
    completed = count(Assignment, Assignment.status == "completed")
    disputed = count(Dispute, Dispute.status == "open")
    pending_settlements = db.scalar(select(func.coalesce(func.sum(Assignment.net_pay), 0)).where(Assignment.payout_status == "pending")) or 0
    recognized_platform_revenue = db.scalar(select(func.coalesce(func.sum(Assignment.platform_fee), 0)).where(Assignment.status == "completed", Assignment.payout_status == "paid")) or 0
    return {"active_workers": active_workers, "business_accounts": businesses, "verified_businesses": verified,
            "published_jobs": published_jobs, "assignments": assignments, "completed_assignments": completed,
            "open_disputes": disputed, "pending_settlements": round(float(pending_settlements), 2),
            "recognized_platform_revenue": round(float(recognized_platform_revenue), 2),
            "revenue_note": "Recognized revenue includes only completed assignments with reconciled payout status. This is not profit.",
            "pending_business_verifications": count(BusinessProfile, BusinessProfile.verification_status == "pending"),
            "open_support_tickets": count(SupportTicket, SupportTicket.status.in_(("open", "in_progress", "waiting_user"))),
            "open_safety_reports": count(SupportTicket, SupportTicket.category == "safety", SupportTicket.status.in_(("open", "in_progress", "waiting_user"))),
            "active_accounts": count(User, User.active.is_(True)),
            "inactive_accounts": count(User, User.active.is_(False))}


@app.get("/api/admin/businesses")
def admin_businesses(status_filter: Literal["pending", "verified", "rejected", "all"] = "pending", user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    query = select(BusinessProfile).join(User, User.id == BusinessProfile.user_id)
    if status_filter != "all":
        query = query.where(BusinessProfile.verification_status == status_filter)
    profiles = db.scalars(query.order_by(BusinessProfile.user_id.desc()).limit(200)).all()
    return {"items": [{"user_id": p.user_id, "email": db.get(User, p.user_id).email, "owner_name": db.get(User, p.user_id).full_name,
                       "legal_name": p.legal_name, "category": p.category, "city": p.city, "address": p.address,
                       "phone": p.phone, "description": p.description, "verification_status": p.verification_status,
                       "verification_reason": p.verification_reason, "terms_accepted": p.terms_accepted} for p in profiles]}


@app.patch("/api/admin/businesses/{business_user_id}/verification")
def verify_business(business_user_id: int, body: dict[str, str], user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    profile = db.get(BusinessProfile, business_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Business profile not found.")
    action = body.get("status")
    reason = str(body.get("reason", "")).strip()[:500]
    if action not in {"verified", "rejected", "pending"}:
        raise HTTPException(status_code=422, detail="Status must be verified, rejected, or pending.")
    if action == "rejected" and len(reason) < 8:
        raise HTTPException(status_code=422, detail="Provide a clear rejection reason.")
    profile.verification_status = action
    profile.verification_reason = reason
    notify(db, profile.user_id, "Business verification updated", f"Your business verification status is {action}. {reason}".strip())
    log_event(db, user.id, "business_verification_changed", "business_profile", business_user_id, {"status": action, "reason": reason})
    db.commit()
    return {"user_id": profile.user_id, "verification_status": profile.verification_status, "verification_reason": profile.verification_reason}


@app.get("/api/admin/jobs")
def admin_jobs(status_filter: Literal["draft", "published", "paused", "closed", "cancelled", "all"] = "all", user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    query = select(Job)
    if status_filter != "all":
        query = query.where(Job.status == status_filter)
    jobs = db.scalars(query.order_by(Job.created_at.desc()).limit(200)).all()
    return {"items": [serialize_job(db, j) for j in jobs]}


@app.get("/api/admin/disputes")
def admin_disputes(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    disputes = db.scalars(select(Dispute).order_by(Dispute.created_at.desc()).limit(200)).all()
    items = []
    for d in disputes:
        a = db.get(Assignment, d.assignment_id)
        j = db.get(Job, a.job_id) if a else None
        reporter = db.get(User, d.reporter_id)
        items.append({"id": d.id, "assignment_id": d.assignment_id, "job_title": j.title if j else "",
                      "reporter": reporter.full_name if reporter else "Unknown", "reason": d.reason,
                      "status": d.status, "resolution_note": d.resolution_note, "created_at": as_utc(d.created_at).isoformat()})
    return {"items": items}


@app.patch("/api/admin/disputes/{dispute_id}")
def resolve_dispute(dispute_id: int, body: ResolveDisputeBody, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found.")
    if dispute.status != "open":
        raise HTTPException(status_code=409, detail="This dispute is already closed.")
    dispute.status = body.status
    dispute.resolution_note = body.resolution_note.strip()
    assignment = db.get(Assignment, dispute.assignment_id)
    if assignment:
        assignment.status = dispute.assignment_status_before
        assignment.payout_status = dispute.payout_status_before
        job = db.get(Job, assignment.job_id)
        notify(db, assignment.worker_id, "Dispute updated", f"The dispute for {job.title if job else 'your assignment'} was {body.status}.")
        if job:
            notify(db, job.business_id, "Dispute updated", f"The dispute for {job.title} was {body.status}.")
    log_event(db, user.id, "dispute_resolved", "dispute", dispute.id, {"status": body.status})
    db.commit()
    return {"id": dispute.id, "status": dispute.status, "resolution_note": dispute.resolution_note}


@app.get("/api/admin/audit")
def admin_audit(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    items = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(200)).all()
    return {"items": [{"id": e.id, "actor_user_id": e.actor_user_id, "action": e.action, "entity_type": e.entity_type,
                       "entity_id": e.entity_id, "detail": e.detail, "created_at": as_utc(e.created_at).isoformat()} for e in items]}


# Payment reconciliation is intentionally provider-verified. Manual dashboard clicks never set a payout to paid.
@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request, x_razorpay_signature: str | None = Header(default=None), db: Session = Depends(get_db)):
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured. Payout status remains pending.")
    raw = await request.body()
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing provider signature.")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid provider signature.")
    try:
        payload = json.loads(raw)
        event_id = str(payload.get("id", ""))
        event_type = str(payload.get("event", ""))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid webhook payload.")
    if not event_id:
        raise HTTPException(status_code=400, detail="Provider event id is required.")
    if db.scalar(select(ProviderEvent.id).where(ProviderEvent.provider_event_id == event_id)):
        return {"received": True, "duplicate": True}
    db.add(ProviderEvent(provider_event_id=event_id, event_type=event_type, payload_sha256=hashlib.sha256(raw).hexdigest()))
    # Do not mark worker payouts paid merely because any generic payment.captured event was sent.
    # A provider-specific settlement/payout mapping must be configured to link a signed event to an assignment.
    log_event(db, None, "payment_provider_event_received", "provider_event", event_id, {"event_type": event_type})
    db.commit()
    return {"received": True, "mapped_to_payout": False, "note": "Signed event stored idempotently; payout remains unchanged until a verified settlement mapping is configured."}


@app.post("/api/support/tickets", status_code=201)
def create_support_ticket(body: SupportTicketCreateBody, user: User = Depends(require_role("worker", "business")), db: Session = Depends(get_db)):
    ticket = SupportTicket(user_id=user.id, subject=body.subject, category=body.category, status="open")
    db.add(ticket)
    db.flush()
    db.add(SupportMessage(ticket_id=ticket.id, sender_user_id=user.id, message=body.message))
    log_event(db, user.id, "support_ticket_created", "support_ticket", ticket.id, {"category": body.category})
    for administrator in db.scalars(select(User).where(User.role == "admin", User.active.is_(True))).all():
        notify(db, administrator.id, "New support ticket", f"{body.subject} · submitted by {user.full_name}.")
    db.commit()
    db.refresh(ticket)
    return {"ticket": serialize_support_ticket(db, ticket, include_messages=True)}


@app.get("/api/support/tickets/me")
def my_support_tickets(user: User = Depends(require_role("worker", "business")), db: Session = Depends(get_db)):
    tickets = db.scalars(
        select(SupportTicket).where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc()).limit(100)
    ).all()
    return {"items": [serialize_support_ticket(db, item) for item in tickets]}


@app.get("/api/support/tickets/{ticket_id}")
def get_support_ticket(ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket or (user.role != "admin" and ticket.user_id != user.id):
        raise HTTPException(status_code=404, detail="Support ticket not found.")
    return {"ticket": serialize_support_ticket(db, ticket, include_messages=True)}


@app.post("/api/support/tickets/{ticket_id}/messages", status_code=201)
def add_support_message(ticket_id: int, body: SupportMessageBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket or (user.role != "admin" and ticket.user_id != user.id):
        raise HTTPException(status_code=404, detail="Support ticket not found.")
    if user.role not in {"worker", "business", "admin"}:
        raise HTTPException(status_code=403, detail="This account cannot reply to support tickets.")
    if ticket.status == "closed":
        raise HTTPException(status_code=409, detail="This support ticket is closed. Create a new ticket if you still need help.")
    db.add(SupportMessage(ticket_id=ticket.id, sender_user_id=user.id, message=body.message))
    ticket.updated_at = utc_now()
    if user.role == "admin":
        ticket.status = "waiting_user"
        ticket.closed_at = None
        notify(db, ticket.user_id, "Support replied", f"We replied to your support ticket: {ticket.subject}.")
    else:
        if ticket.status in {"resolved", "waiting_user"}:
            ticket.status = "open"
            ticket.closed_at = None
        for administrator in db.scalars(select(User).where(User.role == "admin", User.active.is_(True))).all():
            notify(db, administrator.id, "Support ticket updated", f"{ticket.subject} has a new reply.")
    log_event(db, user.id, "support_message_added", "support_ticket", ticket.id, {"sender_role": user.role})
    db.commit()
    db.refresh(ticket)
    return {"ticket": serialize_support_ticket(db, ticket, include_messages=True)}


@app.get("/api/admin/support/tickets")
def admin_support_tickets(status_filter: str | None = None, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    allowed = {"open", "in_progress", "waiting_user", "resolved", "closed"}
    if status_filter and status_filter not in allowed:
        raise HTTPException(status_code=422, detail="Choose a supported support-ticket status.")
    query = select(SupportTicket)
    if status_filter:
        query = query.where(SupportTicket.status == status_filter)
    tickets = db.scalars(query.order_by(SupportTicket.updated_at.desc()).limit(200)).all()
    return {"items": [serialize_support_ticket(db, item) for item in tickets]}


@app.patch("/api/admin/support/tickets/{ticket_id}/status")
def update_support_ticket_status(ticket_id: int, body: SupportTicketStatusBody, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")
    ticket.status = body.status
    ticket.updated_at = utc_now()
    ticket.closed_at = utc_now() if body.status in {"resolved", "closed"} else None
    log_event(db, user.id, "support_ticket_status_changed", "support_ticket", ticket.id, {"status": body.status})
    notify(db, ticket.user_id, "Support ticket updated", f"Your ticket \"{ticket.subject}\" is now {body.status.replace('_', ' ')}.")
    db.commit()
    db.refresh(ticket)
    return {"ticket": serialize_support_ticket(db, ticket, include_messages=True)}


@app.get("/api/business/summary")
def business_summary(user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).where(Job.business_id == user.id)).all()
    job_ids = [j.id for j in jobs]
    applications = db.scalar(select(func.count(Application.id)).where(Application.job_id.in_(job_ids))) if job_ids else 0
    assignments = db.scalars(select(Assignment).join(Job).where(Job.business_id == user.id)).all()
    return {"active_jobs": len([j for j in jobs if j.status == "published"]), "draft_jobs": len([j for j in jobs if j.status == "draft"]),
            "applications": int(applications or 0), "confirmed_workers": len([a for a in assignments if a.status in {"confirmed", "checked_in", "checked_out"}]),
            "completed_assignments": len([a for a in assignments if a.status == "completed"]),
            "pending_settlement": round(sum(a.gross_pay for a in assignments if a.payout_status == "pending"), 2),
            "verification_status": (db.get(BusinessProfile, user.id).verification_status if db.get(BusinessProfile, user.id) else "pending")}


@app.get("/api/business/analytics")
def business_analytics(user: User = Depends(require_role("business")), db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job).where(Job.business_id == user.id)).all()
    jobs_out = []
    for j in jobs:
        app_count = db.scalar(select(func.count(Application.id)).where(Application.job_id == j.id)) or 0
        filled = db.scalar(select(func.count(Assignment.id)).where(Assignment.job_id == j.id, Assignment.status != "cancelled")) or 0
        jobs_out.append({"job_id": j.id, "title": j.title, "status": j.status, "applications": app_count,
                         "positions": j.slots, "filled": filled, "fill_rate": round(min(filled / max(j.slots, 1), 1) * 100, 1)})
    return {"items": jobs_out}


@app.get("/api/metrics/public")
def public_metrics():
    return {"principles": ["Transparent pay", "Schedule-aware matching", "Recorded assignment history"],
            "note": "Platform growth and earnings metrics appear only when real activity has been recorded."}


# Public pages and the dedicated admin sign-in entry are served from the same origin.
# /admin is a UI route only; all privileged data and mutations still require an admin bearer token.
@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/admin", include_in_schema=False)
@app.get("/admin/", include_in_schema=False)
def admin_console_entry():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
