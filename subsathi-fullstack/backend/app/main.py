from __future__ import annotations

import json
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import GoogleConnection, OAuthLoginTicket, OAuthState, ScanCandidate, User, utcnow
from .scanner import extract_message_text, group_billing_evidence, parse_billing_message
from .security import create_session_token, decrypt_secret, encrypt_secret, decode_session_token

SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"]
app = FastAPI(title="SubSathi API", version="1.0.0", description="Secure subscription discovery API. Gmail scans run only after explicit OAuth consent.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
security = HTTPBearer(auto_error=False)
Base.metadata.create_all(bind=engine)


class CandidateImportRequest(BaseModel):
    candidate_ids: list[int] = Field(min_length=1, max_length=100)


class OAuthExchangeRequest(BaseModel):
    code: str = Field(min_length=20, max_length=200)


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def google_flow(state: str | None = None) -> Flow:
    if not settings.google_configured:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on this server yet.")
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    return Flow.from_client_config(client_config, scopes=SCOPES, state=state, redirect_uri=settings.google_redirect_uri)


def candidate_public(candidate: ScanCandidate) -> dict[str, Any]:
    return {
        "id": candidate.id,
        "name": candidate.service_name,
        "category": candidate.category,
        "amount": candidate.amount,
        "cycle": candidate.cycle,
        "nextRenewal": candidate.next_renewal or None,
        "confidence": candidate.confidence,
        "evidenceCount": candidate.evidence_count,
        "evidenceDate": candidate.evidence_date or None,
        "needsReview": candidate.amount is None or not candidate.next_renewal or candidate.cycle in {"", "Unknown"},
        "manageUrl": _manage_url_for(candidate.service_name),
        "alreadyImported": candidate.imported,
    }


def _manage_url_for(service_name: str) -> str:
    from .scanner import MERCHANTS
    normalized = service_name.lower()
    for merchant in MERCHANTS:
        if merchant.name.lower() == normalized:
            return merchant.manage_url
    return ""


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in with Google to continue.")
    payload = decode_session_token(credentials.credentials)
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="This account no longer exists. Please connect Google again.")
    return user


def revoke_google_connection(connection: GoogleConnection | None) -> None:
    """Best-effort provider token revocation before deleting the local credential copy."""
    if connection is None:
        return
    try:
        data = json.loads(decrypt_secret(connection.encrypted_credentials))
        token = data.get("refresh_token") or data.get("token")
        if token:
            import httpx
            httpx.post("https://oauth2.googleapis.com/revoke", params={"token": token}, timeout=4.0)
    except Exception:
        # Local deletion must still complete if Google's revocation service is unavailable.
        pass


def credentials_for_user(db: Session, user: User) -> Credentials:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    if connection is None:
        raise HTTPException(status_code=409, detail="Gmail is not connected to this account.")
    try:
        data = json.loads(decrypt_secret(connection.encrypted_credentials))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Stored Gmail credential data is invalid.") from exc
    credentials = Credentials.from_authorized_user_info(data, scopes=SCOPES)
    if credentials.expired or not credentials.token:
        if not credentials.refresh_token:
            raise HTTPException(status_code=401, detail="Gmail authorization expired. Please connect Gmail again.")
        try:
            credentials.refresh(GoogleRequest())
            connection.encrypted_credentials = encrypt_secret(credentials.to_json())
            connection.updated_at = utcnow()
            db.commit()
        except Exception as exc:  # Google can return several credential exceptions.
            db.rollback()
            raise HTTPException(status_code=401, detail="Could not refresh Gmail authorization. Please connect Gmail again.") from exc
    return credentials


def callback_deeplink(*, code: str | None = None, email: str | None = None, error: str | None = None) -> RedirectResponse:
    values = []
    if code:
        values.append("code=" + quote(code, safe=""))
    if email:
        values.append("email=" + quote(email, safe=""))
    if error:
        values.append("error=" + quote(error[:180], safe=""))
    return RedirectResponse(settings.mobile_redirect_uri + ("?" + "&".join(values) if values else ""), status_code=302)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "subsathi-api", "environment": settings.app_env, "google_oauth_configured": settings.google_configured}


@app.get("/api/auth/google/url")
def google_authorization_url(redirect_target: str = Query("mobile", pattern="^mobile$"), db: Session = Depends(get_db)) -> dict[str, str]:
    flow = google_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    now = now_utc()
    db.query(OAuthState).filter(OAuthState.expires_at < now).delete(synchronize_session=False)
    db.add(OAuthState(state=state, redirect_target=redirect_target, created_at=now, expires_at=now + timedelta(minutes=10)))
    db.commit()
    return {"authorization_url": auth_url, "redirect_target": redirect_target, "expires_in_seconds": 600}


