'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'native-android', 'MainActivity.java'), 'utf8');

test('fresh native startup is not dependent on a WebView or remote HTML', () => {
  assert.match(source, /private void showWelcome\(\)/);
  assert.match(source, /Your next brand deal starts here/);
  assert.match(source, /setContentView\(root\)/);
  assert.doesNotMatch(source, /import\s+android\.webkit\.WebView/);
});

test('startup errors have a visible fallback screen', () => {
  assert.match(source, /private void showStartupFailure\(\)/);
  assert.match(source, /We couldn't open Collabzy/);
});

test('native client retains core collaboration workflows', () => {
  for (const phrase of [
    '/api/auth/register', '/api/auth/login', '/api/campaigns',
    '/api/campaigns/', '/api/applications', '/api/my-campaigns',
    '/api/ai/studio', '/api/instagram/status', '₹299 / year'
  ]) assert.ok(source.includes(phrase), 'missing workflow marker: ' + phrase);
});
