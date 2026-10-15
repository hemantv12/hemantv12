# Collabzy Instagram Login — production setup

The app already implements the server-side Instagram Login flow, encrypted long-lived token storage, token refresh, profile linking, recent media, account insights and disconnect. Real authorization must be enabled in the owner's Meta developer account; app code cannot create or approve those credentials.

## Exact configuration

1. In Meta for Developers, create or select the app that owns the Instagram API with Instagram Login product. Add the Instagram professional-account test user as an app tester while the app is in development mode.
2. In Instagram Login's OAuth redirect configuration, register this **exact** URI:

   \`https://collabzy-api.onrender.com/api/instagram/callback\`

   It must match \`META_REDIRECT_URI\` byte-for-byte (including HTTPS, path, and trailing-slash behavior). The Meta redirect is the server URL, not the Android deep link.
3. Request the least permissions needed for the current feature set:
   - \`instagram_business_basic\` — professional profile and media
   - \`instagram_business_manage_insights\` — authorized account insights

4. In Render → \`collabzy-api\` → Environment, configure these server-side environment variables:
   - \`META_APP_ID\` — the Instagram/Meta app ID
   - \`META_APP_SECRET\` — the app secret; keep it private
   - \`META_REDIRECT_URI\` — \`https://collabzy-api.onrender.com/api/instagram/callback\`

   Save/redeploy the service. Do not place the app secret in Android source, a browser, GitHub commits, screenshots, or chat messages.
5. After deploy, \`GET /api/health\` reports only \`integrations.instagram = configured\` or \`setup_required\`; it never returns credentials. The authenticated \`GET /api/instagram/status\` also reports setup readiness.
6. Sign in to Collabzy with a creator account, open Instagram Insights, and select **Continue with Instagram**. Approve the requested access in Meta's authorization page. On success, verify the handle, recent media and any metrics returned by Instagram.
7. Test token refresh and disconnect, then test with a separate eligible account after required Meta App Review / access-level approvals. Only Instagram Creator and Business accounts are supported by this API; personal consumer accounts are not.

## Current product boundary

The current integration reads authorized profile/media/insights; it does not yet auto-publish posts, manage DMs/comments, run paid campaigns, or guarantee metric availability. Those require separate scopes, product implementation, Meta approval, and account-level eligibility. Do not show unavailable metrics as zero; a missing metric means Meta did not return it.

## Release checklist

- [ ] Meta App ID, App Secret and exact redirect URI configured in Render.
- [ ] OAuth tested end-to-end using an actual eligible Instagram professional account.
- [ ] Required permissions submitted/approved for users outside the app's developer/test roles.
- [ ] Android release signed with the stable upload key, and verified on a physical Android device.
- [ ] Privacy policy, data deletion/contact details, and Play Console release completed.


Public registration also requires `PUBLIC_LAUNCH_APPROVED=true`. Keep this false until real Instagram, email/support, privacy/legal review, backup restoration, paid infrastructure and mobile-device QA have passed. It is intentionally not auto-enabled merely because environment variable names have values.