@app.get("/api/auth/google/callback", response_class=HTMLResponse)
def google_callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    if error:
        return callback_deeplink(error="Google authorization was cancelled or denied.")
    if not code or not state:
        return callback_deeplink(error="Missing authorization code or state.")
    state_row = db.get(OAuthState, state)
    if state_row is None or state_row.expires_at < now_utc():
        if state_row:
            db.delete(state_row)
            db.commit()
        return callback_deeplink(error="Authorization link expired. Please try again.")
    db.delete(state_row)
    db.commit()
    try:
        flow = google_flow(state=state)
        flow.fetch_token(code=code)
        google_credentials = flow.credentials
        claims = id_token.verify_oauth2_token(google_credentials.id_token, GoogleRequest(), settings.google_client_id)
        if not claims.get("email_verified") or not claims.get("email") or not claims.get("sub"):
            return callback_deeplink(error="Google did not return a verified account email.")
        email = str(claims["email"]).lower().strip()
        google_sub = str(claims["sub"])
        user = db.scalar(select(User).where(User.google_sub == google_sub))
        if user is None:
            user = User(google_sub=google_sub, email=email, display_name=str(claims.get("name") or ""))
            db.add(user)
            db.flush()
        else:
            user.email = email
            user.display_name = str(claims.get("name") or user.display_name or "")
            user.updated_at = utcnow()
        connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
        # Google may not return a new refresh token on every authorization; preserve the prior one if available.
        if not google_credentials.refresh_token and connection:
            old_data = json.loads(decrypt_secret(connection.encrypted_credentials))
            old_credentials = Credentials.from_authorized_user_info(old_data, scopes=SCOPES)
            google_credentials.refresh_token = old_credentials.refresh_token
        encrypted = encrypt_secret(google_credentials.to_json())
        granted_scopes = " ".join(google_credentials.scopes or SCOPES)
        if connection is None:
            connection = GoogleConnection(user_id=user.id, email=email, encrypted_credentials=encrypted, granted_scopes=granted_scopes)
            db.add(connection)
        else:
            connection.email = email
            connection.encrypted_credentials = encrypted
            connection.granted_scopes = granted_scopes
            connection.updated_at = utcnow()
        db.commit()
        # Redirect only a short-lived, one-time code into the app. Never put the bearer session token in a deep link.
        one_time_code = secrets.token_urlsafe(36)
        code_hash = hashlib.sha256(one_time_code.encode("utf-8")).hexdigest()
        db.add(OAuthLoginTicket(code_hash=code_hash, user_id=user.id, email=email, created_at=now_utc(), expires_at=now_utc() + timedelta(minutes=2)))
        db.query(OAuthLoginTicket).filter(OAuthLoginTicket.expires_at < now_utc()).delete(synchronize_session=False)
        db.commit()
        return callback_deeplink(code=one_time_code, email=email)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        # Never expose provider tokens or raw exception details on a public callback page/deep link.
        return callback_deeplink(error="Could not complete Google authorization. Check server OAuth settings and try again.")


