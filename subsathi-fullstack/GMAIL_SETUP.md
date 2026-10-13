# SubSathi Gmail connection setup (v0.4.0)

## Why Connect Gmail is currently failing

The Android app checks `GET /health` before starting Google sign-in. The backend returns `google_oauth_configured: false` when its Google OAuth client is not configured. This is server setup, not a phone permission issue.

## Configure Google Cloud

1. Open a Google Cloud project owned by the publisher.
2. Enable **Gmail API**.
3. Configure the OAuth consent screen and publishing status.
4. Create an OAuth Client ID of type **Web application**.
5. Add this exact Authorized redirect URI: `https://subsathi-api.onrender.com/api/auth/google/callback`.
6. While the consent screen is in Testing, add your Google account as a test user.
7. The requested `gmail.readonly` scope is restricted. Google may require verification and an independent security assessment before public launch; don't promise public availability until approved.

## Configure Render

Open the `subsathi-api` web service → Environment and set:

- `GOOGLE_CLIENT_ID`: the Web OAuth client ID
- `GOOGLE_CLIENT_SECRET`: the Web OAuth client secret
- `GOOGLE_REDIRECT_URI`: `https://subsathi-api.onrender.com/api/auth/google/callback`
- `API_BASE_URL`: `https://subsathi-api.onrender.com`
- `MOBILE_REDIRECT_URI`: `subsathi://auth`

The production service must also have `DATABASE_URL` pointed to the persistent Render PostgreSQL instance, a valid Fernet `TOKEN_ENCRYPTION_KEY`, and a unique `JWT_SECRET` of at least 32 characters. Generate a Fernet key with Python's `cryptography.fernet.Fernet.generate_key()`; do not reuse a development key. Save the environment variables and redeploy.

Open `https://subsathi-api.onrender.com/health`. Continue only when it reports `status: ok` and `google_oauth_configured: true`. Then test sign-in, scan, candidate review/import, disconnect, account deletion and token refresh with an account you control.

## Security and product limits

- Never put the client secret or Google refresh tokens in the APK, source repository, screenshots or chat.
- Gmail only discovers subscriptions with evidence in accessible billing emails. It cannot automatically identify phone-only registrations, SMS, cards, bank mandates or UPI AutoPay.
- Candidate detections are estimates and must be reviewed. Missing price, billing cycle or renewal date must not be invented.
- Test AdMob IDs are not monetized. Real ads require the publisher's own ad unit IDs, consent configuration and Google approval.
