# SubSathi release checklist

## Source package
- Android UI: `mobile/` (Expo / React Native / TypeScript)
- API: `backend/` (FastAPI)
- Render deployment blueprint: `render.yaml`
- CI tests: `.github/workflows/backend-tests.yml`

## Before deployment
1. Upload this folder to a private GitHub repository. Do not commit `.env` or secrets.
2. Create a Render Blueprint from the repository and review its web-service and PostgreSQL resources.
3. Provide a persistent Fernet `TOKEN_ENCRYPTION_KEY` and generated `JWT_SECRET` before the production backend boots.
4. Deploy and verify `https://YOUR-API-DOMAIN/health`. Gmail OAuth should report false until configured; that is expected.
5. Create a Google Cloud project owned by the app publisher, enable Gmail API, configure the consent screen, create a Web OAuth client, and add the exact callback URI `https://YOUR-API-DOMAIN/api/auth/google/callback`.
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Render. Restart/redeploy and verify `/health` shows `google_oauth_configured: true`.
7. Add test users and test the OAuth flow, scan, candidate review/import, disconnection, account deletion and token refresh before distributing builds. Gmail `gmail.readonly` is a restricted scope; do not open public access until Google verification and any required security assessment are complete.
8. In `mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL=https://YOUR-API-DOMAIN`. Build an internal APK with your Expo/EAS account and test it on real Android devices.

## Important product boundaries
- Gmail can only find subscriptions for which supporting information appears in accessible email. It cannot discover phone-only registrations, bank/card mandates, SMS or UPI AutoPay without another authorised data source.
- Missing amounts, cycles or renewal dates must be reviewed; the app should not invent them.
- Provider renew/cancel actions use official provider pages where known. There is no universal API for controlling all subscriptions inside SubSathi.
- This package is source code, not a published GitHub repository, deployed Render service, Google-verified OAuth app, or signed APK. Those steps require the publisher's accounts and credentials.