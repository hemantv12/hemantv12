# SubSathi — Full-stack build (Android + Gmail discovery API)

SubSathi is an Android-first subscription organiser. This project contains a React Native + Expo Android frontend and a FastAPI backend for Google OAuth, Gmail receipt discovery, encrypted credential storage and candidate review/import.

## What is implemented

### Android frontend (`mobile/`)
- Local-first subscription tracker backed by SQLite.
- Dashboard, upcoming renewals, spend insights and local renewal notifications.
- Secure Google OAuth browser flow (`subsathi://auth`) using Expo WebBrowser.
- Session token stored with Android secure storage.
- Connected Gmail status; scans automatically after connection, when an existing authorised session is restored at app launch, and again whenever the Email scan screen is opened. Users review detected plans before importing.
- Disconnect Gmail removes server-stored connection/candidate cache; already imported local tracker entries remain.

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

- The Google Cloud OAuth client is **not provisioned by this project**. You must create it in your own Google Cloud project, enable Gmail API, set the exact authorised redirect URI, configure the consent screen and complete whatever verification/security assessment Google requires for the selected Gmail scope. A project with empty credentials cannot scan a real inbox.
- The backend is deployable but **not yet deployed**. A public HTTPS backend URL and database must be created, environment secrets configured, and `/health` verified.
- The native app reads `EXPO_PUBLIC_API_BASE_URL`; set it to your hosted API URL for an installed build. The default `http://10.0.2.2:8000` is for an Android Studio emulator only.
- The mobile tracker stores imported subscriptions locally on the device. The backend stores encrypted Google credentials and scan candidates, but this current MVP does not yet synchronise the user's entire tracker across devices.
- SMS, phone-number-only subscriptions, banks, cards and UPI AutoPay are not automatically accessible. These require separate supported user-provided imports or authorised provider/banking integrations; Gmail alone cannot discover them.
- No universal third-party renew/cancel API exists. The app opens provider-owned management pages where known; it does not promise that every provider can be renewed or cancelled inside SubSathi.
- This is source code, not an already-installed APK or a live public service. It needs configuration and real-device/browser testing before release.

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

1. Put this folder in a private GitHub repository that you own.
2. In Render, create a Blueprint from that repository. Use the root `render.yaml` Blueprint. It sets the Docker context to `backend` and points to `backend/Dockerfile`.
3. Provision the PostgreSQL database and web service. The API may boot with Google OAuth disabled, but `TOKEN_ENCRYPTION_KEY` must be a valid Fernet key and `JWT_SECRET` must be secure.
4. Verify `https://YOUR-API-DOMAIN/health` reports `status: ok`. It may report `google_oauth_configured: false` at this stage; that is intentional and means Gmail features remain disabled.
5. Configure your own Google OAuth client and then add Google client ID/secret, exact HTTPS `GOOGLE_REDIRECT_URI`, and final `CORS_ORIGINS` in Render. Redeploy, then verify `/health` reports `google_oauth_configured: true`. A health check alone does not mean Gmail OAuth has been verified by Google.

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