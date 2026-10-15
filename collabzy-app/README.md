# Collabzy

Mobile-first creator and brand collaboration MVP with account authentication, campaign discovery, paid/barter/hybrid listings, creator applications, application status tracking, creator/brand profiles and an Express API backed by SQLite.

## Local backend
- Install Node.js 20 or newer.
- Copy .env.example to .env and set a strong random JWT_SECRET.
- Run npm install, then npm start.
- Open http://localhost:3000.

## Android
GitHub Actions builds a debug APK on pushes to the collabzy-android branch. Open Actions > Build Collabzy Android APK and download the Collabzy-Android-APK artifact.

## Integration limitations
- Payments intentionally are not enabled.
- Instagram insights require Meta app credentials, OAuth token exchange, granted permissions and a configured callback. The app does not scrape private follower data.
- SQLite on a free cloud service may not be durable across restarts. Configure persistent storage or migrate to managed PostgreSQL before public launch.
- A debug APK is for testing. Play Store release needs release signing and production testing.
