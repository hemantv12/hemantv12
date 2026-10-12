from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from .config import settings

ALGORITHM = "HS256"


def _fernet() -> Fernet:
    if not settings.token_encryption_key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is not configured. Generate a Fernet key and set it in the environment.")
    try:
        return Fernet(settings.token_encryption_key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is invalid. Generate one with Fernet.generate_key().") from exc


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Stored Google credentials could not be decrypted; check TOKEN_ENCRYPTION_KEY.") from exc


def create_session_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(days=settings.session_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_session_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM], issuer=settings.jwt_issuer, options={"require": ["sub", "exp", "iat", "iss"]})
        if not str(payload.get("sub", "")).isdigit():
            raise jwt.InvalidTokenError("Invalid user identifier")
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please connect Google again.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session. Please connect Google again.") from exc