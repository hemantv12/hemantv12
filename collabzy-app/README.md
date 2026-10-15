# Collabzy

Collabzy is a mobile-first creator–brand collaboration marketplace. This branch includes the deployed web app and a GitHub Actions workflow that builds an Android debug APK.

## Implemented features

- Creator and brand accounts with password hashing, JWT sessions, validation and auth rate limits.
- Creator profile with niche, bio, location, Instagram handle, follower count and engagement rate.
- Campaign marketplace with paid, barter and hybrid listings; search, campaign applications and status tracking.
- Brand campaign manager with applicant counts, campaign close/reopen controls, and a creator directory.
- Brand-to-creator campaign invitations; creators can accept or decline. Accepting creates a trackable application.
- Saved campaigns, in-app collaboration conversations, messaging and activity notifications.
- Official Instagram Login OAuth flow, encrypted token storage, account insights, recent media and disconnect. This requires Meta credentials and correct access/permissions; it is not enabled just by installing the app.
- Privacy and Terms pages.

## Live services

- App and API: https://collabzy-api.onrender.com
- Health check: https://collabzy-api.onrender.com/api/health
- Privacy: https://collabzy-api.onrender.com/privacy.html
- Terms: https://collabzy-api.onrender.com/terms.html
- GitHub branch: https://github.com/hemantv12/hemantv12/tree/collabzy-android/collabzy-app

## Run locally

1. Install Node.js 22.
2. Copy `.env.example` to `.env` and set a unique random `JWT_SECRET` (32+ characters).
3. Run `npm install`, `npm test`, and `npm start`.
4. Open http://localhost:3000.

Demo campaigns are seeded for development/tests but disabled in production. Create a brand account to post a real campaign.

## Android

Every push to `collabzy-android` runs the backend/API and frontend JavaScript syntax tests, then builds `Collabzy-Android-APK`. Download the artifact from GitHub Actions. Workflow artifacts expire, so keep a copy of any APK you need.

The generated APK is a **debug/testing build**. Before Play Store release, configure release signing, verify package/app icons and versioning, test on physical Android devices, and review the Play Console requirements. Never treat a successful compile as a substitute for device QA.

## Required before public commercial launch

- **Persistent database:** the current server implementation still uses SQLite. Render's free web service has an ephemeral filesystem; SQLite records can be lost on redeploy/restart/spin-down. Do not rely on this deployment to preserve real user records until a persistent disk or managed database is wired in and verified. Do not point Collabzy at the separate SubSathi database.
- **Instagram:** configure `META_APP_ID`, `META_APP_SECRET` and `META_REDIRECT_URI` in Render; see [Instagram setup](docs/INSTAGRAM_SETUP.md). Redirect URI must match Meta settings exactly. External creator accounts require appropriate Meta access/review; an eligible Creator or Business Instagram account is required. The app reports setup errors instead of fabricating connection or metrics.
- **Payments:** the planned ₹299/year membership is not connected. No checkout or payment collection is active.
- **Account operations:** email verification, password reset delivery, data export/deletion workflow, support contact and monitoring need completion before scaling.
- **Release/security:** keep secrets in the hosting secret store; never commit credentials. Keep `JWT_SECRET` stable while encrypted Instagram tokens exist. Configure backups and test account recovery before opening registration broadly.

## API test coverage

The automated smoke tests cover account registration/login, campaign publication and application, saved campaigns, messaging, creator discovery, campaign invitations and dashboard metrics. Instagram's live OAuth/insights still need a real Meta app and an eligible test account to verify against Meta.
