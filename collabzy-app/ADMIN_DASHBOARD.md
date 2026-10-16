# Collabzy owner admin dashboard

The dashboard is served by the same backend and PostgreSQL database as Collabzy.

- Dashboard: https://collabzy-api.onrender.com/admin/
- Admin API: /api/admin/*
- Sections: live overview, creator/brand accounts, campaign moderation, support inbox, launch readiness and audit trail.
- Admin session: signed bearer token, two-hour expiry and rate-limited login.
- Moderation: suspending an account invalidates existing sessions; campaign/support status changes are audited.
- Browser credential handling: a temporary token is kept in sessionStorage. Passwords and provider secrets are not included in frontend code.

## First-time owner setup

When the server reports that admin setup is required, the dashboard displays a one-time owner setup form. Enter an email address you control, create a strong password (14+ characters; maximum 72 UTF-8 bytes), confirm the password, and enter the private one-time setup code provided to the owner for this deployment. The server hashes the password with bcrypt and creates the single owner record in PostgreSQL. The setup route refuses further setup once that record exists and has rate limits. Store the password in a password manager; do not send it in chat or commit it to the repository.

The optional environment-based override remains available for operators who prefer managing `COLLABZY_ADMIN_EMAIL` and `COLLABZY_ADMIN_PASSWORD_HASH` directly in Render. The repository also includes `npm run admin:hash` to generate a bcrypt hash in a local terminal.

## Important launch notes

Metrics come from PostgreSQL; the dashboard does not manufacture sample data. Provider checks indicate configuration presence only: they cannot verify that Meta permissions are approved, mail is deliverable, payments settle correctly, legal terms are complete, or the operator has approved public launch. Public account registration remains gated by existing launch readiness checks.

Campaign moderation, account suspension and support-state changes affect real production records. The support inbox opens a prefilled email draft but does not send mail through an unconfigured provider.
