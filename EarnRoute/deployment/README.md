# Deployment notes

- `render.yaml` provisions an API web service and a separate PostgreSQL database when applied in the intended Render workspace. It uses a generated JWT secret and runs Alembic migrations before startup.
- The Blueprint is a low-cost/private-beta starting point. Verify current hosting/database limits and backup/retention policies before taking production traffic.
- This release is not cleared for live marketplace payments or worker payouts. `RAZORPAY_*` environment variables alone do not enable settlement; provider-specific checkout, webhook idempotency, refund and payout reconciliation still need to be implemented and tested.
- The GitHub Actions workflow runs backend tests and builds an installable **debug APK** artifact on GitHub-hosted Linux runners. It is not a Play Store release build; a release signing key must be kept in repository/organization secrets and a dedicated signing workflow added before public store distribution.
