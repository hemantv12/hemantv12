from __future__ import annotations

import json
import secrets
import hashlib
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from threading import local
from time import perf_counter
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
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import GoogleConnection, LinkedGmailAccount, OAuthLoginTicket, OAuthState, ScanCandidate, User, utcnow
from .scanner import MERCHANTS, MERCHANT_SENDER_DOMAINS, extract_management_link, extract_message_text, group_billing_evidence, parse_billing_message, should_fetch_full_message
from .security import create_session_token, decrypt_secret, encrypt_secret, decode_session_token

SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"]
SCOPE_ALIASES = {
    "email": "https://www.googleapis.com/auth/userinfo.email",
    "profile": "https://www.googleapis.com/auth/userinfo.profile",
}


def normalize_scope_set(scopes: list[str] | tuple[str, ...] | None) -> set[str]:
    """Normalize Google's documented shorthand identity-scope aliases."""
    return {SCOPE_ALIASES.get(scope, scope) for scope in (scopes or [])}


app = FastAPI(title="SubSathi API", version="1.0.0", description="Secure subscription discovery API. Gmail scans run only after explicit OAuth consent.")


class OAuthCallbackAccessLogRedactor(logging.Filter):
    """Redact one-time OAuth codes and state values from Uvicorn access logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "uvicorn.access" and isinstance(record.args, tuple) and len(record.args) >= 3:
            args = list(record.args)
            request_target = args[2]
            if isinstance(request_target, str) and request_target.startswith("/api/auth/google/callback"):
                args[2] = "/api/auth/google/callback?[redacted]"
                record.args = tuple(args)
        return True


logging.getLogger("uvicorn.access").addFilter(OAuthCallbackAccessLogRedactor())

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
security = HTTPBearer(auto_error=False)
Base.metadata.create_all(bind=engine)

def ensure_oauth_state_pkce_column() -> None:
    """Add the temporary PKCE verifier column to databases created by older releases."""
    inspector = inspect(engine)
    if not inspector.has_table("oauth_states"):
        return
    existing_columns = {column["name"] for column in inspector.get_columns("oauth_states")}
    if "code_verifier" not in existing_columns:
        # SQLite and PostgreSQL both support this additive nullable-column migration.
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE oauth_states ADD COLUMN code_verifier VARCHAR(128)"))


ensure_oauth_state_pkce_column()


def ensure_linked_gmail_columns() -> None:
    """Add nullable account-link state and source metadata to existing pilot databases."""
    inspector = inspect(engine)
    if inspector.has_table("oauth_states"):
        columns = {column["name"] for column in inspector.get_columns("oauth_states")}
        if "link_user_id" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE oauth_states ADD COLUMN link_user_id INTEGER"))
    if inspector.has_table("scan_candidates"):
        columns = {column["name"] for column in inspector.get_columns("scan_candidates")}
        with engine.begin() as connection:
            if "source_accounts" not in columns:
                connection.execute(text("ALTER TABLE scan_candidates ADD COLUMN source_accounts TEXT NOT NULL DEFAULT '[]'"))
            if "billing_source" not in columns:
                connection.execute(text("ALTER TABLE scan_candidates ADD COLUMN billing_source VARCHAR(40) NOT NULL DEFAULT 'provider'"))
            if "manage_url" not in columns:
                connection.execute(text("ALTER TABLE scan_candidates ADD COLUMN manage_url TEXT NOT NULL DEFAULT ''"))


ensure_linked_gmail_columns()


class CandidateImportOverride(BaseModel):
    candidate_id: int
    amount: float | None = Field(default=None, gt=0, le=10_000_000)
    cycle: str | None = Field(default=None, pattern=r"^(Weekly|Monthly|Quarterly|Yearly)$")
    next_renewal: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class CandidateImportRequest(BaseModel):
    candidate_ids: list[int] = Field(min_length=1, max_length=100)
    overrides: list[CandidateImportOverride] = Field(default_factory=list, max_length=100)


class OAuthExchangeRequest(BaseModel):
    code: str = Field(min_length=20, max_length=200)


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def google_flow(
    state: str | None = None,
    *,
    code_verifier: str | None = None,
    autogenerate_code_verifier: bool = True,
) -> Flow:
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
    return Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state,
        redirect_uri=settings.google_redirect_uri,
        code_verifier=code_verifier,
        autogenerate_code_verifier=autogenerate_code_verifier,
    )


def candidate_public(candidate: ScanCandidate) -> dict[str, Any]:
    try:
        source_accounts = json.loads(candidate.source_accounts or "[]")
        if not isinstance(source_accounts, list):
            source_accounts = []
    except (ValueError, TypeError):
        source_accounts = []
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
        "sourceAccounts": [str(email) for email in source_accounts if isinstance(email, str)],
        "billingSource": candidate.billing_source or "provider",
        "billingSourceLabel": _billing_source_label(candidate.billing_source),
        "needsReview": candidate.amount is None or not candidate.next_renewal or candidate.cycle in {"", "Unknown"},
        "manageUrl": candidate.manage_url or _manage_url_for(candidate.service_name, candidate.billing_source),
        "alreadyImported": candidate.imported,
    }


def _billing_source_label(source: str | None) -> str:
    return {
        "google_play": "Google Play",
        "apple_app_store": "Apple App Store",
        "paypal": "PayPal automatic payments",
        "upi_autopay": "UPI AutoPay / mandate",
        "bank_mandate": "Bank / card mandate",
        "provider": "Provider website",
    }.get((source or "provider").lower(), "Provider website")


def _manage_url_for(service_name: str, billing_source: str | None = "provider") -> str:
    from .scanner import MERCHANTS, management_url_for_source
    normalized = service_name.lower()
    provider_url = next((merchant.manage_url for merchant in MERCHANTS if merchant.name.lower() == normalized), "")
    return management_url_for_source(provider_url, billing_source)


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


def _credentials_for_mailbox(db: Session, connection: GoogleConnection | LinkedGmailAccount) -> Credentials:
    try:
        data = json.loads(decrypt_secret(connection.encrypted_credentials))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail="Stored Gmail credential data is invalid.") from exc
    credentials = Credentials.from_authorized_user_info(data, scopes=SCOPES)
    if credentials.expired or not credentials.token:
        if not credentials.refresh_token:
            raise HTTPException(status_code=401, detail="Gmail authorization expired. Reconnect this Gmail account.")
        try:
            credentials.refresh(GoogleRequest())
            connection.encrypted_credentials = encrypt_secret(credentials.to_json())
            connection.updated_at = utcnow()
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=401, detail="Could not refresh this Gmail authorization. Reconnect this Gmail account.") from exc
    return credentials


def credentials_for_all_mailboxes(
    db: Session, user: User
) -> tuple[list[tuple[str, Credentials]], list[dict[str, str]]]:
    """Load each explicitly linked mailbox; one broken secondary inbox won't block others."""
    rows: list[GoogleConnection | LinkedGmailAccount] = []
    primary = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    if primary is not None:
        rows.append(primary)
    linked = db.scalars(
        select(LinkedGmailAccount)
        .where(LinkedGmailAccount.user_id == user.id)
        .order_by(LinkedGmailAccount.email.asc())
    ).all()
    known = {row.email.lower() for row in rows}
    rows.extend(row for row in linked if row.email.lower() not in known)
    if not rows:
        raise HTTPException(status_code=409, detail="Connect at least one Gmail account before scanning.")

    credentials_by_email: list[tuple[str, Credentials]] = []
    errors: list[dict[str, str]] = []
    for row in rows:
        try:
            credentials_by_email.append((row.email, _credentials_for_mailbox(db, row)))
        except HTTPException as exc:
            errors.append({"email": row.email, "message": str(exc.detail)})
        except Exception:
            errors.append({"email": row.email, "message": "Could not load this Gmail connection. Reconnect the account and retry."})
    if not credentials_by_email:
        raise HTTPException(status_code=401, detail="None of the connected Gmail accounts could be accessed. Reconnect at least one account and try again.")
    return credentials_by_email, errors


