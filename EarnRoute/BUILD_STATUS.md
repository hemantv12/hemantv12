# EarnRoute Build Status — 16 October 2026

## Verified in this workspace

- Backend automated tests: **19 passed** (`python3 -m pytest -q`).
- Python source compilation: passed (`python3 -m compileall -q app tests scripts`).
- Frontend JavaScript syntax: passed (`node --check app/static/app.js`).
- Android project sources, manifest, launcher activity, and bundled static web assets are included.

## APK binary status

**No installable APK was produced in this workspace.** The container has Java 21 but no Android SDK Platform, Android Build Tools, Gradle executable, `aapt2`, D8, or `apksigner`. Outbound DNS/network access needed to fetch official build packages failed during this session. No `.apk` file is included or represented as built.

## To build the APK

On a machine with internet access, install Android Studio with Android SDK Platform 37 and Build Tools 36.0.0, then run `android/build-apk-mac.command` on macOS. The script validates the official Gradle distribution checksum and stops if the required components are missing. Expected output after a successful build:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Still required before a public production launch

The app has a configurable API URL, but a deployed HTTPS EarnRoute backend and PostgreSQL database must be supplied for multi-user live use. Real checkout/marketplace settlements, worker payouts, production business/identity verification, email/phone OTP, secure evidence uploads, and real maps/travel routing are not production-ready in this version. Do not accept real marketplace payments or promise payouts until those provider/legal/operational flows are completed and tested.
