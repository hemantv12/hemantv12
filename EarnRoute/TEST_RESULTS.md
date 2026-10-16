# EarnRoute verification report

Date: 2026-10-15

## Passed checks

- Automated tests: **19 passed** (`pytest -q`). The 14 API lifecycle/security tests cover account registration and role controls, business verification before publication, matching and job discovery, duplicate application prevention, offers and acceptance, assignment capacity and scheduling conflicts, attendance/check-out/completion, disputes and pre-dispute state restoration, notifications/audit behavior, age/terms confirmation, cancellation/withdrawal, participant review authorization/duplicates, and safe pending-payment behavior. Five additional tests verify Android wrapper presence/security, HTTPS API configuration and health checks, Android target SDK/launcher assets, native asset synchronization, and frontend server-connection wiring.
- Frontend JavaScript syntax: `node --check app/static/app.js` — passed.
- Python syntax compilation: `python -m compileall -q app tests scripts` — passed.
- Database migrations: a fresh SQLite database applied all four Alembic revisions — passed.
- Schema drift: `alembic check` — `No new upgrade operations detected`.
- Live HTTP smoke test against a started Uvicorn server: `/`, `/api/health`, `/static/terms.html`, `/static/privacy.html`, `/static/fair-work.html`, `/static/manifest.webmanifest`, `/static/sw.js`, `/static/app.js`, and `/static/styles.css` returned HTTP 200.
- Android-origin CORS smoke check: API health response returned `Access-Control-Allow-Origin: https://appassets.androidplatform.net` when configured in `CORS_ORIGINS`.
- Production-mode smoke check from the previous run: server booted against migrated isolated SQLite; health returned HTTP 200 and CSP, HSTS, frame and content-type protection headers were present.
- Android configuration/assets checks: source contains a launcher `MainActivity`, `WebViewAssetLoader`, disabled file/content access, cancelled TLS errors, HTTPS-only server URL validation, health endpoint verification, target API 36/compile API 36, and current web assets synced into the Android package.
- A double-click macOS launcher was added. Its startup helper was exercised in a temporary clean project copy: it rotated the sample JWT secret, migrated a fresh SQLite database, started Uvicorn, and returned HTTP 200 from `/api/health`. The launcher creates a Python virtual environment and installs dependencies before starting.

## Not verified / not yet launch-ready

- **Android APK compilation:** not run successfully. This environment has no Android SDK, Gradle, DEX, or APK signing/build tools installed; outbound DNS to Gradle, Google Maven and Android SDK hosts is blocked. The Android Java/Gradle source is present, but there is no generated or device-tested `.apk` binary. Do not rename the ZIP to `.apk`.
- Browser visual/end-to-end automation: attempted using the installed Chromium, but navigation to localhost was blocked by the environment with `ERR_BLOCKED_BY_ADMINISTRATOR`; no browser visual pass is claimed.
- Public hosting deployment: not created or verified. The Render connector requires the user to explicitly select a workspace before service changes. The accessible GitHub repository belongs to a different SwapKaro project and has not been overwritten.
- PostgreSQL-specific integration, load tests, penetration testing, accessibility review, real Android device/emulator tests and independent security review have not been performed.
- Production payment collection, marketplace settlement/payout mapping, refunds and reconciliation remain incomplete. The optional webhook receiver only verifies/records configured events; it does not establish that a worker payout was made.
- Email/phone verification and password-reset delivery, external business/identity verification, protected document uploads, geocoding/routing, background queues, SMS/WhatsApp and workplace OTP/QR attendance require additional integrations and operating setup.

## Repeat checks

```bash
pytest -q
node --check app/static/app.js
python -m compileall -q app tests scripts
DATABASE_URL=sqlite:////tmp/earnroute-smoke.db alembic check
```
