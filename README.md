# SubSathi — Subscription Control Center

SubSathi helps people organise recurring subscriptions, review renewal dates, and identify billing emails that may reveal subscriptions. This repository contains the local-first web app, FastAPI backend, and Android app.

## Current release status

**Hosted pilot / release candidate — not yet production-ready for real customer data.**

- Web app: https://subsathi-web.onrender.com
- Backend health endpoint: https://subsathi-api.onrender.com/health
- Privacy notice: https://subsathi-web.onrender.com/privacy.html
- Terms: https://subsathi-web.onrender.com/terms.html

The web app supports local subscription tracking, renewal views, receipt-file import, CSV export, JSON backup/restore, and PWA installation. Its subscription list is stored in the current browser; it is not yet synced to a signed-in web account.

The Android app includes Google sign-in, Gmail receipt scanning, candidate review/import, CSV export and disconnect/delete controls. Hosted OAuth-start preflight passes, but real-account scan/import acceptance testing and durable database verification remain before a public production launch.

## Repository layout

- `frontend/` — hosted local-first web app, PWA manifest/service worker, privacy notice and terms.
- `subsathi-fullstack/backend/` — FastAPI API, SQLAlchemy models, Gmail scanning/parser, OAuth and security helpers.
- `subsathi-fullstack/mobile/` — Expo / React Native Android application.
- `render.yaml` — Render Blueprint for the API, web site and PostgreSQL database.
- `.github/workflows/` — automated checks and Android test-build workflow.

## Before accepting real users

Complete the following items in the owner's accounts:

1. **Persistent database:** sync/review the Render Blueprint so the API receives the `subsathi-db` PostgreSQL connection string. Confirm `DATABASE_URL` is PostgreSQL, not `sqlite:///./subsathi.db`, and verify the tables exist. The existing free database expires on 11 November 2026; upgrade to a suitable durable plan before storing real customer data. No paid plan is changed automatically by this repository.
2. **Google OAuth:** in the owner's Google Cloud project, enable Gmail API, configure the OAuth consent screen and a Web application OAuth client, and add `https://subsathi-api.onrender.com/api/auth/google/callback` as an authorised redirect URI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as private Render environment variables. Do not commit either secret into Git.
3. **Google approval:** the Gmail read-only scope is restricted. Complete Google's applicable verification and security requirements before public customer use.
4. **Web account sync:** the browser app is local-first. Implement and test a dedicated web sign-in/session and server-backed subscription CRUD flow before advertising cross-device web sync.
5. **Android release:** the available APK is a debug/test build. Create a production-signed build with an owner-controlled signing key, test it on devices, prepare the Google Play listing and complete the required policy/Data Safety declarations.
6. **Commercial launch:** set up customer support, data-retention/deletion procedures, terms/privacy review, payment provider and refund/tax policies before accepting payments.

## Render deployment configuration

The `render.yaml` Blueprint uses these resources:

- `subsathi-api` — Docker / FastAPI service, health check at `/health`.
- `subsathi-web` — static site serving `frontend/`.
- `subsathi-db` — PostgreSQL database.

The Blueprint file alone does not change existing Render services until the Blueprint is reviewed and synced in the Render Dashboard. Review proposed changes before applying them. Keep the API and database in the same region where possible. Do not expose database access publicly just to make remote tools connect.

Set these API environment variables in Render:

- `APP_ENV=production`
- `API_BASE_URL=https://subsathi-api.onrender.com`
- `GOOGLE_REDIRECT_URI=https://subsathi-api.onrender.com/api/auth/google/callback`
- `MOBILE_REDIRECT_URI=subsathi://auth`
- `CORS_ORIGINS=https://subsathi-web.onrender.com`
- `DATABASE_URL` — Render PostgreSQL connection string, supplied via the Blueprint's `fromDatabase` reference.
- `TOKEN_ENCRYPTION_KEY` — private Fernet key generated for this app.
- `JWT_SECRET` — unique, random secret (32+ characters minimum).
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — private Google OAuth client credentials.

Never commit live secrets, access tokens, signing keys or database credentials to Git.

## Local development

### Backend

Python 3.12 is recommended.

```bash
cd subsathi-fullstack/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

For local-only development, SQLite is the default. For any hosted environment, explicitly configure PostgreSQL.

### Web app

Serve the `frontend/` directory from a local static server. The PWA service worker requires HTTPS or localhost.

### Android

```bash
cd subsathi-fullstack/mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` to the backend URL when building a test or production app. Use an owner-controlled signing key for production Android releases.

## Quality checks

Backend tests:

```bash
cd subsathi-fullstack/backend
PYTHONPATH=. python -m pytest -q tests
```

The CI workflow also checks frontend JavaScript, the PWA manifest and service worker. A passing CI run confirms those checks—not Google OAuth approval, durable database configuration, Play Store acceptance, or end-to-end Gmail access.

## Security principles

- Google sign-in must use the official consent screen; never ask users for their Gmail password.
- Request minimum scopes and explain what email metadata is extracted.
- Keep provider credentials encrypted on the server and out of logs.
- Do not store full email bodies after parsing.
- Let users disconnect Gmail and request server-side account/data deletion.
- Do not claim estimated subscription amounts or dates are verified when the receipt does not contain them.