@app.post("/api/auth/google/exchange")
def exchange_oauth_code(payload: OAuthExchangeRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    code_hash = hashlib.sha256(payload.code.encode("utf-8")).hexdigest()
    ticket = db.get(OAuthLoginTicket, code_hash)
    if ticket is None or ticket.expires_at < now_utc():
        if ticket:
            db.delete(ticket)
            db.commit()
        raise HTTPException(status_code=401, detail="The sign-in link expired or was already used. Please connect Google again.")
    user = db.get(User, ticket.user_id)
    email = ticket.email
    db.delete(ticket)
    db.commit()
    if user is None:
        raise HTTPException(status_code=401, detail="Account was not found. Please connect Google again.")
    return {"session": create_session_token(user.id, email), "email": email, "token_type": "Bearer", "expires_in_days": settings.session_days}


@app.get("/api/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "gmail_connected": connection is not None,
        "gmail_email": connection.email if connection else None,
        "connected_at": connection.connected_at.isoformat() if connection else None,
    }


def _body_from_gmail_payload(payload: dict[str, Any]) -> str:
    return extract_message_text(payload)


@app.post("/api/gmail/scan")
def scan_gmail(max_messages: int = Query(150, ge=1, le=500), user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    credentials = credentials_for_user(db, user)
    try:
        service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
        query = settings.gmail_query
        refs: list[dict[str, str]] = []
        page_token = None
        limit = min(max_messages, settings.scan_max_messages)
        while len(refs) < limit:
            page = service.users().messages().list(
                userId="me", q=query, maxResults=min(100, limit - len(refs)), pageToken=page_token,
            ).execute()
            refs.extend(page.get("messages") or [])
            page_token = page.get("nextPageToken")
            if not page_token or not page.get("messages"):
                break
        parsed: list[dict[str, Any]] = []
        for ref in refs:
            try:
                message = service.users().messages().get(userId="me", id=ref["id"], format="full").execute()
            except HttpError:
                continue
            payload = message.get("payload") or {}
            headers = {str(item.get("name", "")).lower(): str(item.get("value", "")) for item in payload.get("headers") or []}
            subject = headers.get("subject", "")
            sender = headers.get("from", "")
            date_header = headers.get("date", "")
            body = _body_from_gmail_payload(payload)
            candidate = parse_billing_message(message_id=str(ref.get("id", "")), subject=subject, sender=sender, date_header=date_header, body=body)
            if candidate:
                parsed.append(candidate)
        grouped = group_billing_evidence(parsed)
        # Replace stale, not-yet-imported detections with the latest scan so old prices don't pile up.
        db.query(ScanCandidate).filter(ScanCandidate.user_id == user.id, ScanCandidate.imported.is_(False)).delete(synchronize_session=False)
        for candidate in grouped:
            fingerprint = candidate["fingerprint"][:300]
            existing = db.scalar(select(ScanCandidate).where(ScanCandidate.user_id == user.id, ScanCandidate.fingerprint == fingerprint))
            if existing is None:
                existing = ScanCandidate(user_id=user.id, fingerprint=fingerprint, service_name=candidate["service_name"], category=candidate["category"])
                db.add(existing)
            existing.service_name = candidate["service_name"]
            existing.category = candidate["category"]
            existing.amount = candidate.get("amount")
            existing.cycle = candidate.get("cycle") or "Unknown"
            existing.next_renewal = candidate.get("next_renewal") or ""
            existing.confidence = int(candidate.get("confidence", 50))
            existing.evidence_count = int(candidate.get("evidence_count", 1))
            existing.evidence_date = str(candidate.get("evidence_date") or "")
            existing.updated_at = utcnow()
        db.commit()
        saved = db.scalars(select(ScanCandidate).where(ScanCandidate.user_id == user.id).order_by(ScanCandidate.imported.asc(), ScanCandidate.updated_at.desc())).all()
        return {
            "scanned_messages": len(refs),
            "matched_receipts": len(parsed),
            "candidate_count": len(grouped),
            "scanned_at": now_utc().isoformat() + "Z",
            "candidates": [candidate_public(item) for item in saved[:100]],
            "notice": "Detection is evidence-based, not perfect. Review prices and dates before relying on them.",
        }
    except HTTPException:
        raise
    except HttpError as exc:
        raise HTTPException(status_code=502, detail="Gmail returned an API error. Check consent, scopes and API enablement.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not scan Gmail. Check the connection and try again.") from exc


@app.post("/api/gmail/import")
def import_candidates(payload: CandidateImportRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    candidates = db.scalars(select(ScanCandidate).where(ScanCandidate.user_id == user.id, ScanCandidate.id.in_(payload.candidate_ids))).all()
    found_ids = {item.id for item in candidates}
    if found_ids != set(payload.candidate_ids):
        raise HTTPException(status_code=404, detail="One or more scan results were not found for your account. Scan again.")
    missing_prices = [item.service_name for item in candidates if item.amount is None or item.amount <= 0]
    if missing_prices:
        raise HTTPException(status_code=422, detail="Add the price manually before importing: " + ", ".join(missing_prices))
    result = []
    for item in candidates:
        item.imported = True
        item.updated_at = utcnow()
        result.append({
            "candidateId": item.id,
            "name": item.service_name,
            "category": item.category,
            "amount": item.amount,
            "cycle": item.cycle if item.cycle in {"Weekly", "Monthly", "Quarterly", "Yearly"} else "Monthly",
            "nextRenewal": item.next_renewal or "",
            "manageUrl": _manage_url_for(item.service_name),
            "notes": f"Detected from billing emails ({item.evidence_count} message(s)). Verify missing dates or cycle before relying on reminders.",
            "needsReview": not bool(item.next_renewal) or item.cycle == "Unknown",
            "source": "gmail",
        })
    db.commit()
    return {"imported": result, "count": len(result), "notice": "Imported records are saved by the app on this device. Verify any fields marked for review."}


@app.delete("/api/auth/gmail/connection")
def disconnect_gmail(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    if connection:
        revoke_google_connection(connection)
        db.delete(connection)
    db.query(ScanCandidate).filter(ScanCandidate.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"status": "disconnected", "message": "Stored Gmail credentials and cached scan candidates were deleted. Locally imported tracker entries were not touched."}


@app.delete("/api/me")
def delete_account(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    revoke_google_connection(connection)
    db.query(ScanCandidate).filter(ScanCandidate.user_id == user.id).delete(synchronize_session=False)
    db.query(OAuthLoginTicket).filter(OAuthLoginTicket.user_id == user.id).delete(synchronize_session=False)
    if connection is not None:
        db.delete(connection)
    db.delete(user)
    db.commit()
    return {"status": "deleted", "message": "SubSathi server account, Gmail credentials and scan candidates have been deleted. Local app entries must be cleared separately on this device."}


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "SubSathi API", "docs": "/docs", "health": "/health"}

@app.get("/privacy", response_class=HTMLResponse)
def privacy_policy() -> HTMLResponse:
    from .policy import PRIVACY_POLICY_HTML
    return HTMLResponse(PRIVACY_POLICY_HTML)


@app.get("/terms", response_class=HTMLResponse)
def terms() -> HTMLResponse:
    from .policy import TERMS_HTML
    return HTMLResponse(TERMS_HTML)