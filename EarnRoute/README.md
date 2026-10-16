# EarnRoute

EarnRoute is an India-first, mobile-first hyperlocal earning marketplace for finding genuine paid shifts within a selectable 1 km, 3 km or 5 km radius, plus expanded 8 km, 10 km and 15 km options. This repository is a runnable launch candidate: it includes a responsive public website, worker/business/admin workspaces, API, PostgreSQL-compatible schema, migration, tests, and deployment assets. It must **not** be represented as a fully production-verified marketplace until the remaining integrations and operating procedures in this README are completed.

## Version 1.4.0 — mobile fit, language and sharing

- App-first welcome and workspace layouts have narrower-device constraints, Devanagari font/line-height treatment, safe-area handling, wrapping controls, and horizontal overflow prevention.
- English/Hindi preference is persisted locally. The UI localization pass covers the welcome screen, role navigation, forms, dynamic labels, job statuses, common prompts, and notifications. Device/browser rendering still needs physical-device QA to catch any remaining string or font differences.
- Workers can use the OS share sheet/browser sharing to send nearby or accepted-shift details, compensation estimates, workplace information, and a Maps destination link. It does not track the other party live.
- More nearby distance choices are 8 km, 10 km and 15 km beyond 1/3/5 km presets; the UI and API validate supported values.

## What works in this release

- Worker/business registration and login; workers confirm they are 18+ and accept terms before joining; passwords are hashed with PBKDF2-SHA256, and role permissions are enforced server-side.
- Business profile editing and a human-reviewed verification queue; publishing is blocked until an administrator approves a profile.
- Job drafts and publishing with shift times, city, responsibilities, skills, pay basis, payment terms, cancellation terms, breaks, equipment, and safety instructions.
- Hyperlocal nearby discovery that requires device location and calculates real straight-line distance from a business-set workplace pin. Workers can choose 1 km, 3 km or 5 km, then expand More to 8 km, 10 km or 15 km; results are distance-sorted and unpinned listings are excluded from nearby mode. Worker GPS stays in the browser session and is not saved to the profile.
- Published job discovery, category/city/pay filtering, pagination, explainable match scores, required-skill and experience checks, explicit availability checks, and a schedule-conflict safety buffer.
- Application status, business applicant review, offers, worker offer acceptance/decline, capacity checks, assignments, attendance timestamps, completion review, disputes, one review per participant after resolved completion, rating aggregates, notifications, and audit events.
- Transparent compensation estimates: hourly rates are multiplied by shift duration; gross shift estimate, configured platform fee, and estimated net are shown separately before applying.
- Earnings separate completed work, pending settlement, and provider-verified paid status. **No UI action can mark a payout paid.**
- Admin overview, business verification, job moderation, dispute review, audit history, and operational metrics based on recorded database activity.
- Responsive hyperlocal-first UI with forest-green/ivory/electric-lime palette, clear distance/pay cards, compact 1/3/5 km radius controls with expandable 8/10/15 km presets, category chips, role-aware mobile bottom navigation, English/Hindi language toggle, app-first Android onboarding, Google Maps destination links for shift workplaces, PWA support, public terms/privacy/fair-work pages, and security headers.
- SQLAlchemy schema with a five-revision Alembic migration chain, `.env.example`, Dockerfile, founder-admin provisioning script, and automated API tests.

## Important limitations before public launch

The API and PostgreSQL database have a live HTTPS deployment and a successful health/database smoke check. The app has not been independently security-reviewed or fully tested on physical devices. It is not yet a complete labour/payment compliance implementation.

- **Payment and payouts:** a Razorpay webhook endpoint verifies signatures and stores event IDs idempotently when configured, but it does not yet map provider settlement/payout events to assignments. Real checkout, marketplace settlement, refunds, payout orchestration, reconciliation, and production account approval are not connected. No payment is simulated or labelled paid. Do not accept real money or promise payouts until a supported provider flow is implemented, tested, and approved for the intended marketplace model.
- **Email/OTP:** email/phone verification, password-reset delivery, email notifications, SMS and WhatsApp are not configured. The UI currently uses password-based login. Do not describe accounts as email-verified just because a signup succeeded.
- **Business/worker verification:** admin review is a workflow only. Secure document upload, an external identity/business verification provider, background checks, and evidence-retention rules are not integrated. A platform status is not a government endorsement or a guarantee of safety.
- **Attendance:** check-in/check-out timestamps are recorded, but workplace-issued OTP/QR scans, geofence verification, supervisor signatures, and evidence-file storage are not integrated. Use an established workplace verification process in addition to timestamps.
- **Nearby location:** hyperlocal filtering is implemented from device GPS and the actual workplace pin. No paid maps, geocoding, traffic, or travel-time matrix is configured. Distance is straight-line kilometre distance, not road distance or ETA. A business must set the pin at the physical workplace before publishing; old jobs without a pin stay hidden from nearby mode until updated.
- **Messaging, recurring shifts, subscriptions, worker payout orchestration, file evidence, account deletion workflow, and referral features:** these are not fully implemented in this release. Completed assignments support participant ratings and comments; payout provider settlement is still not integrated.
- **Operations:** the login rate limiter is process-local; configure a shared rate limiter/API gateway before multi-instance scaling. Add central logs, alerting, backup restore drills, retention jobs, and support contact details. `support@earnroute.example` is a placeholder.
- **Legal/marketplace operations:** obtain appropriate professional guidance for worker classification, applicable labour rules, consumer/privacy policies, taxes/invoicing, dispute and cancellation rules, and payment-provider eligibility. This README makes no legal-compliance claim.

