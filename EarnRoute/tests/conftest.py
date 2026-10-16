import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret-key-that-is-long-enough-for-unit-tests-123456")

import pytest
from fastapi.testclient import TestClient
from app.main import Base, SessionLocal, app, engine, User, hash_password, _RATE_BUCKETS

@pytest.fixture
def client():
    _RATE_BUCKETS.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def create_admin():
    def _create(email="admin@earnroute.test", password="StrongAdminPass123"):
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                return existing
            user = User(email=email, full_name="EarnRoute Admin", password_hash=hash_password(password), role="admin", active=True, email_verified=True)
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()
    return _create

def token_headers(client, email, password):
    response = client.post("/api/auth/login", json={"email":email,"password":password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

@pytest.fixture
def register_worker(client):
    def _register(email="worker@example.com", name="Aanya Sharma", password="WorkerPass1234"):
        response = client.post("/api/auth/register", json={"email":email,"full_name":name,"password":password,"role":"worker","terms_accepted":True,"adult_confirmed":True})
        assert response.status_code == 201, response.text
        return response.json(), {"Authorization": f"Bearer {response.json()['access_token']}"}
    return _register

@pytest.fixture
def register_business(client):
    def _register(email="business@example.com", name="Northstar Retail", password="BusinessPass123"):
        response = client.post("/api/auth/register", json={"email":email,"full_name":name,"password":password,"role":"business","terms_accepted":True})
        assert response.status_code == 201, response.text
        return response.json(), {"Authorization": f"Bearer {response.json()['access_token']}"}
    return _register
