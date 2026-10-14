# SubSathi — Full-stack build (Android + Gmail discovery API)

## Current deployment status — 14 October 2026

- **Web workspace:** https://subsathi-web.onrender.com
- **API health endpoint:** https://subsathi-api.onrender.com/health
- **Android:** version 0.5.3 (versionCode 9) is an installable internal test APK built by GitHub Actions; it is not a Play Store-signed release.
- **Automated checks:** latest backend regression tests passed (23 tests); Android type-check and APK packaging are verified by the linked GitHub Actions build.
- **Gmail:** hosted API health and Google OAuth-start preflight passed. A real account's end-to-end Gmail scan/import still needs physical-device acceptance testing.
- **Production gate:** verify the running API uses durable PostgreSQL, upgrade the temporary free database before expiry, and complete Google restricted-scope verification/security requirements before accepting real customer data.

The current project code is in the public `hemantv12/hemantv12` repository on the `subsathi-launch` branch. Do not put real user data, .env files, OAuth secrets, database URLs, signing keys or customer records in this repository. Use a private repository for production if you want the implementation source kept private.


SubSathi is an Android-first subscription organiser. This project contains a React Native + Expo Android frontend and a FastAPI backend for Google OAuth, Gmail receipt discovery, encrypted credential storage and candidate review/import.

## What is implemented

### Android frontend (`mobile/`)
- Local-first subscription tracker backed by SQLite.
- Dashboard, upcoming renewals, spend insights and local renewal notifications.
- Secure Google OAuth browser flow (`subsathi://auth`) using Expo WebBrowser.
- Session token stored with Android secure storage.
- Connected Gmail status; scans automatically after connection, when an existing authorised session is restored at app launch, and again whenever the Email scan screen is opened. Users review detected plans before importing.
- Disconnect Gmail removes server-stored connection/candidate cache; already imported local tracker entries remain.

### SmartSathi AI and voice assistant (`mobile/`)
- Local subscription money coach with Hindi/English questions, personalised monthly/yearly estimates, upcoming-renewal summaries, highest-cost plan review and exact-name duplicate warnings.
- Voice input uses the native speech-recognition service; voice replies use device text-to-speech. Users must grant microphone/speech permissions, and actual recognition availability depends on the device's installed speech service.
- This release is a local, rule-based money helper rather than a cloud generative LLM. Saved tracker data and typed chat prompts are not sent to a cloud AI API; voice transcription may be processed by the device's configured speech service.
- Android version 0.5.3 (versionCode 9) includes native voice-recognition configuration and CSV export; real-device microphone/speech validation is still required.

### API backend (`backend/`)
- FastAPI health check, Google OAuth start/callback and session endpoint.
- Gmail scanning with a configurable billing-focused Gmail query and a scan cap.
- Receipt metadata extraction for supported merchants, INR price, billing cycle hints and explicitly stated next-renewal dates.
- Candidate grouping / duplicate fingerprinting and import endpoint.
- Google credentials encrypted at rest using a Fernet key.
- SQLAlchemy database supports local SQLite and managed PostgreSQL.
- Privacy and terms draft pages at `/privacy` and `/terms`.
- Render Docker deployment blueprint and automated parser tests.

## Important limitations before calling this production-ready

- Google OAuth credentials are configured on the hosted service and the authorization-start endpoint passes preflight, but that does not mean Google has approved the app for public use. The owner must complete applicable restricted-scope verification/security review and test the full sign-in/scan/import path with an account they control.
- The API is deployed at `https://subsathi-api.onrender.com` and `/health` is its health check. The repository's Render Blueprint declares a PostgreSQL binding, but the active service must be verified in the Render dashboard to confirm `DATABASE_URL` is actually PostgreSQL. The existing free database is temporary; do not store real user accounts until durable database binding, backup and migration status are confirmed.
- The native app reads `EXPO_PUBLIC_API_BASE_URL`; set it to your hosted API URL for an installed build. The default `http://10.0.2.2:8000` is for an Android Studio emulator only.
- The mobile tracker stores imported subscriptions locally on the device. The backend stores encrypted Google credentials and scan candidates, but this current MVP does not yet synchronise the user's entire tracker across devices.
- SMS, phone-number-only subscriptions, banks, cards and UPI AutoPay are not automatically accessible. These require separate supported user-provided imports or authorised provider/banking integrations; Gmail alone cannot discover them.
- No universal third-party renew/cancel API exists. The app opens provider-owned management pages where known; it does not promise that every provider can be renewed or cancelled inside SubSathi.
- The web workspace and API are live, and a debug Android APK exists. The SmartSathi AI/voice update needs a new native APK build and real-device microphone/speech validation. This does not mean a full production release is approved: real Gmail login is disabled until Google OAuth is configured and verified, PostgreSQL must be linked, legal/contact details must be finalised, and the Android build needs production signing plus real-device testing.