def gmail_scan_queries() -> list[str]:
    """Use configured billing terms, known provider senders and a broad five-year query."""
    configured = (settings.gmail_query or "").strip()
    domains = sorted({domain for values in MERCHANT_SENDER_DOMAINS.values() for domain in values})
    sender_query = "newer_than:5y {" + " ".join(f"from:{domain}" for domain in domains) + "}"
    broad_query = (
        'newer_than:5y {subject:receipt subject:invoice subject:renewal subject:renewed '
        'subject:subscription subject:membership subject:purchase "auto-renew" '
        '"recurring payment" "next payment" "your plan renews" "payment successful"}'
    )
    queries: list[str] = []
    for query in (configured, sender_query, broad_query):
        if query and query not in queries:
            queries.append(query)
    return queries


def _list_gmail_refs_for_query(credentials: Credentials, query: str, budget: int) -> list[dict[str, str]]:
    """Fetch a capped slice of one Gmail query using its own thread-local API client."""
    service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
    refs: list[dict[str, str]] = []
    page_token = None
    while len(refs) < budget:
        page = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=min(100, budget - len(refs)),
            pageToken=page_token,
        ).execute(num_retries=2)
        refs.extend(page.get("messages") or [])
        page_token = page.get("nextPageToken")
        if not page_token or not page.get("messages"):
            break
    return refs


