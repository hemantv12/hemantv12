from datetime import datetime, timedelta, timezone

from app.main import SessionLocal, User, BusinessProfile, WorkerProfile, Job, Assignment, Dispute, ProviderEvent, match_job
from tests.conftest import token_headers


def future_job_payload(days=3, title="Event registration associate", publish=True):
    start = datetime.now(timezone.utc) + timedelta(days=days)
    start = start.replace(hour=10, minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=4)
    deadline = start - timedelta(hours=5)
    return {
        "title": title,
        "description": "Help attendees check in, manage the event desk, and answer visitor questions.",
        "category": "Events", "city": "Delhi", "address": "Example convention centre, Delhi",
        "latitude": 28.6139, "longitude": 77.2090,
        "slots": 2, "start_at": start.isoformat(), "end_at": end.isoformat(),
        "pay_amount": 1200, "pay_basis": "shift", "payment_terms": "Within 3 business days after approved completion",
        "requirements": ["customer service", "event support"], "min_experience": 0,
        "breaks_info": "One 15-minute break during the shift", "equipment_info": "Wear closed shoes",
        "safety_info": "Check in with the named shift supervisor on arrival.",
        "application_deadline": deadline.isoformat(), "cancellation_policy": "Notify the other party as early as possible.",
        "publish": publish,
    }


def set_eligible_worker_profile(client, headers, availability=None, skills=None, experience_years=1):
    windows = availability if availability is not None else [
        {"day": day, "start": "00:00", "end": "23:59"} for day in range(7)
    ]
    return client.patch("/api/worker/profile", headers=headers, json={
        "city": "Delhi", "skills": skills if skills is not None else ["customer service", "event support"],
        "preferred_categories": ["Events"], "availability": windows,
        "travel_radius_km": 5, "min_pay": 0, "experience_years": experience_years,
    })


def verify_business(client, create_admin, business_user_id, email="admin@earnroute.test"):
    admin = create_admin(email=email)
    headers = token_headers(client, email, "StrongAdminPass123")
    response = client.patch(f"/api/admin/businesses/{business_user_id}/verification", headers=headers, json={"status":"verified","reason":"Business details reviewed by founder."})
    assert response.status_code == 200, response.text
    return headers