## Architecture

- Frontend: responsive vanilla HTML/CSS/JavaScript served same-origin at `/` and `/static/*`.
- API: FastAPI in `app/main.py`.
- ORM: SQLAlchemy 2; PostgreSQL in production and SQLite for local development/tests.
- Database migrations: Alembic in `migrations/`.
- Auth: bearer JWT (HS256) with current user/role reloaded from the database per request.
- Core ranking: deterministic explainable rules; core matching does not depend on a paid LLM.
- Optional integrations are controlled by environment variables; missing credentials do not turn into fake success states.

## Requirements

- Python 3.12 recommended (3.11+ should work with compatible current dependencies).
- PostgreSQL for production; SQLite supported for local evaluation.
- Docker optional.

## Local setup (macOS/Linux)

```bash
cd EarnRoute
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Generate and place a unique 32+ character `JWT_SECRET` in `.env`. For local evaluation, the default SQLite URL is fine. Apply the schema and run:

```bash
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

Open `http://127.0.0.1:8000`. The first account can be a worker or business; there are no fake jobs seeded. A business must be manually verified by the admin account before publishing jobs.

In development/test mode, app startup can create any missing tables for convenience. When `APP_ENV=production`, the server will not run `create_all`; run `alembic upgrade head` as a deployment step.

## Provision the founder/admin account

Do not add an admin role by changing a browser payload. Use the interactive local command after the schema is migrated:

```bash
python scripts/create_admin.py
```

It prompts for email, display name and a new 14+ character password. It will not promote or overwrite an existing user. For a remote database, set `.env` to the correct database first and ensure you have secure, authorized access. Never commit `.env` or share the admin password.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ENV` | Yes for prod | Set `production` in production; activates startup secret guard and HSTS. |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters in production. Store in host secret storage. |
| `JWT_EXPIRE_MINUTES` | No | Bearer token lifetime; defaults to 720 minutes. |
| `DATABASE_URL` | Yes for prod | PostgreSQL URL such as `postgresql+psycopg://USER:PASSWORD@HOST:5432/earnroute?sslmode=require`. |
| `PORT` | Host-dependent | Listening port; defaults to `8000`. |
| `CORS_ORIGINS` | No same-origin | Comma-separated trusted origins if UI and API are separated. |
| `MARKET_TIMEZONE` | No | Defaults to `Asia/Kolkata` for weekly availability matching. |
| `TRAVEL_BUFFER_MINUTES` | No | Conservative schedule buffer; defaults to 45 (clamped to 0–240). |
| `DEFAULT_PLATFORM_FEE_PERCENT` | No | Configured fee percent deducted from gross worker compensation in this release; default 12. Disclose policy and terms before production use. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Integration not yet wired | Reserved for future email delivery; currently unused. |
| `MAPS_API_KEY` | Integration not yet wired | Reserved for future geocoding/routing; currently unused. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments not complete | Reserved; no live checkout/payout flow is implemented. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional webhook receiver | Enables signature validation and event recording only; it does not mark payouts paid. |

## Database migrations

```bash
alembic upgrade head
alembic current
alembic history
```

After changing models, create a reviewable migration (with a development/test database configured):

```bash
alembic revision --autogenerate -m "describe schema change"
# Review the generated file before applying it.
alembic upgrade head
```

Always take a verified backup before applying a production migration. Autogenerate does not understand every data migration; write/review data changes explicitly.

## Tests and checks

```bash
pytest -q
node --check app/static/app.js
python -m compileall -q app tests scripts
```

The tests exercise core API lifecycle, reviews, and access controls with an isolated in-memory SQLite database. They do not replace load testing, penetration testing, PostgreSQL integration testing, provider sandbox testing, browser/device QA, or an independent security review.

## Docker

Build and run with environment variables supplied through your host's secret manager:

