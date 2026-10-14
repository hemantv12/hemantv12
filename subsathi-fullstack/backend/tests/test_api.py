import pytest

# The production Docker image installs Google OAuth/Gmail dependencies.
# Skip API import tests in constrained local environments where those wheels are unavailable.
pytest.importorskip('google.auth')
pytest.importorskip('google_auth_oauthlib')
pytest.importorskip('googleapiclient.discovery')

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint_is_public_and_reports_oauth_state():
    response = client.get('/health')
    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'ok'
    assert payload['service'] == 'subsathi-api'
    assert 'google_oauth_configured' in payload
    assert payload['database_backend'] in ('sqlite', 'postgresql')
    assert payload['durable_database_configured'] is (payload['database_backend'] == 'postgresql')


def test_public_policy_pages_are_available():
    assert client.get('/privacy').status_code == 200
    assert 'Privacy' in client.get('/privacy').text
    assert client.get('/terms').status_code == 200
    assert 'Terms' in client.get('/terms').text


def test_private_api_requires_authentication():
    response = client.get('/api/me')
    assert response.status_code == 401


def test_gmail_oauth_url_is_clear_when_not_configured():
    response = client.get('/api/auth/google/url')
    # The regular dev test environment has no Google client credentials.
    assert response.status_code in (200, 503)
    if response.status_code == 503:
        assert 'not configured' in response.json()['detail'].lower()


def test_google_oauth_start_persists_pkce_verifier_for_callback(monkeypatch):
    from types import SimpleNamespace
    from urllib.parse import parse_qs, urlparse

    import app.main as main
    from app.database import SessionLocal
    from app.models import OAuthState

    monkeypatch.setattr(main, "settings", SimpleNamespace(
        google_configured=True,
        google_client_id="test-client.apps.googleusercontent.com",
        google_client_secret="test-client-secret",
        google_redirect_uri="https://example.com/api/auth/google/callback",
    ))

    response = client.get("/api/auth/google/url?redirect_target=mobile")
    assert response.status_code == 200
    authorization_url = response.json()["authorization_url"]
    query = parse_qs(urlparse(authorization_url).query)
    state = query["state"][0]
    assert query.get("code_challenge_method") == ["S256"]
    assert query.get("code_challenge")

    db = SessionLocal()
    try:
        saved_state = db.get(OAuthState, state)
        assert saved_state is not None
        assert saved_state.code_verifier
        assert len(saved_state.code_verifier) == 128

        callback_flow = main.google_flow(
            state=state,
            code_verifier=saved_state.code_verifier,
            autogenerate_code_verifier=False,
        )
        assert callback_flow.code_verifier == saved_state.code_verifier
        assert callback_flow.autogenerate_code_verifier is False
        db.delete(saved_state)
        db.commit()
    finally:
        db.close()



def test_google_identity_scope_aliases_normalize_without_relaxing_gmail_scope():
    from app.main import normalize_scope_set, SCOPES

    expected = {
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.readonly",
    }
    assert normalize_scope_set(SCOPES) == expected
    actual_google_response_scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]
    normalized = normalize_scope_set(actual_google_response_scopes)
    assert normalized == expected
    assert "https://www.googleapis.com/auth/gmail.readonly" in normalized



def test_gmail_import_request_accepts_user_reviewed_price_cycle_and_renewal():
    from app.main import CandidateImportRequest

    payload = CandidateImportRequest(
        candidate_ids=[11],
        overrides=[{
            "candidate_id": 11,
            "amount": 199,
            "cycle": "Monthly",
            "next_renewal": "2026-11-18",
        }],
    )
    assert payload.candidate_ids == [11]
    assert payload.overrides[0].amount == 199
    assert payload.overrides[0].cycle == "Monthly"
    assert payload.overrides[0].next_renewal == "2026-11-18"


def test_gmail_import_request_rejects_invalid_reviewed_cycle():
    from pydantic import ValidationError
    from app.main import CandidateImportRequest

    with pytest.raises(ValidationError):
        CandidateImportRequest(
            candidate_ids=[11],
            overrides=[{"candidate_id": 11, "cycle": "Every 2 weeks"}],
        )



def test_link_gmail_endpoint_requires_an_existing_subsathi_session():
    response = client.get("/api/auth/google/link-url")
    assert response.status_code == 401


