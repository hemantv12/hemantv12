import json

from app.ai_extractor import extract_billing_evidence_with_ai


def _email_result(**overrides):
    result = {
        "email_id": "msg-1",
        "is_subscription": True,
        "service_name": "Spotify Premium",
        "service_evidence": "Spotify Premium",
        "recurrence_evidence": "Your Spotify Premium subscription renews on November 12, 2026.",
        "amount_evidence": "You will be charged ₹119",
        "cycle_evidence": "₹119 per month",
        "renewal_evidence": "Your Spotify Premium subscription renews on November 12, 2026.",
    }
    result.update(overrides)
    return result


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_ai_extraction_accepts_only_quoted_email_evidence(monkeypatch):
    input_email = {
        "message_id": "msg-1",
        "subject": "Your Spotify Premium subscription receipt",
        "sender": "Spotify <no-reply@spotify.com>",
        "date_header": "Mon, 12 Oct 2026 10:00:00 +0000",
        "body": "Your Spotify Premium subscription renews on November 12, 2026. You will be charged ₹119 per month.",
    }
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["request"] = kwargs
        return FakeResponse({"output_text": json.dumps({"results": [_email_result()]})})

    monkeypatch.setattr("app.ai_extractor.httpx.post", fake_post)
    results = extract_billing_evidence_with_ai([input_email], api_key="test-key")

    assert captured["url"] == "https://api.openai.com/v1/responses"
    assert captured["request"]["headers"]["Authorization"] == "Bearer test-key"
    assert captured["request"]["json"]["store"] is False
    assert results[0]["service_name"] == "Spotify Premium"
    assert results[0]["amount"] == 119
    assert results[0]["cycle"] == "Monthly"
    assert results[0]["next_renewal"] == "2026-11-12"
    assert results[0]["ai_evidence_used"] is True


def test_ai_extraction_rejects_hallucinated_quotes(monkeypatch):
    input_email = {
        "message_id": "msg-1",
        "subject": "Your subscription receipt",
        "sender": "billing@example.com",
        "date_header": "Mon, 12 Oct 2026 10:00:00 +0000",
        "body": "Thank you for your order.",
    }

    def fake_post(url, **kwargs):
        return FakeResponse({"output_text": json.dumps({"results": [_email_result()]})})

    monkeypatch.setattr("app.ai_extractor.httpx.post", fake_post)
    assert extract_billing_evidence_with_ai([input_email], api_key="test-key") == []


def test_ai_extraction_is_noop_without_key():
    assert extract_billing_evidence_with_ai(
        [{"message_id": "msg-1", "subject": "A subscription"}],
        api_key="",
    ) == []


def test_ai_keeps_verified_subscription_when_billing_fields_are_absent(monkeypatch):
    input_email = {
        "message_id": "msg-no-fields",
        "subject": "Your Spotify Premium membership renewed",
        "sender": "Spotify <no-reply@spotify.com>",
        "date_header": "Mon, 12 Oct 2026 10:00:00 +0000",
        "body": "Your Spotify Premium subscription has been renewed successfully.",
    }
    result = _email_result(
        email_id="msg-no-fields",
        service_name="Spotify Premium",
        service_evidence="Spotify Premium",
        recurrence_evidence="subscription has been renewed successfully",
        amount_evidence=None,
        cycle_evidence=None,
        renewal_evidence=None,
    )

    def fake_post(url, **kwargs):
        return FakeResponse({"output_text": json.dumps({"results": [result]})})

    monkeypatch.setattr("app.ai_extractor.httpx.post", fake_post)
    results = extract_billing_evidence_with_ai([input_email], api_key="test-key")

    assert len(results) == 1
    assert results[0]["service_name"] == "Spotify Premium"
    assert results[0]["amount"] is None
    assert results[0]["cycle"] is None
    assert results[0]["next_renewal"] is None
    assert results[0]["confidence"] == 48
