# Production launch configuration

The server intentionally holds public registration closed while required identity, support and account-recovery dependencies are missing. The health endpoint reports safe readiness labels only; it never returns secrets.

## Email verification and password reset

Create a Resend account, verify a sender domain you control, and create an API key with only the permissions needed to send mail. In Render → \`collabzy-api\` → Environment, set:

- \`RESEND_API_KEY\`: private Resend API key
- \`EMAIL_FROM\`: verified sender, for example \`Collabzy <no-reply@your-verified-domain>\`
- \`PUBLIC_APP_URL\`: \`https://collabzy-api.onrender.com\`
- \`REQUIRE_EMAIL_VERIFICATION\`: \`true\`

Registration sends a single-use email verification link (24-hour expiry). Password reset links are single-use and expire after one hour. Password resets invalidate existing JWT sessions. Verification and reset tokens are stored as SHA-256 hashes, not in plaintext. The UI has separate verification and reset pages.

## Monitored support channel

Set \`SUPPORT_EMAIL\` to an inbox monitored by the service operator. The public Support form is rate-limited, stores requests in PostgreSQL and emails the request to this address via Resend. The production privacy/contact requirement is not complete until this mailbox is real, monitored and disclosed in the service operator's public details. Do not set a made-up address.

## Instagram Login

Set the following private server-side values after configuring the Meta developer app:

- \`META_APP_ID\`
- \`META_APP_SECRET\`
- \`META_REDIRECT_URI\` = \`https://collabzy-api.onrender.com/api/instagram/callback\`
- \`REQUIRE_INSTAGRAM_CONFIG\` = \`true\`

Register that exact redirect URI in the Instagram Login settings. Test an actual Creator/Business account and obtain the access level / App Review required for accounts outside app roles. App credentials in environment variables do not, by themselves, mean Meta has approved the use case.

## Opening registration

The \`/api/health\` response exposes \`integrations.email\`, \`integrations.support\`, \`integrations.instagram\`, \`integrations.emailVerification\` and \`integrations.publicRegistration\`. Public registration becomes available only when email delivery, support and (if required) Meta credentials are configured. After saving secrets, redeploy and inspect the health status. The production smoke test checks that registration fails closed when these gates are missing.

## Still required outside source code

- Use paid production hosting/database tiers with an agreed uptime target; the current Render/Neon plans are free tier and are not suitable for a public reliability commitment.
- Configure and verify database backups with a restore drill.
- Configure a stable Android upload keystore in protected build secrets, then run physical-device QA.
- Complete Meta review, Play Console data-safety disclosures, store listing, required closed testing / production access, and review.
- Confirm the operator's legal name, jurisdiction, privacy contact and terms with a qualified adviser before commercial launch.