def test_gmail_scan_queries_include_known_sender_and_longer_history():
    from app.main import gmail_scan_queries

    queries = gmail_scan_queries()
    assert len(queries) >= 4
    assert any("newer_than:5y" in query for query in queries)
    assert any("from:netflix.com" in query for query in queries)
    assert any("from:swiggy.com" in query for query in queries)
    assert any("free trial" in query for query in queries)
    assert any("recurring charge" in query for query in queries)
    assert any("UPI AutoPay" in query for query in queries)
    assert any("standing instruction" in query for query in queries)



def test_gmail_batch_fetch_uses_supported_execute_signature_and_preserves_order(monkeypatch):
    import app.main as main

    batches = []

    class FakeBatch:
        def __init__(self, callback):
            self.callback = callback
            self.requests = []
            batches.append(self)

        def add(self, request, request_id):
            self.requests.append((request, request_id))

        # Intentionally mirrors BatchHttpRequest.execute(self, http=None):
        # passing num_retries here would raise TypeError.
        def execute(self):
            for request, request_id in self.requests:
                self.callback(request_id, {
                    "id": request["id"],
                    "format": request["format"],
                    "metadataHeaders": request.get("metadataHeaders"),
                }, None)

    class FakeMessages:
        def get(self, **kwargs):
            return kwargs

    class FakeUsers:
        def messages(self):
            return FakeMessages()

    class FakeService:
        def users(self):
            return FakeUsers()

        def new_batch_http_request(self, callback):
            return FakeBatch(callback)

    monkeypatch.setattr(main, "build", lambda *args, **kwargs: FakeService())
    ids = [f"message-{index}" for index in range(101)]

    result = main._batch_fetch_gmail_messages_for_scan(
        credentials=object(),
        message_ids=ids,
        message_format="metadata",
    )

    assert len(batches) == 3
    assert [len(batch.requests) for batch in batches] == [50, 50, 1]
    assert [item["id"] for item in result] == ids
    assert all(item["format"] == "metadata" for item in result)
    assert all(item["metadataHeaders"] == ["From", "Subject", "Date"] for item in result)


def test_manage_url_is_specific_to_billing_platform():
    from app.main import _manage_url_for, _billing_source_label

    assert _manage_url_for("Netflix", "google_play") == "https://play.google.com/store/account/subscriptions"
    assert _manage_url_for("Netflix", "provider") == "https://www.netflix.com/YourAccount"
    assert _billing_source_label("apple_app_store") == "Apple App Store"

def test_gmail_import_preserves_detected_subscription_when_price_and_cycle_are_unknown():
    from types import SimpleNamespace
    from app.main import CandidateImportRequest, import_candidates

    candidate = SimpleNamespace(
        id=11,
        user_id=4,
        service_name="Netflix",
        category="Entertainment",
        amount=None,
        cycle="Unknown",
        next_renewal="",
        manage_url="",
        billing_source="provider",
        evidence_count=2,
        source_accounts='["person@example.com"]',
        imported=False,
        updated_at=None,
    )

    class FakeScalars:
        def all(self):
            return [candidate]

    class FakeDB:
        def scalars(self, _statement):
            return FakeScalars()

        def commit(self):
            return None

    response = import_candidates(
        CandidateImportRequest(candidate_ids=[11]),
        user=SimpleNamespace(id=4),
        db=FakeDB(),
    )

    assert response["count"] == 1
    imported = response["imported"][0]
    assert imported["name"] == "Netflix"
    assert imported["amount"] is None
    assert imported["cycle"] == "Unknown"
    assert imported["needsReview"] is True
    assert "Price not found" in imported["notes"]
    assert "Billing cycle not found" in imported["notes"]



def test_gmail_import_request_allows_correcting_or_clearing_unverified_fields():
    from app.main import CandidateImportRequest

    payload = CandidateImportRequest(
        candidate_ids=[11],
        overrides=[{
            "candidate_id": 11,
            "amount": None,
            "cycle": "Unknown",
            "next_renewal": "",
        }],
    )
    override = payload.overrides[0]
    fields_set = getattr(override, "model_fields_set", getattr(override, "__fields_set__", set()))
    assert "amount" in fields_set
    assert override.amount is None
    assert override.cycle == "Unknown"
    assert override.next_renewal == ""



def test_health_endpoint_reports_effective_scan_budget():
    from app.config import settings

    payload = client.get("/health").json()
    assert payload["scan_max_messages_per_inbox"] == settings.scan_max_messages


def test_gmail_permission_error_recommends_repair_without_disconnect():
    from app.main import _gmail_http_error_message

    message = _gmail_http_error_message(403, "PERMISSION_DENIED")
    assert "Repair Gmail connection" in message
    assert "tracker" in message.lower()


