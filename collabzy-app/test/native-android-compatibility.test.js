'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'native-android', 'MainActivity.java'), 'utf8');

test('native startup avoids Android API 28-only TextView calls', () => {
  assert.doesNotMatch(source, /\.setAllCaps\s*\(/, 'TextView.setAllCaps is not safe on older supported Android versions');
  assert.match(source, /b\.setTransformationMethod\(null\)/, 'buttons should keep their supplied casing using an API-compatible call');
});

test('native welcome screen installs visible content before starting its animation', () => {
  const start = source.indexOf('private void showWelcome()');
  const end = source.indexOf('private void addFeature(', start);
  assert.ok(start >= 0 && end > start, 'welcome screen should exist');
  const welcome = source.slice(start, end);
  assert.match(welcome, /setContentView\(frame\)/, 'welcome content must be installed');
  assert.match(welcome, /Create your account/, 'welcome screen must offer account creation');
  assert.match(welcome, /₹299 \/ year/, 'welcome screen must show the annual plan');
});
