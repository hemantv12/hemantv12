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
| 5 | Render | Two live Render web services currently exist: https://earnroute-nearby-api.onrender.com and https://earnroute-api.onrender.com, both tracking earnroute-production. Treat as a duplicate until the actual Android/server URL use is verified; do not delete either blindly. Root Render Blueprint now requires Neon DATABASE_URL instead of provisioning a second Render PostgreSQL database. |
| 6 | Neon PostgreSQL | PostgreSQL 16 project earnroute-production, production branch, database earnroute and application/support tables confirmed. Private earnroute-backups bucket and one manual baseline snapshot exist. Neon's API reports automatic snapshot scheduling is not enabled on this project, so daily encrypted backups must be verified through the GitHub Actions workflow. |
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
| 32 | GitHub Actions | APK/test build and live API smoke workflows exist. Added CodeQL for Python/JavaScript/Actions, pip-audit and API/frontend regression checks, plus weekly Dependabot updates for Python, Gradle, Docker and Actions. Signed APK/AAB release workflow exists but requires owner-managed signing secrets. Verify new security workflow run results in Actions. |
| 33 | Docker | Production API uses Docker; a separate backup Dockerfile is included. Script can install Docker Desktop. |
| 34 | Error Monitoring Tool | Sentry SDK integration is wired but remains disabled until SENTRY_DSN is configured. |
| 35 | Analytics Tool | Not connected. Choose a provider and review privacy/consent before enabling client analytics. |
| 36 | Database Backup System | Backup container and scheduled GitHub Actions workflow are present; however, daily backup is NOT yet verified/running until four owner-managed Actions secrets are set and a manual workflow run succeeds. Neon automatic snapshots cannot be enabled via the current project API; an earlier manual snapshot exists. Off-site copy is in the same Neon provider/region. |
| 37 | Security Testing Tools | CodeQL and Python dependency audit workflow are included; scans are not a third-party security audit. |
| 38 | Automated Testing Framework | Pytest API/business-rule tests and JavaScript syntax checks run in CI. |
| 39 | APK/AAB Signing Key | No production keystore is committed. Signed-release workflow expects owner-managed GitHub Actions secrets. Keep an offline backup. |
| 40 | Push Notification Service | Not connected. FCM requires Firebase app configuration and sender credentials. |
| 41 | Environment Variables & Secrets | Local .env.example template added; live credentials remain in hosting secret storage. |
| 42 | Privacy Policy | Existing public privacy page exists; provider/data-flow review remains before launch. |
| 43 | Terms & Conditions | Existing terms page exists; obtain appropriate professional review before public marketplace launch. |
| 44 | Customer Support System | In-app support-ticket creation, threaded replies, admin queue and status updates are implemented. Email/ticketing-provider delivery and staffed support hours still need an owner mailbox/provider. |

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

## Daily encrypted backup configuration

The workflow `.github/workflows/earnroute-backup.yml` is scheduled for 20:30 UTC (02:00 Asia/Kolkata); GitHub-hosted runners avoid creating a separate paid Render Cron service. The workflow is not operational until its secrets exist. In GitHub repository Settings → Secrets and variables → Actions, add:

- `EARNROUTE_DATABASE_URL`: SSL-enabled Neon connection string to the `earnroute` database using a role that can read all app tables.
- `NEON_STORAGE_ACCESS_KEY_ID`: token ID from a fresh Neon production-branch credential with `storage:read` and `storage:write`.
- `NEON_STORAGE_SECRET_ACCESS_KEY`: secret for that credential; copy it when first shown and never commit it.
- `EARNROUTE_BACKUP_PASSPHRASE`: a password-manager-generated secret of 32+ characters. Preserve an offline recovery copy; losing it makes encrypted backups unreadable.

The workflow uses private bucket `earnroute-backups`, endpoint `https://br-snowy-paper-b3u8r564.storage.c-4.ap-southeast-1.aws.neon.tech`, region `ap-southeast-1`, and 14-day retention. After adding secrets, manually run the workflow once and confirm the upload, re-download, decryption, archive and checksum verification succeeds before relying on the schedule. Do not use any credential that was revoked. The bucket is in the same Neon project and region; configure a second-provider copy before treating it as disaster-proof backup and rehearse restore to a non-production database. A manual baseline snapshot exists, but Neon automatic snapshot scheduling is unavailable for this project via the current API.

## External accounts that cannot be fabricated

Real checkout/payouts, email delivery, OTP, push notifications, analytics and a custom domain must use the owner's approved provider accounts, secrets and settings. A placeholder key never turns an incomplete workflow into a successful payment, identity check, email or payout.