def test_expired_google_refresh_token_does_not_invalidate_subsathi_session(monkeypatch):
    from types import SimpleNamespace

    import app.main as main
    from fastapi import HTTPException

    primary = SimpleNamespace(email="owner@gmail.com", user_id=7)
    user = SimpleNamespace(id=7)

    class FakeScalars:
        def all(self):
            return []

    class FakeDB:
        def scalar(self, statement):
            return primary

        def scalars(self, statement):
            return FakeScalars()

    def rejected_google_refresh(db, connection):
        raise HTTPException(
            status_code=401,
            detail="Could not refresh this Gmail authorization. Reconnect this Gmail account.",
        )

    monkeypatch.setattr(main, "_credentials_for_mailbox", rejected_google_refresh)
    with pytest.raises(HTTPException) as caught:
        main.credentials_for_all_mailboxes(FakeDB(), user)

    assert caught.value.status_code == 409
    assert "Repair Gmail connection" in caught.value.detail
    assert "local subscription tracker is untouched" in caught.value.detail


def test_gmail_error_context_prefers_actionable_google_reason():
    import json

    from googleapiclient.errors import HttpError
    from httplib2 import Response

    import app.main as main

    response = Response({"status": "403", "reason": "Forbidden"})
    payload = {
        "error": {
            "code": 403,
            "status": "PERMISSION_DENIED",
            "message": "Request is not permitted",
            "errors": [{"domain": "usageLimits", "reason": "userRateLimitExceeded"}],
        }
    }
    error = HttpError(response, json.dumps(payload).encode("utf-8"))
    assert main._gmail_http_error_context(error) == (403, "userRateLimitExceeded")


@pytest.mark.parametrize("status_code", [403, 429])
def test_gmail_batch_fetch_does_not_silently_drop_access_errors(monkeypatch, status_code):
    import json

    from googleapiclient.errors import HttpError
    from httplib2 import Response

    import app.main as main

    class FakeBatch:
        def __init__(self, callback):
            self.callback = callback
            self.request_ids = []

        def add(self, request, request_id):
            self.request_ids.append(request_id)

        def execute(self):
            payload = {
                "error": {
                    "code": status_code,
                    "status": "PERMISSION_DENIED" if status_code == 403 else "RESOURCE_EXHAUSTED",
                    "message": "Gmail body access failed",
                    "errors": [{"reason": "insufficientPermissions" if status_code == 403 else "userRateLimitExceeded"}],
                }
            }
            exception = HttpError(
                Response({"status": str(status_code), "reason": "Forbidden"}),
                json.dumps(payload).encode("utf-8"),
            )
            for request_id in self.request_ids:
                self.callback(request_id, None, exception)

    class FakeMessages:
        def get(self, **kwargs):
            return kwargs

    class FakeUsers:
        def messages(self):
            return FakeMessages()

    class FakeService:
        def new_batch_http_request(self, callback):
            return FakeBatch(callback)

        def users(self):
            return FakeUsers()

    monkeypatch.setattr(main, "build", lambda *args, **kwargs: FakeService())
    with pytest.raises(HttpError):
        main._batch_fetch_gmail_messages_for_scan(
            object(), ["message-1"], message_format="full"
        )


def test_gmail_batch_fetch_ignores_only_messages_that_disappeared(monkeypatch):
    import json

    from googleapiclient.errors import HttpError
    from httplib2 import Response

    import app.main as main

    class FakeBatch:
        def __init__(self, callback):
            self.callback = callback
            self.request_ids = []

        def add(self, request, request_id):
            self.request_ids.append(request_id)

        def execute(self):
            exception = HttpError(
                Response({"status": "404", "reason": "Not Found"}),
                json.dumps({"error": {"code": 404, "status": "NOT_FOUND"}}).encode("utf-8"),
            )
            for request_id in self.request_ids:
                self.callback(request_id, None, exception)

    class FakeMessages:
        def get(self, **kwargs):
            return kwargs

    class FakeUsers:
        def messages(self):
            return FakeMessages()

    class FakeService:
        def new_batch_http_request(self, callback):
            return FakeBatch(callback)

        def users(self):
            return FakeUsers()

    monkeypatch.setattr(main, "build", lambda *args, **kwargs: FakeService())
    assert main._batch_fetch_gmail_messages_for_scan(
        object(), ["deleted-message"], message_format="full"
    ) == [None]
