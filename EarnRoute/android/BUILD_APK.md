# EarnRoute Android APK build

This folder contains an Android WebView app that bundles the real EarnRoute frontend and uses the same API. It is not a fake store/demo APK: the server URL is explicitly configured in the app because a mobile APK cannot replace the shared backend/database.

## Build on a machine with Android SDK

1. Install Android Studio and a JDK 17 or newer.
2. In Android Studio → SDK Manager, install **Android SDK Platform 37** and **Android SDK Build-Tools 36.0.0**.
3. Run `./sync-assets.sh` (the Mac build script does this automatically) so Android always packages the newest frontend files.
4. On your Mac, double-click `build-apk-mac.command`. It verifies the Android SDK components, downloads Gradle 9.8.1 from the official distribution host, verifies the published SHA-256 checksum, and builds the debug APK. The script stops with a specific error if a prerequisite or network download is missing.
5. The expected debug APK output is `app/build/outputs/apk/debug/app-debug.apk`. It targets Android API 36 and supports Android 7.0+ (minimum API 24).

This workspace did not have Android SDK, Gradle, AAPT, D8 or apksigner installed, and outbound DNS/network access to Google's Android package host was unavailable. Therefore the APK binary could not be built/verified in this environment. No fake `.apk` file is included.

## Connect the backend

1. Deploy the EarnRoute FastAPI service and PostgreSQL database using the main README.
2. The packaged Android client defaults to `https://earnroute-api.onrender.com`; the in-app Connect server control remains available for overrides. On the backend, set `CORS_ORIGINS=https://appassets.androidplatform.net` plus any web origins you use, then restart the service. Keep the API URL on HTTPS; HTTP and mixed-content traffic are intentionally blocked.
3. Install the APK, tap **Connect server**, enter the deployed HTTPS base URL (for example `https://api.your-domain.example`), and save.
4. Confirm the API health endpoint is reachable and test worker/business flows with test accounts before real launch.

Real payments/payouts and email/phone verification are not production-ready in this release; do not accept real marketplace payments or promise payouts yet.
