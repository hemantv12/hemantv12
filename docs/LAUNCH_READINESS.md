# EarnRoute launch-readiness checklist

Snapshot date: 19 October 2026  
Status: updated release candidate, not an approval for public production launch. The checklist distinguishes implemented application controls from external/operator actions still needed.

## Implemented in the current codebase

- [x] Worker/business/admin access is validated server-side on protected API routes; self-registration cannot create administrator access.
- [x] Nearby search supports 1 km, 3 km, 5 km, 8 km, 10 km and 15 km choices; nearby results use published workplace coordinates and straight-line distance.
- [x] GPS-denied/unavailable users can choose a search point manually. City-centre fallback is marked approximate. Search points are temporary in device session storage for up to 30 minutes; there is no continuous background worker tracking.
- [x] Saved shifts, applications, offers, assignments, schedule conflict checks, support tickets, disputes, reviews, notifications and audit events have code paths and regression coverage.
- [x] A signed-in user can request a JSON export of their own account data. Password hashes and session tokens are excluded; activity sections are capped and truncation is reported.
- [x] New sign-ups record the exact draft Terms/Privacy revision identifiers accepted into the audit history. Older registrations are not backdated to a revision they never accepted.
- [x] Access-help, correction and deletion requests create private, admin-notified support tickets. They do not automatically erase the account or records.
- [x] Android includes a native document-picker bridge for saving a user-requested JSON export without requesting broad file-storage permissions.
- [x] Automated API/source/packaging checks, dependency/security workflows and a live API smoke workflow are present.

## Required before public launch

- [ ] Responsible operator and monitored contact: replace support@earnroute.example and placeholder entity wording with the actual legal entity/operator and a monitored support/privacy contact. Assign an incident and complaint owner.
- [ ] Legal/privacy review: Terms and Privacy remain drafts. Finalise purposes, lawful basis/consent wording, retention, grievance response, rights requests and breach response with qualified Indian counsel. MeitY's DPDP Rules 2025 use phased commencement; verify the exact sections and deadlines applicable to the operating entity rather than treating this note as legal advice.
- [ ] Privacy-request operations: the app records private access/correction/deletion tickets, but deletion is intentionally not automatic. Assign an accountable operator, response SLA, verification procedure, retention exceptions and auditable fulfilment/closure process.
- [ ] Policy-version management: update the hardcoded draft revision identifiers whenever counsel-approved notices change; do not describe draft-policy acceptance as legal compliance.
- [ ] Email verification: the user model has an email_verified state but an end-to-end email verification/delivery provider has not been verified. Do not present an email as verified until the actual flow succeeds.
- [ ] SMS/OTP/push delivery: no configured SMS/OTP/push provider has been verified end-to-end. In-app database notifications are not proof of an SMS, email or push being delivered.
- [ ] Payments and payouts: no production payment/payout provider flow has been verified end-to-end. Keep recorded completion, pending settlement and provider-confirmed payment as distinct states.
- [ ] Business verification operations: the admin queue supports human review, but the operator must define required evidence and anti-fraud steps. The current profile screen does not support private identity-document uploads.
- [ ] Maps at scale: the public OpenStreetMap raster tile service is best-effort with no SLA. Choose a provider or self-hosted stack whose usage terms and capacity support expected commercial traffic.
- [ ] Backups and recovery: the repository's encrypted PostgreSQL backup workflow requires owner-managed GitHub Actions secrets. Run it manually, verify encrypted archive integrity and perform a tested restore before depending on scheduled backups.
- [ ] Production Android signing: unless release signing environment variables and a valid owner-managed keystore are configured, the deliverable is a debug build. Configure signing securely, verify the signed APK/AAB, test upgrades and never commit signing secrets.
- [ ] Physical-device QA: validate registration/login, header/footers, keyboard/insets, location permission denied, manual area selection, map fallback, language switching, export and privacy requests on more than one screen size and both Android navigation modes. Automated tests are not physical-device visual QA.
- [ ] Monitoring and rollback: configure an incident owner, error monitoring, backup alerts, logs and rollback instructions; verify database migration status and deployed API behaviour after each release.
- [ ] AI integrations: matching is deterministic today. Do not advertise live AI until an external provider, server-side credentials, appropriate data boundaries, cost controls, failure fallback and tests are configured.

## Owner actions that cannot safely be invented in code

1. Supply the actual responsible entity/operator and a monitored support/privacy email address.
2. Approve final Terms/Privacy notices and a retention/request-handling procedure after legal review.
3. Configure missing provider credentials and backup/signing secrets in the provider's secure settings, never in source code or chat.
4. Arrange physical-device QA and production-signed Android release validation.
