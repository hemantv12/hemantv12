# SubSathi production release checklist

## Current state — 13 October 2026
- Web workspace is deployed: https://subsathi-web.onrender.com
- API is deployed: https://subsathi-api.onrender.com/health
- Android debug/test APK was built by GitHub Actions (run 38260668459).
- Automated backend tests and frontend manifest/service-worker/script checks passed (run 38356294917).
- The code is on the public `subsathi-launch` branch of `hemantv12/hemantv12`. Use a private repository for production source privacy.
- This is not a public production release yet: Google OAuth credentials are missing, the live API is still configured for SQLite, and the separate free PostgreSQL database is not yet linked to `DATABASE_URL`.

## Required before accepting real users
1. In Render, review and sync the root `render.yaml` Blueprint. Confirm it links `subsathi-api`'s `DATABASE_URL` to `subsathi-db`; a normal Git commit does not sync a Blueprint.
2. Upgrade the free PostgreSQL instance before production use. It currently expires on 11 November 2026. Configure backup and restore testing.
3. Confirm production `TOKEN_ENCRYPTION_KEY` is a valid Fernet key and `JWT_SECRET` is a unique randomly generated value. Do not put secrets in Git.
4. Create an app-owner-controlled Google Cloud project, enable Gmail API, configure the OAuth consent screen and create a Web OAuth client.
5. Add the exact callback URI `https://subsathi-api.onrender.com/api/auth/google/callback` in Google Cloud and configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Render.
6. Complete Google's required verification for the Gmail scope and any security assessment required for server-side storage/transmission of restricted-scope data. Do not claim public access is approved until Google confirms it.
7. Check API health and logs, then test OAuth approve/deny, expired-token refresh, Gmail scan, candidate review/import, disconnect, account deletion, rate limits and recovery from database restart.
8. Verify privacy notice, terms, operator contact, retention, data-deletion behaviour and support process against actual deployed behaviour. Replace generic beta wording with the operator's reviewed legal policy before public marketing.
9. Test mobile local SQLite, reminders, backup/delete flows and hosted API on physical Android devices. The current APK is a debug/test build, not a Play Store-signed production release.
10. Set up production Android signing under the publisher's control, app-store listing, Play Console Data safety declaration and policy review before Play Store submission.
11. Decide whether to keep the implementation in a private repository; the connected launch branch is public. Never store real customer data in the repository.

## Product boundaries
- Web records are stored locally in the browser and are not synchronised across devices.
- The Android tracker stores its subscription list locally; server-side Gmail metadata and credentials are separate from local entries.
- Gmail discovery depends on user consent and the information present in messages. It cannot discover phone-only services, bank/card mandates, SMS or UPI AutoPay without other authorised data sources.
- Missing prices, billing cycles or renewal dates must be reviewed, not invented.
- Provider management pages are official links where known; there is no universal API that cancels every subscription.
- The earnings and pricing screen is a planning model, not live billing. Payments, partner referrals and paid plans are not active.