def _interleave_query_results(query_results: list[list[dict[str, str]]], limit: int) -> list[str]:
    """Round-robin the newest results from each query so one broad query can't starve others."""
    ids: list[str] = []
    seen: set[str] = set()
    max_len = max((len(items) for items in query_results), default=0)
    for index in range(max_len):
        for items in query_results:
            if index >= len(items):
                continue
            message_id = str(items[index].get("id", ""))
            if message_id and message_id not in seen:
                seen.add(message_id)
                ids.append(message_id)
                if len(ids) >= limit:
                    return ids
    return ids


def _scan_single_gmail_mailbox(credentials: Credentials, mailbox_email: str, limit: int) -> dict[str, Any]:
    queries = gmail_scan_queries()
    per_query_budget = min(100, max(40, (limit + max(1, len(queries)) - 1) // max(1, len(queries)) + 12))
    # Query families are independent. Parallel listing reduces the long serial wait
    # while the round-robin merge preserves coverage from both provider and text searches.
    if queries:
        with ThreadPoolExecutor(max_workers=min(3, len(queries))) as executor:
            query_results = list(executor.map(
                lambda query: _list_gmail_refs_for_query(credentials, query, per_query_budget),
                queries,
            ))
    else:
        query_results = []
    message_ids = _interleave_query_results(query_results, limit)

    if message_ids:
        with ThreadPoolExecutor(
            max_workers=min(6, len(message_ids)),
            initializer=_init_gmail_scan_worker,
            initargs=(credentials,),
        ) as executor:
            metadata_messages = list(executor.map(_fetch_gmail_message_metadata_for_scan, message_ids))
    else:
        metadata_messages = []

    relevant_ids: list[str] = []
    metadata_by_id: dict[str, dict[str, str]] = {}
    for message_id, message in zip(message_ids, metadata_messages):
        if not message:
            continue
        payload = message.get("payload") or {}
        headers = {str(item.get("name", "")).lower(): str(item.get("value", "")) for item in payload.get("headers") or []}
        if should_fetch_full_message(headers.get("subject", ""), headers.get("from", "")):
            relevant_ids.append(message_id)
            metadata_by_id[message_id] = headers

    if relevant_ids:
        with ThreadPoolExecutor(
            max_workers=min(6, len(relevant_ids)),
            initializer=_init_gmail_scan_worker,
            initargs=(credentials,),
        ) as executor:
            full_messages = list(executor.map(_fetch_gmail_message_for_scan, relevant_ids))
    else:
        full_messages = []

    parsed: list[dict[str, Any]] = []
    for message_id, message in zip(relevant_ids, full_messages):
        if not message:
            continue
        payload = message.get("payload") or {}
        headers = {str(item.get("name", "")).lower(): str(item.get("value", "")) for item in payload.get("headers") or []}
        fallback = metadata_by_id.get(message_id, {})
        subject = headers.get("subject", fallback.get("subject", ""))
        sender = headers.get("from", fallback.get("from", ""))
        body = _body_from_gmail_payload(payload)
        candidate = parse_billing_message(
            message_id=message_id,
            subject=subject,
            sender=sender,
            date_header=headers.get("date", fallback.get("date", "")),
            body=body,
        )
        if candidate:
            extracted_url = extract_management_link(
                payload,
                service_name=str(candidate.get("service_name") or ""),
                sender=sender,
                billing_source=str(candidate.get("billing_source") or "provider"),
            )
            if extracted_url:
                candidate["manage_url"] = extracted_url
            candidate["source_mailbox"] = mailbox_email
            parsed.append(candidate)
    return {"searched": len(message_ids), "full_fetched": len(relevant_ids), "parsed": parsed}


def callback_deeplink(*, code: str | None = None, email: str | None = None, error: str | None = None, linked: bool = False) -> RedirectResponse:
    values = []
    if code:
        values.append("code=" + quote(code, safe=""))
    if email:
        values.append("email=" + quote(email, safe=""))
    if linked:
        values.append("linked=1")
    if error:
        values.append("error=" + quote(error[:180], safe=""))
    return RedirectResponse(settings.mobile_redirect_uri + ("?" + "&".join(values) if values else ""), status_code=302)


@app.get("/health")
def health() -> dict[str, Any]:
    # Expose only the database engine type (never its connection string) so the
    # deployment preflight can distinguish durable PostgreSQL from ephemeral SQLite.
    database_backend = engine.dialect.name
    return {
        "status": "ok",
        "service": "subsathi-api",
        "environment": settings.app_env,
        "google_oauth_configured": settings.google_configured,
        "database_backend": database_backend,
        "durable_database_configured": database_backend == "postgresql",
    }


def _new_google_authorization(db: Session, *, redirect_target: str, link_user_id: int | None = None) -> dict[str, Any]:
    flow = google_flow(autogenerate_code_verifier=True)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    now = now_utc()
    db.query(OAuthState).filter(OAuthState.expires_at < now).delete(synchronize_session=False)
    db.add(OAuthState(
        state=state,
        redirect_target=redirect_target,
        code_verifier=flow.code_verifier,
        link_user_id=link_user_id,
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    ))
    db.commit()
    return {"authorization_url": auth_url, "redirect_target": redirect_target, "expires_in_seconds": 600}


@app.get("/api/auth/google/url")
def google_authorization_url(redirect_target: str = Query("mobile", pattern="^mobile$"), db: Session = Depends(get_db)) -> dict[str, Any]:
    return _new_google_authorization(db, redirect_target=redirect_target)


@app.get("/api/auth/google/link-url")
def link_gmail_authorization_url(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    """Link a secondary Gmail account to the current SubSathi profile with separate consent."""
    return _new_google_authorization(db, redirect_target="mobile", link_user_id=user.id)


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
    code_verifier = state_row.code_verifier
    link_user_id = state_row.link_user_id
    db.delete(state_row)
    db.commit()
    if not code_verifier:
        return callback_deeplink(error="This Google sign-in was started before the latest security fix. Please tap Connect Gmail and try again.")
    stage = "create_google_flow"
    try:
        # Reuse the exact PKCE verifier generated for the authorization URL.
        # Generating a new verifier here makes Google's token exchange fail with invalid_grant.
        flow = google_flow(state=state, code_verifier=code_verifier, autogenerate_code_verifier=False)
        stage = "exchange_authorization_code"
        # Google can report the requested "email"/"profile" aliases alongside their
        # canonical userinfo.email/userinfo.profile URI names. oauthlib treats that
        # harmless alias expansion as a Warning exception unless scope relaxation is
        # enabled. We independently validate the exact normalized granted scope set
        # immediately after token exchange below.
        os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")
        flow.fetch_token(code=code)
        google_credentials = flow.credentials
        stage = "validate_granted_scopes"
        raw_granted_scopes = getattr(google_credentials, "granted_scopes", None)
        if not raw_granted_scopes:
            token_scope = (flow.oauth2session.token or {}).get("scope")
            if isinstance(token_scope, str):
                raw_granted_scopes = token_scope.split()
            elif isinstance(token_scope, (list, tuple)):
                raw_granted_scopes = list(token_scope)
        if isinstance(raw_granted_scopes, str):
            raw_granted_scopes = raw_granted_scopes.split()
        if not raw_granted_scopes:
            return callback_deeplink(error="Google did not return granted permissions we can verify. Please reconnect and approve Gmail read access.")
        granted_scopes = normalize_scope_set(list(raw_granted_scopes))
        required_scopes = normalize_scope_set(SCOPES)
        if not required_scopes.issubset(granted_scopes):
            missing_scopes = required_scopes - granted_scopes
            logging.getLogger("uvicorn.error").error(
                "Google OAuth did not grant required scope count=%s",
                len(missing_scopes),
            )
            return callback_deeplink(error="Google did not grant all required permissions. Please reconnect and approve Gmail read access.")
        unexpected_scopes = granted_scopes - required_scopes
        if unexpected_scopes:
            logging.getLogger("uvicorn.error").error(
                "Google OAuth returned unexpected scope count=%s",
                len(unexpected_scopes),
            )
            return callback_deeplink(error="Google returned permissions SubSathi did not request. Please contact support before connecting.")
        stage = "verify_google_identity_token"
        claims = id_token.verify_oauth2_token(google_credentials.id_token, GoogleRequest(), settings.google_client_id)
        if not claims.get("email_verified") or not claims.get("email") or not claims.get("sub"):
            return callback_deeplink(error="Google did not return a verified account email.")
        email = str(claims["email"]).lower().strip()
        google_sub = str(claims["sub"])
        if link_user_id is not None:
            # Attach this mailbox to the authenticated SubSathi profile that created
            # the OAuth state; do not create a second SubSathi user or switch sessions.
            link_user = db.get(User, link_user_id)
            if link_user is None:
                return callback_deeplink(error="The SubSathi account for this linking request no longer exists. Please sign in again.")
            primary = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == link_user.id))
            linked = db.scalar(select(LinkedGmailAccount).where(
                LinkedGmailAccount.user_id == link_user.id,
                LinkedGmailAccount.email == email,
            ))
            if primary and primary.email.lower() == email:
                return callback_deeplink(email=email, linked=True)
            if not google_credentials.refresh_token and linked:
                previous = Credentials.from_authorized_user_info(
                    json.loads(decrypt_secret(linked.encrypted_credentials)), scopes=SCOPES
                )
                google_credentials.refresh_token = previous.refresh_token
            encrypted = encrypt_secret(google_credentials.to_json())
            scope_text = " ".join(google_credentials.scopes or SCOPES)
            if linked is None:
                db.add(LinkedGmailAccount(
                    user_id=link_user.id,
                    email=email,
                    google_sub=google_sub,
                    encrypted_credentials=encrypted,
                    granted_scopes=scope_text,
                ))
            else:
                linked.google_sub = google_sub
                linked.encrypted_credentials = encrypted
                linked.granted_scopes = scope_text
                linked.updated_at = utcnow()
            db.commit()
            return callback_deeplink(email=email, linked=True)

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
    except Exception as exc:
        db.rollback()
        # Log only a safe diagnostic classification. Never log tokens, auth codes,
        # the client secret, full provider response bodies, or raw exception messages.
        oauth_error = getattr(exc, "error", "")
        if not isinstance(oauth_error, str):
            oauth_error = ""
        oauth_error = "".join(ch for ch in oauth_error if ch.isalnum() or ch in "_-")[:48]
        response = getattr(exc, "response", None)
        upstream_status = getattr(response, "status_code", None)
        logging.getLogger("uvicorn.error").error(
            "Google OAuth callback failed: stage=%s exception=%s oauth_error=%s upstream_status=%s",
            stage, type(exc).__name__, oauth_error or "none", upstream_status or "none",
        )
        # Never expose provider tokens or raw exception details on a public callback page/deep link.
        if stage == "exchange_authorization_code" and type(exc).__name__ == "InvalidClientError":
            return callback_deeplink(error="Google rejected the OAuth client credentials. Check the Client ID and secret for the same Web OAuth client in Render.")
        if stage == "exchange_authorization_code" and oauth_error == "invalid_grant":
            return callback_deeplink(error="Google rejected this one-time sign-in code. Please tap Connect Gmail and try again; do not open the callback URL directly.")
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
    linked_accounts = db.scalars(
        select(LinkedGmailAccount)
        .where(LinkedGmailAccount.user_id == user.id)
        .order_by(LinkedGmailAccount.email.asc())
    ).all()
    accounts: list[dict[str, Any]] = []
    if connection is not None:
        accounts.append({"email": connection.email, "primary": True, "connected_at": connection.connected_at.isoformat()})
    accounts.extend({
        "email": row.email,
        "primary": False,
        "connected_at": row.connected_at.isoformat(),
    } for row in linked_accounts if not connection or row.email.lower() != connection.email.lower())
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "gmail_connected": bool(accounts),
        "gmail_email": connection.email if connection else (accounts[0]["email"] if accounts else None),
        "connected_at": connection.connected_at.isoformat() if connection else None,
        "gmail_accounts": accounts,
    }


