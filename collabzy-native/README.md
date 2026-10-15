# Collabzy Native Android

Jetpack Compose Android client for the existing Collabzy API. It is separated from the current Capacitor app so it can be built and verified without replacing the running website.

## Build

Requires Java 17+, Android SDK 35 and Gradle 8.9 or compatible. The GitHub Actions workflow builds an installable debug APK, runs compilation, and publishes the build as an artifact.

## Live API

The app uses `https://collabzy-api.onrender.com/api`. The server must have a persistent production database before general public launch. Instagram authorization uses the official Meta OAuth flow and requires valid Meta app configuration. This branch does not pretend membership payments are active; payment collection must be connected and tested with the merchant's approved provider and credentials before charging users.

## Release signing

The CI pipeline always compile-checks debug and release variants. The installable debug APK is for hands-on preview only. A signed production APK/AAB is emitted only when these protected GitHub Actions secrets are configured: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Keep one stable upload key backed up outside GitHub; never rotate it casually. A signed artifact still requires physical-device OAuth testing and Play Console review before public release.

## Instagram

The app uses Meta's official Instagram Login flow. Live connection works only when the Render service has `META_APP_ID`, `META_APP_SECRET` and an exact `META_REDIRECT_URI` registered in the Meta developer dashboard. Eligible accounts are Instagram Creator or Business accounts. Meta app permissions/review are platform-side requirements and cannot be bypassed by packaging the APK.
