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

test('AI Studio and Auto DM workspaces have explicit user controls and honest setup states',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 const backend=fs.readFileSync(path.join(root,'src','server-postgres.js'),'utf8');
 assert.match(html,/go\('ai'\)/,'AI Studio must be reachable from the signed-in workspace');
 assert.match(html,/go\('autodm'\)/,'Auto DM must be reachable from the signed-in creator workspace');
 assert.match(html,/Generate draft/,'AI Studio must offer a real draft-generation form');
 assert.match(html,/starter_template/,'AI template fallback must remain explicitly labelled');
 assert.match(html,/Save reply rule/,'creator must be able to save a keyword reply');
 assert.match(html,/Pause rule|Pause/,'creator must be able to pause an automation');
 assert.match(backend,/app\.post\('\/api\/ai\/studio'/,'AI Studio backend route must exist');
 assert.match(backend,/app\.get\('\/api\/instagram\/automations'/,'automation list route must exist');
 assert.match(backend,/app\.post\('\/api\/instagram\/automations'/,'automation create route must exist');
 assert.match(backend,/META_AUTO_DM_ENABLED==='true'/,'live auto-replies must require an explicit server-side switch');
 assert.match(backend,/x-hub-signature-256/i,'Instagram webhook must validate signed Meta events');
 assert.match(backend,/ON CONFLICT\(comment_id\) DO NOTHING/,'webhook event processing must deduplicate comment IDs');
 assert.match(backend,/confirmed_ai_disclosure/,'AI generation must require the in-app data-use acknowledgement');
 assert.match(html,/go\('matches'\)/,'Smart Match Center must be reachable from the signed-in workspace');
 assert.match(backend,/app\.get\('\/api\/matches'/,'the authenticated matching endpoint must exist');
 assert.match(html,/Recent reply activity/,'Auto DM workspace must show recent delivery status');
 assert.match(backend,/app\.get\('\/api\/instagram\/automations\/events'/,'creator Auto DM activity must have an authenticated endpoint');
 assert.match(backend,/\/me\/subscribed_apps/,'Instagram Login webhook setup must use the official /me/subscribed_apps edge');
});
