const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const crypto=require('node:crypto');
const adminBootstrapCode=crypto.randomBytes(36).toString('base64url');
const adminTestPassword='TestOwner_'+crypto.randomBytes(24).toString('base64url')+'!';
const Database=require('better-sqlite3');
const bcrypt=require('bcryptjs');

test('PostgreSQL production backend supports creator-brand collaboration workflow',{skip:!process.env.DATABASE_URL},async(t)=>{
  assert.ok(process.env.DATABASE_URL,'PostgreSQL test DATABASE_URL must be configured');
  const probe=net.createServer();
  await new Promise((resolve,reject)=>probe.listen(0,'127.0.0.1',resolve).once('error',reject));
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const sqlitePath=path.join(os.tmpdir(),'collabzy-legacy-'+process.pid+'-'+Date.now()+'.db');
  const legacy=new Database(sqlitePath);
  legacy.exec("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL,niche TEXT DEFAULT '',bio TEXT DEFAULT '',location TEXT DEFAULT '',instagram_handle TEXT DEFAULT '',instagram_user_id TEXT DEFAULT '',instagram_access_token_enc TEXT DEFAULT '',instagram_connected_at TEXT DEFAULT '',followers INTEGER DEFAULT 0,engagement REAL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  legacy.exec("CREATE TABLE campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT,brand_id INTEGER NOT NULL,title TEXT NOT NULL,brand_name TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,collaboration_type TEXT NOT NULL,budget_min INTEGER DEFAULT 0,budget_max INTEGER DEFAULT 0,deliverables TEXT DEFAULT '',location TEXT DEFAULT 'India',status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  legacy.prepare("INSERT INTO users(id,name,email,password_hash,role,niche,bio,location,instagram_handle,followers,engagement) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(50,'Legacy Brand','legacy-brand@example.com',bcrypt.hashSync('LegacyPassword123!',10),'brand','Lifestyle','Imported from the SQLite version','Mumbai','legacybrand',0,0);
  legacy.prepare("INSERT INTO campaigns(id,brand_id,title,brand_name,description,category,collaboration_type,budget_min,budget_max,deliverables,location) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(90,50,'Migrated Legacy Campaign','Legacy Brand','A campaign imported from SQLite.','Lifestyle','Paid',1000,4000,'1 Reel','India');
  legacy.close();
  let child=spawn(process.execPath,['src/server.js'],{
    cwd:path.join(__dirname,'..'),
    env:{...process.env,NODE_ENV:'test',PORT:String(port),JWT_SECRET:'postgres-test-secret-at-least-32-characters-long',PGSSLMODE:'disable',MIGRATE_SQLITE_ON_START:'true',SQLITE_MIGRATION_PATH:sqlitePath,COLLABZY_ADMIN_EMAIL:'',COLLABZY_ADMIN_PASSWORD_HASH:'',COLLABZY_ADMIN_BOOTSTRAP_TOKEN:adminBootstrapCode},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  child.stdout.on('data',d=>logs+=d.toString());
  child.stderr.on('data',d=>logs+=d.toString());
  t.after(async()=>{
    child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1500)});
    for(const ext of ['', '-shm','-wal'])try{fs.unlinkSync(sqlitePath+ext)}catch{}
  });
  const base='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)break;
    try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();if(h.mode==='postgres-persistent')ready=true;if(ready)break}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.equal(ready,true,'PostgreSQL API should start with a persistent DB; logs: '+logs);
  const migratedCampaigns=(await (await fetch(base+'/api/campaigns')).json()).campaigns;
  assert.ok(migratedCampaigns.some(c=>c.title==='Migrated Legacy Campaign'),'one-time SQLite import should migrate active campaigns');
  const migratedLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'legacy-brand@example.com',password:'LegacyPassword123!'})});
  assert.equal(migratedLogin.status,200,'SQLite import should preserve user password hashes and credentials');
  const create=async(name,email,role)=> {
    const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,email,password:'TestPassword123!',role})});
    assert.equal(r.status,201,'registration should succeed: '+await r.clone().text());
    return r.json();
  };
  const creator=await create('PG Test Creator','creator'+Date.now()+'@example.com','creator');
  const brand=await create('PG Test Brand','brand'+Date.now()+'@example.com','brand');
  const creatorProfileUpdate=await fetch(base+'/api/me',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({niche:'Lifestyle',bio:'Lifestyle and travel creator making helpful short videos.',location:'India',followers:6000,engagement:4.2})});
  assert.equal(creatorProfileUpdate.status,200,'creator should update profile before matching');
  const campaignResponse=await fetch(base+'/api/campaigns',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({title:'Postgres Launch Test',description:'A test campaign on Postgres.',category:'Lifestyle',collaboration_type:'Paid',budget_min:4000,budget_max:9000,deliverables:'1 Reel + 2 Stories',location:'India'})});
  assert.equal(campaignResponse.status,201,'brand should publish: '+await campaignResponse.clone().text());
  const campaign=(await campaignResponse.json()).campaign;

  const smartCreatorResponse=await fetch(base+'/api/matches',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(smartCreatorResponse.status,200,'creator should receive Smart Match suggestions');
  const smartCreatorData=await smartCreatorResponse.json();
  assert.ok(smartCreatorData.matches.some(m=>String(m.campaign?.id)===String(campaign.id)),'creator Smart Match should include a relevant active campaign');
  assert.ok(smartCreatorData.matches.every(m=>Number(m.score)>=20&&Number(m.score)<=99),'creator match scores should be bounded and explainable');
  const smartBrandResponse=await fetch(base+'/api/matches',{headers:{authorization:'Bearer '+brand.token}});
  assert.equal(smartBrandResponse.status,200,'brand should receive creator recommendations');
  const smartBrandData=await smartBrandResponse.json();
  assert.ok(smartBrandData.matches.some(m=>String(m.creator?.id)===String(creator.user.id)),'brand Smart Match should include the created creator');
  assert.ok(smartBrandData.matches.every(m=>!Object.hasOwn(m.creator||{},'email')),'creator matching must not expose email addresses');
  const aiDraftResponse=await fetch(base+'/api/ai/studio',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({tool:'reel_hooks',brief:'Make relatable lifestyle content for new creators',audience:'new creators',tone:'friendly Hinglish',confirmed_ai_disclosure:true})});
  assert.equal(aiDraftResponse.status,200,'AI Studio should return a draft when provider key is absent');
  const aiDraft=await aiDraftResponse.json();
  assert.equal(aiDraft.mode,'starter_template','missing OpenAI key must be disclosed as starter-template mode');
  assert.ok(aiDraft.output.length>20,'AI Studio fallback should still generate usable starter content');
  const dmListResponse=await fetch(base+'/api/instagram/automations',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(dmListResponse.status,200,'creator should open Auto DM rule workspace without Meta being configured');
  const dmList=await dmListResponse.json();
  assert.equal(dmList.configured,false,'Auto DM should report setup required without Meta credentials and opt-in');
  const dmRuleResponse=await fetch(base+'/api/instagram/automations',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({keyword:'GUIDE',match_type:'contains',reply_text:'Thanks for commenting! Here is the guide.',cta_url:'https://example.com/guide'})});
  assert.equal(dmRuleResponse.status,201,'creator should save a draft Auto DM reply');
  const dmRule=(await dmRuleResponse.json()).rule;
  assert.equal(dmRule.enabled,false,'Auto DM rule must default to draft/off');
  const dmEnableBlocked=await fetch(base+'/api/instagram/automations/'+dmRule.id,{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({enabled:true})});
  assert.equal(dmEnableBlocked.status,503,'live Auto DM must be gated without approved/configured Meta credentials');
  const brandDmBlocked=await fetch(base+'/api/instagram/automations',{headers:{authorization:'Bearer '+brand.token}});
  assert.equal(brandDmBlocked.status,403,'Auto DM rule manager must be creator-only');
  const dmEvents=await fetch(base+'/api/instagram/automations/events',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(dmEvents.status,200,'creator should be able to load private-reply activity');
  assert.ok(Array.isArray((await dmEvents.json()).events),'delivery activity must be a safe array response');

  const dmDelete=await fetch(base+'/api/instagram/automations/'+dmRule.id,{method:'DELETE',headers:{authorization:'Bearer '+creator.token}});
  assert.equal(dmDelete.status,200,'creator should be able to delete a draft Auto DM rule');
  const applyResponse=await fetch(base+'/api/campaigns/'+campaign.id+'/apply',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({pitch:'My work fits the audience.',proposed_rate:5000})});
  assert.equal(applyResponse.status,201,'creator should apply: '+await applyResponse.clone().text());
  const application=(await applyResponse.json()).application;
  assert.ok(application.id);
  const conversationList=await fetch(base+'/api/conversations',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(conversationList.status,200);
  const conversations=(await conversationList.json()).conversations;
  assert.equal(conversations.length,1);
  const convId=conversations[0].id;
  const messageResponse=await fetch(base+'/api/conversations/'+convId+'/messages',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({body:'Hello from PostgreSQL.'})});
  assert.equal(messageResponse.status,201,'creator should be able to send a message: '+await messageResponse.clone().text());
  const savedResponse=await fetch(base+'/api/campaigns/'+campaign.id+'/save',{method:'POST',headers:{authorization:'Bearer '+creator.token}});
  assert.equal(savedResponse.status,200);
  const saved=(await (await fetch(base+'/api/saved-campaigns',{headers:{authorization:'Bearer '+creator.token}})).json()).campaigns;
  assert.equal(saved.length,1);
  const secondCampaignResponse=await fetch(base+'/api/campaigns',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({title:'Postgres Invitation Test',description:'A second campaign for testing invitations.',category:'Beauty',collaboration_type:'Hybrid',budget_min:2000,budget_max:6000,deliverables:'1 Reel',location:'India'})});
  assert.equal(secondCampaignResponse.status,201);
  const secondCampaign=(await secondCampaignResponse.json()).campaign;
  const editSecond=await fetch(base+'/api/campaigns/'+secondCampaign.id,{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({title:'Postgres Invitation Edited',description:'Edited campaign brief.',budget_min:2500,budget_max:6500,deliverables:'Updated Reel deliverable'})});
  assert.equal(editSecond.status,200,'brand should edit the campaign on PostgreSQL');
  const editedSecond=(await editSecond.json()).campaign;
  assert.equal(editedSecond.title,'Postgres Invitation Edited');
  assert.equal(Number(editedSecond.budget_max),6500);
  const creatorEdit=await fetch(base+'/api/campaigns/'+secondCampaign.id,{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({title:'Should be denied'})});
  assert.equal(creatorEdit.status,403,'creator cannot edit a brand campaign');
  const invitationResponse=await fetch(base+'/api/campaigns/'+secondCampaign.id+'/invite',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({creator_id:creator.user.id,message:'Would love to work together.'})});
  assert.equal(invitationResponse.status,201,'brand should invite creator: '+await invitationResponse.clone().text());
  const invitation=(await invitationResponse.json()).invitation;
  const response=await fetch(base+'/api/invitations/'+invitation.id+'/respond',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({status:'accepted'})});
  assert.equal(response.status,200,'creator should accept invitation: '+await response.clone().text());
  const brandApps=(await (await fetch(base+'/api/applications',{headers:{authorization:'Bearer '+brand.token}})).json()).applications;
  assert.ok(brandApps.every(a=>!Object.hasOwn(a,'creator_email')),'PostgreSQL brand application list must not reveal creator email addresses');
  const invitationApp=brandApps.find(a=>String(a.campaign_id)===String(secondCampaign.id));
  assert.ok(invitationApp,'accepted invitation should create an application owned by the campaign brand');
  const acceptApplication=await fetch(base+'/api/applications/'+invitationApp.id+'/status',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({status:'accepted'})});
  assert.equal(acceptApplication.status,200);
  const completeApplication=await fetch(base+'/api/applications/'+invitationApp.id+'/status',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({status:'completed'})});
  assert.equal(completeApplication.status,200,'brand should be able to complete the collaboration');
  const dashboard=(await (await fetch(base+'/api/dashboard',{headers:{authorization:'Bearer '+brand.token}})).json()).stats;
  assert.equal(Number(dashboard.myCampaigns),2);
  assert.equal(Number(dashboard.receivedApplications),2);

  assert.ok(adminBootstrapCode.length>=48,'the test-only owner setup code meets the minimum length');
  const adminCreate=await fetch(base+'/api/admin/bootstrap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bootstrap_token:adminBootstrapCode,email:'collabzy-smoke-owner@example.com',password:adminTestPassword})});
  assert.equal(adminCreate.status,201,'first owner admin should be created through the one-time bootstrap route: '+await adminCreate.clone().text());
  const ownerToken=(await adminCreate.json()).token;
  assert.ok(ownerToken,'owner setup should return a short-lived authenticated admin token');
  const adminHeaders={'content-type':'application/json',authorization:'Bearer '+ownerToken};
  const ownerBrandsResponse=await fetch(base+'/api/admin/brand-options',{headers:adminHeaders});
  assert.equal(ownerBrandsResponse.status,200,'owner can load registered brand accounts for campaign publishing');
  const ownerBrands=(await ownerBrandsResponse.json()).brands;
  assert.ok(ownerBrands.some(b=>String(b.id)===String(brand.user.id)),'campaign composer must use an existing active brand');
  const adminAdResponse=await fetch(base+'/api/admin/campaigns',{method:'POST',headers:adminHeaders,body:JSON.stringify({brand_id:brand.user.id,title:'Owner Published Beauty Campaign',description:'A real owner-created marketplace test campaign for registered creator discovery.',category:'Beauty',collaboration_type:'Paid',budget_min:7000,budget_max:15000,deliverables:'1 Reel plus 2 Stories',location:'India'})});
  assert.equal(adminAdResponse.status,201,'owner can publish a campaign to the selected brand account: '+await adminAdResponse.clone().text());
  const adminAd=(await adminAdResponse.json()).campaign;
  assert.equal(adminAd.status,'active','owner campaign should be published as active');
  const publicCampaignsAfterAdminPost=(await (await fetch(base+'/api/campaigns')).json()).campaigns;
  assert.ok(publicCampaignsAfterAdminPost.some(c=>String(c.id)===String(adminAd.id)),'admin-published ad should appear in the public creator marketplace');
  const noAdminToken=await fetch(base+'/api/admin/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brand_id:brand.user.id,title:'Unauthorized Campaign',description:'This publication attempt should not succeed.',category:'Beauty',collaboration_type:'Paid',budget_min:100,budget_max:200})});
  assert.equal(noAdminToken.status,401,'campaign publishing must reject requests without an owner token');
  const exportResponse=await fetch(base+'/api/me/export',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(exportResponse.status,200);
  assert.equal((await exportResponse.json()).profile.email,creator.user.email);
  const badTokenFields=await (await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:creator.user.email,password:'TestPassword123!'})})).json();
  assert.equal(Object.hasOwn(badTokenFields.user,'instagram_access_token_enc'),false);
  const billingStatusResponse=await fetch(base+'/api/billing/status',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(billingStatusResponse.status,200,'subscription status is available after sign-in');
  const billingStatus=await billingStatusResponse.json();
  assert.equal(billingStatus.active,false,'new test accounts must not receive a paid subscription by default');
  assert.equal(billingStatus.plan_code,'','no subscription should be claimed before verified payment');
  const publicConfig=await (await fetch(base+'/api/public-config')).json();
  assert.equal(publicConfig.annualPlan?.code,'creator_annual_299');
  assert.equal(publicConfig.annualPlan?.amount,299);
  assert.equal(publicConfig.annualPlan?.durationDays,365);
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET){
    const noCheckout=await fetch(base+'/api/billing/order',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({plan_code:'creator_annual_299'})});
    assert.equal(noCheckout.status,503,'checkout must be fail-closed without merchant credentials');
  }
  if(!process.env.OPENAI_API_KEY){
    const noAI=await fetch(base+'/api/instagram/ai-analysis',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({confirmed_ai_disclosure:true})});
    assert.equal(noAI.status,503,'AI analysis must be fail-closed without the provider key');
  } else {
    const noProAI=await fetch(base+'/api/instagram/ai-analysis',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({confirmed_ai_disclosure:true})});
    assert.equal(noProAI.status,402,'an unpaid account must not access AI analysis');
  }
  const health2=await (await fetch(base+'/api/health')).json();
  assert.equal(health2.mode,'postgres-persistent');

  // Restart the API process while keeping the same PostgreSQL service.
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,2500)});
  child=spawn(process.execPath,['src/server.js'],{
    cwd:path.join(__dirname,'..'),
    env:{...process.env,NODE_ENV:'test',PORT:String(port),JWT_SECRET:'postgres-test-secret-at-least-32-characters-long',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe']
  });
  child.stdout.on('data',d=>logs+=d.toString());
  child.stderr.on('data',d=>logs+=d.toString());
  let restarted=false;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)break;
    try{const r=await fetch(base+'/api/health');if(r.ok&&(await r.json()).mode==='postgres-persistent'){restarted=true;break}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.equal(restarted,true,'API should restart cleanly on the same persistent database; logs: '+logs);
  const loginAfterRestart=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:creator.user.email,password:'TestPassword123!'})});
  assert.equal(loginAfterRestart.status,200,'account should still exist after API restart');
  const restored=await loginAfterRestart.json();
  const campaignsAfterRestart=(await (await fetch(base+'/api/campaigns')).json()).campaigns;
  assert.ok(campaignsAfterRestart.some(c=>String(c.id)===String(campaign.id)),'campaign should persist after API restart');
  const conversationsAfterRestart=(await (await fetch(base+'/api/conversations',{headers:{authorization:'Bearer '+restored.token}})).json()).conversations;
  assert.ok(conversationsAfterRestart.length>=1,'conversation metadata should persist after API restart');
  const messagesAfterRestart=await fetch(base+'/api/conversations/'+convId+'/messages',{headers:{authorization:'Bearer '+restored.token}});
  assert.equal(messagesAfterRestart.status,200);
  assert.ok((await messagesAfterRestart.json()).messages.some(m=>m.body==='Hello from PostgreSQL.'),'messages should persist after API restart');

  // Production-like private beta: no email provider, Meta credentials or payment keys are configured.
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,2500)});
  child=spawn(process.execPath,['src/server.js'],{
    cwd:path.join(__dirname,'..'),
    env:{
      ...process.env,NODE_ENV:'production',PORT:String(port),
      JWT_SECRET:'postgres-test-secret-at-least-32-characters-long',
      PGSSLMODE:'disable',MIGRATE_SQLITE_ON_START:'false',
      REQUIRE_EMAIL_VERIFICATION:'true',PUBLIC_LAUNCH_APPROVED:'false',
      COLLABZY_PRIVATE_BETA_CODE:'collabzy-test-beta-code-32-characters',
      COLLABZY_TEST_ACCOUNT_ENABLED:'',
      RESEND_API_KEY:'',EMAIL_FROM:'',SUPPORT_EMAIL:'',
      OPERATOR_LEGAL_NAME:'',OPERATOR_JURISDICTION:'',
      OPENAI_API_KEY:'',RAZORPAY_KEY_ID:'',RAZORPAY_KEY_SECRET:'',
      RAZORPAY_WEBHOOK_SECRET:'',META_APP_ID:'',META_APP_SECRET:''
    },
    stdio:['ignore','pipe','pipe']
  });
  child.stdout.on('data',d=>logs+=d.toString());
  child.stderr.on('data',d=>logs+=d.toString());
  let betaReady=false;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)break;
    try{
      const r=await fetch(base+'/api/health');
      if(r.ok){
        const h=await r.json();
        if(h.mode==='postgres-persistent'&&h.integrations?.privateBetaRegistration==='invite_only'&&h.integrations?.publicRegistration==='setup_required'){betaReady=true;break}
      }
    }catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.equal(betaReady,true,'private beta should be enabled while public registration stays locked; logs: '+logs);

  const paused=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Uninvited Tester',email:'uninvited'+Date.now()+'@example.com',password:'TestPassword123!',role:'creator',accepted_terms:true})});
  assert.equal(paused.status,503,'public sign-up without an invite must remain closed');
  const badCode=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Wrong Code Tester',email:'wrongcode'+Date.now()+'@example.com',password:'TestPassword123!',role:'creator',accepted_terms:true,beta_code:'not-the-private-code'})});
  assert.equal(badCode.status,403,'an invalid invite code must be rejected');

  const betaEmail='privatebeta'+Date.now()+'@example.com';
  const betaRegister=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Private Beta Creator',email:betaEmail,password:'BetaPassword123!',role:'creator',accepted_terms:true,beta_code:'collabzy-test-beta-code-32-characters'})});
  assert.equal(betaRegister.status,201,'valid invite should create a beta account without claiming email verification: '+await betaRegister.clone().text());
  const betaAccount=await betaRegister.json();
  assert.equal(betaAccount.private_beta,true);
  assert.equal(Object.hasOwn(betaAccount.user,'private_beta_access'),false,'beta access flag must not be returned in public profile payload');
  const betaLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:betaEmail,password:'BetaPassword123!'})});
  assert.equal(betaLogin.status,200,'a private-beta account can sign in without pretending its email was verified');
  const betaSession=await betaLogin.json();
  const betaProfile=await fetch(base+'/api/me',{headers:{authorization:'Bearer '+betaSession.token}});
  assert.equal(betaProfile.status,200,'private-beta account can use authenticated API routes');
  const betaBilling=await fetch(base+'/api/billing/status',{headers:{authorization:'Bearer '+betaSession.token}});
  assert.equal(betaBilling.status,200);
  assert.equal((await betaBilling.json()).active,false,'private beta must not create a paid subscription');
  const betaCheckout=await fetch(base+'/api/billing/order',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+betaSession.token},body:JSON.stringify({plan_code:'creator_annual_299'})});
  assert.equal(betaCheckout.status,503,'paid checkout must remain blocked without merchant keys');
});
