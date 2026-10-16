# EarnRoute owner setup — 44-item readiness checklist

Updated 16 October 2026. This reflects the repository and connected hosting/database configuration, not an assumption that every provider is active.

**Important:** the released Android project is currently a native Java WebView shell around the existing HTML/CSS/JavaScript frontend. FastAPI is the live backend. Installing Flutter/Dart does not automatically convert the released app into a full Flutter implementation; that is a separate code migration and device QA task.

## Readiness status

| # | Item | Status / next action |
|---:|---|---|
| 1 | Frontend | Responsive HTML/CSS/JavaScript frontend; native mobile shell present. Full Flutter re-platform is not complete. |
| 2 | Backend | FastAPI deployed on Render; health endpoint checks database connectivity. |
| 3 | Admin Dashboard | Admin workflows cover business verification, job moderation, disputes, audit history and metrics. |
| 4 | GitHub | Source branch earnroute-production. |
| 5 | Render | earnroute-nearby-api live at https://earnroute-nearby-api.onrender.com. |
| 6 | Neon PostgreSQL | Database earnroute on project earnroute-production, branch production. Credentials remain private. |
| 7 | Flutter SDK | Mac installer included; local install must be run by owner. |
| 8 | Dart SDK | Bundled with Flutter; installer checks Dart version. |
| 9 | Android Studio | Installer installs the app; first-run wizard and emulator/device setup are local actions. |
| 10 | Flutter & Dart Plugins | Android Studio > Settings > Plugins > Marketplace > Flutter; accept the Dart plugin prompt. |
| 11 | Android SDK | Android Studio SDK Manager; script attempts package installation if command-line tools exist. |
| 12 | Android Build Tools | CI uses Android SDK Platform 36 and Build-Tools 36.0.0. |
| 13 | Java JDK | CI uses JDK 17; installer installs OpenJDK 17. |
| 14 | Gradle | CI uses Gradle 9.8.1; local setup installs Gradle. |
| 15 | Git | Source control; local installer verifies it. |
| 16 | Node.js | Used for frontend syntax checks; installer installs Node. |
| 17 | npm | Bundled with Node; installer verifies its version. |
| 18 | Backend Framework | FastAPI. |
| 19 | REST API | Existing API covers authentication, jobs, nearby discovery, applications, assignments, earnings and admin workflows. |
| 20 | API Testing Tool | Pytest and live API smoke tests are in CI; a Postman collection template is included. |
| 21 | PostgreSQL Client | Backup image uses PostgreSQL 16 pg_dump/pg_restore; local client tools are installed by script. |
| 22 | Firebase | Not linked to a Firebase project. Owner project/configuration is required before enabling Firebase features. |
| 23 | Google Maps Platform | Basic destination links work. Maps API key, geocoding, road routing and traffic ETA are not configured. |
| 24 | Payment Gateway | Razorpay checkout is not integrated; current webhook handler only validates/records events if configured. |
| 25 | Payout Provider | Worker payouts, refunds and marketplace settlement are not connected. Razorpay Route approval/linked accounts may be required. |
| 26 | Email Service | Not connected. Resend account, sender/domain verification and credentials remain required. |
| 27 | OTP/SMS Service | Not connected. Twilio Verify or another chosen provider needs an owner account and credentials. |
| 28 | AI API | Matching currently uses deterministic rules. Optional AI features are not connected; no AI key is fabricated. |
| 29 | Domain Name | No custom domain supplied; Render subdomain is working. |
| 30 | SSL Certificate | Render HTTPS works on the provided subdomain; custom-domain certificate follows domain setup/validation. |
| 31 | Google Play Console | Owner must create/verify the publisher account and complete Play account registration. |
| 32 | GitHub Actions | Test/build and live API smoke workflows exist; security/dependency scans and a signed-release workflow are being added. |
| 33 | Docker | Production API uses Docker; a separate backup Dockerfile is included. Script can install Docker Desktop. |
| 34 | Error Monitoring Tool | Sentry SDK integration is wired but remains disabled until SENTRY_DSN is configured. |
| 35 | Analytics Tool | Not connected. Choose a provider and review privacy/consent before enabling client analytics. |
| 36 | Database Backup System | Baseline Neon snapshot exists, private bucket created and backup-container source included. Scheduled Render Cron Job is not active; owner must add database/storage secrets in Render and verify a successful run before relying on automatic backups. |
| 37 | Security Testing Tools | CodeQL and Python dependency audit workflow are included; scans are not a third-party security audit. |
| 38 | Automated Testing Framework | Pytest API/business-rule tests and JavaScript syntax checks run in CI. |
| 39 | APK/AAB Signing Key | No production keystore is committed. Signed-release workflow expects owner-managed GitHub Actions secrets. Keep an offline backup. |
| 40 | Push Notification Service | Not connected. FCM requires Firebase app configuration and sender credentials. |
| 41 | Environment Variables & Secrets | Local .env.example template added; live credentials remain in hosting secret storage. |
| 42 | Privacy Policy | Existing public privacy page exists; provider/data-flow review remains before launch. |
| 43 | Terms & Conditions | Existing terms page exists; obtain appropriate professional review before public marketplace launch. |
| 44 | Customer Support System | Admin dispute tools exist but staffed ticket/email support is not live. Replace support@earnroute.example after establishing a real support mailbox/ticketing account. |

## Mac developer setup

From the repository's EarnRoute folder, run the developer-toolchain script:

    bash SETUP_DEVELOPER_TOOLS_MAC.command

Homebrew installs Flutter (bundled Dart), Android Studio, Docker Desktop, Postman, Git, Node/npm, Java 17, Gradle and PostgreSQL 16 client tools. Review installer prompts. This script cannot run remotely against your Mac from this chat.

After Android Studio's first-run wizard, install the Flutter plugin under Settings > Plugins. Then run:

    flutter doctor -v
    flutter doctor --android-licenses
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env

Edit .env locally and replace the development JWT placeholder with a unique random value. Never upload .env to GitHub or paste production credentials into chat.

## GitHub release signing

Before running the signed-release workflow, add these repository Actions secrets under Settings > Secrets and variables > Actions:

- ANDROID_KEYSTORE_BASE64: base64-encoded keystore file.
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

Do not commit the keystore. Keep an encrypted offline backup; losing the key can block app updates. The release workflow deliberately fails if any secret is missing.

## Scheduled backup configuration

The intended schedule is daily at 20:30 UTC (02:00 Asia/Kolkata), but the Render Cron Job is not active yet. It uses PostgreSQL custom-format dumps, GPG/AES-256 encryption, a private storage bucket, verifies the downloaded copy with pg_restore --list, and prunes old objects under its dedicated prefix. Retention is 14 days, and at least the newest backup is kept. The encryption passphrase must stay outside the bucket and be recorded securely by the owner.

This bucket is in the same Neon project and region; configure a second-provider copy before treating this as disaster-proof off-site backup. Verify successful scheduled execution in Render logs and rehearse restore to a non-production database.

## External accounts that cannot be fabricated

Real checkout/payouts, email delivery, OTP, push notifications, analytics and a custom domain must use the owner's approved provider accounts, secrets and settings. A placeholder key never turns an incomplete workflow into a successful payment, identity check, email or payout.
