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