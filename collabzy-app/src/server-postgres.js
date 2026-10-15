const express=require('express');
const path=require('node:path');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const rateLimit=require('express-rate-limit');

function encryptToken(value,secret){
  const iv=crypto.randomBytes(12),key=crypto.createHash('sha256').update(secret).digest();
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
function decryptToken(value,secret){
  const parts=String(value||'').split('.');
  if(parts.length!==3)throw Error('Instagram token is unavailable.');
  const key=crypto.createHash('sha256').update(secret).digest();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(parts[0],'base64url'));
  decipher.setAuthTag(Buffer.from(parts[1],'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
function publicUser(row){
  if(!row)return row;
  const {password_hash,session_version,email_verified_at,terms_accepted_at,terms_version,instagram_user_id,instagram_access_token_enc,instagram_connected_at,instagram_token_expires_at,...user}=row;
  return user;
}
function tokenFor(user,secret){return jwt.sign({id:String(user.id),email:user.email,role:user.role,ver:Number(user.session_version||0)},secret,{expiresIn:'7d'});}
function validEmail(value){
  const email=String(value||'').trim().toLowerCase();
  return email.length<=254&&!/\s/.test(email)&&/^[^@]+@[^@]+\.[^@]+$/.test(email)?email:'';
}
function htmlEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function asyncRoute(fn){return(q,s,n)=>Promise.resolve(fn(q,s,n)).catch(n);}
const PROFILE_FIELDS='id,name,email,role,niche,bio,location,instagram_handle,followers,engagement,created_at';

async function start(PORT,SECRET){
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required for the PostgreSQL adapter.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:true},max:8,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
  const app=express();
  await pool.query('SELECT 1');
  await pool.query("CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('creator','brand')),niche TEXT NOT NULL DEFAULT '',bio TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',instagram_handle TEXT NOT NULL DEFAULT '',instagram_user_id TEXT NOT NULL DEFAULT '',instagram_access_token_enc TEXT NOT NULL DEFAULT '',instagram_connected_at TIMESTAMPTZ,instagram_token_expires_at TIMESTAMPTZ,followers BIGINT NOT NULL DEFAULT 0,engagement REAL NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT NOT NULL DEFAULT ''");
  await pool.query("CREATE TABLE IF NOT EXISTS email_action_tokens(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,purpose TEXT NOT NULL CHECK(purpose IN('verify_email','password_reset')),expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE INDEX IF NOT EXISTS email_action_tokens_user_idx ON email_action_tokens(user_id,purpose,created_at DESC)");
  await pool.query("CREATE TABLE IF NOT EXISTS support_requests(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,category TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE TABLE IF NOT EXISTS billing_orders(id BIGSERIAL PRIMARY KEY,provider TEXT NOT NULL DEFAULT 'razorpay',order_id TEXT NOT NULL UNIQUE,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,amount_paise INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'INR',plan_code TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'created',payment_id TEXT UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,paid_at TIMESTAMPTZ)");
  await pool.query("CREATE INDEX IF NOT EXISTS billing_orders_user_idx ON billing_orders(user_id,created_at DESC)");
  await pool.query("CREATE TABLE IF NOT EXISTS user_subscriptions(user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,plan_code TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',starts_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL,provider TEXT NOT NULL DEFAULT 'razorpay',provider_payment_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE TABLE IF NOT EXISTS ai_analysis_usage(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE INDEX IF NOT EXISTS ai_analysis_usage_user_time_idx ON ai_analysis_usage(user_id,requested_at DESC)");
  await pool.query("CREATE TABLE IF NOT EXISTS campaigns(id BIGSERIAL PRIMARY KEY,brand_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,brand_name TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,collaboration_type TEXT NOT NULL CHECK(collaboration_type IN('Paid','Barter','Hybrid')),budget_min BIGINT NOT NULL DEFAULT 0,budget_max BIGINT NOT NULL DEFAULT 0,deliverables TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT 'India',status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE TABLE IF NOT EXISTS applications(id BIGSERIAL PRIMARY KEY,campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,pitch TEXT NOT NULL DEFAULT '',proposed_rate BIGINT NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(campaign_id,creator_id))");
  await pool.query("CREATE TABLE IF NOT EXISTS saved_campaigns(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,campaign_id))");
  await pool.query("CREATE TABLE IF NOT EXISTS conversations(id BIGSERIAL PRIMARY KEY,application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,brand_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE TABLE IF NOT EXISTS messages(id BIGSERIAL PRIMARY KEY,conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TIMESTAMPTZ)");
  await pool.query("CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id,id)");
  await pool.query("CREATE TABLE IF NOT EXISTS notifications(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'general',entity_id BIGINT NOT NULL DEFAULT 0,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await pool.query("CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,id)");
  await pool.query("CREATE TABLE IF NOT EXISTS campaign_invitations(id BIGSERIAL PRIMARY KEY,campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,brand_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,message TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','declined')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(campaign_id,creator_id))");
  await pool.query("CREATE INDEX IF NOT EXISTS invitations_creator_idx ON campaign_invitations(creator_id,status,id)");
  await pool.query('CREATE INDEX IF NOT EXISTS campaigns_status_created_idx ON campaigns(status,created_at DESC,id DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS campaigns_brand_status_idx ON campaigns(brand_id,status,created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS applications_creator_created_idx ON applications(creator_id,created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS applications_campaign_status_idx ON applications(campaign_id,status,created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS saved_campaigns_user_created_idx ON saved_campaigns(user_id,created_at DESC)');
  if(process.env.MIGRATE_SQLITE_ON_START==='true'){
    const {migrateLegacySQLite}=require('./sqlite-to-postgres-migration');
    const sourcePath=process.env.SQLITE_MIGRATION_PATH||path.join(__dirname,'..','collabzy.db');
    const result=await migrateLegacySQLite(pool,sourcePath);
    console.log('SQLite migration status:',JSON.stringify(result));
  }
  await pool.query("INSERT INTO conversations(application_id,creator_id,brand_id) SELECT a.id,a.creator_id,c.brand_id FROM applications a JOIN campaigns c ON c.id=a.campaign_id ON CONFLICT(application_id) DO NOTHING");
  if(process.env.NODE_ENV==='production'&&process.env.SEED_DEMO_DATA!=='true')await pool.query('DELETE FROM users WHERE email=$1',['hello@collabzy.demo']);
  // Optional owner-controlled QA identity. Disabled unless all three protected settings are supplied.
  // This creates only a low-privilege creator account; it does not open public registration.
  if(process.env.COLLABZY_TEST_ACCOUNT_ENABLED==='true'){
    const testEmail=validEmail(process.env.COLLABZY_TEST_ACCOUNT_EMAIL);
    const testPassword=String(process.env.COLLABZY_TEST_ACCOUNT_PASSWORD||'');
    if(!testEmail||testPassword.length<16||testPassword.length>200)throw Error('The gated Collabzy test account requires a valid email and a password of at least 16 characters.');
    const testHash=await bcrypt.hash(testPassword,12);
    const seeded=await pool.query("INSERT INTO users(name,email,password_hash,role,niche,bio,location,email_verified_at) VALUES($1,$2,$3,'creator',$4,$5,$6,CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,email_verified_at=COALESCE(users.email_verified_at,CURRENT_TIMESTAMP) RETURNING password_hash",["Collabzy Test Creator",testEmail,testHash,"Lifestyle","Dedicated QA account; not a public customer profile.","India"]);
    if(seeded.rows.length!==1||!(await bcrypt.compare(testPassword,seeded.rows[0].password_hash)))throw Error('The gated Collabzy QA account password could not be verified.');
    console.log('Dedicated creator QA account initialized; stored password hash verified and credentials are not logged.');
  }
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next()});
  app.use(cors({origin:(origin,cb)=>{if(!origin||origin.startsWith('http://localhost')||origin.startsWith('https://localhost')||origin.startsWith('http://127.0.0.1')||origin==='https://collabzy-api.onrender.com'||origin==='capacitor://localhost')return cb(null,true);return cb(null,false)},credentials:false}));
  app.use(express.json({limit:'1mb',verify:(req,res,buf)=>{req.rawBody=Buffer.from(buf)}}));
  app.use('/api/auth',rateLimit({windowMs:900000,limit:20,standardHeaders:true,legacyHeaders:false}));
  app.use('/api/support',rateLimit({windowMs:3600000,limit:5,standardHeaders:true,legacyHeaders:false}));
  app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:true,legacyHeaders:false,skip:req=>req.path==='/health'}));
  app.use(express.static(path.join(__dirname,'..','public')));
  const notify=async(userId,title,body,kind='general',entityId=0)=>pool.query('INSERT INTO notifications(user_id,title,body,kind,entity_id) VALUES($1,$2,$3,$4,$5)',[userId,String(title).slice(0,120),String(body).slice(0,500),String(kind).slice(0,40),Number(entityId)||0]);
  const emailReady=()=>!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM);
  const requireEmailVerification=process.env.NODE_ENV==='production'&&process.env.REQUIRE_EMAIL_VERIFICATION==='true';
  const metaReady=()=>!!(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.META_REDIRECT_URI);
  const supportReady=()=>!!process.env.SUPPORT_EMAIL;
  const legalIdentityReady=()=>!!(process.env.OPERATOR_LEGAL_NAME&&process.env.OPERATOR_JURISDICTION);
  const openAiReady=()=>!!process.env.OPENAI_API_KEY;
  const razorpayCheckoutReady=()=>!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET);
  const razorpayReady=()=>!!(razorpayCheckoutReady()&&process.env.RAZORPAY_WEBHOOK_SECRET);
  const publicLaunchApproved=()=>process.env.PUBLIC_LAUNCH_APPROVED==='true';
  // Explicit allowlist for private beta testing only. Empty by default; never grants access to public users.
  const betaAccessAllowed=(user)=>{
    const allowed=String(process.env.COLLABZY_BETA_ACCESS_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    return !!user?.email&&allowed.includes(String(user.email).trim().toLowerCase());
  };
  const registrationReady=()=>!requireEmailVerification||(publicLaunchApproved()&&emailReady()&&supportReady()&&legalIdentityReady()&&openAiReady()&&razorpayReady()&&(process.env.REQUIRE_INSTAGRAM_CONFIG!=='true'||metaReady()));
  const annualPlan={code:'creator_annual_299',amountPaise:29900,currency:'INR',durationDays:365};
  const razorpayAuthorization=()=>('Basic '+Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64'));
  async function recordCapturedPayment({orderId,paymentId,amount,currency}){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query('SELECT * FROM billing_orders WHERE order_id=$1 FOR UPDATE',[orderId]);
      if(!found.rows.length)throw Error('Payment order was not created by Collabzy.');
      const order=found.rows[0];
      if(Number(order.amount_paise)!==Number(amount)||String(order.currency)!==String(currency)||Number(order.amount_paise)!==annualPlan.amountPaise||String(order.currency)!==annualPlan.currency)throw Error('Payment amount or currency does not match the Collabzy annual plan.');
      if(order.status==='paid'){
        if(order.payment_id!==paymentId)throw Error('This order has already been applied to another payment.');
        const existing=await client.query('SELECT status,expires_at FROM user_subscriptions WHERE user_id=$1',[order.user_id]);
        await client.query('COMMIT');
        return {active:existing.rows[0]?.status==='active'&&new Date(existing.rows[0].expires_at)>new Date(),expires_at:existing.rows[0]?.expires_at||null};
      }
      const prior=await client.query('SELECT starts_at,expires_at,status FROM user_subscriptions WHERE user_id=$1 FOR UPDATE',[order.user_id]);
      const now=new Date();
      let startsAt=now;
      if(prior.rows[0]?.status==='active'&&new Date(prior.rows[0].expires_at)>now)startsAt=new Date(prior.rows[0].expires_at);
      const expiresAt=new Date(startsAt.getTime()+annualPlan.durationDays*24*60*60*1000);
      await client.query("UPDATE billing_orders SET status='paid',payment_id=$2,paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP) WHERE order_id=$1",[orderId,paymentId]);
      await client.query("INSERT INTO user_subscriptions(user_id,plan_code,status,starts_at,expires_at,provider,provider_payment_id,updated_at) VALUES($1,$2,'active',$3,$4,'razorpay',$5,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status='active',starts_at=EXCLUDED.starts_at,expires_at=EXCLUDED.expires_at,provider='razorpay',provider_payment_id=EXCLUDED.provider_payment_id,updated_at=CURRENT_TIMESTAMP",[order.user_id,annualPlan.code,startsAt.toISOString(),expiresAt.toISOString(),paymentId]);
      await client.query('COMMIT');
      return {active:true,expires_at:expiresAt.toISOString()};
    }catch(error){
      try{await client.query('ROLLBACK')}catch{}
      throw error;
    }finally{client.release()}
  }
  async function sendEmailMessage({to,subject,html,text}){
    if(!emailReady())throw Error('Email delivery is not configured.');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,html,text})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error('Email delivery failed with provider status '+response.status+'.');
    return result;
  }
  async function createEmailAction(userId,email,purpose){
    const raw=crypto.randomBytes(32).toString('base64url');
    const digest=crypto.createHash('sha256').update(raw).digest('hex');
    const hours=purpose==='verify_email'?24:1;
    const base=(process.env.PUBLIC_APP_URL||'https://collabzy-api.onrender.com').replace(/\/+$/,'');
    const page=purpose==='verify_email'?'verify-email.html':'reset-password.html';
    const link=base+'/'+page+'?token='+encodeURIComponent(raw);
    await pool.query('UPDATE email_action_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL',[userId,purpose]);
    const row=await pool.query("INSERT INTO email_action_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+($4::text||' hours')::interval) RETURNING id",[userId,digest,purpose,hours]);
    const subject=purpose==='verify_email'?'Verify your Collabzy email address':'Reset your Collabzy password';
    const headline=purpose==='verify_email'?'Verify your email':'Reset your password';
    const action=purpose==='verify_email'?'Verify email address':'Choose a new password';
    const plain=purpose==='verify_email'?'Use this link to verify your Collabzy email address: ':'Use this link to reset your Collabzy password: ';
    try{
      await sendEmailMessage({to:email,subject,text:plain+link+'\nThis link expires in '+hours+' hour(s). If you did not request this, ignore this email.',html:'<!doctype html><html><body style="margin:0;background:#f7f6fb;padding:28px;font-family:Arial,sans-serif;color:#211c35"><main style="max-width:520px;margin:auto;background:#fff;padding:28px;border-radius:18px"><p style="font-weight:800;color:#7056e8">COLLABZY</p><h1 style="font-size:25px">'+headline+'</h1><p>Use the secure button below. This single-use link expires in '+hours+' hour(s).</p><p style="margin:28px 0"><a href="'+link+'" style="background:#7056e8;color:white;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">'+action+'</a></p><p style="font-size:12px;color:#77748a">If you did not request this, you can ignore the message.</p></main></body></html>'});
    }catch(error){
      await pool.query('UPDATE email_action_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1',[row.rows[0].id]);
      throw error;
    }
  }
  const auth=asyncRoute(async(q,s,n)=>{
    const raw=String(q.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!raw)return s.status(401).json({error:'Please sign in to continue.'});
    let decoded;try{decoded=jwt.verify(raw,SECRET)}catch{return s.status(401).json({error:'Session expired. Please sign in again.'})}
    const r=await pool.query('SELECT '+PROFILE_FIELDS+', (instagram_access_token_enc<>\'\') AS instagram_connected,session_version,email_verified_at FROM users WHERE id=$1',[decoded.id]);
    if(!r.rows.length)return s.status(401).json({error:'Please sign in to continue.'});
    if(Number(decoded.ver||0)!==Number(r.rows[0].session_version||0))return s.status(401).json({error:'Your session expired. Please sign in again.'});
    if(requireEmailVerification&&!r.rows[0].email_verified_at)return s.status(403).json({error:'Please verify your email before using Collabzy.'});
    q.sessionVersion=Number(r.rows[0].session_version||0);
    q.user=publicUser(r.rows[0]);n();
  });
  app.get('/api/health',asyncRoute(async(q,s)=>{await pool.query('SELECT 1');s.json({ok:true,app:'Collabzy',version:'2.3.0',database:'connected',mode:'postgres-persistent',integrations:{instagram:metaReady()?'configured':'setup_required',email:emailReady()?'configured':'setup_required',emailVerification:requireEmailVerification?'required':'not_enforced',aiAnalytics:openAiReady()?'configured':'setup_required',payments:razorpayReady()?'configured':'setup_required',support:supportReady()&&emailReady()?'configured':'setup_required',operatorIdentity:legalIdentityReady()?'configured':'setup_required',publicLaunchApproval:publicLaunchApproved()?'approved':'required',publicRegistration:registrationReady()?'open':'setup_required'}})}));
  app.get('/api/public-config',(q,s)=>s.json({operatorName:process.env.OPERATOR_LEGAL_NAME||'',jurisdiction:process.env.OPERATOR_JURISDICTION||'',supportEmail:process.env.SUPPORT_EMAIL||'',supportReady:supportReady()&&emailReady(),aiAnalyticsReady:openAiReady(),paymentsReady:razorpayReady(),annualPlan:{code:'creator_annual_299',amount:299,currency:'INR',durationDays:365}}));
  app.post('/api/auth/register',asyncRoute(async(q,s)=>{
    const name=String(q.body?.name||'').trim(),email=validEmail(q.body?.email),password=String(q.body?.password||''),role=q.body?.role||'creator';
    if(!name||!email||!password)return s.status(400).json({error:'Name, email and password are required.'});
    if(name.length>80)return s.status(400).json({error:'Name must be 80 characters or fewer.'});
    if(password.length<8||password.length>200)return s.status(400).json({error:'Password must contain 8 to 200 characters.'});
    if(!['creator','brand'].includes(role))return s.status(400).json({error:'Choose creator or brand.'});
    if(process.env.NODE_ENV==='production'&&q.body?.accepted_terms!==true)return s.status(400).json({error:'Please accept the Terms of Use and Privacy Notice.'});
    if(!registrationReady())return s.status(503).json({error:'Account creation is paused until email verification, operator/legal contact details, a monitored support mailbox, and required Meta integration are configured.'});
    const hash=await bcrypt.hash(password,12);
    try{
      const acceptedAt=q.body?.accepted_terms===true?new Date():null;
      const r=await pool.query('INSERT INTO users(name,email,password_hash,role,email_verified_at,terms_accepted_at,terms_version) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING '+PROFILE_FIELDS,[name,email,hash,role,requireEmailVerification?null:new Date(),acceptedAt,acceptedAt?'2026-10-15':'']);
      const u=r.rows[0];
      if(requireEmailVerification){
        try{await createEmailAction(u.id,email,'verify_email')}
        catch(error){console.error('Verification email delivery failed:',error.message);return s.status(503).json({error:'Your account was created but verification email delivery failed. Use Resend verification from the sign-in screen after email service is restored.'})}
        return s.status(201).json({requires_email_verification:true,message:'Check your email for a verification link before signing in.'});
      }
      s.status(201).json({token:tokenFor(u,SECRET),user:publicUser(u)});
    }catch(e){if(e.code==='23505')return s.status(409).json({error:'Email already registered.'});throw e}
  }));
  app.post('/api/auth/login',asyncRoute(async(q,s)=>{
    const email=validEmail(q.body?.email),r=await pool.query('SELECT * FROM users WHERE email=$1',[email]);
    if(!r.rows.length||!(await bcrypt.compare(String(q.body?.password||''),r.rows[0].password_hash)))return s.status(401).json({error:'Email or password is incorrect.'});
    if(requireEmailVerification&&!r.rows[0].email_verified_at)return s.status(403).json({error:'Please verify your email before signing in. Use Resend verification if you need a new link.'});
    const u=publicUser(r.rows[0]);s.json({token:tokenFor(r.rows[0],SECRET),user:u});
  }));
  app.post('/api/auth/verify-email',asyncRoute(async(q,s)=>{
    const raw=String(q.body?.token||'').trim();
    if(!raw||raw.length>200)return s.status(400).json({error:'This verification link is invalid or has expired.'});
    const digest=crypto.createHash('sha256').update(raw).digest('hex'),client=await pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query("SELECT t.id,t.user_id FROM email_action_tokens t WHERE t.token_hash=$1 AND t.purpose='verify_email' AND t.consumed_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP FOR UPDATE",[digest]);
      if(!found.rows.length){await client.query('ROLLBACK');return s.status(400).json({error:'This verification link is invalid, expired, or already used.'})}
      await client.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP) WHERE id=$1',[found.rows[0].user_id]);
      await client.query('UPDATE email_action_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1',[found.rows[0].id]);
      await client.query('COMMIT');s.json({ok:true,message:'Email verified. You can now sign in.'});
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }));
  app.post('/api/auth/resend-verification',asyncRoute(async(q,s)=>{
    const email=validEmail(q.body?.email);
    if(requireEmailVerification&&!emailReady())return s.status(503).json({error:'Email verification service is not configured yet.'});
    if(email&&emailReady()){
      const found=await pool.query('SELECT id,email_verified_at FROM users WHERE email=$1',[email]);
      if(found.rows.length&&!found.rows[0].email_verified_at){
        try{await createEmailAction(found.rows[0].id,email,'verify_email')}
        catch(error){console.error('Resend verification delivery failed:',error.message)}
      }
    }
    s.json({ok:true,message:'If an unverified account exists for that address, a new verification link will be sent.'});
  }));
  app.post('/api/auth/forgot-password',asyncRoute(async(q,s)=>{
    const email=validEmail(q.body?.email);
    if(!emailReady())return s.status(503).json({error:'Password recovery email is not configured yet.'});
    if(email){
      const found=await pool.query('SELECT id,email FROM users WHERE email=$1',[email]);
      if(found.rows.length){
        try{await createEmailAction(found.rows[0].id,email,'password_reset')}
        catch(error){console.error('Password reset delivery failed:',error.message)}
      }
    }
    s.json({ok:true,message:'If that account exists, a password reset link will be sent.'});
  }));
  app.post('/api/auth/reset-password',asyncRoute(async(q,s)=>{
    const raw=String(q.body?.token||'').trim(),password=String(q.body?.password||'');
    if(password.length<8||password.length>200)return s.status(400).json({error:'Password must contain 8 to 200 characters.'});
    if(!raw||raw.length>200)return s.status(400).json({error:'This reset link is invalid or has expired.'});
    const digest=crypto.createHash('sha256').update(raw).digest('hex'),passwordHash=await bcrypt.hash(password,12),client=await pool.connect();
    try{
      await client.query('BEGIN');
      const found=await client.query("SELECT t.id,t.user_id FROM email_action_tokens t WHERE t.token_hash=$1 AND t.purpose='password_reset' AND t.consumed_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP FOR UPDATE",[digest]);
      if(!found.rows.length){await client.query('ROLLBACK');return s.status(400).json({error:'This reset link is invalid, expired, or already used.'})}
      await client.query('UPDATE users SET password_hash=$1,session_version=session_version+1 WHERE id=$2',[passwordHash,found.rows[0].user_id]);
      await client.query('UPDATE email_action_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1',[found.rows[0].id]);
      await client.query('UPDATE email_action_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL',[found.rows[0].user_id,'verify_email']);
      await client.query('COMMIT');s.json({ok:true,message:'Password reset. Please sign in again.'});
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }));
  app.get('/api/me',auth,asyncRoute(async(q,s)=>s.json({user:q.user})));
  app.patch('/api/me',auth,asyncRoute(async(q,s)=>{
    const b=q.body||{},setters=[],values=[];
    const stored=await pool.query("SELECT (instagram_access_token_enc<>'') AS instagram_connected FROM users WHERE id=$1",[q.user.id]);
    const instagramConnected=!!stored.rows[0]?.instagram_connected;
    const allowed={name:80,niche:100,bio:500,location:100,instagram_handle:100};
    for(const[k,max]of Object.entries(allowed))if(b[k]!==undefined){if(instagramConnected&&k==='instagram_handle')continue;const value=String(b[k]||'').trim();if(k==='name'&&!value)return s.status(400).json({error:'Name cannot be empty.'});setters.push(k+'=$'+(values.length+1));values.push(value.slice(0,max))}
    if(b.followers!==undefined&&!instagramConnected){setters.push('followers=$'+(values.length+1));values.push(Math.max(0,Math.min(100000000,Number(b.followers)||0)))}
    if(b.engagement!==undefined){setters.push('engagement=$'+(values.length+1));values.push(Math.max(0,Math.min(100,Number(b.engagement)||0)))}
    if(setters.length)await pool.query('UPDATE users SET '+setters.join(',')+' WHERE id=$'+(values.length+1),[...values,q.user.id]);
    const r=await pool.query("SELECT "+PROFILE_FIELDS+", (instagram_access_token_enc <> '') AS instagram_connected FROM users WHERE id=$1",[q.user.id]);s.json({user:r.rows[0]});
  }));
  app.patch('/api/me/password',auth,asyncRoute(async(q,s)=>{
    const current=String(q.body?.current_password||''),next=String(q.body?.new_password||'');
    if(next.length<8||next.length>200)return s.status(400).json({error:'New password must contain 8 to 200 characters.'});
    const r=await pool.query('SELECT password_hash FROM users WHERE id=$1',[q.user.id]);
    if(!r.rows.length||!(await bcrypt.compare(current,r.rows[0].password_hash)))return s.status(400).json({error:'Current password is incorrect.'});
    const nextVersion=q.sessionVersion+1;
    await pool.query('UPDATE users SET password_hash=$1,session_version=$2 WHERE id=$3',[await bcrypt.hash(next,12),nextVersion,q.user.id]);
    s.json({ok:true,token:tokenFor({...q.user,session_version:nextVersion},SECRET)});
  }));
  app.get('/api/me/export',auth,asyncRoute(async(q,s)=>{
    const id=q.user.id,brand=q.user.role==='brand';
    const [profile,campaigns,applications,messages,saved,invitations,notifications]=await Promise.all([
      pool.query('SELECT '+PROFILE_FIELDS+',terms_accepted_at,terms_version FROM users WHERE id=$1',[id]),
      brand?pool.query('SELECT * FROM campaigns WHERE brand_id=$1 ORDER BY id',[id]):pool.query('SELECT * FROM campaigns WHERE false'),
      pool.query(brand?'SELECT a.*,c.title campaign_title,u.name creator_name FROM applications a JOIN campaigns c ON c.id=a.campaign_id JOIN users u ON u.id=a.creator_id WHERE c.brand_id=$1 ORDER BY a.id':'SELECT a.*,c.title campaign_title,c.brand_name FROM applications a JOIN campaigns c ON c.id=a.campaign_id WHERE a.creator_id=$1 ORDER BY a.id',[id]),
      pool.query('SELECT m.id,m.conversation_id,m.sender_id,m.body,m.created_at,m.read_at FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.creator_id=$1 OR c.brand_id=$1 ORDER BY m.id',[id]),
      pool.query('SELECT campaign_id,created_at FROM saved_campaigns WHERE user_id=$1 ORDER BY created_at',[id]),
      pool.query('SELECT * FROM campaign_invitations WHERE creator_id=$1 OR brand_id=$1 ORDER BY id',[id]),
      pool.query('SELECT id,title,body,kind,entity_id,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY id',[id])
    ]);
    s.setHeader('Content-Disposition','attachment; filename="collabzy-account-export.json"');s.json({exported_at:new Date().toISOString(),profile:profile.rows[0],campaigns:campaigns.rows,applications:applications.rows,messages:messages.rows,saved_campaigns:saved.rows,invitations:invitations.rows,notifications:notifications.rows});
  }));
  app.delete('/api/me',auth,asyncRoute(async(q,s)=>{
    const password=String(q.body?.password||''),r=await pool.query('SELECT password_hash FROM users WHERE id=$1',[q.user.id]);
    if(!r.rows.length||!(await bcrypt.compare(password,r.rows[0].password_hash)))return s.status(400).json({error:'Password is incorrect; account was not deleted.'});
    await pool.query('DELETE FROM users WHERE id=$1',[q.user.id]);s.json({ok:true,deleted:true});
  }));
  app.get('/api/campaigns',asyncRoute(async(q,s)=>{
    let sql="SELECT c.*,u.email brand_email FROM campaigns c JOIN users u ON u.id=c.brand_id WHERE c.status='active'",args=[];
    if(q.query.q){args.push('%'+String(q.query.q).slice(0,80)+'%');sql+=' AND (c.title ILIKE $'+args.length+' OR c.brand_name ILIKE $'+args.length+' OR c.description ILIKE $'+args.length+')'}
    if(q.query.category&&q.query.category!=='All'){args.push(String(q.query.category).slice(0,60));sql+=' AND c.category=$'+args.length}
    if(q.query.type&&q.query.type!=='All'){args.push(String(q.query.type));sql+=' AND c.collaboration_type=$'+args.length}
    sql+=' ORDER BY c.created_at DESC,c.id DESC LIMIT 200';
    const r=await pool.query(sql,args);s.json({campaigns:r.rows.map(c=>{const{brand_email,...campaign}=c;return{...campaign,is_sample:false}})});
  }));
  app.post('/api/campaigns',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brand accounts can publish campaigns.'});
    const b=q.body||{};if(!b.title||!b.description||!b.category||!['Paid','Barter','Hybrid'].includes(b.collaboration_type))return s.status(400).json({error:'Enter campaign details and choose Paid, Barter or Hybrid.'});
    const low=Math.max(0,Number(b.budget_min)||0),high=Math.max(low,Number(b.budget_max)||0);
    const r=await pool.query('INSERT INTO campaigns(brand_id,title,brand_name,description,category,collaboration_type,budget_min,budget_max,deliverables,location) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[q.user.id,String(b.title).slice(0,120),q.user.name,String(b.description).slice(0,1500),String(b.category).slice(0,60),b.collaboration_type,low,high,String(b.deliverables||'').slice(0,300),String(b.location||'India').slice(0,100)]);
    s.status(201).json({campaign:r.rows[0]});
  }));
  app.patch('/api/campaigns/:id',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brands can edit campaigns.'});
    const id=Number(q.params.id),b=q.body||{},found=await pool.query('SELECT * FROM campaigns WHERE id=$1 AND brand_id=$2',[id,q.user.id]);if(!found.rows.length)return s.status(404).json({error:'Campaign not found.'});
    const c=found.rows[0],title=String(b.title===undefined?c.title:b.title).trim().slice(0,120),description=String(b.description===undefined?c.description:b.description).trim().slice(0,1500),category=String(b.category===undefined?c.category:b.category).trim().slice(0,60),type=String(b.collaboration_type===undefined?c.collaboration_type:b.collaboration_type),low=b.budget_min===undefined?Number(c.budget_min):Math.max(0,Number(b.budget_min)||0),high=b.budget_max===undefined?Number(c.budget_max):Math.max(0,Number(b.budget_max)||0),deliverables=String(b.deliverables===undefined?c.deliverables:b.deliverables).slice(0,300),location=String(b.location===undefined?c.location:b.location).slice(0,100);
    if(!title||!description||!category||!['Paid','Barter','Hybrid'].includes(type))return s.status(400).json({error:'Enter a title, brief, category and valid collaboration type.'});
    if(high<low)return s.status(400).json({error:'Maximum budget must be at least the minimum budget.'});
    const r=await pool.query('UPDATE campaigns SET title=$1,description=$2,category=$3,collaboration_type=$4,budget_min=$5,budget_max=$6,deliverables=$7,location=$8 WHERE id=$9 AND brand_id=$10 RETURNING *',[title,description,category,type,low,high,deliverables,location,id,q.user.id]);s.json({campaign:r.rows[0]});
  }));
  app.get('/api/saved-campaigns',auth,asyncRoute(async(q,s)=>{
    const r=await pool.query("SELECT c.*,sc.created_at saved_at FROM saved_campaigns sc JOIN campaigns c ON c.id=sc.campaign_id WHERE sc.user_id=$1 AND c.status='active' ORDER BY sc.created_at DESC",[q.user.id]);s.json({campaigns:r.rows.map(c=>({...c,is_sample:false}))});
  }));
  app.post('/api/campaigns/:id/save',auth,asyncRoute(async(q,s)=>{
    const id=Number(q.params.id);const c=await pool.query("SELECT id FROM campaigns WHERE id=$1 AND status='active'",[id]);if(!c.rows.length)return s.status(404).json({error:'Campaign unavailable.'});
    await pool.query('INSERT INTO saved_campaigns(user_id,campaign_id) VALUES($1,$2) ON CONFLICT(user_id,campaign_id) DO NOTHING',[q.user.id,id]);s.json({ok:true,saved:true});
  }));
  app.delete('/api/campaigns/:id/save',auth,asyncRoute(async(q,s)=>{await pool.query('DELETE FROM saved_campaigns WHERE user_id=$1 AND campaign_id=$2',[q.user.id,Number(q.params.id)]);s.json({ok:true,saved:false})}));
  app.post('/api/campaigns/:id/apply',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='creator')return s.status(403).json({error:'Only creator accounts can apply.'});
    const c=await pool.query("SELECT id,brand_id,title FROM campaigns WHERE id=$1 AND status='active'",[Number(q.params.id)]);if(!c.rows.length)return s.status(404).json({error:'Campaign unavailable.'});
    const b=q.body||{};
    try{
      const inserted=await pool.query('INSERT INTO applications(campaign_id,creator_id,pitch,proposed_rate) VALUES($1,$2,$3,$4) RETURNING *',[c.rows[0].id,q.user.id,String(b.pitch||'').slice(0,1000),Math.max(0,Number(b.proposed_rate)||0)]);
      const a=inserted.rows[0];
      await pool.query('INSERT INTO conversations(application_id,creator_id,brand_id) VALUES($1,$2,$3) ON CONFLICT(application_id) DO NOTHING',[a.id,q.user.id,c.rows[0].brand_id]);
      await notify(c.rows[0].brand_id,'New campaign application',q.user.name+' applied to '+c.rows[0].title+'.','application',a.id);
      s.status(201).json({application:a});
    }catch(e){if(e.code==='23505')return s.status(409).json({error:'Already applied to this campaign.'});throw e}
  }));
  app.get('/api/applications',auth,asyncRoute(async(q,s)=>{
    const r=q.user.role==='creator'
      ?await pool.query('SELECT a.*,c.title campaign_title,c.brand_name,c.collaboration_type,c.category FROM applications a JOIN campaigns c ON c.id=a.campaign_id WHERE a.creator_id=$1 ORDER BY a.created_at DESC',[q.user.id])
      :await pool.query('SELECT a.*,c.title campaign_title,c.brand_name,u.name creator_name,u.niche,u.followers,u.engagement FROM applications a JOIN campaigns c ON c.id=a.campaign_id JOIN users u ON u.id=a.creator_id WHERE c.brand_id=$1 ORDER BY a.created_at DESC',[q.user.id]);
    s.json({applications:r.rows});
  }));
  app.patch('/api/applications/:id/status',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brands can update applications.'});
    const r=await pool.query('SELECT a.*,c.brand_id,c.title FROM applications a JOIN campaigns c ON c.id=a.campaign_id WHERE a.id=$1',[Number(q.params.id)]);
    if(!r.rows.length)return s.status(404).json({error:'Application not found.'});
    const a=r.rows[0];if(String(a.brand_id)!==String(q.user.id))return s.status(403).json({error:'Not your campaign.'});
    const status=String(q.body?.status||'');if(!['pending','accepted','declined','completed'].includes(status))return s.status(400).json({error:'Invalid status.'});
    await pool.query('UPDATE applications SET status=$1 WHERE id=$2',[status,a.id]);await notify(a.creator_id,'Application '+status,'Your application for '+a.title+' was '+status+'.','application',a.id);s.json({ok:true});
  }));
  app.get('/api/dashboard',auth,asyncRoute(async(q,s)=>{
    const id=q.user.id,role=q.user.role;
    const [active,myCampaigns,myApplications,received,accepted,unreadMessages,unreadNotifications,saved]=await Promise.all([
      pool.query("SELECT COUNT(*)::int n FROM campaigns WHERE status='active'"),
      pool.query('SELECT COUNT(*)::int n FROM campaigns WHERE brand_id=$1',[id]),
      pool.query('SELECT COUNT(*)::int n FROM applications WHERE creator_id=$1',[id]),
      pool.query('SELECT COUNT(*)::int n FROM applications a JOIN campaigns c ON c.id=a.campaign_id WHERE c.brand_id=$1',[id]),
      pool.query("SELECT COUNT(*)::int n FROM applications WHERE creator_id=$1 AND status='accepted'",[id]),
      pool.query("SELECT COUNT(*)::int n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.sender_id<>$1 AND m.read_at IS NULL AND (c.creator_id=$1 OR c.brand_id=$1)",[id]),
      pool.query('SELECT COUNT(*)::int n FROM notifications WHERE user_id=$1 AND read_at IS NULL',[id]),
      pool.query('SELECT COUNT(*)::int n FROM saved_campaigns WHERE user_id=$1',[id])
    ]);
    s.json({stats:{role,activeCampaigns:active.rows[0].n,myCampaigns:role==='brand'?myCampaigns.rows[0].n:0,myApplications:myApplications.rows[0].n,receivedApplications:role==='brand'?received.rows[0].n:0,accepted:accepted.rows[0].n,unreadMessages:unreadMessages.rows[0].n,unreadNotifications:unreadNotifications.rows[0].n,savedCampaigns:saved.rows[0].n}});
  }));
  app.get('/api/my-campaigns',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brands have a campaign manager.'});
    const r=await pool.query('SELECT c.*,COUNT(a.id)::int application_count FROM campaigns c LEFT JOIN applications a ON a.campaign_id=c.id WHERE c.brand_id=$1 GROUP BY c.id ORDER BY c.created_at DESC',[q.user.id]);s.json({campaigns:r.rows});
  }));
  app.patch('/api/campaigns/:id/manage',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brands can manage campaigns.'});
    const status=String(q.body?.status||'');if(!['active','closed'].includes(status))return s.status(400).json({error:'Status must be active or closed.'});
    const r=await pool.query('UPDATE campaigns SET status=$1 WHERE id=$2 AND brand_id=$3 RETURNING id',[status,Number(q.params.id),q.user.id]);if(!r.rows.length)return s.status(404).json({error:'Campaign not found.'});s.json({ok:true,status});
  }));
  app.get('/api/creators',auth,asyncRoute(async(q,s)=>{
    const args=[];let sql="SELECT id,name,niche,bio,location,instagram_handle,followers,engagement,created_at,(instagram_access_token_enc<>'') instagram_connected FROM users WHERE role='creator'";
    if(q.query.q){args.push('%'+String(q.query.q).slice(0,80)+'%');sql+=' AND (name ILIKE $'+args.length+' OR niche ILIKE $'+args.length+' OR bio ILIKE $'+args.length+' OR instagram_handle ILIKE $'+args.length+')'}
    if(q.query.niche){args.push('%'+String(q.query.niche).slice(0,80)+'%');sql+=' AND niche ILIKE $'+args.length}
    if(q.query.location){args.push('%'+String(q.query.location).slice(0,80)+'%');sql+=' AND location ILIKE $'+args.length}
    sql+=' ORDER BY followers DESC,created_at DESC LIMIT 80';const r=await pool.query(sql,args);s.json({creators:r.rows});
  }));
  app.get('/api/invitations',auth,asyncRoute(async(q,s)=>{
    const r=q.user.role==='creator'
      ?await pool.query('SELECT i.*,c.title campaign_title,c.category,c.collaboration_type,c.budget_min,c.budget_max,b.name brand_name FROM campaign_invitations i JOIN campaigns c ON c.id=i.campaign_id JOIN users b ON b.id=i.brand_id WHERE i.creator_id=$1 ORDER BY i.id DESC',[q.user.id])
      :await pool.query('SELECT i.*,c.title campaign_title,c.category,c.collaboration_type,c.budget_min,c.budget_max,u.name creator_name,u.niche,u.followers,u.engagement FROM campaign_invitations i JOIN campaigns c ON c.id=i.campaign_id JOIN users u ON u.id=i.creator_id WHERE i.brand_id=$1 ORDER BY i.id DESC',[q.user.id]);
    s.json({invitations:r.rows});
  }));
  app.post('/api/campaigns/:id/invite',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='brand')return s.status(403).json({error:'Only brands can invite creators.'});
    const c=await pool.query("SELECT * FROM campaigns WHERE id=$1 AND brand_id=$2 AND status='active'",[Number(q.params.id),q.user.id]);if(!c.rows.length)return s.status(404).json({error:'Active campaign not found in your brand account.'});
    const creator=await pool.query("SELECT id,name FROM users WHERE id=$1 AND role='creator'",[Number(q.body?.creator_id)]);if(!creator.rows.length)return s.status(404).json({error:'Creator profile not found.'});
    const message=String(q.body?.message||'').trim().slice(0,1000);
    try{const r=await pool.query('INSERT INTO campaign_invitations(campaign_id,brand_id,creator_id,message) VALUES($1,$2,$3,$4) RETURNING *',[c.rows[0].id,q.user.id,creator.rows[0].id,message]);await notify(creator.rows[0].id,'New campaign invitation',q.user.name+' invited you to '+c.rows[0].title+'. '+message,'invitation',r.rows[0].id);s.status(201).json({invitation:r.rows[0]})}
    catch(e){if(e.code==='23505')return s.status(409).json({error:'You already invited this creator to this campaign.'});throw e}
  }));
  app.patch('/api/invitations/:id/respond',auth,asyncRoute(async(q,s)=>{
    if(q.user.role!=='creator')return s.status(403).json({error:'Only creator accounts can respond to invitations.'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const r=await client.query('SELECT i.*,c.title,c.budget_min,c.brand_id,b.name brand_name FROM campaign_invitations i JOIN campaigns c ON c.id=i.campaign_id JOIN users b ON b.id=i.brand_id WHERE i.id=$1 AND i.creator_id=$2 FOR UPDATE',[Number(q.params.id),q.user.id]);
      if(!r.rows.length){await client.query('ROLLBACK');return s.status(404).json({error:'Invitation not found.'})}
      const i=r.rows[0];if(i.status!=='pending'){await client.query('ROLLBACK');return s.status(409).json({error:'This invitation has already been answered.'})}
      const status=String(q.body?.status||'');if(!['accepted','declined'].includes(status)){await client.query('ROLLBACK');return s.status(400).json({error:'Choose accepted or declined.'})}
      await client.query('UPDATE campaign_invitations SET status=$1 WHERE id=$2',[status,i.id]);
      if(status==='accepted'){
        let appRow=await client.query('SELECT * FROM applications WHERE campaign_id=$1 AND creator_id=$2',[i.campaign_id,q.user.id]);
        if(!appRow.rows.length)appRow=await client.query("INSERT INTO applications(campaign_id,creator_id,pitch,proposed_rate) VALUES($1,$2,$3,$4) RETURNING *",[i.campaign_id,q.user.id,'Accepted invitation from '+i.brand_name+'.',Math.max(0,Number(i.budget_min)||0)]);
        await client.query('INSERT INTO conversations(application_id,creator_id,brand_id) VALUES($1,$2,$3) ON CONFLICT(application_id) DO NOTHING',[appRow.rows[0].id,q.user.id,i.brand_id]);
        await client.query('INSERT INTO notifications(user_id,title,body,kind,entity_id) VALUES($1,$2,$3,$4,$5)',[i.brand_id,'Creator accepted invitation',q.user.name+' accepted the invitation for '+i.title+'.','invitation',i.id]);
      }else await client.query('INSERT INTO notifications(user_id,title,body,kind,entity_id) VALUES($1,$2,$3,$4,$5)',[i.brand_id,'Creator declined invitation',q.user.name+' declined the invitation for '+i.title+'.','invitation',i.id]);
      const updated=await client.query('SELECT * FROM campaign_invitations WHERE id=$1',[i.id]);await client.query('COMMIT');s.json({invitation:updated.rows[0]});
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  }));
  app.get('/api/notifications',auth,asyncRoute(async(q,s)=>{const r=await pool.query('SELECT id,title,body,kind,entity_id,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[q.user.id]);s.json({notifications:r.rows,unread:r.rows.filter(x=>!x.read_at).length})}));
  app.patch('/api/notifications/read-all',auth,asyncRoute(async(q,s)=>{await pool.query('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND read_at IS NULL',[q.user.id]);s.json({ok:true})}));
  app.get('/api/conversations',auth,asyncRoute(async(q,s)=>{
    const sql="SELECT c.id,c.application_id,c.creator_id,c.brand_id,c.updated_at,a.status application_status,a.campaign_id,p.title campaign_title,CASE WHEN c.creator_id=$1 THEN b.name ELSE cr.name END counterpart_name,CASE WHEN c.creator_id=$1 THEN b.id ELSE cr.id END counterpart_id,(SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_message,(SELECT created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_message_at,(SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.read_at IS NULL) unread FROM conversations c JOIN applications a ON a.id=c.application_id JOIN campaigns p ON p.id=a.campaign_id JOIN users cr ON cr.id=c.creator_id JOIN users b ON b.id=c.brand_id WHERE c.creator_id=$1 OR c.brand_id=$1 ORDER BY COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id=c.id),c.id) DESC";
    const r=await pool.query(sql,[q.user.id]);s.json({conversations:r.rows});
  }));
  app.get('/api/conversations/:id/messages',auth,asyncRoute(async(q,s)=>{
    const c=await pool.query('SELECT * FROM conversations WHERE id=$1 AND (creator_id=$2 OR brand_id=$2)',[Number(q.params.id),q.user.id]);if(!c.rows.length)return s.status(404).json({error:'Conversation not found.'});
    await pool.query('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL',[c.rows[0].id,q.user.id]);
    const r=await pool.query('SELECT m.id,m.sender_id,m.body,m.created_at,m.read_at,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 ORDER BY m.id ASC LIMIT 300',[c.rows[0].id]);s.json({messages:r.rows,conversation:{id:c.rows[0].id,application_id:c.rows[0].application_id}});
  }));
  app.post('/api/conversations/:id/messages',auth,asyncRoute(async(q,s)=>{
    const c=await pool.query('SELECT * FROM conversations WHERE id=$1 AND (creator_id=$2 OR brand_id=$2)',[Number(q.params.id),q.user.id]);if(!c.rows.length)return s.status(404).json({error:'Conversation not found.'});
    const body=String(q.body?.body||'').trim();if(!body||body.length>2000)return s.status(400).json({error:'Message must contain 1–2,000 characters.'});
    const r=await pool.query('INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',[c.rows[0].id,q.user.id,body]);
    await pool.query('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1',[c.rows[0].id]);const recipient=String(q.user.id)===String(c.rows[0].creator_id)?c.rows[0].brand_id:c.rows[0].creator_id;
    await notify(recipient,'New collaboration message',q.user.name+': '+body.slice(0,160),'message',c.rows[0].id);s.status(201).json({message:r.rows[0]});
  }));
  app.post('/api/support',asyncRoute(async(q,s)=>{
    const name=String(q.body?.name||'').trim().slice(0,80),email=validEmail(q.body?.email),category=String(q.body?.category||'general'),subject=String(q.body?.subject||'').trim().slice(0,120),message=String(q.body?.message||'').trim().slice(0,4000);
    if(!name||!email||subject.length<4||message.length<20)return s.status(400).json({error:'Enter your name, a valid email, a subject, and a message of at least 20 characters.'});
    if(!['general','privacy','deletion','security'].includes(category))return s.status(400).json({error:'Choose a valid request category.'});
    if(!emailReady()||!supportReady())return s.status(503).json({error:'The support channel is not configured yet. Account self-service controls remain available in Profile.'});
    const saved=await pool.query('INSERT INTO support_requests(name,email,category,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[name,email,category,subject,message]);
    try{
      await sendEmailMessage({to:process.env.SUPPORT_EMAIL,subject:'[Collabzy '+category+'] '+subject,text:'Request ID: '+saved.rows[0].id+'\nFrom: '+name+' <'+email+'>\nCategory: '+category+'\n\n'+message,html:'<!doctype html><html><body style="font-family:Arial,sans-serif;color:#211c35"><h2>Collabzy support request #'+saved.rows[0].id+'</h2><p><b>From:</b> '+htmlEscape(name)+' &lt;'+htmlEscape(email)+'&gt;</p><p><b>Category:</b> '+htmlEscape(category)+'</p><p><b>Subject:</b> '+htmlEscape(subject)+'</p><pre style="white-space:pre-wrap">'+htmlEscape(message)+'</pre></body></html>'});
    }catch(error){console.error('Support notification delivery failed:',error.message);return s.status(202).json({ok:true,request_id:saved.rows[0].id,message:'Your request was stored, but notification delivery failed. Please retry later if you do not receive an acknowledgement.'})}
    s.status(201).json({ok:true,request_id:saved.rows[0].id,message:'Your request was sent to Collabzy support.'});
  }));
  app.post('/api/instagram/disconnect',auth,asyncRoute(async(q,s)=>{await pool.query("UPDATE users SET instagram_user_id='',instagram_access_token_enc='',instagram_connected_at=NULL,instagram_token_expires_at=NULL,instagram_handle='',followers=0 WHERE id=$1",[q.user.id]);s.json({ok:true,connected:false})}));
  async function accessForInstagram(userId,row){
    let access=decryptToken(row.instagram_access_token_enc,SECRET),expires=Date.parse(row.instagram_token_expires_at||'');
    if(!Number.isFinite(expires)||expires-Date.now()>7*24*60*60*1000)return access;
    if(expires<=Date.now())throw Error('Instagram access token expired. Disconnect and reconnect your account.');
    const url=new URL('https://graph.instagram.com/refresh_access_token');url.searchParams.set('grant_type','ig_refresh_token');url.searchParams.set('access_token',access);
    const response=await fetch(url),data=await response.json();
    if(!response.ok||!data.access_token)throw Error(data.error?.message||'Instagram token refresh failed. Reconnect your account.');
    access=data.access_token;const next=new Date(Date.now()+(Number(data.expires_in)||5184000)*1000).toISOString();
    await pool.query('UPDATE users SET instagram_access_token_enc=$1,instagram_token_expires_at=$2 WHERE id=$3',[encryptToken(access,SECRET),next,userId]);return access;
  }
  app.get('/api/instagram/connect',auth,asyncRoute(async(q,s)=>{
    if(!metaReady())return s.status(503).json({error:'Instagram connection is not configured yet. Add META_APP_ID, META_APP_SECRET and the exact META_REDIRECT_URI in hosting settings and Meta app configuration.'});
    const redirect=process.env.META_REDIRECT_URI;
    const state=jwt.sign({sub:String(q.user.id),purpose:'instagram-oauth',platform:q.query.platform==='native'?'native':'web',nonce:crypto.randomBytes(16).toString('hex')},SECRET,{expiresIn:'10m'});
    const u=new URL('https://www.instagram.com/oauth/authorize');u.searchParams.set('client_id',process.env.META_APP_ID);u.searchParams.set('redirect_uri',redirect);u.searchParams.set('response_type','code');u.searchParams.set('scope','instagram_business_basic,instagram_business_manage_insights');u.searchParams.set('state',state);s.json({authorization_url:u.toString()});
  }));
  app.get('/api/instagram/callback',asyncRoute(async(q,s)=>{
    let state=null;const done=result=>s.redirect(state?.platform==='native'?'collabzy://instagram/callback?instagram='+encodeURIComponent(result):'/?instagram='+encodeURIComponent(result));
    try{if(q.query.state)state=jwt.verify(String(q.query.state),SECRET)}catch{}
    if(q.query.error)return done('denied');if(!q.query.code||!state)return done('error');
    try{
      if(state.purpose!=='instagram-oauth'||!state.sub)throw Error('Invalid OAuth state');
      if(!metaReady())throw Error('Meta credentials and exact redirect URI are required');
      const redirect=process.env.META_REDIRECT_URI;
      const form=new URLSearchParams({client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,grant_type:'authorization_code',redirect_uri:redirect,code:String(q.query.code)});
      const exchange=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form}),tokenData=await exchange.json();
      if(!exchange.ok||!tokenData.access_token)throw Error(tokenData.error_message||'Instagram token exchange failed');
      let accessToken=tokenData.access_token,tokenExpiresAt=new Date(Date.now()+(Number(tokenData.expires_in)||3600)*1000).toISOString();
      const longUrl=new URL('https://graph.instagram.com/access_token');longUrl.searchParams.set('grant_type','ig_exchange_token');longUrl.searchParams.set('client_secret',process.env.META_APP_SECRET);longUrl.searchParams.set('access_token',accessToken);
      const longRes=await fetch(longUrl),longData=await longRes.json();if(!longRes.ok||!longData.access_token)throw Error(longData.error?.message||'Could not exchange the short-lived Instagram token');accessToken=longData.access_token;tokenExpiresAt=new Date(Date.now()+(Number(longData.expires_in)||5184000)*1000).toISOString();
      const profileUrl=new URL('https://graph.instagram.com/me');profileUrl.searchParams.set('fields','id,user_id,username,account_type,media_count,followers_count');profileUrl.searchParams.set('access_token',accessToken);
      let profileRes=await fetch(profileUrl),profile=await profileRes.json();if(!profileRes.ok){profileUrl.searchParams.set('fields','user_id,id,username,account_type,media_count');profileRes=await fetch(profileUrl);profile=await profileRes.json()}
      const instagramAccountId=String(profile.user_id||profile.id||'').trim();
      if(!profileRes.ok||!instagramAccountId)throw Error(profile.error?.message||'Could not read the authorized Instagram profile');
      const followers=Number(profile.followers_count);const updated=await pool.query('UPDATE users SET instagram_handle=$1,instagram_user_id=$2,instagram_access_token_enc=$3,instagram_connected_at=CURRENT_TIMESTAMP,instagram_token_expires_at=$4,followers=CASE WHEN $5::double precision>=0 THEN $5 ELSE followers END WHERE id=$6',[String(profile.username||'').slice(0,100),instagramAccountId,encryptToken(accessToken,SECRET),tokenExpiresAt,Number.isFinite(followers)?followers:-1,Number(state.sub)]);
      if(!updated.rowCount)throw Error('Collabzy account no longer exists. Sign in again and reconnect Instagram.');
      return done('connected');
    }catch(e){console.error('Instagram OAuth callback failed:',e.message);return done('error')}
  }));
  app.get('/api/instagram/status',auth,asyncRoute(async(q,s)=>{
    const r=await pool.query('SELECT instagram_handle,instagram_user_id,instagram_access_token_enc,instagram_connected_at,instagram_token_expires_at FROM users WHERE id=$1',[q.user.id]),u=r.rows[0];
    s.json({connected:!!u?.instagram_access_token_enc,handle:u?.instagram_handle||'',instagram_user_id:u?.instagram_user_id||'',connected_at:u?.instagram_connected_at||'',token_expires_at:u?.instagram_token_expires_at||'',mode:metaReady()?'oauth-configured':'setup-required',message:u?.instagram_access_token_enc?'Instagram account connected.':metaReady()?'Ready to connect via Meta authorization.':'Add Meta app credentials and register the exact redirect URI to enable official Instagram authorization.'});
  }));
  app.get('/api/instagram/media',auth,asyncRoute(async(q,s)=>{
    const r=await pool.query('SELECT instagram_access_token_enc,instagram_handle,instagram_token_expires_at FROM users WHERE id=$1',[q.user.id]),u=r.rows[0];if(!u?.instagram_access_token_enc)return s.status(400).json({error:'Connect your Instagram professional account first.'});
    try{const access=await accessForInstagram(q.user.id,u),url=new URL('https://graph.instagram.com/me/media');url.searchParams.set('fields','id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count');url.searchParams.set('limit','12');url.searchParams.set('access_token',access);const apiRes=await fetch(url),data=await apiRes.json();if(!apiRes.ok)return s.status(502).json({error:data.error?.message||'Instagram media is unavailable for the current account or permissions.'});s.json({handle:u.instagram_handle,media:data.data||[],connected:true})}
    catch(e){s.status(502).json({error:e.message||'Could not retrieve Instagram media.'})}
  }));
  app.get('/api/instagram/insights',auth,asyncRoute(async(q,s)=>{
    const r=await pool.query('SELECT instagram_user_id,instagram_access_token_enc,instagram_handle,instagram_token_expires_at FROM users WHERE id=$1',[q.user.id]),u=r.rows[0];if(!u?.instagram_access_token_enc)return s.status(400).json({error:'Connect your Instagram professional account first.'});
    try{const access=await accessForInstagram(q.user.id,u),url=new URL('https://graph.instagram.com/'+encodeURIComponent(u.instagram_user_id)+'/insights');url.searchParams.set('metric','views,reach,accounts_engaged,total_interactions');url.searchParams.set('period','day');url.searchParams.set('access_token',access);const apiRes=await fetch(url),data=await apiRes.json();if(!apiRes.ok)return s.status(502).json({error:data.error?.message||'Instagram insights are unavailable for the current account or permissions.'});s.json({handle:u.instagram_handle,insights:data.data||[],connected:true})}
    catch(e){s.status(502).json({error:e.message||'Could not retrieve Instagram insights.'})}
  }));

  app.get('/api/billing/status',auth,asyncRoute(async(q,s)=>{
    const r=await pool.query('SELECT plan_code,status,starts_at,expires_at FROM user_subscriptions WHERE user_id=$1',[q.user.id]);
    const sub=r.rows[0],active=!!sub&&sub.status==='active'&&new Date(sub.expires_at)>new Date();
    const betaAccess=betaAccessAllowed(q.user),checkoutReady=razorpayReady();
    s.json({active,status:active?'active':sub?'expired':'inactive',beta_access:betaAccess,checkout_ready:checkoutReady,checkout_setup_required:!checkoutReady,plan_code:sub?.plan_code||'',starts_at:sub?.starts_at||'',expires_at:sub?.expires_at||'',amount:annualPlan.amountPaise/100,currency:annualPlan.currency,duration_days:annualPlan.durationDays});
  }));
  app.post('/api/billing/order',auth,asyncRoute(async(q,s)=>{
    if(String(q.body?.plan_code||annualPlan.code)!==annualPlan.code)return s.status(400).json({error:'Choose a valid Collabzy plan.'});
    if(!razorpayCheckoutReady())return s.status(503).json({error:'Secure checkout is not configured yet. The owner must add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render settings.'});
    const receipt=('cz_'+String(q.user.id)+'_'+Date.now().toString(36)).slice(0,40);
    const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:razorpayAuthorization(),'Content-Type':'application/json'},body:JSON.stringify({amount:annualPlan.amountPaise,currency:annualPlan.currency,receipt,notes:{user_id:String(q.user.id),plan_code:annualPlan.code,term_days:String(annualPlan.durationDays)}}),signal:AbortSignal.timeout(15000)});
    const order=await response.json().catch(()=>({}));
    if(!response.ok||!order.id){console.error('Razorpay order creation failed with status',response.status);return s.status(502).json({error:'The payment provider could not create an order. No payment was collected.'})}
    await pool.query("INSERT INTO billing_orders(order_id,user_id,amount_paise,currency,plan_code,status) VALUES($1,$2,$3,$4,$5,'created') ON CONFLICT(order_id) DO NOTHING",[order.id,q.user.id,annualPlan.amountPaise,annualPlan.currency,annualPlan.code]);
    s.status(201).json({order_id:order.id,key_id:process.env.RAZORPAY_KEY_ID,amount:annualPlan.amountPaise,currency:annualPlan.currency,plan_code:annualPlan.code,checkout_options:{key_id:process.env.RAZORPAY_KEY_ID,order_id:order.id,amount:annualPlan.amountPaise,currency:annualPlan.currency,name:'Collabzy',description:'Collabzy Pro — 1 year',prefill:{name:q.user.name,email:q.user.email},notes:{plan_code:annualPlan.code},theme:{color:'#6746E8'}}});
  }));
  app.post('/api/billing/verify',auth,asyncRoute(async(q,s)=>{
    const orderId=String(q.body?.order_id||''),paymentId=String(q.body?.payment_id||''),signature=String(q.body?.signature||'');
    if(!orderId||!paymentId||!/^[a-f0-9]{64}$/i.test(signature))return s.status(400).json({error:'The payment verification response is incomplete.'});
    if(!razorpayCheckoutReady())return s.status(503).json({error:'Payment verification is not configured.'});
    const owned=await pool.query('SELECT order_id,amount_paise,currency,status FROM billing_orders WHERE order_id=$1 AND user_id=$2',[orderId,q.user.id]);
    if(!owned.rows.length)return s.status(404).json({error:'Payment order was not found for this account.'});
    const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(orderId+'|'+paymentId).digest('hex');
    if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return s.status(400).json({error:'Payment signature verification failed. Pro was not activated.'});
    const paymentResponse=await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId),{headers:{Authorization:razorpayAuthorization()},signal:AbortSignal.timeout(15000)});
    const payment=await paymentResponse.json().catch(()=>({}));
    if(!paymentResponse.ok)return s.status(502).json({error:'The payment provider could not verify this payment yet.'});
    if(payment.order_id!==orderId||Number(payment.amount)!==annualPlan.amountPaise||payment.currency!==annualPlan.currency)return s.status(400).json({error:'The payment details do not match this order.'});
    if(payment.status!=='captured')return s.status(409).json({error:'The payment is not captured yet. Please refresh the subscription status before retrying.'});
    const activated=await recordCapturedPayment({orderId,paymentId,amount:payment.amount,currency:payment.currency});
    s.json({ok:true,active:activated.active,expires_at:activated.expires_at,plan_code:annualPlan.code});
  }));
  app.post('/api/billing/webhook',asyncRoute(async(q,s)=>{
    if(!process.env.RAZORPAY_WEBHOOK_SECRET)return s.status(503).json({error:'Payment webhook verification is not configured.'});
    const signature=String(q.headers['x-razorpay-signature']||'');
    if(!/^[a-f0-9]{64}$/i.test(signature)||!q.rawBody)return s.status(400).json({error:'Invalid payment webhook signature.'});
    const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(q.rawBody).digest('hex');
    if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))return s.status(400).json({error:'Invalid payment webhook signature.'});
    const event=String(q.body?.event||'');
    const payment=q.body?.payload?.payment?.entity;
    if(event==='payment.failed'&&payment?.order_id){
      await pool.query("UPDATE billing_orders SET status=CASE WHEN status='paid' THEN status ELSE 'failed' END WHERE order_id=$1",[payment.order_id]);
      return s.json({ok:true,received:true});
    }
    if(event==='payment.refunded'&&payment?.order_id&&payment?.id){
      const amount=Number(payment.amount||0),refunded=Number(payment.amount_refunded||0);
      if(amount>0&&refunded>=amount){
        await pool.query("UPDATE billing_orders SET status='refunded' WHERE order_id=$1 AND payment_id=$2",[payment.order_id,payment.id]);
        await pool.query("UPDATE user_subscriptions SET status='refunded',expires_at=LEAST(expires_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE user_id=(SELECT user_id FROM billing_orders WHERE order_id=$1 AND payment_id=$2) AND provider_payment_id=$2",[payment.order_id,payment.id]);
      }
      return s.json({ok:true,received:true});
    }
    if((event==='payment.captured'||event==='order.paid')&&payment?.order_id&&payment?.id){
      await recordCapturedPayment({orderId:payment.order_id,paymentId:payment.id,amount:payment.amount,currency:payment.currency});
    }
    s.json({ok:true,received:true});
  }));
  app.post('/api/instagram/ai-analysis',auth,asyncRoute(async(q,s)=>{
    if(q.body?.confirmed_ai_disclosure!==true)return s.status(400).json({error:'Please confirm the AI data-use notice before generating a report.'});
    if(!openAiReady())return s.status(503).json({error:'AI Growth Coach is not configured yet. Add OPENAI_API_KEY in the protected Render environment.'});
    const entitlement=await pool.query("SELECT 1 FROM user_subscriptions WHERE user_id=$1 AND status='active' AND expires_at>CURRENT_TIMESTAMP",[q.user.id]);
    // Private beta access never creates a paid subscription or changes payment status.
    if(!entitlement.rows.length&&!betaAccessAllowed(q.user))return s.status(402).json({error:'Collabzy Pro is required for AI Growth Coach. Activate the ₹299/year plan to generate a report.'});
    const usage=await pool.query("SELECT COUNT(*)::int AS n FROM ai_analysis_usage WHERE user_id=$1 AND requested_at>CURRENT_TIMESTAMP-INTERVAL '24 hours'",[q.user.id]);
    if(Number(usage.rows[0]?.n||0)>=10)return s.status(429).json({error:'You have used 10 AI reports in the last 24 hours. Please try again later.'});
    const account=(await pool.query('SELECT instagram_user_id,instagram_handle,instagram_access_token_enc,instagram_token_expires_at FROM users WHERE id=$1',[q.user.id])).rows[0];
    if(!account?.instagram_access_token_enc)return s.status(409).json({error:'Connect your Instagram professional account first.'});
    const access=await accessForInstagram(q.user.id,account);
    const insightUrl=new URL('https://graph.instagram.com/'+encodeURIComponent(account.instagram_user_id)+'/insights');
    insightUrl.searchParams.set('metric','views,reach,accounts_engaged,total_interactions');
    insightUrl.searchParams.set('period','day');
    insightUrl.searchParams.set('access_token',access);
    const mediaUrl=new URL('https://graph.instagram.com/me/media');
    mediaUrl.searchParams.set('fields','id,caption,media_type,timestamp,like_count,comments_count');
    mediaUrl.searchParams.set('limit','12');
    mediaUrl.searchParams.set('access_token',access);
    const [insightResponse,mediaResponse]=await Promise.all([
      fetch(insightUrl,{signal:AbortSignal.timeout(15000)}),
      fetch(mediaUrl,{signal:AbortSignal.timeout(15000)})
    ]);
    const [insightData,mediaData]=await Promise.all([insightResponse.json().catch(()=>({})),mediaResponse.json().catch(()=>({}))]);
    if(!insightResponse.ok)return s.status(502).json({error:insightData.error?.message||'Instagram insights could not be read for this report.'});
    if(!mediaResponse.ok)return s.status(502).json({error:mediaData.error?.message||'Instagram media could not be read for this report.'});
    const metrics=(insightData.data||[]).map(m=>({name:m.name,title:m.title||m.name,period:m.period||'day',values:(m.values||[]).slice(-7).map(v=>({value:v.value,end_time:v.end_time||null}))}));
    const posts=(mediaData.data||[]).slice(0,12).map(p=>({caption:String(p.caption||'').slice(0,500),media_type:p.media_type||'UNKNOWN',timestamp:p.timestamp||'',likes:Number(p.like_count||0),comments:Number(p.comments_count||0)}));
    await pool.query('INSERT INTO ai_analysis_usage(user_id) VALUES($1)',[q.user.id]);
    const schema={
      type:'object',additionalProperties:false,
      properties:{
        headline:{type:'string'},summary:{type:'string'},
        strengths:{type:'array',items:{type:'string'}},
        opportunities:{type:'array',items:{type:'string'}},
        next_7_days:{type:'array',items:{type:'string'}}
      },
      required:['headline','summary','strengths','opportunities','next_7_days']
    };
    const model=process.env.OPENAI_ANALYTICS_MODEL||'gpt-5-mini';
    const aiResponse=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
      model,
      instructions:'You are Collabzy, a careful Instagram creator growth analyst. Analyze only the supplied authorized Instagram metrics and recent post metadata. Never invent followers, reach, rates, growth percentages, trends or results not present in the data. If there is not enough evidence, say so plainly. Give specific, safe, practical recommendations to help improve content and brand-collaboration readiness. Avoid promises of virality or guaranteed earnings. Return the requested structured JSON with concise, evidence-based language.',
      input:JSON.stringify({handle:account.instagram_handle,profile_niche:q.user.niche||'',metrics,posts}),
      max_output_tokens:1100,
      text:{format:{type:'json_schema',name:'collabzy_creator_growth_report',strict:true,schema}}
    }),signal:AbortSignal.timeout(25000)});
    const ai=await aiResponse.json().catch(()=>({}));
    if(!aiResponse.ok){console.error('OpenAI Instagram analysis failed with status',aiResponse.status);return s.status(502).json({error:'The AI provider could not produce the report this time. No additional charge was made by Collabzy.'})}
    const outputText=(ai.output||[]).flatMap(item=>item.type==='message'?(item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text||[]):[]).join('');
    let report;
    try{report=JSON.parse(outputText)}catch{return s.status(502).json({error:'The AI provider returned an unreadable report. Please retry.'})}
    const cleanList=value=>Array.isArray(value)?value.slice(0,7).map(v=>String(v||'').trim().slice(0,500)).filter(Boolean):[];
    s.json({handle:account.instagram_handle,headline:String(report.headline||'Your creator growth report').slice(0,180),summary:String(report.summary||'').slice(0,1600),strengths:cleanList(report.strengths),opportunities:cleanList(report.opportunities),next_7_days:cleanList(report.next_7_days),generated_at:new Date().toISOString(),model});
  }));
  app.get('*',(q,s)=>s.sendFile(path.join(__dirname,'..','public','index.html')));
  app.use((e,q,s,n)=>{console.error('Collabzy API error:',e.message);s.status(500).json({error:'Unexpected server error.'})});
  const server=app.listen(PORT,()=>console.log('Collabzy PostgreSQL API listening on '+PORT));
  const shutdown=async()=>{server.close(()=>{});await pool.end();process.exit(0)};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  return {app,pool,server};
}
module.exports={start};
