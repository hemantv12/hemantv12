# Collabzy

Collabzy is a mobile-first creator–brand collaboration marketplace. The live early-access web app and Android debug package provide account, campaign, creator discovery, invitation, messaging and Instagram integration workflows.

## Implemented features

- Creator and brand accounts with password hashing, signed sessions, validation and auth rate limits.
- Creator profile with niche, bio, location, Instagram handle, follower count and engagement rate.
- Campaign marketplace with paid/barter/hybrid listings, search, application pitches, status tracking and saved campaigns.
- Brand campaign management, creator discovery, campaign invitations and accept/decline response.
- In-app conversations/messages, unread-message counts and activity notifications.
- Account password change, self-service data export and password-confirmed deletion.
- Official Instagram Login OAuth, encrypted access-token storage, expiry handling, insights, recent media and disconnect. Requires Meta app credentials and approved permissions before it can be used with real accounts.
- Privacy and Terms pages.

## Live services

- App and API: https://collabzy-api.onrender.com
- Health check: https://collabzy-api.onrender.com/api/health
- Privacy: https://collabzy-api.onrender.com/privacy.html
- Terms: https://collabzy-api.onrender.com/terms.html
- GitHub branch: https://github.com/hemantv12/hemantv12/tree/collabzy-android/collabzy-app

## Database modes

- **Current deployment:** SQLite on a free web service. Free Render web services have an ephemeral filesystem; do not rely on it for production user records.
- **Persistent PostgreSQL adapter:** src/server-postgres.js provides a managed PostgreSQL backend with equivalent marketplace endpoints. When a valid DATABASE_URL is configured, src/server.js selects this backend automatically. PostgreSQL schema initialization and existing-application conversation backfill run on startup.
- Database provisioning is blocked until the Render workspace has billing information. See Production database setup (docs/PRODUCTION_DATABASE.md). Do not reuse or point Collabzy at the separate SubSathi database.

## Run locally

1. Install Node.js 22.
2. Copy .env.example to .env and set a unique random JWT_SECRET (32+ characters).
3. Run npm install, npm test, and npm start.
4. Open http://localhost:3000.

Without DATABASE_URL, local development/tests use SQLite. To exercise PostgreSQL mode, configure DATABASE_URL and run npm run test:postgres.

Demo campaigns are seeded for development/tests but disabled when NODE_ENV=production. Create a brand account to post a real campaign.

## Android

Every push to collabzy-android runs frontend/backend syntax and API tests, plus a real PostgreSQL integration test using a temporary CI database, before building Collabzy-Android-APK. Download the artifact from GitHub Actions.

The APK is a **debug/testing build** and is around 4 MB because the current frontend is a compact, locally bundled HTML/CSS/JavaScript interface running in Capacitor's Android WebView. It is not a full native Kotlin screen-by-screen UI. The web interface itself is packaged into the APK and calls the live API over the network. A Play Store release needs release signing, app icon/splash polish, package/version review and physical Android testing; a debug build should not be published as-is.

## Before public commercial launch

- **Persistent database:** create a separate Collabzy PostgreSQL database and configure DATABASE_URL in Render. See the setup guide. This has a monthly charge. Until it is configured and tested on the live service, records may be lost on restart or redeploy.
- **Instagram:** configure META_APP_ID, META_APP_SECRET and META_REDIRECT_URI in Render and complete the Meta app setup in docs/INSTAGRAM_SETUP.md. Redirect URI must match exactly. A Creator/Business professional test account and correct Meta permissions are required; app review may be needed for outside users.
- **Payments:** the planned ₹299/year membership is not connected. No checkout or payment collection is active.
- **Account operations:** email verification and a real mail delivery provider for password recovery are not configured.
- **Release/security:** keep secrets in the host secret store; never commit credentials. Keep JWT_SECRET stable while encrypted Instagram tokens exist. Configure backups, account recovery, support ownership, monitoring and physical-device QA before opening registration broadly.

## Automated test coverage

The GitHub Actions workflow covers registration/login, campaign publication/application, saved campaigns, messaging, creator discovery, campaign invitations, account export/password operations and a separate PostgreSQL-mode collaboration workflow. Live Meta OAuth and real Instagram metrics still need an eligible account and a configured Meta app.
