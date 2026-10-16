# Collabzy owner admin dashboard

The dashboard is served by the same backend and PostgreSQL database as Collabzy:

- Route: **/admin/** (after the collabzy-api service has deployed this commit)
- Admin API namespace: **/api/admin/***
- Sections: overview, people/accounts, campaigns, support inbox, and launch readiness
- Admin session: signed bearer token, two-hour expiry, five login attempts per 15 minutes
- Moderation: suspending an account revokes existing user sessions; account, campaign and support status changes are written to admin_audit_log
- Browser credential handling: the dashboard stores the temporary token in sessionStorage; the password and bcrypt hash are not embedded in frontend code

## One-time owner setup

The admin console intentionally stays unavailable until its owner identity is configured. It does not reuse a creator/brand account or have a hard-coded default password.

1. On a trusted computer, open the repository's collabzy-app directory and run npm install (if dependencies are not installed).
2. Run npm run admin:hash. Enter a unique password in the hidden prompt. Use at least 14 characters; the helper prints only a bcrypt hash.
3. In the Render dashboard, open the collabzy-api service → **Environment**. Add:
   - **COLLABZY_ADMIN_EMAIL** — the owner email address, in lowercase.
   - **COLLABZY_ADMIN_PASSWORD_HASH** — the complete bcrypt hash generated in step 2.
4. Save the Render environment changes and let the service restart/deploy. Open https://collabzy-api.onrender.com/admin/ and sign in with the configured email and the original password (not the hash).

Keep the original password private, do not commit the hash into the Git repository, and do not paste either into public issues or chat. If the hash or password needs rotation, generate a new hash, update the environment variable, then replace the old password.

## Important safety notes

The dashboard reads data from production tables; it does not manufacture sample metrics. Provider checks only show whether server settings are present. They do not prove that Instagram permissions were approved, emails can be delivered, Razorpay payments settle, or a legal/public launch is approved. The API keeps public registration gated according to the existing launch checks. Do not turn on public registration solely because this dashboard loads.

Admin status changes are powerful. Use account suspension for access control, campaign status for moderation, and the support inbox for request tracking. The support page can open a prefilled email draft; it does not send email through an unconfigured provider.
