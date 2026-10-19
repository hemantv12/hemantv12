'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'native-android', 'MainActivity.java'), 'utf8');

test('native startup is independent of web content and installs a real Android screen', () => {
  assert.match(source, /private void showWelcome\(\)/);
  assert.match(source, /Turn your content/);
  assert.match(source, /setContentView\(frame\)/);
  assert.doesNotMatch(source, /import\s+android\.webkit\.WebView/);
});

test('startup failures get a visible fallback instead of an empty screen', () => {
  assert.match(source, /private void showStartupFailure\(\)/);
  assert.match(source, /We couldn't open Collabzy/);
});

test('native activity exposes owner/creator collaboration and membership functions', () => {
  for (const marker of [
    'renderExplore', 'renderMyCampaigns', 'renderApplications', 'renderAI',
    'renderBilling', 'showApplyDialog', '/api/billing/status', '₹299 / year'
  ]) assert.ok(source.includes(marker), 'missing native workflow marker: ' + marker);
});
