const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const path=require('node:path');

test('PostgreSQL production backend supports creator-brand collaboration workflow',{skip:!process.env.DATABASE_URL},async(t)=>{
  assert.ok(process.env.DATABASE_URL,'PostgreSQL test DATABASE_URL must be configured');
  const probe=net.createServer();
  await new Promise((resolve,reject)=>probe.listen(0,'127.0.0.1',resolve).once('error',reject));
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,['src/server.js'],{
    cwd:path.join(__dirname,'..'),
    env:{...process.env,NODE_ENV:'test',PORT:String(port),JWT_SECRET:'postgres-test-secret-at-least-32-characters-long',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  child.stdout.on('data',d=>logs+=d.toString());
  child.stderr.on('data',d=>logs+=d.toString());
  t.after(async()=>{
    child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1500)});
  });
  const base='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)break;
    try{const r=await fetch(base+'/api/health');if(r.ok){const h=await r.json();if(h.mode==='postgres-persistent')ready=true;if(ready)break}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.equal(ready,true,'PostgreSQL API should start with a persistent DB; logs: '+logs);
  const create=async(name,email,role)=> {
    const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,email,password:'TestPassword123!',role})});
    assert.equal(r.status,201,'registration should succeed: '+await r.clone().text());
    return r.json();
  };
  const creator=await create('PG Test Creator','creator'+Date.now()+'@example.com','creator');
  const brand=await create('PG Test Brand','brand'+Date.now()+'@example.com','brand');
  const campaignResponse=await fetch(base+'/api/campaigns',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({title:'Postgres Launch Test',description:'A test campaign on Postgres.',category:'Lifestyle',collaboration_type:'Paid',budget_min:4000,budget_max:9000,deliverables:'1 Reel + 2 Stories',location:'India'})});
  assert.equal(campaignResponse.status,201,'brand should publish: '+await campaignResponse.clone().text());
  const campaign=(await campaignResponse.json()).campaign;
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
  const invitationResponse=await fetch(base+'/api/campaigns/'+secondCampaign.id+'/invite',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+brand.token},body:JSON.stringify({creator_id:creator.user.id,message:'Would love to work together.'})});
  assert.equal(invitationResponse.status,201,'brand should invite creator: '+await invitationResponse.clone().text());
  const invitation=(await invitationResponse.json()).invitation;
  const response=await fetch(base+'/api/invitations/'+invitation.id+'/respond',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+creator.token},body:JSON.stringify({status:'accepted'})});
  assert.equal(response.status,200,'creator should accept invitation: '+await response.clone().text());
  const dashboard=(await (await fetch(base+'/api/dashboard',{headers:{authorization:'Bearer '+brand.token}})).json()).stats;
  assert.equal(Number(dashboard.myCampaigns),2);
  assert.equal(Number(dashboard.receivedApplications),2);
  const exportResponse=await fetch(base+'/api/me/export',{headers:{authorization:'Bearer '+creator.token}});
  assert.equal(exportResponse.status,200);
  assert.equal((await exportResponse.json()).profile.email,creator.user.email);
  const badTokenFields=await (await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:creator.user.email,password:'TestPassword123!'})})).json();
  assert.equal(Object.hasOwn(badTokenFields.user,'instagram_access_token_enc'),false);
  const health2=await (await fetch(base+'/api/health')).json();
  assert.equal(health2.mode,'postgres-persistent');
});
