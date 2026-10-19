'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const adminHtml = fs.readFileSync(path.join(root, 'public', 'admin', 'index.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'src', 'server-postgres.js'), 'utf8');

test('owner admin dashboard is responsive, real-data-only and JavaScript parses', () => {
  const scripts = [...adminHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'admin dashboard should use one self-contained client script');
  assert.doesNotThrow(() => new vm.Script(scripts[0][1], { filename: 'collabzy-admin.js' }));
  assert.match(adminHtml, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(adminHtml, /Control center/);
  for (const view of ['overview', 'users', 'campaigns', 'support', 'readiness']) {
    assert.ok(adminHtml.includes('data-view="' + view + '"'), 'missing ' + view + ' admin section');
  }
  assert.match(adminHtml, /sessionStorage\.setItem\('collabzy_admin_token'/);
  assert.match(adminHtml, /id="setup-form"/);
  assert.match(adminHtml, /Create owner account/);
  assert.match(adminHtml, /api\('\/setup-status'\)/);
  assert.match(adminHtml, /No sample data is shown/);
  assert.match(adminHtml, /data-create-campaign/);
  assert.match(adminHtml, /Create campaign ad/);
  assert.match(adminHtml, /campaign-create-form/);
  assert.match(adminHtml, /Collabzy Official/);
  assert.match(adminHtml, /Owner publisher/);
  assert.doesNotMatch(adminHtml, /COLLABZY_ADMIN_PASSWORD_HASH|process\.env|RAZORPAY_KEY_SECRET|OPENAI_API_KEY/);
});

test('admin API is owner-only, short-lived, rate-limited and audits moderation', () => {
  assert.match(backend, /COLLABZY_ADMIN_EMAIL/);
  assert.match(backend, /COLLABZY_ADMIN_PASSWORD_HASH/);
  assert.match(backend, /COLLABZY_ADMIN_BOOTSTRAP_TOKEN/);
  assert.match(backend, /bcrypt\.compare\(password,credentials\.password_hash\)/);
  assert.match(backend, /app\.post\('\/api\/admin\/bootstrap',adminSetupLimiter/);
  assert.match(backend, /ON CONFLICT\(id\) DO NOTHING RETURNING email/);
  assert.match(backend, /password\.length<14\|\|Buffer\.byteLength\(password,'utf8'\)>72/);
  assert.match(backend, /expiresIn:'2h',issuer:'collabzy-api'/);
  assert.match(backend, /adminLoginLimiter/);
  assert.match(backend, /jwt\.verify\(raw,SECRET,\{issuer:'collabzy-api'\}\)/);
  assert.match(backend, /app\.get\('\/api\/admin\/overview',adminAuth/);
  assert.match(backend, /app\.get\('\/api\/admin\/users',adminAuth/);
  assert.match(backend, /app\.get\('\/api\/admin\/campaigns',adminAuth/);
  assert.match(backend, /app\.get\('\/api\/admin\/support',adminAuth/);
  assert.match(backend, /admin_audit_log/);
  assert.ok(backend.includes("app.get('/api/admin/brand-options',adminAuth"));
  assert.ok(backend.includes("app.post('/api/admin/campaigns',adminAuth"));
  assert.ok(backend.includes("publish_campaign"));
  assert.match(backend, /session_version=session_version\+1/);
  assert.match(backend, /account_status==='suspended'/);
});
