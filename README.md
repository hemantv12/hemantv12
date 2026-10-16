# EarnRoute

EarnRoute is an India-first paid-shift marketplace MVP. It has separate worker, business and admin experiences, a FastAPI backend, SQLAlchemy/Alembic database migrations, and an Android WebView client that connects to the same HTTPS API.

## Repository layout

- `EarnRoute/` — full application source (the cloud build workflow extracts this from the source bundle and commits it to this branch)
- `Dockerfile` — deploy image build, extracting the source bundle and installing the Python service
- `render.yaml` — Render web service + PostgreSQL Blueprint
- `.earnroute-payload/` — reproducible compressed source bundle used by Docker and CI

## Android build

The GitHub Actions workflow **EarnRoute cloud build** restores the bundle, runs `pytest`, Python compilation and frontend syntax checks, installs Android SDK Platform 37 and Build Tools 36, and builds an installable debug APK using Gradle 9.8.1 / Android Gradle Plugin 9.4.0.

After the workflow finishes, open **Actions → EarnRoute cloud build → Artifacts → EarnRoute-debug-apk** to download `app-debug.apk`. Debug APK is for private beta/device testing and is not a Play Store release signed with a founder-owned release key.

## Render deployment

The included Blueprint provisions the web API and a PostgreSQL database when applied in the intended Render workspace. Review the service/database plan, retention and cost limits before applying. Check `/api/health` after deployment. Then set the HTTPS API base URL in the Android app using **Connect server**.

## Verified local checks

At source packaging time: `pytest -q` passed 21 tests; `node --check app/static/app.js` passed; `python -m compileall -q app tests scripts` passed; the Render YAML parsed successfully.

## Important go-live limitations

- This is a tested MVP, not a fully cleared production marketplace.
- Real payment checkout, marketplace settlement/payouts, refunds and provider reconciliation are not complete. Do not take live worker funds or claim payouts as paid until these provider flows are implemented and verified.
- Email/phone OTP, password reset delivery, private evidence/document storage, external business/identity verification, real routing/travel-time integration, and background notification jobs still need production integrations.
- The default fee is illustrative/configurable and must be reviewed and disclosed in the applicable terms before live use.
- Do not expose test accounts or fake jobs as live listings. Job availability or worker income is not guaranteed.
