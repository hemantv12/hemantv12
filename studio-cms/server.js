'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'studioadmin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
if (!JWT_SECRET || !DATABASE_URL || !ADMIN_PASSWORD_HASH) {
  console.error('Missing required environment variables: DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD_HASH');
  process.exit(1);
}
const pool = new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false},max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'https://rti-growth-studio.onrender.com').split(',').map(v => v.trim()).filter(Boolean));
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(!origin || allowedOrigins.has(origin)){
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');
  }
  if(req.method==='OPTIONS')return res.status(204).end();
  next();
});
app.use(express.json({limit:'1mb'}));
app.use('/api/admin/login',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many login attempts. Please wait 15 minutes.'}}));
app.use('/api/public/enquiries',rateLimit({windowMs:60*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many enquiries from this connection. Please try later.'}}));

const defaults = {
 brandName:'AA Growth Studio',brandTagline:'Social · Creative · Digital',
 heroEyebrow:'Creative direction · Social · Digital',heroLineOne:'Make them',heroLineTwo:'stop.',heroLineThree:'Make it',heroHighlight:'matter.',
 heroDescription:'We turn brands into the ones people notice, remember and come back to. Sharp social storytelling, punchy creative and digital experiences with a point of view.',
 heroPrimaryCta:"Let's build your next move",heroSecondaryCta:'Explore the work',
 workEyebrow:'Selected creative directions',workTitleLineOne:'A little less ordinary.',workTitleLineTwo:'A lot more memorable.',
 workIntro:"The best work has a clear idea at its centre. These original explorations show our creative direction—not invented client commissions or performance claims.",
 statementEyebrow:'The work should feel like you',statementTitleLineOne:'Generic is easy.',statementTitleLineTwo:'Unforgettable takes intent.',
 statementBody:"We get under the surface of your business, find the interesting bit and build the creative world around it—then make sure the experience actually works.",
 studioEyebrow:'A little about AA',studioTitleLineOne:'Small details.',studioTitleLineTwo:'Big feeling.',
 studioParagraphOne:'AA Growth Studio brings creative, social and digital thinking together so a brand feels connected at every touchpoint. We believe in an idea before an effect, useful before complicated, and details that earn their place.',
 studioParagraphTwo:"Based in Gurugram, India, we work with ambitious businesses wherever they are. Each engagement starts with your goals—not a pre-packed template.",
 teamEyebrow:'The people behind the work',teamTitleLineOne:'Good ideas start',teamTitleLineTwo:'with good people.',
 teamIntro:"Meet the founder. As you share the rest of the team photos, we'll add real introductions and roles here—no made-up profiles.",
 founderName:'Hemant Verma',founderRole:'Founder & creative lead',
 founderBio:'Building thoughtful creative and digital experiences where brand, technology and business goals come together. Focused on good work, clear communication and every detail having a purpose.',
 founderImage:'',
 contactEyebrow:'Your move starts here',contactTitleLineOne:"Let's make",contactTitleLineTwo:'some noise.',
 contactDescription:'Have a business, a launch, a brand in need of a refresh or a big idea you want to build? Tell us what you’re thinking.',
 contactEmail:'',contactPhone:'',contactAddressLineOne:'Office 302, Third Floor, Building 1644',contactAddressLineTwo:'Sector 15, Gurugram, Haryana, India',
 mapUrl:'https://www.google.com/maps?q=28.4619959,77.0417564&z=17&hl=en',
 footerTagline:'Gurugram-made. World-facing. Idea-led.',instagramUrl:'',linkedinUrl:'',
 seoTitle:'AA Growth Studio — Make people stop scrolling.',
 seoDescription:'Social media, content, motion, brand design, websites, product UI/UX and performance campaigns from AA Growth Studio, Gurugram.',
 portfolioItems:[
  {id:'work-social',title:'Make the feed feel like your brand.',category:'Social creative',label:'Concept exploration',description:'A recognisable creative system for campaigns, carousels, reels and everyday social content. One visual voice, multiple ways to tell the story.',imageUrl:'',href:'/services/social-media/',visible:true},
  {id:'work-motion',title:'Creative that has rhythm.',category:'Motion & video',label:'Visual study',description:'From sharp short-form edits to campaign films, every frame carries the idea forward.',imageUrl:'',href:'/services/video-motion/',visible:true},
  {id:'work-brand',title:'Build a brand you can spot in a second.',category:'Brand & identity',label:'Identity study',description:'Distinctive typography, identity systems and visual assets that stay consistent wherever people meet you.',imageUrl:'',href:'/services/brand-design/',visible:true},
  {id:'work-web',title:'Your website should do more than look good.',category:'Website design',label:'Web concept',description:'Considered digital journeys with crisp hierarchy and interaction that moves the visitor forward.',imageUrl:'',href:'/services/websites/',visible:true},
  {id:'work-product',title:'Make complicated feel clear.',category:'App & UI/UX',label:'Product concept',description:'Mobile-first interfaces, smart user flows and products people can work out without a manual.',imageUrl:'',href:'/services/app-uiux/',visible:true}
 ],
 teamMembers:[],customSections:[],showBlogLink:true
};
const defaultServices = [
 {slug:'social-media',title:'Social media & content',category:'SOCIAL',icon:'↗',short_description:'Strategy, creative systems, calendars, captions, reels and consistent publishing.',detail_text:'Social-first strategy, content planning and creative production built around your brand voice.',href:'/services/social-media/',visible:true,sort_order:1,image_url:''},
 {slug:'video-motion',title:'Video editing & motion',category:'MOTION',icon:'▶',short_description:'Short-form edits, campaign videos, motion details and formats built for the feed.',detail_text:'Short-form editing, campaign films, motion graphics and platform-ready cutdowns.',href:'/services/video-motion/',visible:true,sort_order:2,image_url:''},
 {slug:'brand-design',title:'Brand & graphic design',category:'IDENTITY',icon:'✳',short_description:'Identity direction, campaign graphics, brand assets and design systems.',detail_text:'Distinctive identities, visual systems, campaign graphics and brand assets.',href:'/services/brand-design/',visible:true,sort_order:3,image_url:''},
 {slug:'websites',title:'Website design & development',category:'WEB',icon:'⌘',short_description:'Responsive websites, landing pages and conversion-aware journeys.',detail_text:'Responsive, accessible and polished websites with clear calls to action.',href:'/services/websites/',visible:true,sort_order:4,image_url:''},
 {slug:'app-uiux',title:'App & product UI/UX',category:'PRODUCT',icon:'▣',short_description:'Mobile interfaces, product flows, prototypes and digital experiences.',detail_text:'Product strategy, mobile-first UI, prototypes and usability-led experiences.',href:'/services/app-uiux/',visible:true,sort_order:5,image_url:''},
 {slug:'paid-media',title:'Meta ads & lead campaigns',category:'GROWTH',icon:'↗',short_description:'Ad creative, audience planning, conversion journeys, tracking and optimisation.',detail_text:'Performance creative and campaign management focused on measurable objectives.',href:'/services/paid-media/',visible:true,sort_order:6,image_url:''}
];
const schema = [
 'CREATE TABLE IF NOT EXISTS admin_users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), data JSONB NOT NULL DEFAULT \'{}\'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE TABLE IF NOT EXISTS services (id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT \'SERVICE\', icon TEXT NOT NULL DEFAULT \'✳\', short_description TEXT NOT NULL DEFAULT \'\', detail_text TEXT NOT NULL DEFAULT \'\', href TEXT NOT NULL DEFAULT \'/contact/\', image_url TEXT NOT NULL DEFAULT \'\', visible BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE TABLE IF NOT EXISTS blog_posts (id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT \'INSIGHTS\', excerpt TEXT NOT NULL DEFAULT \'\', content TEXT NOT NULL DEFAULT \'\', cover_image TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'draft\' CHECK(status IN (\'draft\',\'published\')), published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE TABLE IF NOT EXISTS contact_enquiries (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, company TEXT NOT NULL DEFAULT \'\', service TEXT NOT NULL DEFAULT \'\', goal TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'new\' CHECK(status IN (\'new\',\'in_progress\',\'replied\',\'closed\')), created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON blog_posts(status, published_at DESC)',
 'CREATE INDEX IF NOT EXISTS contact_enquiries_created_idx ON contact_enquiries(created_at DESC)'
];
function b64url(buf){return Buffer.from(buf).toString('base64url');}
function verifyPass(password,stored){
 try{const parts=String(stored).split('$');if(parts.length!==4||parts[0]!=='pbkdf2')return false;const iterations=Number(parts[1]);if(!Number.isInteger(iterations)||iterations<200000||iterations>1000000)return false;const salt=Buffer.from(parts[2],'base64url');const expected=Buffer.from(parts[3],'base64url');const actual=crypto.pbkdf2Sync(password,salt,iterations,expected.length,'sha256');return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);}catch{return false;}
}
function hashPass(password){const salt=crypto.randomBytes(16);const iterations=310000;const hash=crypto.pbkdf2Sync(password,salt,iterations,32,'sha256');return 'pbkdf2$'+iterations+'$'+b64url(salt)+'$'+b64url(hash);}
function safeText(value,max=5000){return typeof value==='string'?value.trim().slice(0,max):'';}
function validHttpUrl(value){if(!value)return true;try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
function slugify(value){return safeText(value,150).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);}
function tokenFor(user){return jwt.sign({sub:user.username,sv:user.session_version},JWT_SECRET,{expiresIn:'8h',issuer:'aa-growth-studio-cms',audience:'aa-growth-studio-admin'});}
async function adminAuth(req,res,next){
 const header=req.get('authorization')||'';if(!header.startsWith('Bearer '))return res.status(401).json({error:'Please sign in again.'});
 try{const claims=jwt.verify(header.slice(7),JWT_SECRET,{issuer:'aa-growth-studio-cms',audience:'aa-growth-studio-admin'});const found=await pool.query('SELECT username, session_version FROM admin_users WHERE username=$1',[claims.sub]);if(!found.rows.length||found.rows[0].session_version!==claims.sv)return res.status(401).json({error:'Session expired. Please sign in again.'});req.admin=found.rows[0];next();}catch{return res.status(401).json({error:'Session expired. Please sign in again.'});}
}
function asyncRoute(fn){return(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);}
function validateService(body){
 const title=safeText(body.title,150),slug=slugify(body.slug||title);if(!title||!slug)return{error:'A service title is required.'};
 if(body.image_url&&!validHttpUrl(body.image_url))return{error:'Image URL must be a valid HTTP or HTTPS URL.'};
 const href=safeText(body.href||'/contact/',500);if(!(href.startsWith('/')&&!href.startsWith('//'))&&!validHttpUrl(href))return{error:'Link must be an internal path or HTTP(S) URL.'};
 return{values:{slug,title,category:safeText(body.category||'SERVICE',80).toUpperCase(),icon:safeText(body.icon||'✳',12),short_description:safeText(body.short_description,800),detail_text:safeText(body.detail_text,4000),href,image_url:safeText(body.image_url,1000),visible:body.visible!==false,sort_order:Number.isFinite(Number(body.sort_order))?Math.trunc(Number(body.sort_order)):0}};
}
function validateBlog(body){
 const title=safeText(body.title,180),slug=slugify(body.slug||title);if(!title||!slug)return{error:'A post title is required.'};
 if(body.cover_image&&!validHttpUrl(body.cover_image))return{error:'Cover image must be a valid HTTP or HTTPS URL.'};
 const status=body.status==='published'?'published':'draft';
 return{values:{slug,title,category:safeText(body.category||'INSIGHTS',80),excerpt:safeText(body.excerpt,1200),content:safeText(body.content,50000),cover_image:safeText(body.cover_image,1000),status}};
}
async function initialize(){
 for(const q of schema)await pool.query(q);
 await pool.query('INSERT INTO admin_users(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO NOTHING',[ADMIN_USERNAME,ADMIN_PASSWORD_HASH]);
 await pool.query('INSERT INTO site_settings(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=$1::jsonb || site_settings.data,updated_at=now()',[JSON.stringify(defaults)]);
 for(const s of defaultServices)await pool.query('INSERT INTO services(slug,title,category,icon,short_description,detail_text,href,visible,sort_order,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(slug) DO NOTHING',[s.slug,s.title,s.category,s.icon,s.short_description,s.detail_text,s.href,s.visible,s.sort_order,s.image_url]);
}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'AA Growth Studio CMS API'}));
app.get('/api/public/site',asyncRoute(async(req,res)=>{
 const [settings,services]=await Promise.all([pool.query('SELECT data, updated_at FROM site_settings WHERE id=1'),pool.query('SELECT id,slug,title,category,icon,short_description,href,image_url,visible,sort_order FROM services WHERE visible=true ORDER BY sort_order,id')]);
 res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({settings:settings.rows[0]?.data||defaults,services:services.rows});
}));
app.get('/api/public/blogs',asyncRoute(async(req,res)=>{
 const result=await pool.query("SELECT slug,title,category,excerpt,cover_image,published_at,created_at FROM blog_posts WHERE status='published' AND published_at <= now() ORDER BY published_at DESC LIMIT 100");
 res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({posts:result.rows});
}));
app.get('/api/public/blogs/:slug',asyncRoute(async(req,res)=>{
 const result=await pool.query("SELECT slug,title,category,excerpt,content,cover_image,published_at,created_at FROM blog_posts WHERE slug=$1 AND status='published' AND published_at <= now()",[slugify(req.params.slug)]);
 if(!result.rows.length)return res.status(404).json({error:'Post not found.'});res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({post:result.rows[0]});
}));
app.post('/api/public/enquiries',asyncRoute(async(req,res)=>{
 const body=req.body||{};const name=safeText(body.name,120),email=safeText(body.email,250).toLowerCase(),company=safeText(body.company,180),service=safeText(body.service,180),goal=safeText(body.goal,5000);
 if(!name||!email||!company||!service||!goal||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please complete all required fields with a valid email.'});
 const result=await pool.query('INSERT INTO contact_enquiries(name,email,company,service,goal) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[name,email,company,service,goal]);res.status(201).json({ok:true,message:'Your enquiry has been saved securely.',enquiryId:result.rows[0].id});
}));
app.post('/api/admin/login',asyncRoute(async(req,res)=>{
 const username=safeText(req.body?.username,120),password=typeof req.body?.password==='string'?req.body.password:'';
 const result=await pool.query('SELECT username,password_hash,session_version FROM admin_users WHERE username=$1',[username]);const user=result.rows[0];
 if(!user||password.length>500||!verifyPass(password,user.password_hash))return res.status(401).json({error:'Invalid admin ID or password.'});
 res.json({token:tokenFor(user),username:user.username,expiresIn:28800});
}));
app.use('/api/admin',adminAuth);
app.get('/api/admin/me',(req,res)=>res.json({username:req.admin.username}));
app.get('/api/admin/overview',asyncRoute(async(req,res)=>{
 const [posts,services,leads,newLeads,recent]=await Promise.all([pool.query('SELECT count(*)::int n FROM blog_posts'),pool.query('SELECT count(*)::int n FROM services'),pool.query('SELECT count(*)::int n FROM contact_enquiries'),pool.query("SELECT count(*)::int n FROM contact_enquiries WHERE status='new'"),pool.query('SELECT id,name,email,company,service,status,created_at FROM contact_enquiries ORDER BY created_at DESC LIMIT 6')]);
 res.json({posts:posts.rows[0].n,services:services.rows[0].n,enquiries:leads.rows[0].n,newEnquiries:newLeads.rows[0].n,recentEnquiries:recent.rows});
}));
app.get('/api/admin/site',asyncRoute(async(req,res)=>{const r=await pool.query('SELECT data,updated_at FROM site_settings WHERE id=1');res.json({settings:r.rows[0]?.data||defaults,updatedAt:r.rows[0]?.updated_at||null});}));
app.patch('/api/admin/site',asyncRoute(async(req,res)=>{
 const incoming=req.body?.settings;if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({error:'Settings object required.'});
 const allowed=new Set(Object.keys(defaults)),clean={};
 for(const [key,value] of Object.entries(incoming)){
  if(!allowed.has(key))continue;
  if(key==='customSections'){
   if(!Array.isArray(value)||value.length>20)return res.status(400).json({error:'Custom sections limit is 20.'});
   clean[key]=value.map((s,i)=>({id:safeText(s.id||('section-'+(i+1)),80),title:safeText(s.title,180),body:safeText(s.body,4000),visible:s.visible!==false})).filter(s=>s.title&&s.body);
  }else if(key==='portfolioItems'){
   if(!Array.isArray(value)||value.length>40)return res.status(400).json({error:'You can manage up to 40 portfolio items.'});
   if(value.some(x=>x.imageUrl&&!validHttpUrl(x.imageUrl)))return res.status(400).json({error:'Portfolio image URLs must be HTTP(S) links.'});
   if(value.some(x=>x.href&&!((String(x.href).startsWith('/')&&!String(x.href).startsWith('//'))||validHttpUrl(x.href))))return res.status(400).json({error:'Portfolio links must be internal paths or HTTP(S) URLs.'});
   clean[key]=value.map((x,i)=>({id:safeText(x.id||('work-'+(i+1)),100),title:safeText(x.title,180),category:safeText(x.category||'CREATIVE',100),label:safeText(x.label||'Concept exploration',100),description:safeText(x.description,2000),imageUrl:safeText(x.imageUrl,1000),href:safeText(x.href||'/contact/',500),visible:x.visible!==false})).filter(x=>x.title&&x.description);
  }else if(key==='teamMembers'){
   if(!Array.isArray(value)||value.length>30)return res.status(400).json({error:'You can manage up to 30 additional team profiles.'});
   if(value.some(x=>x.imageUrl&&!validHttpUrl(x.imageUrl)))return res.status(400).json({error:'Team photo URLs must be HTTP(S) links.'});
   clean[key]=value.map((x,i)=>({id:safeText(x.id||('member-'+(i+1)),100),name:safeText(x.name,150),role:safeText(x.role,150),bio:safeText(x.bio,1200),imageUrl:safeText(x.imageUrl,1000),visible:x.visible!==false})).filter(x=>x.name&&x.role);
  }else if(key==='showBlogLink')clean[key]=Boolean(value);
  else if(typeof value==='string'){
   if(['mapUrl','instagramUrl','linkedinUrl','founderImage'].includes(key)&&value&&!validHttpUrl(value))return res.status(400).json({error:key+' must be an HTTP(S) URL.'});
   clean[key]=safeText(value,key.toLowerCase().includes('description')||key.toLowerCase().includes('paragraph')||key==='statementBody'||key==='studioParagraphOne'||key==='studioParagraphTwo'||key==='founderBio'?6000:1200);
  }
 }
 const r=await pool.query('UPDATE site_settings SET data=data || $1::jsonb,updated_at=now() WHERE id=1 RETURNING data,updated_at',[JSON.stringify(clean)]);res.json({settings:r.rows[0].data,updatedAt:r.rows[0].updated_at});
}));
app.get('/api/admin/services',asyncRoute(async(req,res)=>{const r=await pool.query('SELECT * FROM services ORDER BY sort_order,id');res.json({services:r.rows});}));
app.post('/api/admin/services',asyncRoute(async(req,res)=>{
 const v=validateService(req.body||{});if(v.error)return res.status(400).json({error:v.error});const x=v.values;
 try{const r=await pool.query('INSERT INTO services(slug,title,category,icon,short_description,detail_text,href,image_url,visible,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[x.slug,x.title,x.category,x.icon,x.short_description,x.detail_text,x.href,x.image_url,x.visible,x.sort_order]);res.status(201).json({service:r.rows[0]});}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'That service URL slug already exists.'});throw e;}
}));
app.patch('/api/admin/services/:id',asyncRoute(async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid service ID.'});const old=await pool.query('SELECT * FROM services WHERE id=$1',[id]);if(!old.rows.length)return res.status(404).json({error:'Service not found.'});
 const v=validateService(Object.assign({},old.rows[0],req.body));if(v.error)return res.status(400).json({error:v.error});const x=v.values;
 try{const r=await pool.query('UPDATE services SET slug=$1,title=$2,category=$3,icon=$4,short_description=$5,detail_text=$6,href=$7,image_url=$8,visible=$9,sort_order=$10,updated_at=now() WHERE id=$11 RETURNING *',[x.slug,x.title,x.category,x.icon,x.short_description,x.detail_text,x.href,x.image_url,x.visible,x.sort_order,id]);res.json({service:r.rows[0]});}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'That service URL slug already exists.'});throw e;}
}));
app.delete('/api/admin/services/:id',asyncRoute(async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid service ID.'});const r=await pool.query('DELETE FROM services WHERE id=$1 RETURNING id',[id]);if(!r.rowCount)return res.status(404).json({error:'Service not found.'});res.json({ok:true});}));
app.get('/api/admin/blogs',asyncRoute(async(req,res)=>{const r=await pool.query('SELECT * FROM blog_posts ORDER BY updated_at DESC,id DESC');res.json({posts:r.rows});}));
app.post('/api/admin/blogs',asyncRoute(async(req,res)=>{
 const v=validateBlog(req.body||{});if(v.error)return res.status(400).json({error:v.error});const p=v.values;
 try{const r=await pool.query("INSERT INTO blog_posts(slug,title,category,excerpt,content,cover_image,status,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7='published' THEN now() ELSE NULL END) RETURNING *",[p.slug,p.title,p.category,p.excerpt,p.content,p.cover_image,p.status]);res.status(201).json({post:r.rows[0]});}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'That blog URL slug already exists.'});throw e;}
}));
app.patch('/api/admin/blogs/:id',asyncRoute(async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid post ID.'});const old=await pool.query('SELECT * FROM blog_posts WHERE id=$1',[id]);if(!old.rows.length)return res.status(404).json({error:'Post not found.'});
 const v=validateBlog(Object.assign({},old.rows[0],req.body));if(v.error)return res.status(400).json({error:v.error});const p=v.values;
 try{const r=await pool.query("UPDATE blog_posts SET slug=$1,title=$2,category=$3,excerpt=$4,content=$5,cover_image=$6,status=$7,published_at=CASE WHEN $7='published' THEN COALESCE(published_at,now()) ELSE NULL END,updated_at=now() WHERE id=$8 RETURNING *",[p.slug,p.title,p.category,p.excerpt,p.content,p.cover_image,p.status,id]);res.json({post:r.rows[0]});}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'That blog URL slug already exists.'});throw e;}
}));
app.delete('/api/admin/blogs/:id',asyncRoute(async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Invalid post ID.'});const r=await pool.query('DELETE FROM blog_posts WHERE id=$1 RETURNING id',[id]);if(!r.rowCount)return res.status(404).json({error:'Post not found.'});res.json({ok:true});}));
app.get('/api/admin/enquiries',asyncRoute(async(req,res)=>{const r=await pool.query('SELECT * FROM contact_enquiries ORDER BY created_at DESC LIMIT 500');res.json({enquiries:r.rows});}));
app.patch('/api/admin/enquiries/:id',asyncRoute(async(req,res)=>{const id=Number(req.params.id),status=safeText(req.body?.status,30);if(!Number.isInteger(id)||id<1||!['new','in_progress','replied','closed'].includes(status))return res.status(400).json({error:'Invalid enquiry status.'});const r=await pool.query('UPDATE contact_enquiries SET status=$1 WHERE id=$2 RETURNING id,status',[status,id]);if(!r.rowCount)return res.status(404).json({error:'Enquiry not found.'});res.json({enquiry:r.rows[0]});}));
app.post('/api/admin/password',asyncRoute(async(req,res)=>{
 const current=typeof req.body?.currentPassword==='string'?req.body.currentPassword:'',next=typeof req.body?.newPassword==='string'?req.body.newPassword:'';
 const r=await pool.query('SELECT password_hash FROM admin_users WHERE username=$1',[req.admin.username]);
 if(!r.rows.length||!verifyPass(current,r.rows[0].password_hash))return res.status(400).json({error:'Current password is incorrect.'});
 if(next.length<12||next.length>200)return res.status(400).json({error:'New password must be 12–200 characters.'});if(next===current)return res.status(400).json({error:'Choose a different password.'});
 await pool.query('UPDATE admin_users SET password_hash=$1,session_version=session_version+1,updated_at=now() WHERE username=$2',[hashPass(next),req.admin.username]);res.json({ok:true,message:'Password changed. Please sign in again.'});
}));
app.use((req,res)=>res.status(404).json({error:'API route not found.'}));
app.use((err,req,res,next)=>{console.error('Request failed:',err.code||err.name||'error');if(res.headersSent)return next(err);res.status(err.status||500).json({error:err.code==='23505'?'That value is already in use.':'The server could not complete this request. Please try again.'});});
initialize().then(()=>{app.listen(PORT,'0.0.0.0',()=>console.log('AA Growth Studio CMS API listening on '+PORT));}).catch(err=>{console.error('Database initialization failed:',err.code||err.message);process.exit(1);});
