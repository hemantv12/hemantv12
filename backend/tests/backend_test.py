"""SwapKaro backend API tests covering auth, profile, feed, swaps, chat, skills,
pro/boost and notifications."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://swapkaro-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Unique phone per run to keep new-user path deterministic
TEST_PHONE = f"+91-99{int(time.time()) % 100000000:08d}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    """Authenticate test user and return (token, user)."""
    r = session.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE})
    assert r.status_code == 200, r.text
    r = session.post(f"{API}/auth/verify-otp", json={"phone": TEST_PHONE, "otp": "123456"})
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["token"], "user": body["user"], "is_new": body["is_new"]}


@pytest.fixture(scope="module")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# --- Health ---
class TestHealth:
    def test_root_ok(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert body.get("app") == "SwapKaro"


# --- Auth ---
class TestAuth:
    def test_request_otp(self, session):
        r = session.post(f"{API}/auth/request-otp", json={"phone": "+91-9876543210"})
        assert r.status_code == 200
        assert r.json().get("sent") is True

    def test_verify_otp_wrong(self, session):
        r = session.post(f"{API}/auth/verify-otp", json={"phone": "+91-9876543210", "otp": "000000"})
        assert r.status_code == 400

    def test_verify_otp_correct_returns_token(self, auth):
        assert auth["token"]
        assert auth["user"]["phone"] == TEST_PHONE
        # new user should be flagged
        assert auth["is_new"] is True

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/me")
        assert r.status_code == 401


# --- Profile ---
class TestProfile:
    def test_get_me(self, session, headers):
        r = session.get(f"{API}/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["phone"] == TEST_PHONE

    def test_patch_me_updates(self, session, headers):
        payload = {
            "name": "TEST_User",
            "city": "Bengaluru",
            "offered": [{"name": "Logo Design", "level": "Expert", "verified": False}],
            "needed": [{"name": "Yoga Coaching", "level": "Good", "verified": False}],
        }
        r = session.patch(f"{API}/me", headers=headers, json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "TEST_User"
        assert body["city"] == "Bengaluru"
        assert body["offered"][0]["level"] == "Expert"
        # verify persistence with GET
        r2 = session.get(f"{API}/me", headers=headers)
        assert r2.json()["name"] == "TEST_User"


# --- Feed ---
class TestFeed:
    def test_feed_requires_auth(self, session):
        r = session.get(f"{API}/feed")
        assert r.status_code == 401

    def test_feed_returns_items(self, session, headers):
        r = session.get(f"{API}/feed", headers=headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert "match_pct" in items[0]
        assert "distance_km" in items[0]


# --- AI Matches ---
class TestAIMatches:
    def test_ai_matches_top3(self, session, headers):
        r = session.get(f"{API}/matches/ai", headers=headers, timeout=60)
        assert r.status_code == 200
        matches = r.json()["matches"]
        assert 1 <= len(matches) <= 3
        for m in matches:
            assert "reason" in m and isinstance(m["reason"], str) and len(m["reason"]) > 0


# --- Skills autocomplete & verify quiz ---
class TestSkills:
    def test_autocomplete(self, session):
        r = session.get(f"{API}/skills/autocomplete", params={"q": "lo"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("Logo Design" == s for s in items)

    def test_verify_quiz_returns_3(self, session, headers):
        r = session.post(f"{API}/skills/verify-quiz", headers=headers, json={"skill": "Logo Design"}, timeout=60)
        assert r.status_code == 200
        qs = r.json()["questions"]
        assert len(qs) == 3
        assert all("q" in q and "options" in q and "answer" in q for q in qs)

    def test_verify_submit_pass_flips_verified(self, session, headers):
        r = session.post(f"{API}/skills/verify-submit", headers=headers,
                         json={"skill": "Logo Design", "score": 3, "total": 3})
        assert r.status_code == 200
        assert r.json()["passed"] is True
        me = session.get(f"{API}/me", headers=headers).json()
        verified = [s for s in me["offered"] if s["name"].lower() == "logo design"]
        assert verified and verified[0]["verified"] is True


# --- Swaps & chat ---
class TestSwaps:
    swap_id = None
    other_user_id = None

    def test_create_swap_with_agreement(self, session, headers):
        feed = session.get(f"{API}/feed", headers=headers).json()["items"]
        other = feed[0]
        TestSwaps.other_user_id = other["id"]
        payload = {"to_user": other["id"], "my_skill": "Logo Design", "their_skill": other["offered"][0]["name"]}
        r = session.post(f"{API}/swaps", headers=headers, json=payload, timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert body["swap"]["from_user"]
        assert body["agreement"]
        TestSwaps.swap_id = body["swap"]["id"]

    def test_messages_have_agreement_bot(self, session, headers):
        assert TestSwaps.swap_id
        r = session.get(f"{API}/swaps/{TestSwaps.swap_id}/messages", headers=headers)
        assert r.status_code == 200
        msgs = r.json()["items"]
        assert len(msgs) >= 1
        assert msgs[0]["is_bot"] is True

    def test_send_message(self, session, headers):
        r = session.post(f"{API}/swaps/{TestSwaps.swap_id}/messages", headers=headers,
                         json={"text": "Hello from test"})
        assert r.status_code == 200
        assert r.json()["text"] == "Hello from test"

    def test_bot_reply(self, session, headers):
        r = session.post(f"{API}/swaps/{TestSwaps.swap_id}/bot", headers=headers,
                         json={"question": "Kab milenge?"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["is_bot"] is True
        assert len(r.json()["text"]) > 0

    def test_milestone_advances_and_completes(self, session, headers):
        for expected in [1, 2, 3, 4]:
            r = session.post(f"{API}/swaps/{TestSwaps.swap_id}/milestone", headers=headers)
            assert r.status_code == 200
            assert r.json()["milestone"] == expected
        # At 4, status must be completed
        sw = session.get(f"{API}/swaps", headers=headers).json()["items"]
        target = [s for s in sw if s["id"] == TestSwaps.swap_id][0]
        assert target["status"] == "completed"

    def test_swap_score_bumped_after_completion(self, session, headers):
        me = session.get(f"{API}/me", headers=headers).json()
        # Started at 720; after one full swap, +12 → 732 (allow >= 732)
        assert me["swap_score"] >= 732
        assert me["swaps_completed"] >= 1


# --- Pro & Boost ---
class TestPro:
    def test_upgrade_pro(self, session, headers):
        r = session.post(f"{API}/pro/upgrade", headers=headers, json={})
        assert r.status_code == 200
        assert r.json()["is_pro"] is True
        me = session.get(f"{API}/me", headers=headers).json()
        assert me["is_pro"] is True

    def test_boost(self, session, headers):
        r = session.post(f"{API}/boost", headers=headers, json={"hours": 48})
        assert r.status_code == 200
        assert r.json()["hours"] == 48
        assert r.json().get("boost_until")


# --- Notifications ---
class TestNotifs:
    def test_list_notifications(self, session, headers):
        r = session.get(f"{API}/notifications", headers=headers)
        assert r.status_code == 200
        items = r.json()["items"]
        # Should have notifications from swap-create + pro upgrade
        assert len(items) >= 1

    def test_seed_notifications(self, session, headers):
        # Already has notifs -> seed should return False idempotently
        r = session.post(f"{API}/notifications/seed", headers=headers, json={})
        assert r.status_code == 200
        assert "seeded" in r.json()