```bash
docker build -t earnroute:local .
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e JWT_SECRET='set-a-unique-secret-of-at-least-32-characters' \
  -e DATABASE_URL='postgresql+psycopg://USER:PASSWORD@HOST:5432/earnroute?sslmode=require' \
  -e PORT=8000 earnroute:local
```

Use your production Postgres provider's SSL requirements and credentials. Do not place passwords in a public image, Dockerfile, source code or Git repository. For local development, run the app directly with SQLite and do not set `APP_ENV=production` unless you have provided a proper secret and database URL.

## Deployment checklist

1. Create or select a production PostgreSQL database and a hosting project in the account you intend to use.
2. Configure every required secret in the host's environment/secret manager. Use `APP_ENV=production` and a unique `JWT_SECRET`.
3. Run `alembic upgrade head` as a release/pre-deploy command.
4. Configure a real support email, domain, HTTPS, authentication policy, privacy/data-retention procedure, backups, restore tests, monitoring, log access, and an incident contact.
5. Implement and test provider-approved payment collection, settlement/payout mapping, webhook idempotency, refund handling and reconciliation in sandbox. Obtain provider approval before production.
6. Configure actual email/phone verification and contact flows, secure upload storage, a business verification policy, and verified attendance options.
7. Conduct PostgreSQL integration, browser/device, accessibility, load, and security testing; rehearse migration rollback and recovery.
8. Deploy. Verify `/api/health`, registration, roles, job posting/discovery, assignment lifecycle, and provider sandbox events on the deployed host.
9. Only announce “live” once the public URL and its critical paths have been manually verified.

## Hyperlocal release behaviour

- Worker home opens to a native-first local feed and offers 1 km, 3 km and 5 km radius controls plus More for 8 km, 10 km and 15 km. Nearby mode only returns jobs with a saved workplace pin within that radius.
- Worker location is stored in a short-lived browser session entry only and expires after 30 minutes; it is not sent to the worker profile.
- Businesses must set an accurate pin at the actual work location to publish. They can add pins to old jobs from job management. Distances shown are straight-line distances.
- Estimated take-home is an estimate based on the configured platform fee, not a guarantee or payment confirmation.

## Known behavior to keep honest

- An assignment marked `completed` creates a **pending settlement**, not a paid transaction.
- There is currently no supported UI/API route that marks a worker payout paid by assertion. Provider-specific settlement evidence must be mapped and verified before that state can be implemented.
- No opportunity, income, background check or safety outcome is guaranteed by registering.
- The public visual dashboard contains explicitly illustrative marketing graphics; they are not database-backed workers, jobs or metrics.

## Android application wrapper

The `android/` directory contains an Android Studio project bundling the responsive frontend with a secure `WebViewAssetLoader`, EarnRoute launcher icon, native **Connect server** setting and HTTPS `/api/health` verification before a server URL is saved. The Android page calls the deployed API over HTTPS; no fake server is hardcoded. See [`android/BUILD_APK.md`](android/BUILD_APK.md).

The Android wrapper now requests native fine/coarse location permission for nearby search, defaults to the deployed HTTPS API, and bundles the updated local-earning interface. A cloud build workflow compiles and uploads the debug APK from checked-in source; see GitHub Actions for the latest result. The app compiles against Android API 36. The debug APK is for beta/device testing and is not a Play Store production-signed release.

## Start EarnRoute on a Mac with one double-click

For a local evaluation, double-click `RUN_EARNROUTE_MAC.command`. On first launch it creates a private Python virtual environment, installs dependencies, replaces the sample JWT signing secret with a random local secret, applies database migrations and opens the browser at `http://127.0.0.1:8000`. Keep the Terminal window open while using the app; press Ctrl+C there to stop it. First-time dependency installation requires internet access. This runs on that Mac only and is not a public production deployment.

To create the founder console account after the app setup is ready, run `python3 scripts/create_admin.py` from the project folder after activating `.venv` (or `.venv/bin/python scripts/create_admin.py`). It asks you to choose a unique email and password; there is no preset admin login.


## Owner setup and operations

The numbered 44-item setup and readiness checklist is in OWNER-SETUP-44.md. On the owner's Mac, run SETUP_DEVELOPER_TOOLS_MAC.command with Bash. This installer can set up local tools, but it cannot run remotely against the owner's Mac.

Optional Sentry error reporting activates only when SENTRY_DSN is set in Render's secret environment. Never commit live credentials. The signed-release workflow requires the owner's Android keystore in GitHub Actions Secrets; a debug APK is not a Play Store release.

A daily database backup job exports a PostgreSQL custom-format dump, encrypts it with AES-256, uploads to a private bucket, downloads and decrypts the uploaded copy, and verifies it with pg_restore before reporting success. It retains up to 14 days of backups. The bucket is in the same Neon project and region; configure a second-provider copy before treating this as disaster-proof off-site backup.
