# Instagram Login Setup for Collabzy

This guide configures official Instagram Login for Collabzy. It does not scrape Instagram and must never be presented as active until the callback works with a real eligible account.

## 1. Requirements

- A Meta Developer account with access to create/manage an app.
- An Instagram **Creator or Business** professional account for testing. Personal/consumer accounts are not supported by this insights flow.
- A Meta app configured for Instagram API with Instagram Login.
- Appropriate permissions. Collabzy requests:
  - `instagram_business_basic`
  - `instagram_business_manage_insights`

Meta may require Advanced Access, App Review, business verification, and further review steps before unrelated creators (not app-role testers) can connect. Start with your own eligible test account.

## 2. Configure the Meta app

1. Open the Meta for Developers App Dashboard and create/select your app.
2. Add/configure Instagram API with Instagram Login (Business Login for Instagram).
3. In the Business Login settings, configure the redirect/valid OAuth redirect URI as exactly:

   `https://collabzy-api.onrender.com/api/instagram/callback`

4. Configure the requested scopes and add your test Instagram account as an app tester where the dashboard requires it.
5. Keep the App ID and App Secret private. Never put the secret in the frontend, GitHub, a screenshot, or a chat message.

## 3. Configure Render

In the Render dashboard, open the `collabzy-api` service → Environment and set:

- `META_APP_ID`: the Meta app's App ID
- `META_APP_SECRET`: the Meta app's App Secret
- `META_REDIRECT_URI`: `https://collabzy-api.onrender.com/api/instagram/callback`

Save changes and wait for the deployment to complete successfully. The service uses the exact redirect URI above. Keep `JWT_SECRET` stable: the server derives the encryption key for stored Instagram tokens from it. Rotating it without a token migration makes previously encrypted tokens unreadable.

## 4. End-to-end verification

1. Register/sign in to Collabzy with a Creator account.
2. Open **Instagram** and choose **Connect / refresh Instagram**.
3. Authorize using the eligible professional Instagram account and accept the requested permissions.
4. Verify the browser returns to Collabzy with a connection success result.
5. Refresh the Instagram panel. Verify the connected username, actual insights and recent media appear.
6. Use **Disconnect** and verify stored access credentials are removed.
7. Test invalid/revoked tokens and missing permissions; the app should show a meaningful error and should not display fabricated metrics.

## 5. Troubleshooting

- **Setup required:** `META_APP_ID` or `META_APP_SECRET` is missing in Render.
- **Redirect mismatch:** the redirect URI differs by scheme, path, trailing slash, or hostname between Render and the Meta dashboard.
- **App-role/tester error:** add the test account in the Meta app roles/tester flow, or request the required access for public users.
- **Insights unavailable:** confirm the Instagram account is professional, the account granted `instagram_business_manage_insights`, and the app has the appropriate access level.
- **Connection fails after secret rotation:** token encryption key changed; reconnect accounts or perform an explicit token migration before rotation.

Instagram account insights and available media/metrics are controlled by Meta and may vary by account eligibility and permission approval. A working OAuth URL alone does not mean public access has been approved.
