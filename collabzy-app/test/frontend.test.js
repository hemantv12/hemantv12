const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

test('Collabzy frontend JavaScript parses and native OAuth bridge is bundled',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length>=2,'external bridge and inline application script should exist');
  const inline=scripts[scripts.length-1][1];
  assert.ok(inline.trim().length>1000,'main application JavaScript should be present');
  assert.doesNotThrow(()=>new vm.Script(inline,{filename:'collabzy-public-index-inline.js'}),'frontend script must be syntactically valid');
  assert.match(html,/src=["']\/vendor\/capacitor-bridge\.js["']/,'app should load the locally bundled Capacitor bridge');
  assert.match(html,/collabzy:oauth-return/,'native OAuth deep-link return must be handled');
  const bridge=path.join(root,'public','vendor','capacitor-bridge.js');
  assert.ok(fs.existsSync(bridge),'postinstall should bundle the native bridge before tests');
  assert.ok(fs.statSync(bridge).size>1000,'bundled Capacitor bridge should not be empty');
});
