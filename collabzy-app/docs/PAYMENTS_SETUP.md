# Collabzy Payments — ₹299/year

This guide prepares and validates the **one-time annual Creator Pro payment**. Creator Pro is currently a one-time ₹299 INR purchase that grants 365 days of access; automatic renewal is not implemented, so creators must purchase again when the term ends.

## What is already implemented

- The backend creates a server-side Razorpay Order for exactly INR 299 (29900 paise).
- The Android app opens Razorpay Checkout using the server-created Order ID.
- The backend verifies the Checkout HMAC signature, then fetches the payment from Razorpay and activates Pro only when the order, account, amount, currency and captured status all match.
- The signed webhook supports `payment.captured`, `order.paid`, `payment.failed` and full `payment.refunded` events.
- Checkout and subscription access fail closed when required payment configuration is missing. Do not add any client-side or database shortcut to mark an unpaid account as paid.

## 1. Create / activate the merchant account

Use the official Razorpay dashboard: https://dashboard.razorpay.com/

Complete the merchant/business onboarding and bank/KYC checks requested by Razorpay. Live payments cannot be enabled before Razorpay has approved the merchant account. Start in **Test Mode** while developing.

Official documentation:
- Generate API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
- Android Checkout: https://razorpay.com/docs/payments/payment-gateway/android-integration/standard/build-integration-android/
- Webhooks: https://razorpay.com/docs/webhooks/

## 2. Configure Test Mode API keys in Render

Open the Render service `collabzy-api` → Environment. Add the **Test Mode** values from Razorpay Dashboard:

- `RAZORPAY_KEY_ID` — test Key ID, normally prefixed `rzp_test_`
- `RAZORPAY_KEY_SECRET` — matching test Key Secret

Keep both values in Render's protected environment only. Never add the Key Secret to Android source, public JavaScript, GitHub, logs, or a user-facing screen. The Android app only receives the public Key ID from the server after a signed-in account asks to create a payment order.

The server-side `RAZORPAY_WEBHOOK_SECRET` is also configured in Render. In the Razorpay webhook configuration, use the exact matching secret supplied separately by the deployment owner; do not use the Razorpay API Key Secret in its place. If you rotate the webhook secret, update both Razorpay and Render.

Saving Render variables triggers a backend deploy automatically.

## 3. Add the webhook in Razorpay Test Mode

Set the webhook URL to:

`https://collabzy-api.onrender.com/api/billing/webhook`

Subscribe to these events:
- `payment.captured`
- `order.paid`
- `payment.failed`
- `payment.refunded`

Use the same webhook secret as `RAZORPAY_WEBHOOK_SECRET` in Render. Razorpay signs the raw request body; the server validates `X-Razorpay-Signature` before changing a subscription.

## 4. Test the complete flow

After the Render deploy is live:

1. Open the Android app and register/sign in with a private-beta creator account.
2. Open **Plan & billing** and verify the ₹299/year amount.
3. Use Razorpay's Test Mode payment instruments shown in its official documentation. Test payments do not move real money.
4. Confirm the app reports payment success only after the backend verifies the signed response and Razorpay reports the payment as captured.
5. Check the billing screen again; it should show Pro active and an expiry date 365 days from the activation.
6. Also test cancellation/failure, a malformed signature, a non-INR / wrong-amount payment, webhook delivery, and a repeated webhook. None of these should grant extra access or duplicate the term.

Readiness endpoints:
- `GET https://collabzy-api.onrender.com/api/health` — `integrations.payments` should report `configured`
- `GET https://collabzy-api.onrender.com/api/public-config` — `paymentsReady` should be `true`
- `GET /api/billing/status` with a signed-in user's Bearer token — `checkout_ready` should be `true`

Do not test by manually changing a user's subscription row. Use successful captured test payments through Checkout.

## 5. Go live

Only after Test Mode passes, switch Razorpay to Live Mode and complete merchant approval. Replace the Render values with the **Live** Key ID and matching Live Key Secret. Configure a Live Mode webhook at the same URL and keep its configured secret matched to Render. Re-test with a controlled real payment only when you are ready for a real ₹299 transaction.

Before public sales, also complete email verification/account recovery, support contact, operator/legal details, privacy/terms review, refund handling, backups and release signing. Keep `PUBLIC_LAUNCH_APPROVED=false` until those checks are complete.

## Current external blocker

The code cannot create merchant credentials on the owner's behalf. The merchant owner must sign in to Razorpay, complete their account onboarding, and provide the generated Test/Live Key ID and Key Secret through Render's protected environment settings. Never send the Key Secret in chat or put it in GitHub.