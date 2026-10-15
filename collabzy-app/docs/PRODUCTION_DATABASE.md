# Production Database Setup

Collabzy's SQLite database on a Free Render web service is suitable for preview/testing only. Free service filesystems are ephemeral. For production, use a **separate managed PostgreSQL database dedicated to Collabzy**. Never reuse the SubSathi database.

## Cost and billing

Render's official pricing page lists the smallest paid PostgreSQL plan ('0.1c-256mb', formerly Basic-256mb) at **US$6/month**, with 256 MB RAM and 100 connections. Storage growth, outbound bandwidth and other services can add cost. Confirm the current amount in the Render Dashboard before creating resources: https://render.com/pricing

The Render API refused provisioning because payment information is required in the workspace. No database was created and no database charge was placed.

## Provision a separate database

1. Add a payment method in the Render billing dashboard: https://dashboard.render.com/billing
2. Open the Render dashboard and create a new PostgreSQL database:
   - Name: 'collabzy-db'
   - Region: Singapore (same region as 'collabzy-api')
   - Plan: smallest paid PostgreSQL plan ('0.1c-256mb' / Basic-256mb)
3. Copy the **Internal Database URL** from the new Collabzy database's Connect panel. Keep it private.
4. Open the 'collabzy-api' web service → Environment and set 'DATABASE_URL' to that URL.
5. Keep the existing long random 'JWT_SECRET' unchanged. The Instagram token encryption key is derived from it.
6. Save and redeploy. When 'DATABASE_URL' is set, 'src/server.js' starts 'src/server-postgres.js' instead of the SQLite implementation.
7. Verify '/api/health' returns 'database: "connected"' and 'mode: "postgres-persistent"'.
8. Create one test creator and brand, post a campaign, apply, send a message, verify the rows persist through a deployment/restart, and then delete test records/accounts.

PostgreSQL schema initialization runs on server startup. The tables are scoped to this new database; existing SQLite test data is not automatically migrated. If there are real accounts or campaign agreements in the SQLite deployment, export/backup them before switching and perform a one-time migration rather than silently losing data.

## CI checks

The GitHub Actions workflow starts a disposable PostgreSQL 16 service to test the production adapter end to end. This proves the adapter against a temporary test database, not against the Render production database. Live deployment verification is still required once a real 'DATABASE_URL' is configured.

## Current external blockers

- A payment method must be added to Render before the separate paid database can be provisioned.
- Instagram still needs Meta App ID, App Secret, redirect configuration and an eligible authorized professional account.
- Subscription checkout still needs a merchant account/provider credentials and is intentionally not enabled yet.
