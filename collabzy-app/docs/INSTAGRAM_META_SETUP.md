# Collabzy Instagram Login and Auto DM — production setup

Collabzy supports official Instagram Login, encrypted long-lived token storage, token refresh, profile linking, recent media, account insights and disconnect. The creator app now includes draftable keyword-reply rules and a comment-webhook handler for private replies, but live Auto DM remains locked unless the owner configures Meta permissions and explicitly enables it. Source code cannot create Meta credentials or approve app permissions.

## Instagram Login setup

1. In Meta for Developers, create or select the app that owns Instagram API access with Instagram Login enabled. Add an eligible Instagram professional-account test user while the app is in development mode.
2. Register this exact OAuth redirect URI:

   `https://collabzy-api.onrender.com/api/instagram/callback`

   It must match `META_REDIRECT_URI` byte-for-byte, including HTTPS and path.
3. Start with the least permissions needed:
   - `instagram_business_basic` — professional profile and media.
   - `instagram_business_manage_insights` — authorized account insights.

## Optional Auto DM permissions and webhook

Only request the additional permissions after reviewing the applicable Meta policies and App Review requirements:
- `instagram_business_manage_comments` — read/comment-management workflows that Meta allows for the account.
- `instagram_business_manage_messages` — supported messaging workflows, subject to Meta's eligibility, restrictions and conversation rules.

In Meta for Developers, configure the Instagram webhook object and subscribe to the `comments` field, then set the callback URL to:

`https://collabzy-api.onrender.com/api/instagram/webhook`

Use the same strong, random, private value for the webhook verification token in Meta and Render's `META_WEBHOOK_VERIFY_TOKEN`. The service validates Meta's GET challenge and the POST `X-Hub-Signature-256` HMAC signature. Never publish the verification token or app secret.

In Render → `collabzy-api` → Environment, configure the following server-side values:
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI=https://collabzy-api.onrender.com/api/instagram/callback`
- `META_WEBHOOK_VERIFY_TOKEN` — strong secret, 24+ characters.
- `META_GRAPH_API_VERSION=v26.0` — change only when an API version has been checked for compatibility.
- `META_AUTO_DM_ENABLED=false` initially.

Do not set `META_AUTO_DM_ENABLED=true` until an eligible real professional account has completed OAuth, required permissions are available to the account, webhook verification and comment subscription succeed, test comments have been received, private replies have been checked, duplicate-event handling has been verified, and the operator has approved the feature. Then set the switch to `true` and redeploy. Existing users can save rules as drafts while live sending is locked. The app intentionally rejects an attempt to enable a live rule until the server configuration and Instagram account are ready.

Auto DM is for supported comment-triggered private replies through the official API. It is not a cold-DM sender, bulk spam tool or unrestricted message bot. Meta may restrict delivery based on API permissions, conversation windows, account eligibility and platform policies. A webhook subscription returning success is not proof that every message will be delivered; test with approved accounts and monitor stored event status. Never promise that the automation is live before observing an actual, authorized end-to-end test.

## AI Studio setup

Set `OPENAI_API_KEY` in Render's protected environment to enable live AI Studio generation and AI Growth Coach reports. Optionally set `OPENAI_STUDIO_MODEL` to a supported Responses API model. Never place the API key in the browser, Android bundle, source code, screenshots or chat.

When the key is absent, the AI Studio deliberately returns clearly labelled rule-based starter templates; it must not describe them as live generative AI. Users must accept the in-app AI data-use notice before their submitted brief is processed. Inspect generated content before publishing or sending it. AI cannot guarantee reach, earnings or virality.

## After deployment

1. Save/redeploy Render after configuring required values.
2. Check `GET /api/health`; it exposes boolean-style integration readiness labels only and must not expose credentials.
3. Verify the Instagram callback, token refresh, disconnect, media/insights, webhook challenge and signed test webhook.
4. With Meta-approved permissions and an eligible test account, test a matching comment and confirm that one private reply is sent and duplicate webhook delivery does not send a second reply.
5. Test on a separate eligible account after any required Meta App Review/access-level approvals.

Only Instagram professional accounts covered by the configured Instagram API flow are supported. Missing metrics must not be displayed as real zeros.

## Launch checklist

- [ ] Meta App ID, app secret and exact redirect URI configured in Render.
- [ ] OAuth tested end-to-end using an eligible Instagram professional account.
- [ ] Requested permissions and access level approved for intended users.
- [ ] If Auto DM is advertised as live: webhook verified, comment subscription accepted, and an actual private reply tested.
- [ ] OpenAI API key configured and cost/rate limits reviewed, or starter-template status kept explicit.
- [ ] Email verification, password recovery and monitored support tested.
- [ ] ₹299/year Razorpay checkout, signature verification and webhook tested in test mode before production credentials.
- [ ] Privacy policy, data deletion/contact details, database backups/restore and legal review completed.
- [ ] Android release signed with the stable upload key, and verified on a physical Android device.
- [ ] Public launch explicitly approved only after all launch gates pass.

Public registration requires `PUBLIC_LAUNCH_APPROVED=true` and the configured release dependencies. Keep it false until real Meta, email/support, privacy/legal review, backup restore, paid infrastructure and mobile-device QA have passed. Credentials being present by themselves are not a production sign-off.
