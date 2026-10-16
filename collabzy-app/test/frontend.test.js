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
 assert.match(html,/key:'ai'/,'AI Studio must be included in signed-in navigation');
 assert.match(html,/key:'autodm'/,'Auto DM must be included in creator navigation');
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
 assert.match(html,/key:'matches'/,'Smart Match Center must be included in signed-in navigation');
 assert.match(backend,/app\.get\('\/api\/matches'/,'the authenticated matching endpoint must exist');
 assert.match(html,/Recent reply activity/,'Auto DM workspace must show recent delivery status');
 assert.match(backend,/app\.get\('\/api\/instagram\/automations\/events'/,'creator Auto DM activity must have an authenticated endpoint');
 assert.match(backend,/\/me\/subscribed_apps/,'Instagram Login webhook setup must use the official /me/subscribed_apps edge');
});

test('Capacitor Android uses an app-first welcome screen and mobile tab navigation',()=>{
 const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
 assert.match(html,/const IS_NATIVE_APP =/,'the interface should distinguish the installed Android app from the website');
 assert.match(html,/function renderNativeWelcome\(\)/,'the Android app should have a compact app-first welcome screen');
 assert.match(html,/if \(IS_NATIVE_APP\) \{ renderNativeWelcome\(\); return; \}/,'the installed app should not open the long marketing landing page');
 assert.match(html,/function renderAppNavigation\(\)/,'the signed-in shell should render app navigation');
 assert.match(html,/data-primary="/,'primary tabs must be distinguished from secondary app tools');
 assert.match(html,/function openMoreSheet\(\)/,'secondary destinations must open in an app-style More sheet');
 assert.match(html,/native-app \.nav\.app-tabbar/,'Android must use a fixed bottom tab bar');
 assert.match(html,/env\(safe-area-inset-bottom\)/,'bottom navigation must account for Android safe-area insets');
 assert.match(html,/function closeMoreSheet\(\)/,'the More sheet must be dismissible');
});

test('Native Android app covers core creator, brand and account workflows',()=>{
 const native=fs.readFileSync(path.join(root,'native-android','MainActivity.java'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'..','.github','workflows','collabzy-android.yml'),'utf8');
 const configScript=fs.readFileSync(path.join(root,'scripts','configure-android.js'),'utf8');
 const requiredScreens=[
  'renderHome','renderExplore','renderMatches','renderInbox','renderConversation',
  'renderSavedCampaigns','renderInvitations','renderNotifications','renderMyCampaigns',
  'renderInstagram','renderAutoDM','renderApplications','renderProfile','renderAI',
  'renderCreateCampaign','renderBilling','renderSupport','showPasswordDialog','exportAccountData','confirmDeleteAccount',
  'showInviteDialog','showEditCampaignDialog','showForgotPasswordDialog','loadExploreResults','loadAutomationEvents'
 ];
 for(const screen of requiredScreens) assert.ok(native.includes('private void '+screen+'('),'native screen/function '+screen+' must exist');
 for(const endpoint of [
  '/api/auth/register','/api/auth/login','/api/dashboard','/api/campaigns','/api/matches',
  '/api/applications','/api/invitations','/api/notifications','/api/conversations',
  '/api/me/password','/api/me/export','/api/instagram/connect','/api/instagram/insights',
  '/api/instagram/automations','/api/ai/studio','/api/billing/status','/api/support',
  '/api/campaigns/','/api/auth/forgot-password','/api/invitations/'
 ]) assert.ok(native.includes(endpoint),'native client should use '+endpoint);
 assert.ok(native.includes('class MainActivity extends Activity'),'main screen must use Android native Activity');
 assert.equal(native.includes('android.webkit.WebView'),false,'native main Activity must not embed the website in a WebView');
 assert.ok(workflow.includes('cp native-android/MainActivity.java android/app/src/main/java/com/collabzy/creator/MainActivity.java'),'APK build must install the native Activity source');
 assert.ok(workflow.includes('com.squareup.okhttp3:okhttp:4.12.0'),'native HTTP dependency must be installed at build time');
 assert.ok(configScript.includes('android:launchMode="singleTask"'),'OAuth deep link must return to the existing Android Activity safely');
 assert.ok(configScript.includes('android:scheme="collabzy"'),'OAuth callback must be registered as an Android deep link');
});
