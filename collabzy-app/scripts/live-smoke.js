const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const base = (process.env.COLLABZY_BASE_URL || 'https://collabzy-api.onrender.com').replace(/\/+$/, '');
const expectedVersion = process.env.COLLABZY_EXPECTED_VERSION || '2.2.1';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, { method = 'GET', token = '', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const raw = await response.text();
  let json = {};
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw: raw.slice(0, 300) }; }
  return { response, json };
}

async function expectStatus(path, options, status, why) {
  const result = await request(path, options);
  assert.equal(result.response.status, status, why + ': expected HTTP ' + status + ', got ' + result.response.status + ' (' + String(result.json.error || result.json.message || '').slice(0, 180) + ')');
  return result.json;
}

async function waitForDeployment() {
  const deadline = Date.now() + 5 * 60 * 1000;
  let last = 'no health response';
  while (Date.now() < deadline) {
    try {
      const { response, json } = await request('/api/health');
      last = 'HTTP ' + response.status + ', version=' + (json.version || 'unknown');
      if (response.ok && json.ok === true && json.database === 'connected' && json.version === expectedVersion && ['instagram','email','support','operatorIdentity','publicRegistration','emailVerification','payments'].every(key => typeof json.integrations?.[key] === 'string')) {
        assert.equal(json.mode, 'postgres-persistent', 'production API must use persistent PostgreSQL');
        return json;
      }
    } catch (error) {
      last = error.message;
    }
    await pause(8000);
  }
  throw new Error('Expected live deployment version ' + expectedVersion + ' did not become healthy within 5 minutes. Last result: ' + last);
}

