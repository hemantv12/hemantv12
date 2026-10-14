from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


def _database_url() -> str:
    raw = os.getenv("DATABASE_URL", "sqlite:///./subsathi.db").strip()
    if raw.startswith("postgres://"):
        return "postgresql+psycopg://" + raw[len("postgres://"):]
    if raw.startswith("postgresql://") and not raw.startswith("postgresql+psycopg://"):
        return "postgresql+psycopg://" + raw[len("postgresql://"):]
    return raw


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = _database_url()
    api_base_url: str = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    google_redirect_uri: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback").strip()
    mobile_redirect_uri: str = os.getenv("MOBILE_REDIRECT_URI", "subsathi://auth").strip()
    jwt_secret: str = os.getenv("JWT_SECRET", "development-only-change-this-secret")
    jwt_issuer: str = os.getenv("JWT_ISSUER", "subsathi-api")
    session_days: int = int(os.getenv("SESSION_DAYS", "14"))
    token_encryption_key: str = os.getenv("TOKEN_ENCRYPTION_KEY", "").strip()
    cors_origins: tuple[str, ...] = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
        if origin.strip()
    )
    scan_max_messages: int = int(os.getenv("SCAN_MAX_MESSAGES", "200"))
    gmail_query: str = os.getenv(
        "GMAIL_SCAN_QUERY",
        'newer_than:5y {subject:receipt subject:invoice subject:subscription subject:renewal subject:renewed subject:membership subject:billing subject:purchase "auto-renew" "recurring payment" "billing cycle" "trial ends" "next payment" "your plan renews" "payment successful"}',
    )

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.google_redirect_uri)

    def validate_production(self) -> None:
        if self.app_env.lower() == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret == "development-only-change-this-secret":
                raise RuntimeError("Set a unique JWT_SECRET (at least 32 characters) in production.")
            if not self.token_encryption_key:
                raise RuntimeError("Set TOKEN_ENCRYPTION_KEY in production. Generate it using Fernet.generate_key().")
            # Allow the API to boot before Google OAuth is configured so the owner can
            # deploy /health, then add OAuth credentials in the hosting dashboard.
            # OAuth endpoints remain disabled until google_configured is true.
            if self.google_configured and self.google_redirect_uri.startswith("http://") and urlparse(self.google_redirect_uri).hostname not in {"localhost", "127.0.0.1"}:
                raise RuntimeError("Production Google OAuth callback must use HTTPS.")
            if self.token_encryption_key:
                from cryptography.fernet import Fernet
                try:
                    Fernet(self.token_encryption_key.encode("utf-8"))
                except (TypeError, ValueError) as exc:
                    raise RuntimeError("TOKEN_ENCRYPTION_KEY is invalid. Generate one using Fernet.generate_key().") from exc


settings = Settings()
settings.validate_production()