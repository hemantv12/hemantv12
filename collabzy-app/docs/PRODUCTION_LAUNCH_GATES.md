# Production launch configuration

The server intentionally holds public registration closed while required identity, support and account-recovery dependencies are missing. The health endpoint reports safe readiness labels only; it never returns secrets.

## Email verification and password reset

Create a Resend account, verify a sender domain you control, and create an API key with only the permissions needed to send mail. In Render → \`collabzy-api\` → Environment, set:

- \`RESEND_API_KEY\`: private Resend API key
- \`EMAIL_FROM\`: verified sender, for example \`Collabzy <no-reply@your-verified-domain>\`
- \`PUBLIC_APP_URL\`: \`https://collabzy-api.onrender.com\`
- \`REQUIRE_EMAIL_VERIFICATION\`: \`true\`

Registration sends a single-use email verification link (24-hour expiry). Password reset links are single-use and expire after one hour. Password resets invalidate existing JWT sessions. Verification and reset tokens are stored as SHA-256 hashes, not in plaintext. The UI has separate verification and reset pages.

## AI Growth Coach

Set `OPENAI_API_KEY` in Render's protected environment. Optionally set `OPENAI_ANALYTICS_MODEL` (default `gpt-5-mini`). A report is generated only after a connected Instagram account owner explicitly confirms the AI data-use notice, and only while that user has an active Pro subscription. The backend sends selected account metrics and recent caption text to OpenAI; it does not send Instagram tokens or passwords. Without the key or consent, the AI endpoint fails closed.

## ₹299/year Pro subscription

The annual plan is `creator_annual_299`, ₹299 (29,900 paise) for 365 days. In Render's protected environment, configure all three values from the owner's Razorpay merchant account:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Set the Razorpay webhook URL to `https://collabzy-api.onrender.com/api/billing/webhook`. Configure the `payment.captured`, `order.paid` and `payment.failed` events. Use test-mode keys first. The backend creates an INR order, checks the checkout signature, independently retrieves the payment from Razorpay and only marks the account paid after a captured ₹299 payment. Test successful, cancelled, failed, duplicate-webhook and refund scenarios before live mode. No checkout is available until real provider credentials are configured.

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

The \`/api/health\` response exposes \`integrations.email\`, \`integrations.support\`, \`integrations.instagram\`, \`integrations.emailVerification\` and \`integrations.publicRegistration\`. Public registration becomes available only when email delivery, support, legal operator details, OpenAI AI analytics, Razorpay checkout and webhook verification, and (if required) Meta credentials are configured. After saving secrets, redeploy and inspect the health status. Do not open registration until the provider readiness flags show `configured`, the `publicLaunchApproval` flag is deliberately approved, and the owner has signed off on every non-code item. The production smoke test checks that registration fails closed when these gates are missing.

## Still required outside source code

- Use paid production hosting/database tiers with an agreed uptime target; the current Render/Neon plans are free tier and are not suitable for a public reliability commitment.
- Configure and verify database backups with a restore drill.
- Configure a stable Android upload keystore in protected build secrets, then run physical-device QA.
- Complete Meta review, Play Console data-safety disclosures, store listing, required closed testing / production access, and review.
- Add and test `OPENAI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`; no AI or payment status should be simulated if a provider is unconfigured.
- Confirm the operator's legal name, jurisdiction, privacy contact and terms with a qualified adviser before commercial launch.


Public registration also requires `OPERATOR_LEGAL_NAME` and `OPERATOR_JURISDICTION`. The service displays these fields in its privacy notice and terms. Do not invent an entity name or jurisdiction; the owner must supply accurate public details.
