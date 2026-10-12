import pytest
from cryptography.fernet import Fernet

from app.config import Settings


def test_production_api_can_boot_before_google_oauth_is_configured():
    settings = Settings(
        app_env='production',
        jwt_secret='strong-production-secret-value-that-is-not-default-123456',
        token_encryption_key=Fernet.generate_key().decode('ascii'),
        google_client_id='',
        google_client_secret='',
        google_redirect_uri='http://localhost:8000/api/auth/google/callback',
    )
    settings.validate_production()
    assert not settings.google_configured


def test_production_rejects_placeholder_jwt_secret():
    settings = Settings(
        app_env='production',
        jwt_secret='development-only-change-this-secret',
        token_encryption_key=Fernet.generate_key().decode('ascii'),
    )
    with pytest.raises(RuntimeError, match='JWT_SECRET'):
        settings.validate_production()


def test_production_rejects_invalid_fernet_key():
    settings = Settings(
        app_env='production',
        jwt_secret='strong-production-secret-value-that-is-not-default-123456',
        token_encryption_key='not-a-fernet-key',
    )
    with pytest.raises(RuntimeError, match='TOKEN_ENCRYPTION_KEY'):
        settings.validate_production()