def _body_from_gmail_payload(payload: dict[str, Any]) -> str:
    return extract_message_text(payload)


_gmail_scan_worker = local()


def _init_gmail_scan_worker(credentials: Credentials) -> None:
    """Give each scan worker its own HTTP transport; httplib2 transports aren't thread-safe."""
    _gmail_scan_worker.service = build("gmail", "v1", credentials=credentials, cache_discovery=False)


def _fetch_gmail_message_metadata_for_scan(message_id: str) -> dict[str, Any] | None:
    service = getattr(_gmail_scan_worker, "service", None)
    if service is None:
        raise RuntimeError("Gmail scan worker was not initialized.")
    try:
        return service.users().messages().get(
            userId="me",
            id=message_id,
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute(num_retries=2)
    except HttpError as exc:
        # A message deleted between list/get is harmless. Quota, access and server
        # errors must propagate rather than being silently treated as irrelevant.
        if int(getattr(getattr(exc, "resp", None), "status", 0) or 0) == 404:
            return None
        raise


def _fetch_gmail_message_for_scan(message_id: str) -> dict[str, Any] | None:
    service = getattr(_gmail_scan_worker, "service", None)
    if service is None:
        raise RuntimeError("Gmail scan worker was not initialized.")
    try:
        return service.users().messages().get(userId="me", id=message_id, format="full").execute(num_retries=2)
    except HttpError as exc:
        if int(getattr(getattr(exc, "resp", None), "status", 0) or 0) == 404:
            return None
        raise


def _gmail_http_error_context(exc: HttpError) -> tuple[int, str]:
    """Return safe, bounded diagnostics without logging email data or credentials."""
    status_code = int(getattr(getattr(exc, "resp", None), "status", 0) or 0)
    reason = ""
    try:
        payload = json.loads((exc.content or b"").decode("utf-8", errors="replace"))
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        if isinstance(error, dict):
            reason = str(error.get("status") or "")
            details = error.get("errors") or []
            if not reason and details and isinstance(details[0], dict):
                reason = str(details[0].get("reason") or "")
    except (ValueError, TypeError, AttributeError):
        pass
    reason = "".join(ch for ch in reason if ch.isalnum() or ch in "_.-")[:64] or "unknown"
    return status_code, reason


def _gmail_http_error_message(status_code: int, reason: str) -> str:
    normalized = reason.lower()
    if status_code == 401:
        return "Google rejected the Gmail authorization. Disconnect Gmail in SubSathi, reconnect it, and approve Gmail read access."
    if status_code == 403 and ("accessnotconfigured" in normalized or "servicedisabled" in normalized):
        return "Gmail API is not enabled for the Google Cloud project used by this OAuth client. Enable Gmail API in that same project, then reconnect Gmail."
    if status_code in {403, 429} and any(token in normalized for token in ("ratelimit", "userratelimit", "quota", "resourceexhausted")):
        return "Google is rate-limiting Gmail scans. Wait about a minute and retry; SubSathi now limits parallel requests and retries temporary failures."
    if status_code == 403:
        return "Google did not allow Gmail read access. Disconnect Gmail, reconnect, and approve the requested Gmail read permission. If it persists, check the OAuth consent screen and Gmail API enablement."
    if status_code == 429:
        return "Google temporarily rate-limited this Gmail scan. Wait about a minute and retry."
    if status_code in {500, 502, 503, 504}:
        return "Google's Gmail service temporarily failed. Please wait briefly and retry the scan."
    return f"Gmail API request failed (HTTP {status_code or 'unknown'}, reason {reason}). Please retry; if it repeats, check the server logs."


@app.post("/api/gmail/scan")
def scan_gmail(max_messages: int = Query(100, ge=1, le=200), user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    scan_started = perf_counter()
    mailboxes, account_errors = credentials_for_all_mailboxes(db, user)
    limit = min(max_messages, settings.scan_max_messages)
    parsed: list[dict[str, Any]] = []
    scanned_messages = 0
    full_fetched = 0
    successful_accounts: list[str] = []

    def scan_one_mailbox(mailbox: tuple[str, Credentials]) -> tuple[str, dict[str, Any] | None, dict[str, str] | None]:
        mailbox_email, credentials = mailbox
        try:
            return mailbox_email, _scan_single_gmail_mailbox(credentials, mailbox_email, limit), None
        except HttpError as exc:
            status_code, reason = _gmail_http_error_context(exc)
            logging.getLogger("uvicorn.error").warning(
                "Gmail mailbox scan failed status=%s reason=%s", status_code or "unknown", reason
            )
            return mailbox_email, None, {"email": mailbox_email, "message": _gmail_http_error_message(status_code, reason)}
        except HTTPException as exc:
            return mailbox_email, None, {"email": mailbox_email, "message": str(exc.detail)}
        except Exception as exc:
            logging.getLogger("uvicorn.error").error(
                "Unexpected Gmail mailbox scan failure type=%s", type(exc).__name__
            )
            return mailbox_email, None, {
                "email": mailbox_email,
                "message": "This Gmail account could not be scanned due to a temporary server error.",
            }

    # A slow second inbox no longer holds back results from the first inbox.
    with ThreadPoolExecutor(max_workers=min(3, len(mailboxes))) as executor:
        mailbox_results = list(executor.map(scan_one_mailbox, mailboxes))
    for mailbox_email, result, error in mailbox_results:
        if error:
            account_errors.append(error)
            continue
        if result is None:
            continue
        scanned_messages += int(result["searched"])
        full_fetched += int(result["full_fetched"])
        parsed.extend(result["parsed"])
        successful_accounts.append(mailbox_email)

    if not successful_accounts and account_errors:
        raise HTTPException(status_code=502, detail="All connected Gmail accounts failed to scan. " + account_errors[0]["message"])

    grouped = group_billing_evidence(parsed)
    duration_ms = round((perf_counter() - scan_started) * 1000)
    logging.getLogger("uvicorn.error").info(
        "Gmail scan complete: accounts=%s searched=%s full_fetched=%s matched=%s candidates=%s duration_ms=%s",
        len(successful_accounts), scanned_messages, full_fetched, len(parsed), len(grouped), duration_ms, 4,
    )

    db.query(ScanCandidate).filter(
        ScanCandidate.user_id == user.id,
        ScanCandidate.imported.is_(False),
    ).delete(synchronize_session=False)
    for candidate in grouped:
        fingerprint = candidate["fingerprint"][:300]
        existing = db.scalar(select(ScanCandidate).where(
            ScanCandidate.user_id == user.id,
            ScanCandidate.fingerprint == fingerprint,
        ))
        if existing is None:
            existing = ScanCandidate(
                user_id=user.id,
                fingerprint=fingerprint,
                service_name=candidate["service_name"],
                category=candidate["category"],
            )
            db.add(existing)
        existing.service_name = candidate["service_name"]
        existing.category = candidate["category"]
        existing.amount = candidate.get("amount")
        existing.cycle = candidate.get("cycle") or "Unknown"
        existing.next_renewal = candidate.get("next_renewal") or ""
        existing.confidence = int(candidate.get("confidence", 50))
        existing.evidence_count = int(candidate.get("evidence_count", 1))
        existing.evidence_date = str(candidate.get("evidence_date") or "")
        existing.source_accounts = json.dumps(candidate.get("source_accounts") or [])
        existing.billing_source = str(candidate.get("billing_source") or "provider")
        existing.manage_url = str(candidate.get("manage_url") or _manage_url_for(candidate["service_name"], candidate.get("billing_source")))[:2000]
        existing.updated_at = utcnow()
    db.commit()

    saved = db.scalars(
        select(ScanCandidate)
        .where(ScanCandidate.user_id == user.id, ScanCandidate.imported.is_(False))
        .order_by(ScanCandidate.updated_at.desc())
    ).all()
    return {
        "scanned_messages": scanned_messages,
        "full_messages_fetched": full_fetched,
        "matched_receipts": len(parsed),
        "candidate_count": len(grouped),
        "scanned_at": now_utc().isoformat() + "Z",
        "candidates": [candidate_public(item) for item in saved[:100]],
        "notice": "SubSathi combines billing evidence from all linked Gmail inboxes. Missing prices or renewal dates remain unverified; review results before importing.",
        "scan_limit_per_account": limit,
        "scan_duration_ms": duration_ms,
        "scan_workers": 4,
        "scanned_accounts": successful_accounts,
        "account_errors": account_errors,
        "scan_note": "Each linked inbox is searched with multiple billing/provider query strategies, then duplicate evidence is grouped for review.",
    }


@app.post("/api/gmail/import")
def import_candidates(payload: CandidateImportRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    candidates = db.scalars(select(ScanCandidate).where(ScanCandidate.user_id == user.id, ScanCandidate.id.in_(payload.candidate_ids))).all()
    found_ids = {item.id for item in candidates}
    if found_ids != set(payload.candidate_ids):
        raise HTTPException(status_code=404, detail="One or more scan results were not found for your account. Scan again.")
    overrides = {item.candidate_id: item for item in payload.overrides}
    if set(overrides) - found_ids:
        raise HTTPException(status_code=400, detail="Import details included an item that was not selected.")

    # Apply explicit user-reviewed corrections before validating required fields.
    for item in candidates:
        override = overrides.get(item.id)
        if override is None:
            continue
        if override.amount is not None:
            item.amount = override.amount
        if override.cycle is not None:
            item.cycle = override.cycle
        if override.next_renewal is not None:
            item.next_renewal = override.next_renewal

    missing_prices = [item.service_name for item in candidates if item.amount is None or item.amount <= 0]
    if missing_prices:
        raise HTTPException(status_code=422, detail="Enter a valid price for: " + ", ".join(missing_prices))
    missing_cycles = [item.service_name for item in candidates if item.cycle not in {"Weekly", "Monthly", "Quarterly", "Yearly"}]
    if missing_cycles:
        raise HTTPException(status_code=422, detail="Choose the billing cycle for: " + ", ".join(missing_cycles))

    result = []
    for item in candidates:
        item.imported = True
        item.updated_at = utcnow()
        result.append({
            "candidateId": item.id,
            "name": item.service_name,
            "category": item.category,
            "amount": item.amount,
            "cycle": item.cycle,
            "nextRenewal": item.next_renewal or "",
            "manageUrl": item.manage_url or _manage_url_for(item.service_name, item.billing_source),
            "billingSource": item.billing_source or "provider",
            "billingSourceLabel": _billing_source_label(item.billing_source),
            "notes": f"Detected from billing emails ({item.evidence_count} message(s)). Verify the renewal date if it wasn't found in the email.",
            "needsReview": not bool(item.next_renewal),
            "source": "gmail",
            "sourceAccounts": json.loads(item.source_accounts or "[]"),
        })
    db.commit()
    return {"imported": result, "count": len(result), "notice": "Imported records are saved by the app on this device. Verify any fields marked for review."}


@app.delete("/api/auth/gmail/accounts/{email}")
def disconnect_gmail_account(email: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, Any]:
    normalized_email = email.strip().lower()
    primary = db.scalar(select(GoogleConnection).where(
        GoogleConnection.user_id == user.id,
        GoogleConnection.email == normalized_email,
    ))
    linked = db.scalar(select(LinkedGmailAccount).where(
        LinkedGmailAccount.user_id == user.id,
        LinkedGmailAccount.email == normalized_email,
    ))
    if primary is None and linked is None:
        raise HTTPException(status_code=404, detail="That Gmail account is not connected to this SubSathi account.")
    if primary is not None:
        revoke_google_connection(primary)
        db.delete(primary)
    if linked is not None:
        revoke_google_connection(linked)
        db.delete(linked)
    db.query(ScanCandidate).filter(
        ScanCandidate.user_id == user.id,
        ScanCandidate.imported.is_(False),
    ).delete(synchronize_session=False)
    db.commit()
    remaining_primary = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    remaining_linked = db.scalars(select(LinkedGmailAccount).where(LinkedGmailAccount.user_id == user.id)).all()
    remaining = ([remaining_primary.email] if remaining_primary else []) + [row.email for row in remaining_linked]
    return {"status": "disconnected", "email": normalized_email, "remaining_accounts": remaining}


@app.delete("/api/auth/gmail/connection")
def disconnect_gmail(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    if connection:
        revoke_google_connection(connection)
        db.delete(connection)
    linked = db.scalars(select(LinkedGmailAccount).where(LinkedGmailAccount.user_id == user.id)).all()
    for mailbox in linked:
        revoke_google_connection(mailbox)
        db.delete(mailbox)
    db.query(ScanCandidate).filter(ScanCandidate.user_id == user.id).delete(synchronize_session=False)
    db.commit()
    return {"status": "disconnected", "message": "All connected Gmail credentials and cached scan candidates were deleted. Locally imported tracker entries were not touched."}


@app.delete("/api/me")
def delete_account(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    connection = db.scalar(select(GoogleConnection).where(GoogleConnection.user_id == user.id))
    revoke_google_connection(connection)
    linked = db.scalars(select(LinkedGmailAccount).where(LinkedGmailAccount.user_id == user.id)).all()
    for mailbox in linked:
        revoke_google_connection(mailbox)
        db.delete(mailbox)
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