(async () => {
  let creator = null;
  let brand = null;
  const random = crypto.randomBytes(8).toString('hex');
  const password = 'CsSmoke-' + crypto.randomBytes(18).toString('hex') + '!9';
  const creatorEmail = 'collabzy.creator.' + random + '@example.com';
  const brandEmail = 'collabzy.brand.' + random + '@example.com';
  const run = { checks: [], startedAt: new Date().toISOString() };
  const check = name => run.checks.push(name);

  try {
    const health = await waitForDeployment();
    check('live API health + persistent PostgreSQL');
    for (const name of ['instagram','email','support','operatorIdentity','publicRegistration','emailVerification']) {
      assert.ok(typeof health.integrations?.[name] === 'string', 'health should expose safe ' + name + ' readiness');
    }
    const pages = ['/','/privacy.html','/terms.html','/delete-account.html','/support.html','/verify-email.html','/reset-password.html'];
    for (const path of pages) {
      const page = await request(path);
      assert.equal(page.response.status, 200, 'public page should be reachable: ' + path);
      assert.match(page.response.headers.get('content-type') || '', /text\/html/i, 'page should serve HTML: ' + path);
    }
    check('public web pages including privacy, terms, deletion, support and recovery');

    const launchBlockers = [];
    if (health.integrations.instagram !== 'configured') launchBlockers.push('Meta Instagram Login credentials / permission review');
    if (health.integrations.email !== 'configured') launchBlockers.push('Email verification and password-recovery delivery');
    if (health.integrations.support !== 'configured') launchBlockers.push('Monitored support contact');
    if (health.integrations.operatorIdentity !== 'configured') launchBlockers.push('Public operator identity and jurisdiction');
    if (health.integrations.publicRegistration !== 'open') launchBlockers.push('Public registration is safely paused');
    if (health.integrations.emailVerification === 'required' || health.integrations.publicRegistration !== 'open') {
      if (health.integrations.publicRegistration !== 'open') {
        const gated = await expectStatus('/api/auth/register', {
          method: 'POST',
          body: { name: 'Collabzy Gate Probe', email: 'collabzy.gate.' + random + '@example.com', password, role: 'creator', accepted_terms: true }
        }, 503, 'registration gate');
        assert.match(gated.error || '', /paused|configured/i);
        check('registration fails closed while launch dependencies are missing');
      }
      if (health.integrations.email !== 'configured') {
        await expectStatus('/api/auth/forgot-password', { method: 'POST', body: { email: creatorEmail } }, 503, 'password recovery gate');
        check('password recovery fails closed without email delivery');
      }
      if (health.integrations.support !== 'configured' || health.integrations.email !== 'configured') {
        await expectStatus('/api/support', { method: 'POST', body: { name: 'Smoke Test', email: 'smoke@example.com', category: 'general', subject: 'Support gate probe', message: 'This is a production smoke test probe and does not request action.' } }, 503, 'support gate');
        check('support channel reports setup required rather than discarding requests');
      }
      console.log(JSON.stringify({
        result: 'PASS_WITH_LAUNCH_BLOCKERS',
        version: health.version,
        integrations: health.integrations,
        launchBlockers,
        checks: run.checks,
        checkCount: run.checks.length,
        finishedAt: new Date().toISOString()
      }, null, 2));
      return;
    }

    const creatorRegistration = await expectStatus('/api/auth/register', {
      method: 'POST',
      body: { name: 'Collabzy Smoke Creator', email: creatorEmail, password, role: 'creator', accepted_terms: true }
    }, 201, 'creator registration');
    creator = { token: creatorRegistration.token, id: creatorRegistration.user.id, email: creatorEmail, password };
    assert.ok(creator.token, 'creator JWT should exist');
    assert.equal(creatorRegistration.user.role, 'creator');
    assert.equal(Object.hasOwn(creatorRegistration.user, 'password_hash'), false, 'public user must not expose password hash');
    check('creator registration + safe user response');

    const brandRegistration = await expectStatus('/api/auth/register', {
      method: 'POST',
      body: { name: 'Collabzy Smoke Brand', email: brandEmail, password, role: 'brand', accepted_terms: true }
    }, 201, 'brand registration');
    brand = { token: brandRegistration.token, id: brandRegistration.user.id, email: brandEmail, password };
    assert.equal(brandRegistration.user.role, 'brand');
    check('brand registration');

    const login = await expectStatus('/api/auth/login', {
      method: 'POST',
      body: { email: creatorEmail, password }
    }, 200, 'login');
    assert.ok(login.token);
    assert.equal(Object.hasOwn(login.user, 'instagram_access_token_enc'), false, 'login must not expose stored Instagram token');
    check('login + secret field exclusion');

    const profile = await expectStatus('/api/me', { token: creator.token }, 200, 'authenticated profile');
    assert.equal(String(profile.user.id), String(creator.id));
    check('authenticated profile');

    const createCampaign = async title => {
      const result = await expectStatus('/api/campaigns', {
        method: 'POST', token: brand.token,
        body: {
          title,
          description: 'Automated production smoke test campaign. No real creators or brands are involved.',
          category: 'Lifestyle', collaboration_type: 'Paid',
          budget_min: 1000, budget_max: 5000,
          deliverables: '1 test Reel', location: 'India'
        }
      }, 201, 'brand campaign create');
      assert.ok(result.campaign?.id);
      return result.campaign;
    };

    const campaign = await createCampaign('Smoke Test ' + random);
    const secondCampaign = await createCampaign('Invitation Smoke Test ' + random);
    check('brand campaign creation');

    const publicCampaigns = await expectStatus('/api/campaigns', {}, 200, 'public campaign discovery');
    assert.ok(publicCampaigns.campaigns.some(c => String(c.id) === String(campaign.id)));
    check('public campaign discovery');

    const saved = await expectStatus('/api/campaigns/' + campaign.id + '/save', {
      method: 'POST', token: creator.token
    }, 200, 'save campaign');
    assert.equal(saved.saved, true);
    const savedList = await expectStatus('/api/saved-campaigns', { token: creator.token }, 200, 'saved campaign list');
    assert.ok(savedList.campaigns.some(c => String(c.id) === String(campaign.id)));
    check('saved campaigns');

    const apply = await expectStatus('/api/campaigns/' + campaign.id + '/apply', {
      method: 'POST', token: creator.token,
      body: { pitch: 'This is an automated smoke-test pitch.', proposed_rate: 2500 }
    }, 201, 'creator application');
    const applicationId = apply.application.id;
    assert.ok(applicationId);
    check('campaign application');

    const duplicate = await expectStatus('/api/campaigns/' + campaign.id + '/apply', {
      method: 'POST', token: creator.token,
      body: { pitch: 'Duplicate application test.', proposed_rate: 2500 }
    }, 409, 'duplicate application guard');
    assert.match(duplicate.error, /already applied/i);
    check('duplicate application guard');

    const convList = await expectStatus('/api/conversations', { token: creator.token }, 200, 'conversation list');
    assert.ok(convList.conversations.length);
    const conversationId = convList.conversations[0].id;

    await expectStatus('/api/conversations/' + conversationId + '/messages', {
      method: 'POST', token: creator.token, body: { body: 'Hello from the production smoke test.' }
    }, 201, 'send message');
    const messages = await expectStatus('/api/conversations/' + conversationId + '/messages', { token: brand.token }, 200, 'read conversation');
    assert.ok(messages.messages.some(m => m.body === 'Hello from the production smoke test.'));
    check('messaging + conversation authorization');

    const brandApps = await expectStatus('/api/applications', { token: brand.token }, 200, 'brand applications');
    assert.ok(brandApps.applications.some(a => String(a.id) === String(applicationId)));
    assert.equal(brandApps.applications.some(a => Object.hasOwn(a, 'creator_email')), false, 'brand API response must not leak creator emails');
    await expectStatus('/api/applications/' + applicationId + '/status', {
      method: 'PATCH', token: brand.token, body: { status: 'accepted' }
    }, 200, 'brand application status');
    check('brand application management');

    const invitation = await expectStatus('/api/campaigns/' + secondCampaign.id + '/invite', {
      method: 'POST', token: brand.token, body: { creator_id: creator.id, message: 'Smoke test invitation' }
    }, 201, 'brand invitation');
    const respond = await expectStatus('/api/invitations/' + invitation.invitation.id + '/respond', {
      method: 'PATCH', token: creator.token, body: { status: 'accepted' }
    }, 200, 'creator invitation response');
    assert.equal(respond.invitation?.status, 'accepted', 'accepted invitation response should return the updated invitation');
    check('creator invitation flow');

    const dashboard = await expectStatus('/api/dashboard', { token: brand.token }, 200, 'brand dashboard');
    assert.equal(dashboard.stats.role, 'brand');
    const exportData = await expectStatus('/api/me/export', { token: creator.token }, 200, 'account data export');
    assert.equal(exportData.profile.email, creatorEmail);
    check('dashboard + account export');

    const igStatus = await expectStatus('/api/instagram/status', { token: creator.token }, 200, 'Instagram status');
    assert.equal(typeof igStatus.connected, 'boolean');
    assert.equal(igStatus.mode, health.integrations.instagram === 'configured' ? 'oauth-configured' : 'setup-required');
    const igConnect = await request('/api/instagram/connect?platform=web', { token: creator.token });
    if (health.integrations.instagram === 'configured') {
      assert.equal(igConnect.response.status, 200, 'configured Instagram OAuth should start');
      const authUrl = new URL(igConnect.json.authorization_url);
      assert.equal(authUrl.origin, 'https://www.instagram.com');
      assert.equal(authUrl.pathname, '/oauth/authorize');
      assert.match(authUrl.searchParams.get('scope') || '', /instagram_business_basic/);
      assert.match(authUrl.searchParams.get('scope') || '', /instagram_business_manage_insights/);
      check('Instagram OAuth launch URL + current permission scopes');
    } else {
      assert.equal(igConnect.response.status, 503, 'missing Meta credentials should fail clearly instead of pretending connected');
      check('Instagram credentials gate reports setup required');
    }

    const deletedCreator = await expectStatus('/api/me', {
      method: 'DELETE', token: creator.token, body: { password }
    }, 200, 'creator account deletion');
    assert.equal(deletedCreator.deleted, true);
    creator = null;
    check('creator account deletion');

    const deletedBrand = await expectStatus('/api/me', {
      method: 'DELETE', token: brand.token, body: { password }
    }, 200, 'brand account deletion');
    assert.equal(deletedBrand.deleted, true);
    brand = null;
    check('brand account deletion + cascade cleanup');

    console.log(JSON.stringify({
      result: 'PASS',
      version: health.version,
      instagram: health.integrations.instagram,
      checks: run.checks,
      checkCount: run.checks.length,
      finishedAt: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('Collabzy production smoke test FAILED:', error.message);
    console.error('Completed checks:', JSON.stringify(run.checks));
    process.exitCode = 1;
  } finally {
    for (const user of [creator, brand]) {
      if (!user?.token) continue;
      try {
        await request('/api/me', {
          method: 'DELETE', token: user.token, body: { password: user.password }
        });
      } catch (error) {
        console.error('Warning: unable to clean up a temporary smoke-test account:', error.message);
      }
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
