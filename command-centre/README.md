AA Growth Command Centre — free Render deployment

This app is deployed separately from the public AA Growth website and CMS API. It proxies approved read-only/admin operations to the existing CMS API over HTTPS. Draft campaign and content plans are stored in the browser only. No ad account is activated and no spending action is performed.

Render build: node --check command-centre/server.js
Render start: node command-centre/server.js
Plan: Free
Region: Singapore

Free-tier notes: Render free web services sleep after 15 minutes without inbound traffic and may take about one minute to wake. Browser-only drafts are not synced across devices. Website enquiries and traffic analytics are read from the existing CMS API.
