# Collabzy

A mobile-first creator and brand collaboration platform. The public landing page, creator/brand accounts, campaign discovery, paid/barter/hybrid listings, applications and status tracking are deployed as an early-access MVP.

## Live services
- App and API: https://collabzy-api.onrender.com
- API health: https://collabzy-api.onrender.com/api/health
- Privacy: https://collabzy-api.onrender.com/privacy.html
- Terms: https://collabzy-api.onrender.com/terms.html
- GitHub branch: `collabzy-android`

## Local backend
- Install Node.js 22.
- Copy .env.example to .env and set a strong random JWT_SECRET.
- Run `npm install`, `npm test`, then `npm start`.
- Open http://localhost:3000.

## Android
GitHub Actions builds a debug APK on pushes to the `collabzy-android` branch. Open Actions > Build Collabzy Android APK and download the `Collabzy-Android-APK` artifact. A debug APK is for testing; a Play Store release needs release signing and real-device testing.

## Before public commercial launch
- **Persistent database:** the current deployment uses SQLite on a free web service; managed PostgreSQL is not wired into this version. The free service filesystem may reset on redeploy/restart. A durable database must be attached and the backend migrated and verified before real users rely on the app.
- **Instagram:** official OAuth and token exchange routes are implemented, with tokens encrypted at rest. Set `META_APP_ID`, `META_APP_SECRET` and the exact `META_REDIRECT_URI` in Render, configure the same redirect URI and required Instagram Login permissions in Meta, and test with an eligible professional account before advertising insights as live.
- **Payments:** the planned ₹299/year membership is displayed as planned only; checkout is not enabled and no payment is collected.
- **Operations:** configure durable backups, account recovery/email verification, monitoring, and support contact ownership before scaling.
- **Security:** keep production secrets in the host's secret store; never commit credentials.
