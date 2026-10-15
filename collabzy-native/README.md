# Collabzy Native Android

Jetpack Compose Android client for the existing Collabzy API. It is separated from the current Capacitor app so it can be built and verified without replacing the running website.

## Build

Requires Java 17+, Android SDK 35 and Gradle 8.9 or compatible. The GitHub Actions workflow builds an installable debug APK, runs compilation, and publishes the build as an artifact.

## Live API

The app uses `https://collabzy-api.onrender.com/api`. The server must have a persistent production database before general public launch. Instagram authorization uses the official Meta OAuth flow and requires valid Meta app configuration. This branch does not pretend membership payments are active; payment collection must be connected and tested with the merchant's approved provider and credentials before charging users.

## Signing

CI debug builds are installable for hands-on verification but are not Play Store release artifacts. A production release must use a stable private signing/upload key stored only in protected secrets, then pass physical-device QA and Play Console review.