## 1. Run the backend locally

Requirements: Python 3.11+ (3.12 recommended).

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the generated key into `TOKEN_ENCRYPTION_KEY` in `backend/.env`. For local API health tests, Google credentials may stay blank. Gmail authorization will return a clear configuration error until they are set.

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check `http://localhost:8000/health`, API documentation at `http://localhost:8000/docs`, and the policy draft at `http://localhost:8000/privacy`.

Run scanner unit tests:

```bash
PYTHONPATH=. pytest -q tests
```

## 2. Configure Google OAuth / Gmail API

1. Create a Google Cloud project owned by the publisher.
2. Enable the Gmail API.
3. Configure the OAuth consent screen and publisher domains / privacy policy.
4. Create an OAuth Client ID of type **Web application**.
5. Add the exact API callback, e.g. `https://YOUR-API-DOMAIN/api/auth/google/callback`, to authorised redirect URIs.
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` on the server.
7. Set `TOKEN_ENCRYPTION_KEY` to a generated Fernet key and `JWT_SECRET` to a unique random secret of at least 32 characters.
8. Add test users while the app is in testing mode. Submit the Gmail scope for production verification and complete any independent security review Google requires before general public access.
9. Test authorize, deny, token refresh, disconnect and delete flows with accounts you control.

Scopes include `gmail.readonly`, which Google classifies as restricted. Apps requesting restricted scopes need verification, and apps storing/transmitting restricted data through a server need an approved security assessment unless an exception applies. Do not claim public Gmail access is approved until Google grants it.

## 3. Deploy backend to Render

1. The connected launch branch is currently public. For a production product with private implementation code, move this project to a private repository you control before accepting customers.
2. In Render, sync the **root** `render.yaml` Blueprint. It declares the existing `subsathi-api`, `subsathi-web` and `subsathi-db` resource names and links the API `DATABASE_URL` to the PostgreSQL connection string. A normal Git push does not itself sync a Render Blueprint; use the Blueprint dashboard and review the proposed changes before applying.
3. Keep the database on a paid persistent plan for production. The current free PostgreSQL instance is only a temporary pilot and expires on 11 November 2026. Do not store real customer data on it unless it has been upgraded and backups are configured.
4. Keep Google OAuth disabled until `TOKEN_ENCRYPTION_KEY` is a valid Fernet key and `JWT_SECRET` is unique and random. The current live API can boot while Google OAuth is not configured.
5. After syncing the Blueprint, verify the API's `/health` endpoint and inspect its logs to confirm it is using the PostgreSQL URL without connection errors. Then configure your Google Cloud OAuth client, exact HTTPS `GOOGLE_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and final `CORS_ORIGINS`. Verify `/health` reports `google_oauth_configured: true`; that flag is not evidence that Google has approved the app for public Gmail access.

Never commit real `.env` files, Google client secrets, encryption keys or production database URLs.

## 4. Run the Android app

Requirements: Node.js compatible with Expo SDK 57 and a compatible Android development environment.

```bash
cd mobile
cp .env.example .env
# edit EXPO_PUBLIC_API_BASE_URL for your computer/device/backend
npm install
npx expo start
```

For an Android emulator, `http://10.0.2.2:8000` usually reaches the development host. For a physical Android phone, use the developer computer's LAN IP on the same network, or the deployed HTTPS backend URL.

To produce an internal testing APK, configure EAS with your own Expo account:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

Google Play publishing additionally needs the Play Console account, app signing, store metadata, Data safety declaration, public privacy policy, account deletion path and Play policy review.

## Security notes

- Gmail content must not be used for advertising or sold. The backend only persists detected metadata and encrypted credentials; it does not store full receipt bodies.
- Keep `CORS_ORIGINS` restricted to the real web origins if a browser frontend is added. Native mobile requests do not depend on CORS.
- Configure a durable encrypted database backup and a backup retention policy before production.
- Add operational monitoring/rate limiting, account abuse controls and security review before general release.
- The mobile Settings screen includes server-account deletion; local subscription rows are kept separately and can be cleared in Settings.
- Date, amount and cycle detection are heuristic. A missing renewal date is left blank; never treat inferred data as confirmed.

## Repository map

```text
mobile/        React Native + Expo Android app
backend/app/   FastAPI OAuth, Gmail scan/import, SQLAlchemy models and privacy pages
backend/tests/ receipt parser tests
backend/Dockerfile
render.yaml
```

## SmartSathi AI / voice behaviour

The AI tab is intentionally local and keyless in this release. It computes subscription cost equivalents, highlights upcoming dates, flags exact same-name entries for review, and answers common English/Hinglish questions. It is not a cloud LLM and will not invent provider-side billing facts. Voice input requires a compatible Android speech-recognition service and explicit microphone permission; text-to-speech uses the device voice engine. Check device privacy settings for the speech service's handling of audio.
