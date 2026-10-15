# Production Database Setup

## Current Collabzy deployment

The live `collabzy-api` Render service is configured to use a dedicated Neon PostgreSQL project named `collabzy-production` in Singapore. The project is on the Neon Free plan and is separate from SubSathi. The Render environment stores the private `DATABASE_URL`; the application uses PostgreSQL mode and verifies TLS certificates.

The production adapter initializes these tables on startup: users, campaigns, applications, saved_campaigns, conversations, messages, notifications and campaign_invitations.

## Data migration result

On the first switch to PostgreSQL, the guarded importer looked for the service's SQLite file at `/opt/render/project/src/collabzy-app/collabzy.db`. Render logs confirmed that this file was not found, so the importer skipped safely. The PostgreSQL database was empty and now contains the initialized schema, but no existing users, campaigns, applications or messages were migrated. The migration flag has been disabled again.

Any account that existed only in the old ephemeral SQLite file will need to be registered again. Do not attempt a blind second import or point Collabzy at the SubSathi database.

## Verification checklist

1. Confirm Render's latest deploy is live and logs contain `Collabzy PostgreSQL API listening`.
2. Open `https://collabzy-api.onrender.com/api/health`; expected response includes `database: "connected"` and `mode: "postgres-persistent"`.
3. Register a test creator and a separate test brand.
4. Publish a campaign as the brand, apply as the creator, send a message, and verify the brand receives the application.
5. Restart/redeploy the API and verify both accounts, the campaign and the conversation remain available.
6. Delete the temporary test accounts after the checks.

The PostgreSQL backend's automated integration test uses a disposable CI database; that test is not a substitute for the live end-to-end checks above.

## Free-plan and launch caveats

- Neon Free has usage limits and may suspend/scale compute to zero. Monitor usage, confirm plan limits and configure backups/restore procedures before growth.
- The Render web service is currently on its free plan; cold starts and uptime limits remain. Consider a paid web-service plan before advertising production-grade availability.
- Keep the current `JWT_SECRET` stable while encrypted Instagram tokens exist. Never expose `DATABASE_URL`, Meta secrets, payment credentials or signing keys in the frontend, repository or chat.
- Before commercial launch, complete real Instagram authorization tests, payment provider/webhook tests, account recovery email, release signing and physical Android QA.
