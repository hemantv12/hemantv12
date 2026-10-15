const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');

async function freePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function launch(cwd,port,dbPath,nodeEnv){
 const child=spawn(process.execPath,['src/server.js'],{
  cwd,env:{...process.env,NODE_ENV:nodeEnv,PORT:String(port),JWT_SECRET:'prod-safety-test-secret-at-least-32-characters',DATABASE_PATH:dbPath,SEED_DEMO_DATA:''},
  stdio:['ignore','pipe','pipe']
 });
 let logs='';
 child.stdout.on('data',d=>logs+=d.toString());
 child.stderr.on('data',d=>logs+=d.toString());
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Server exited: '+logs);
  try{const r=await fetch(base+'/api/health');if(r.ok)return {child,base,logs:()=>logs}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 child.kill('SIGTERM');
 throw Error('Server did not become ready: '+logs);
}
async function stop(child){
 if(child.exitCode!==null)return;
 child.kill('SIGTERM');
 await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(resolve,1500)});
}
test('production startup removes the seeded demo brand and its sample campaigns',async(t)=>{
 const port=await freePort(),dbPath=path.join(os.tmpdir(),'collabzy-production-safety-'+process.pid+'-'+Date.now()+'.db'),cwd=path.join(__dirname,'..');
 let dev,prod;
 t.after(async()=>{
  if(dev)await stop(dev.child);
  if(prod)await stop(prod.child);
  for(const ext of ['', '-shm','-wal'])try{fs.unlinkSync(dbPath+ext)}catch{}
 });
 dev=await launch(cwd,port,dbPath,'development');
 const seeded=(await (await fetch(dev.base+'/api/campaigns')).json()).campaigns;
 assert.ok(seeded.length>=1,'development should seed sample campaigns for onboarding');
 const demoLogin=await fetch(dev.base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'hello@collabzy.demo',password:'DemoPass123!'})});
 assert.equal(demoLogin.status,200,'demo fixture should exist in a fresh development database');
 await stop(dev.child);dev=null;
 prod=await launch(cwd,port,dbPath,'production');
 const campaigns=(await (await fetch(prod.base+'/api/campaigns')).json()).campaigns;
 assert.equal(campaigns.length,0,'seeded sample campaigns must not be visible in production');
 const login=await fetch(prod.base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'hello@collabzy.demo',password:'DemoPass123!'})});
 assert.equal(login.status,401,'known demo credentials must not work in production');
 const create=await fetch(prod.base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Real Brand',email:'realbrand'+Date.now()+'@example.com',password:'RealPassword123!',role:'brand'})});
 assert.equal(create.status,201,'production sign-up must remain available after demo cleanup');
});