def test_health_and_public_pages(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    home = client.get("/")
    assert home.status_code == 200 and "EarnRoute" in home.text
    admin_page = client.get("/admin")
    assert admin_page.status_code == 200 and 'id="auth-modal"' in admin_page.text
    assert client.get("/admin/").status_code == 200
    # UI entry is public; administrator data remains protected by bearer auth and role checks.
    assert client.get("/api/admin/overview").status_code == 401
    assert client.get("/static/terms.html").status_code == 200
    assert client.get("/static/privacy.html").status_code == 200


def test_register_login_and_duplicate_protection(client, register_worker):
    first, _ = register_worker()
    assert first["user"]["role"] == "worker"
    assert first["user"]["profile"]["city"] == ""
    stored = SessionLocal().get(User, first["user"]["id"])
    assert stored and stored.adult_confirmed_at is not None
    response_without_age_confirmation = client.post("/api/auth/register", json={"email":"underage@example.com","full_name":"Another Person","password":"WorkerPass1234","role":"worker","terms_accepted":True})
    assert response_without_age_confirmation.status_code == 422
    duplicate = client.post("/api/auth/register", json={"email":"WORKER@example.com","full_name":"Aanya Sharma","password":"WorkerPass1234","role":"worker","terms_accepted":True,"adult_confirmed":True})
    assert duplicate.status_code == 409
    bad = client.post("/api/auth/login", json={"email":"worker@example.com","password":"incorrect-password"})
    assert bad.status_code == 401
    good = client.post("/api/auth/login", json={"email":"worker@example.com","password":"WorkerPass1234"})
    assert good.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization":f"Bearer {good.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["user"]["email"] == "worker@example.com"


def test_users_cannot_self_register_as_admin(client):
    response = client.post("/api/auth/register", json={"email":"root@example.com","full_name":"Root Account","password":"SomeLongPassword123","role":"admin"})
    assert response.status_code == 422


def test_role_based_access_and_worker_profile(client, register_worker):
    _, worker_headers = register_worker()
    forbidden = client.post("/api/jobs", headers=worker_headers, json=future_job_payload())
    assert forbidden.status_code == 403
    body = {"city":"Delhi","skills":["Customer service","Event support"],"preferred_categories":["Events"],"availability":[{"day":5,"start":"09:00","end":"18:00"}],"travel_radius_km":5,"min_pay":800,"experience_years":1}
    response = client.patch("/api/worker/profile", headers=worker_headers, json=body)
    assert response.status_code == 200, response.text
    profile = response.json()["user"]["profile"]
    assert profile["city"] == "Delhi"
    assert profile["skills"] == ["Customer service","Event support"]
    invalid = {**body,"availability":[{"day":9,"start":"18:00","end":"09:00"}]}
    assert client.patch("/api/worker/profile", headers=worker_headers, json=invalid).status_code == 422


def test_business_must_be_verified_before_publishing(client, register_business, create_admin):
    business, business_headers = register_business()
    payload = future_job_payload()
    blocked = client.post("/api/jobs", headers=business_headers, json=payload)
    assert blocked.status_code == 403
    draft = client.post("/api/jobs", headers=business_headers, json={**payload,"publish":False})
    assert draft.status_code == 201, draft.text
    assert draft.json()["job"]["status"] == "draft"
    admin = create_admin()
    admin_headers = token_headers(client,"admin@earnroute.test","StrongAdminPass123")
    verified = client.patch(f"/api/admin/businesses/{business['user']['id']}/verification",headers=admin_headers,json={"status":"verified","reason":"Business details reviewed."})
    assert verified.status_code == 200
    published = client.post(f"/api/jobs/{draft.json()['job']['id']}/publish",headers=business_headers)
    assert published.status_code == 200, published.text
    assert published.json()["job"]["status"] == "published"


def test_end_to_end_apply_offer_and_assignment_lifecycle(client, register_worker, register_business, create_admin):
    business, business_headers = register_business()
    worker, worker_headers = register_worker()
    worker_id = worker["user"]["id"]
    client.patch("/api/worker/profile", headers=worker_headers, json={"city":"Delhi","skills":["customer service","event support"],"preferred_categories":["Events"],"availability":[{"day":0,"start":"00:00","end":"23:59"},{"day":1,"start":"00:00","end":"23:59"},{"day":2,"start":"00:00","end":"23:59"},{"day":3,"start":"00:00","end":"23:59"},{"day":4,"start":"00:00","end":"23:59"},{"day":5,"start":"00:00","end":"23:59"},{"day":6,"start":"00:00","end":"23:59"}],"travel_radius_km":5,"min_pay":800,"experience_years":1})
    admin = create_admin()
    admin_headers = token_headers(client,"admin@earnroute.test","StrongAdminPass123")
    verified = client.patch(f"/api/admin/businesses/{business['user']['id']}/verification",headers=admin_headers,json={"status":"verified","reason":"Business details reviewed by founder."})
    assert verified.status_code == 200
    created = client.post("/api/jobs",headers=business_headers,json=future_job_payload())
    assert created.status_code == 201, created.text
    job = created.json()["job"]
    jobs = client.get("/api/jobs?city=Delhi&category=Events",headers=worker_headers)
    assert jobs.status_code == 200 and jobs.json()["total"] == 1
    assert jobs.json()["items"][0]["match"]["score"] >= 50
    application = client.post(f"/api/jobs/{job['id']}/apply",headers=worker_headers,json={"note":"I have event support experience."})
    assert application.status_code == 201, application.text
    application_id = application.json()["application"]["id"]
    duplicate = client.post(f"/api/jobs/{job['id']}/apply",headers=worker_headers,json={"note":"Again"})
    assert duplicate.status_code == 409
    business_apps = client.get("/api/business/applications",headers=business_headers)
    assert business_apps.status_code == 200 and len(business_apps.json()["items"]) == 1
    offer = client.post(f"/api/applications/{application_id}/offer",headers=business_headers)
    assert offer.status_code == 200 and offer.json()["application"]["status"] == "offered"
    accepted = client.post(f"/api/applications/{application_id}/respond",headers=worker_headers,json={"decision":"accepted"})
    assert accepted.status_code == 200, accepted.text
    assignment = accepted.json()["assignment"]
    assert assignment["status"] == "confirmed"
    assert assignment["payout_status"] == "not_due"
    # Make the test shift active now while keeping end time in the future.
    db = SessionLocal()
    try:
        shift = db.get(Job, job['id'])
        shift.start_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        shift.end_at = datetime.now(timezone.utc) + timedelta(hours=2)
        db.commit()
    finally:
        db.close()
    checked_in = client.post(f"/api/assignments/{assignment['id']}/check-in",headers=worker_headers)
    assert checked_in.status_code == 200, checked_in.text
    too_early = client.post(f"/api/assignments/{assignment['id']}/check-out",headers=worker_headers)
    assert too_early.status_code == 409 and "scheduled shift end" in too_early.json()["detail"].lower()
    # Move the record to after shift-end to test the successful checkout path without waiting hours.
    db = SessionLocal()
    try:
        completed_shift = db.get(Job, job['id'])
        completed_shift.end_at = datetime.now(timezone.utc) - timedelta(minutes=2)
        db.commit()
    finally:
        db.close()
    checked_out = client.post(f"/api/assignments/{assignment['id']}/check-out",headers=worker_headers)
    assert checked_out.status_code == 200, checked_out.text
    complete = client.post(f"/api/assignments/{assignment['id']}/complete",headers=business_headers)
    assert complete.status_code == 200, complete.text
    final_assignment = complete.json()["assignment"]
    assert final_assignment["status"] == "completed"
    assert final_assignment["payout_status"] == "pending"
    # Reviews are persisted, participant-only, one-per-person, and visible as aggregate ratings.
    worker_review = client.post(f"/api/reviews/assignments/{assignment['id']}", headers=worker_headers,
                                json={"rating": 5, "comment": "Clear shift details and a professional team."})
    assert worker_review.status_code == 201, worker_review.text
    duplicate_review = client.post(f"/api/reviews/assignments/{assignment['id']}", headers=worker_headers,
                                   json={"rating": 4, "comment": "Duplicate should be blocked."})
    assert duplicate_review.status_code == 409
    business_review = client.post(f"/api/reviews/assignments/{assignment['id']}", headers=business_headers,
                                  json={"rating": 4, "comment": "Punctual and helpful."})
    assert business_review.status_code == 201, business_review.text
    assert client.post(f"/api/reviews/assignments/{assignment['id']}", headers=admin_headers,
                       json={"rating": 5, "comment": "Non-participant must not review."}).status_code == 404
    detail = client.get(f"/api/jobs/{job['id']}")
    assert detail.status_code == 200
    assert detail.json()["job"]["business_rating"] == 5.0
    assert detail.json()["job"]["business_review_count"] == 1
    business_apps_after_review = client.get("/api/business/applications", headers=business_headers)
    assert business_apps_after_review.json()["items"][0]["worker_rating"] == 4.0
    assignment_view = client.get("/api/assignments/me", headers=worker_headers).json()["items"][0]
    assert assignment_view["worker_reviewed"] is True and len(assignment_view["reviews"]) == 2
    assert assignment_view["latitude"] == 28.6139
    assert assignment_view["longitude"] == 77.2090
    earnings = client.get("/api/worker/earnings",headers=worker_headers)
    assert earnings.status_code == 200
    assert earnings.json()["pending_settlement"] == final_assignment["net_pay"]
    # A business cannot use worker-only earnings or read arbitrary admin data.
    assert client.get("/api/worker/earnings",headers=business_headers).status_code == 403
    assert client.get("/api/admin/overview",headers=worker_headers).status_code == 403


def test_schedule_conflict_is_blocked(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    worker, w_headers = register_worker()
    assert set_eligible_worker_profile(client, w_headers).status_code == 200
    create_admin()
    a_headers = token_headers(client,"admin@earnroute.test","StrongAdminPass123")
    client.patch(f"/api/admin/businesses/{business['user']['id']}/verification",headers=a_headers,json={"status":"verified","reason":"Reviewed business details."})
    job1=client.post('/api/jobs',headers=b_headers,json=future_job_payload(days=3,title='First event shift')).json()['job']
    app1=client.post(f"/api/jobs/{job1['id']}/apply",headers=w_headers,json={}).json()['application']
    assert client.post(f"/api/applications/{app1['id']}/offer",headers=b_headers).status_code==200
    accepted=client.post(f"/api/applications/{app1['id']}/respond",headers=w_headers,json={"decision":"accepted"})
    assert accepted.status_code==200
    payload=future_job_payload(days=3,title='Overlapping stock check')
    payload['start_at']=(datetime.fromisoformat(job1['start_at'].replace('Z','+00:00'))+timedelta(hours=1)).isoformat()
    payload['end_at']=(datetime.fromisoformat(job1['start_at'].replace('Z','+00:00'))+timedelta(hours=3)).isoformat()
    payload['application_deadline']=(datetime.fromisoformat(payload['start_at'])-timedelta(hours=1)).isoformat()
    job2=client.post('/api/jobs',headers=b_headers,json=payload).json()['job']
    conflict=client.post(f"/api/jobs/{job2['id']}/apply",headers=w_headers,json={})
    assert conflict.status_code==409
    assert 'conflicts' in conflict.json()['detail'].lower() or 'schedule' in conflict.json()['detail'].lower()


def test_dispute_workflow_and_notifications(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    worker, w_headers = register_worker()
    assert set_eligible_worker_profile(client, w_headers).status_code == 200
    create_admin()
    a_headers=token_headers(client,"admin@earnroute.test","StrongAdminPass123")
    client.patch(f"/api/admin/businesses/{business['user']['id']}/verification",headers=a_headers,json={"status":"verified","reason":"Reviewed business details."})
    job=client.post('/api/jobs',headers=b_headers,json=future_job_payload()).json()['job']
    appl=client.post(f"/api/jobs/{job['id']}/apply",headers=w_headers,json={}).json()['application']
    client.post(f"/api/applications/{appl['id']}/offer",headers=b_headers)
    assigned=client.post(f"/api/applications/{appl['id']}/respond",headers=w_headers,json={"decision":"accepted"}).json()['assignment']
    db=SessionLocal()
    try:
        record=db.get(Job,job['id']);record.start_at=datetime.now(timezone.utc)-timedelta(minutes=3);record.end_at=datetime.now(timezone.utc)+timedelta(hours=2);db.commit()
    finally: db.close()
    checkin=client.post(f"/api/assignments/{assigned['id']}/check-in",headers=w_headers)
    assert checkin.status_code==200
    dispute=client.post(f"/api/assignments/{assigned['id']}/dispute",headers=w_headers,json={"reason":"The published instructions differ from what the supervisor asked me to do."})
    assert dispute.status_code==201,dispute.text
    assert client.get('/api/admin/disputes',headers=a_headers).json()['items'][0]['status']=='open'
    resolved=client.patch(f"/api/admin/disputes/{dispute.json()['dispute']['id']}",headers=a_headers,json={"status":"resolved","resolution_note":"Reviewed the record and documented a resolution for both participants."})
    assert resolved.status_code==200
    restored_assignment = client.get('/api/assignments/me', headers=w_headers).json()['items'][0]
    assert restored_assignment['status'] == 'checked_in'
    assert restored_assignment['payout_status'] == 'not_due'
    earnings = client.get('/api/worker/earnings', headers=w_headers).json()
    assert earnings['completed_assignments'] == 0 and earnings['gross_completed'] == 0
    notifications=client.get('/api/notifications',headers=w_headers)
    assert notifications.status_code==200 and len(notifications.json()['items'])>=2
    audit=client.get('/api/admin/audit',headers=a_headers)
    assert audit.status_code==200 and any(e['action']=='dispute_resolved' for e in audit.json()['items'])


def test_india_local_timezone_is_used_for_availability_match():
    profile = WorkerProfile(
        city="Delhi", skills=["event support"], preferred_categories=["Events"], min_pay=0,
        experience_years=1, availability=[{"day": 6, "start": "01:00", "end": "05:00"}],
    )
    # Saturday 20:00 UTC is Sunday 01:30 in India. The local weekly day, not UTC day, must match.
    job = Job(
        title="Night stock check", description="A long enough example shift for timezone matching.",
        category="Events", city="Delhi", slots=1,
        start_at=datetime(2026, 10, 17, 20, 0, tzinfo=timezone.utc),
        end_at=datetime(2026, 10, 17, 23, 0, tzinfo=timezone.utc),
        pay_amount=1000, pay_basis="shift", requirements=["event support"], min_experience=0,
        application_deadline=datetime(2026, 10, 17, 19, 0, tzinfo=timezone.utc),
    )
    result = match_job(profile, job)
    assert result["availability_fit"] == "yes"
    assert "Fits your selected availability" in result["reasons"]


def test_hourly_rate_is_calculated_as_full_shift_pay_and_disclosed(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    _, w_headers = register_worker()
    assert set_eligible_worker_profile(client, w_headers).status_code == 200
    create_admin()
    admin_headers = token_headers(client, "admin@earnroute.test", "StrongAdminPass123")
    checked = client.patch(f"/api/admin/businesses/{business['user']['id']}/verification", headers=admin_headers,
                           json={"status":"verified", "reason":"Founder reviewed the supplied business profile."})
    assert checked.status_code == 200
    payload = future_job_payload(title="Hourly event support")
    payload["pay_amount"] = 200
    payload["pay_basis"] = "hour"
    job = client.post("/api/jobs", headers=b_headers, json=payload)
    assert job.status_code == 201, job.text
    detail = job.json()["job"]
    assert detail["duration_hours"] == 4
    assert detail["gross_shift_pay_estimate"] == 800
    assert detail["platform_fee_percent"] == 12
    assert detail["estimated_platform_fee"] == 96
    assert detail["estimated_net_pay"] == 704
    application = client.post(f"/api/jobs/{detail['id']}/apply", headers=w_headers, json={})
    assert application.status_code == 201, application.text
    app_id = application.json()["application"]["id"]
    assert client.post(f"/api/applications/{app_id}/offer", headers=b_headers).status_code == 200
    accepted = client.post(f"/api/applications/{app_id}/respond", headers=w_headers, json={"decision":"accepted"})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["assignment"]["gross_pay"] == 800
    assert accepted.json()["assignment"]["platform_fee"] == 96
    assert accepted.json()["assignment"]["net_pay"] == 704


def test_mandatory_skill_and_explicit_availability_mismatch_prevent_applying(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    _, w_headers = register_worker()
    # The shift is posted at 10:00 UTC, which is 15:30 in India on this all-future test date.
    mismatched = [{"day": day, "start": "00:00", "end": "01:00"} for day in range(7)]
    profile = set_eligible_worker_profile(client, w_headers, availability=mismatched, skills=["customer service"])
    assert profile.status_code == 200
    create_admin()
    admin_headers = token_headers(client, "admin@earnroute.test", "StrongAdminPass123")
    client.patch(f"/api/admin/businesses/{business['user']['id']}/verification", headers=admin_headers,
                 json={"status":"verified", "reason":"Founder reviewed the supplied business profile."})
    job = client.post("/api/jobs", headers=b_headers, json=future_job_payload()).json()["job"]
    missing_skill = client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers, json={})
    assert missing_skill.status_code == 409
    assert "requires skills" in missing_skill.json()["detail"].lower()
    updated = set_eligible_worker_profile(client, w_headers, availability=mismatched)
    assert updated.status_code == 200
    outside_hours = client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers, json={})
    assert outside_hours.status_code == 409
    assert "outside your saved availability" in outside_hours.json()["detail"].lower()


def test_worker_can_withdraw_before_offer_and_business_is_notified(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    _, w_headers = register_worker()
    assert set_eligible_worker_profile(client, w_headers).status_code == 200
    create_admin()
    admin_headers = token_headers(client, "admin@earnroute.test", "StrongAdminPass123")
    client.patch(f"/api/admin/businesses/{business['user']['id']}/verification", headers=admin_headers,
                 json={"status":"verified", "reason":"Founder reviewed the supplied business profile."})
    job = client.post("/api/jobs", headers=b_headers, json=future_job_payload()).json()["job"]
    response = client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers, json={})
    assert response.status_code == 201
    app_id = response.json()["application"]["id"]
    withdrawn = client.post(f"/api/applications/{app_id}/withdraw", headers=w_headers)
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["application"]["status"] == "withdrawn"
    notification = client.get("/api/notifications", headers=b_headers)
    assert any(n["title"] == "Application withdrawn" for n in notification.json()["items"])
    assert client.post(f"/api/applications/{app_id}/withdraw", headers=w_headers).status_code == 409


def test_pre_start_assignment_cancellation_records_reason_and_keeps_payout_not_due(client, register_worker, register_business, create_admin):
    business, b_headers = register_business()
    _, w_headers = register_worker()
    assert set_eligible_worker_profile(client, w_headers).status_code == 200
    create_admin()
    admin_headers = token_headers(client, "admin@earnroute.test", "StrongAdminPass123")
    client.patch(f"/api/admin/businesses/{business['user']['id']}/verification", headers=admin_headers,
                 json={"status":"verified", "reason":"Founder reviewed the supplied business profile."})
    job = client.post("/api/jobs", headers=b_headers, json=future_job_payload()).json()["job"]
    application = client.post(f"/api/jobs/{job['id']}/apply", headers=w_headers, json={}).json()["application"]
    assert client.post(f"/api/applications/{application['id']}/offer", headers=b_headers).status_code == 200
    accepted = client.post(f"/api/applications/{application['id']}/respond", headers=w_headers, json={"decision":"accepted"})
    assert accepted.status_code == 200, accepted.text
    assignment_id = accepted.json()["assignment"]["id"]
    cancelled = client.post(f"/api/assignments/{assignment_id}/cancel", headers=w_headers,
                            json={"reason":"My available hours changed before the shift."})
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["assignment"]["status"] == "cancelled"
    assert cancelled.json()["assignment"]["payout_status"] == "not_due"
    events = client.get("/api/admin/audit", headers=admin_headers).json()["items"]
    assert any(event["action"] == "assignment_cancelled" and event["detail"].get("reason") == "My available hours changed before the shift." for event in events)
    assert client.post(f"/api/assignments/{assignment_id}/cancel", headers=w_headers, json={}).status_code == 409


def test_unconfigured_payment_webhook_does_not_mark_payout_paid(client):
    import os
    os.environ.pop('RAZORPAY_WEBHOOK_SECRET', None)
    response=client.post('/api/webhooks/razorpay',content=b'{"id":"evt_123","event":"payment.captured"}',headers={'content-type':'application/json','X-Razorpay-Signature':'wrong'})
    assert response.status_code==503



def test_worker_can_save_list_and_unsave_published_shifts(client, register_worker, register_business, create_admin):
    _, worker_headers = register_worker()
    business, business_headers = register_business()
    verify_business(client, create_admin, business["user"]["id"])
    job = client.post("/api/jobs", headers=business_headers, json=future_job_payload(title="Saved weekend retail shift"))
    assert job.status_code == 201, job.text
    job_id = job.json()["job"]["id"]

    saved = client.post(f"/api/jobs/{job_id}/save", headers=worker_headers)
    assert saved.status_code == 200, saved.text
    assert saved.json() == {"saved": True, "job_id": job_id}
    # Repeated saves remain safe and do not create duplicate rows.
    assert client.post(f"/api/jobs/{job_id}/save", headers=worker_headers).json()["saved"] is True
    items = client.get("/api/worker/saved-shifts", headers=worker_headers)
    assert items.status_code == 200, items.text
    assert items.json()["total"] == 1
    assert items.json()["items"][0]["id"] == job_id
    assert items.json()["items"][0]["title"] == "Saved weekend retail shift"
    assert "saved_at" in items.json()["items"][0]

    other_worker, other_headers = register_worker(email="another-worker@example.com")
    assert client.get("/api/worker/saved-shifts", headers=other_headers).json()["items"] == []
    assert client.delete(f"/api/jobs/{job_id}/save", headers=other_headers).json()["saved"] is False
    assert client.get("/api/worker/saved-shifts", headers=worker_headers).json()["total"] == 1

    removed = client.delete(f"/api/jobs/{job_id}/save", headers=worker_headers)
    assert removed.status_code == 200
    assert removed.json() == {"saved": False, "job_id": job_id}
    assert client.get("/api/worker/saved-shifts", headers=worker_headers).json()["items"] == []
    assert client.delete(f"/api/jobs/{job_id}/save", headers=worker_headers).json()["saved"] is False


def test_only_workers_can_use_saved_shift_endpoints(client, register_business):
    business, headers = register_business()
    assert client.get("/api/worker/saved-shifts", headers=headers).status_code == 403
    assert client.post("/api/jobs/999/save", headers=headers).status_code == 403
    assert client.delete("/api/jobs/999/save", headers=headers).status_code == 403


def test_nearby_jobs_are_distance_filtered_and_sorted(client, register_business, create_admin):
    business, business_headers = register_business()
    verify_business(client, create_admin, business["user"]["id"])
    base = future_job_payload()
    listings = [
        ("Corner shop helper", 28.6170, 77.2090),
        ("Cafe stock assistant", 28.6409, 77.2090),
        ("Far warehouse shift", 28.7000, 77.2090),
        ("Outer retail shift", 28.7480, 77.2090),
    ]
    for title, latitude, longitude in listings:
        response = client.post("/api/jobs", headers=business_headers, json={
            **base, "title": title, "latitude": latitude, "longitude": longitude,
        })
        assert response.status_code == 201, response.text

    one_km = client.get("/api/jobs?latitude=28.6139&longitude=77.2090&radius_km=1&page_size=20")
    assert one_km.status_code == 200
    assert one_km.json()["nearby"] is True
    assert one_km.json()["total"] == 1
    assert one_km.json()["items"][0]["title"] == "Corner shop helper"
    assert 0 < one_km.json()["items"][0]["distance_km"] < 1
    assert one_km.json()["items"][0]["latitude"] == 28.6170
    assert one_km.json()["items"][0]["longitude"] == 77.2090
    assert one_km.json()["items"][0]["has_workplace_pin"] is True

    five_km = client.get("/api/jobs?latitude=28.6139&longitude=77.2090&radius_km=5&page_size=20")
    assert five_km.status_code == 200
    assert five_km.json()["total"] == 2
    assert [item["title"] for item in five_km.json()["items"]] == ["Corner shop helper", "Cafe stock assistant"]
    assert all(item["distance_km"] <= 5 for item in five_km.json()["items"])

    ten_km = client.get("/api/jobs?latitude=28.6139&longitude=77.2090&radius_km=10&page_size=20")
    assert ten_km.status_code == 200
    assert [item["title"] for item in ten_km.json()["items"]] == [
        "Corner shop helper", "Cafe stock assistant", "Far warehouse shift",
    ]
    assert all(item["distance_km"] <= 10 for item in ten_km.json()["items"])

    fifteen_km = client.get("/api/jobs?latitude=28.6139&longitude=77.2090&radius_km=15&page_size=20")
    assert fifteen_km.status_code == 200
    assert [item["title"] for item in fifteen_km.json()["items"]] == [
        "Corner shop helper", "Cafe stock assistant", "Far warehouse shift", "Outer retail shift",
    ]
    assert all(item["distance_km"] <= 15 for item in fifteen_km.json()["items"])
    assert client.get("/api/jobs?latitude=28.6139&longitude=77.2090&radius_km=20").status_code == 422
    assert client.get("/api/jobs?latitude=28.6139&radius_km=3").status_code == 422



def test_worker_profile_accepts_more_radius_presets(client, register_worker):
    _, headers = register_worker()
    payload = {
        "city": "Delhi", "skills": [], "preferred_categories": [],
        "availability": [], "min_pay": 0, "experience_years": 0,
    }
    for radius in (8, 10, 15):
        response = client.patch(
            "/api/worker/profile",
            headers=headers,
            json={**payload, "travel_radius_km": radius},
        )
        assert response.status_code == 200, response.text
        assert response.json()["user"]["profile"]["travel_radius_km"] == radius

    invalid = client.patch(
        "/api/worker/profile",
        headers=headers,
        json={**payload, "travel_radius_km": 2},
    )
    assert invalid.status_code == 422


def test_published_job_requires_workplace_pin(client, register_business, create_admin):
    business, business_headers = register_business()
    verify_business(client, create_admin, business["user"]["id"])
    payload = future_job_payload(publish=False)
    payload.pop("latitude")
    payload.pop("longitude")
    draft = client.post("/api/jobs", headers=business_headers, json=payload)
    assert draft.status_code == 201, draft.text
    job_id = draft.json()["job"]["id"]
    blocked = client.post(f"/api/jobs/{job_id}/publish", headers=business_headers)
    assert blocked.status_code == 409
    assert "workplace pin" in blocked.json()["detail"].lower()



def test_worker_can_submit_private_safety_report_for_a_suspicious_shift(client, register_worker):
    _, headers = register_worker()
    response = client.post("/api/support/tickets", headers=headers, json={
        "subject": "Suspicious shift listing",
        "category": "safety",
        "message": "The listing asks me to pay a registration fee before confirming the shift.",
    })
    assert response.status_code == 201, response.text
    ticket = response.json()["ticket"]
    assert ticket["category"] == "safety"
    assert ticket["status"] == "open"
    assert "registration fee" in ticket["messages"][0]["message"].lower()


def test_support_ticket_create_and_private_detail(client, register_worker):
    _, owner_headers = register_worker()
    _, other_headers = register_worker(email="other-worker@example.com")
    created = client.post("/api/support/tickets", headers=owner_headers, json={
        "subject": "Account information update",
        "category": "account",
        "message": "I need help updating my account contact information.",
    })
    assert created.status_code == 201, created.text
    ticket_id = created.json()["ticket"]["id"]
    assert client.get(f"/api/support/tickets/{ticket_id}", headers=owner_headers).status_code == 200
    assert client.get(f"/api/support/tickets/{ticket_id}", headers=other_headers).status_code == 404
