'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 10000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://aa-growth-studio-cms-api.onrender.com').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'studioadmin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
if (!JWT_SECRET || !DATABASE_URL || !ADMIN_PASSWORD_HASH) {
  console.error('Missing required environment variables: DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD_HASH');
  process.exit(1);
}
// Enforce TLS certificate + hostname verification for the production database.
// pg-connection-string URL SSL flags override the `ssl` object, so remove them
// and keep unrelated settings (for example channel_binding) intact.
const databaseUrl = new URL(DATABASE_URL);
for (const key of ['sslmode','ssl','sslrootcert','sslcert','sslkey','uselibpqcompat']) databaseUrl.searchParams.delete(key);
const pool = new Pool({connectionString:databaseUrl.toString(),ssl:{rejectUnauthorized:true},max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
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
 contactEmail:'',contactPhone:'+91 74660 39959',contactAddressLineOne:'Gurugram, Haryana, India',contactAddressLineTwo:'Serving clients across India and worldwide',
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
 teamMembers:[],customSections:[],pageContent:{"services":{"heroEyebrow":"What we can do together","heroTitleLineOne":"Creative that","heroTitleLineTwo":"moves things.","heroIntro":"Six connected capabilities. One clear point of view. Choose a service to explore what it can include, or connect disciplines around a bigger brief.","sectionEyebrow":"","sectionTitleLineOne":"Not just a list of deliverables.","sectionTitleLineTwo":"A connected idea.","sectionBody":"We start with the job the work needs to do. That might mean a stronger social presence, a launch campaign, a better website, a sharper identity or paid media that connects with the right audience."},"work":{"heroEyebrow":"The work / Selected directions","heroTitleLineOne":"Make good work","heroTitleLineTwo":"impossible to ignore.","heroIntro":"A look at the creative systems and digital experiences AA Growth Studio can build. These are concept explorations—shown honestly as direction studies, not claimed client commissions or fabricated case-study results.","sectionEyebrow":"Selected creative directions","sectionTitleLineOne":"A little less ordinary.","sectionTitleLineTwo":"A lot more memorable.","sectionBody":"The best work has a clear idea at its centre. These original explorations show our creative direction—not invented client commissions or performance claims."},"studio":{"heroEyebrow":"The studio / Our point of view","heroTitleLineOne":"Good ideas.","heroTitleLineTwo":"Thoughtfully made.","heroIntro":"AA Growth Studio connects strategy, social, creative and digital craft around one clear purpose: make the brand easier to recognise, understand and choose.","sectionEyebrow":"Why AA exists","sectionTitleLineOne":"Not louder for the sake of it.","sectionTitleLineTwo":"Clearer. Braver. Better.","sectionBody":"The internet doesn't need another interchangeable brand voice or another website that looks exactly like every other one. It needs ideas with a point of view and design that helps people take the next step."},"team":{"heroEyebrow":"The people / Meet the founder","heroTitleLineOne":"Built by people.","heroTitleLineTwo":"Made for people.","heroIntro":"Good creative is never only about effects. It comes from people who listen, think carefully, sweat the details and take responsibility for the experience.","sectionEyebrow":"Founder & creative lead","sectionTitleLineOne":"Hemant Verma.","sectionTitleLineTwo":"","sectionBody":"Building thoughtful creative and digital experiences where brand, technology and business goals come together. The focus is on doing useful work, communicating clearly and making every detail count."},"contact":{"heroEyebrow":"Contact / Your next move","heroTitleLineOne":"Let's make","heroTitleLineTwo":"something matter.","heroIntro":"Tell us what you're building, what isn't working or what you want the world to notice. Share the rough idea—we'll help shape the right next step.","sectionEyebrow":"AA Growth Studio / Gurugram","sectionTitleLineOne":"Bring the ambition.","sectionTitleLineTwo":"We'll find the angle.","sectionBody":"Social media, content and video. Brand and graphic design. Websites and apps. Meta ads and lead campaigns. One project or a connected mix—the brief begins with your goal."},"services/social-media":{"heroEyebrow":"SOCIAL STRATEGY & CONTENT / SERVICE 01","heroTitleLineOne":"Make the scroll stop. Make the brand stick.","heroTitleLineTwo":"","heroIntro":"Social works best when every post feels like part of a bigger story. We build a clear voice, an ownable visual system and a repeatable content rhythm that gives your audience a reason to come back.","sectionEyebrow":"The objective","sectionTitleLineOne":"Social media & content.","sectionTitleLineTwo":"With purpose.","sectionBody":"Social media strategy, content calendars, reels, stories, carousels, captions and creative systems by AA Growth Studio in Gurugram."},"services/video-motion":{"heroEyebrow":"VIDEO EDITING & MOTION / SERVICE 02","heroTitleLineOne":"Give your ideas a pulse.","heroTitleLineTwo":"","heroIntro":"Great short-form video respects attention. We shape the hook, rhythm, sound, captions and motion so every second supports the story—across reels, paid ads and campaign assets.","sectionEyebrow":"The objective","sectionTitleLineOne":"Video editing & motion.","sectionTitleLineTwo":"With purpose.","sectionBody":"Reels editing, short-form video, campaign edits, motion graphics, kinetic typography, subtitles and ad creative."},"services/brand-design":{"heroEyebrow":"BRAND IDENTITY & DESIGN / SERVICE 03","heroTitleLineOne":"Be recognised before you are read.","heroTitleLineTwo":"","heroIntro":"Distinctive brands need more than a logo. We develop a visual language—type, colour, composition and campaign assets—that feels coherent across social, print, presentations and digital products.","sectionEyebrow":"The objective","sectionTitleLineOne":"Brand & graphic design.","sectionTitleLineTwo":"With purpose.","sectionBody":"Brand identity, logo exploration, typography, colour systems, campaign graphics, social assets and presentation design."},"services/websites":{"heroEyebrow":"WEBSITE DESIGN & DEVELOPMENT / SERVICE 04","heroTitleLineOne":"Beautiful is good. Useful is better.","heroTitleLineTwo":"","heroIntro":"Your website should tell the story quickly, feel excellent on a phone and guide visitors towards a sensible next step. We pair visual direction with responsive front-end craft, clear content structure and technical basics.","sectionEyebrow":"The objective","sectionTitleLineOne":"Website design & development.","sectionTitleLineTwo":"With purpose.","sectionBody":"Responsive website design, landing pages, web development, accessible interactions, SEO foundations and performance-conscious builds."},"services/app-uiux":{"heroEyebrow":"APP & PRODUCT UI/UX / SERVICE 05","heroTitleLineOne":"Make complex feel natural.","heroTitleLineTwo":"","heroIntro":"Useful products make the next step obvious. We organise flows, remove friction from key journeys and create a consistent interface system for mobile apps, dashboards and web products.","sectionEyebrow":"The objective","sectionTitleLineOne":"App & product UI/UX.","sectionTitleLineTwo":"With purpose.","sectionBody":"Mobile app UI/UX, product strategy, user flows, prototypes, design systems, onboarding and developer handoff."},"services/paid-media":{"heroEyebrow":"META ADS & PERFORMANCE / SERVICE 06","heroTitleLineOne":"Make every campaign earn its place.","heroTitleLineTwo":"","heroIntro":"Effective advertising connects the message, audience, offer, landing page and measurement. We plan campaigns around a clear business goal, then test creative and use actual data to decide what to improve.","sectionEyebrow":"The objective","sectionTitleLineOne":"Meta ads & lead campaigns.","sectionTitleLineTwo":"With purpose.","sectionBody":"Meta advertising strategy, campaign setup, ad creative, lead funnels, conversion tracking, testing and optimisation."}},showBlogLink:true
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
 'CREATE TABLE IF NOT EXISTS contact_enquiries (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, company TEXT NOT NULL DEFAULT \'\', service TEXT NOT NULL DEFAULT \'\', mobile_number TEXT NOT NULL DEFAULT \'\', goal TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'new\' CHECK(status IN (\'new\',\'in_progress\',\'replied\',\'closed\')), created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON blog_posts(status, published_at DESC)',
 'CREATE INDEX IF NOT EXISTS contact_enquiries_created_idx ON contact_enquiries(created_at DESC)',
 'ALTER TABLE contact_enquiries ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT \'\'',
 'CREATE TABLE IF NOT EXISTS studio_media (id BIGSERIAL PRIMARY KEY, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, file_data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
 'CREATE INDEX IF NOT EXISTS studio_media_created_idx ON studio_media(created_at DESC)'
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
 if(process.env.ADMIN_PASSWORD_RESET_HASH){
  const reset=await pool.query('UPDATE admin_users SET password_hash=$1,session_version=session_version+1,updated_at=now() WHERE username=$2 AND password_hash<>$1 RETURNING username',[process.env.ADMIN_PASSWORD_RESET_HASH,ADMIN_USERNAME]);
  if(reset.rowCount)console.log('Admin password reset completed from protected one-time configuration');
 }
 await pool.query('INSERT INTO site_settings(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=$1::jsonb || site_settings.data,updated_at=now()',[JSON.stringify(defaults)]);
 for(const s of defaultServices)await pool.query('INSERT INTO services(slug,title,category,icon,short_description,detail_text,href,visible,sort_order,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(slug) DO NOTHING',[s.slug,s.title,s.category,s.icon,s.short_description,s.detail_text,s.href,s.visible,s.sort_order,s.image_url]);
}
app.get('/api/health',asyncRoute(async(req,res)=>{await pool.query('SELECT 1');res.setHeader('Cache-Control','no-store');res.json({ok:true,service:'AA Growth Studio CMS API',database:'connected'});}));
app.get('/api/public/site',asyncRoute(async(req,res)=>{
 const [settings,services]=await Promise.all([pool.query('SELECT data, updated_at FROM site_settings WHERE id=1'),pool.query('SELECT id,slug,title,category,icon,short_description,href,image_url,visible,sort_order FROM services WHERE visible=true ORDER BY sort_order,id')]);
 res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({settings:settings.rows[0]?.data||defaults,services:services.rows});
}));
app.get('/api/public/media/:id',asyncRoute(async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(404).json({error:'Media not found.'});
 const result=await pool.query('SELECT mime_type,file_data FROM studio_media WHERE id=$1',[id]);if(!result.rows.length)return res.status(404).json({error:'Media not found.'});
 const asset=result.rows[0],data=asset.file_data;res.setHeader('Content-Type',asset.mime_type);res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Disposition','inline');
 const range=req.headers.range;if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m)return res.status(416).setHeader('Content-Range','bytes */'+data.length).end();const start=m[1]?Number(m[1]):Math.max(0,data.length-Number(m[2])),finish=m[1]&&m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;if(start<0||start>=data.length||finish<start)return res.status(416).setHeader('Content-Range','bytes */'+data.length).end();const chunk=data.subarray(start,finish+1);res.status(206).setHeader('Content-Range','bytes '+start+'-'+finish+'/'+data.length);res.setHeader('Content-Length',chunk.length);return res.end(chunk)}
 res.setHeader('Content-Length',data.length);return res.end(data);
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
 const body=req.body||{};const name=safeText(body.name,120),email=safeText(body.email,250).toLowerCase(),mobile=safeText(body.mobile_number||body.mobile,32),company=safeText(body.company,180),service=safeText(body.service,180),goal=safeText(body.goal,5000);
 const digits=mobile.replace(/\D/g,'');
 if(!name||!email||!mobile||digits.length<7||digits.length>15||!/^[+0-9().\s-]+$/.test(mobile)||!company||!service||!goal||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please complete all required fields with a valid email and mobile number.'});
 const result=await pool.query('INSERT INTO contact_enquiries(name,email,mobile_number,company,service,goal) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at',[name,email,mobile,company,service,goal]);res.status(201).json({ok:true,message:'Your enquiry has been saved securely.',enquiryId:result.rows[0].id});
}));
app.post('/api/admin/login',asyncRoute(async(req,res)=>{
 const username=safeText(req.body?.username,120),password=typeof req.body?.password==='string'?req.body.password:'';
 const result=await pool.query('SELECT username,password_hash,session_version FROM admin_users WHERE username=$1',[username]);const user=result.rows[0];
 if(!user||password.length>500||!verifyPass(password,user.password_hash))return res.status(401).json({error:'Invalid admin ID or password.'});
 res.json({token:tokenFor(user),username:user.username,expiresIn:28800});
}));
app.use('/api/admin',adminAuth);
app.get('/api/admin/media',asyncRoute(async(req,res)=>{
 const result=await pool.query('SELECT id,original_name,mime_type,file_size,created_at FROM studio_media ORDER BY created_at DESC LIMIT 200');
 res.json({assets:result.rows.map(x=>({id:x.id,name:x.original_name,mimeType:x.mime_type,size:x.file_size,createdAt:x.created_at,url:PUBLIC_BASE_URL+'/api/public/media/'+x.id}))});
}));
app.post('/api/admin/media',rateLimit({windowMs:60*60*1000,limit:80,standardHeaders:'draft-7',legacyHeaders:false}),express.raw({type:['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'],limit:'15mb'}),asyncRoute(async(req,res)=>{
 const mime=(req.get('content-type')||'').split(';')[0].trim().toLowerCase(),data=Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0);
 const allowed=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']);
 if(!allowed.has(mime))return res.status(415).json({error:'Upload a JPG, PNG, WebP, GIF, MP4 or WebM file.'});
 const max=mime.startsWith('video/')?15*1024*1024:8*1024*1024;if(!data.length)return res.status(400).json({error:'The selected file is empty.'});if(data.length>max)return res.status(413).json({error:'Images must be 8 MB or less; videos must be 15 MB or less.'});
 let valid=false;
 if(mime==='image/jpeg')valid=data.length>3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff;
 else if(mime==='image/png')valid=data.length>8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 else if(mime==='image/gif')valid=data.subarray(0,6).toString('ascii').startsWith('GIF8');
 else if(mime==='image/webp')valid=data.length>12&&data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP';
 else if(mime==='video/mp4')valid=data.length>12&&data.subarray(4,8).toString('ascii')==='ftyp';
 else if(mime==='video/webm')valid=data.length>4&&data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
 if(!valid)return res.status(400).json({error:'The file does not match its declared media format.'});
 const original=safeText(req.query.name,180).replace(/[\\/\u0000-\u001f]/g,'_')||('studio-media-'+Date.now());
 const result=await pool.query('INSERT INTO studio_media(original_name,mime_type,file_size,file_data) VALUES($1,$2,$3,$4) RETURNING id,created_at',[original,mime,data.length,data]);const asset=result.rows[0];
 res.status(201).json({asset:{id:asset.id,name:original,mimeType:mime,size:data.length,createdAt:asset.created_at,url:PUBLIC_BASE_URL+'/api/public/media/'+asset.id}});
}));
app.get('/api/admin/me',(req,res)=>res.json({username:req.admin.username}));
app.get('/api/admin/overview',asyncRoute(async(req,res)=>{
 const [posts,services,leads,newLeads,recent]=await Promise.all([pool.query('SELECT count(*)::int n FROM blog_posts'),pool.query('SELECT count(*)::int n FROM services'),pool.query('SELECT count(*)::int n FROM contact_enquiries'),pool.query("SELECT count(*)::int n FROM contact_enquiries WHERE status='new'"),pool.query('SELECT id,name,email,mobile_number,company,service,status,created_at FROM contact_enquiries ORDER BY created_at DESC LIMIT 6')]);
 res.json({posts:posts.rows[0].n,services:services.rows[0].n,enquiries:leads.rows[0].n,newEnquiries:newLeads.rows[0].n,recentEnquiries:recent.rows});
}));
app.get('/api/admin/site',asyncRoute(async(req,res)=>{const r=await pool.query('SELECT data,updated_at FROM site_settings WHERE id=1');res.json({settings:r.rows[0]?.data||defaults,updatedAt:r.rows[0]?.updated_at||null});}));
app.patch('/api/admin/site',asyncRoute(async(req,res)=>{
 const incoming=req.body?.settings;if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return res.status(400).json({error:'Settings object required.'});
 const allowed=new Set(Object.keys(defaults)),clean={};
 for(const [key,value] of Object.entries(incoming)){
  if(!allowed.has(key))continue;
  if(key==='pageContent'){
   if(!value||typeof value!=='object'||Array.isArray(value))return res.status(400).json({error:'Page content must be an object.'});
   clean[key]={};
   const knownPages=defaults.pageContent;
   for(const [page,content] of Object.entries(value)){
    if(!Object.prototype.hasOwnProperty.call(knownPages,page)||!content||typeof content!=='object'||Array.isArray(content))continue;
    const safe={};
    for(const field of Object.keys(knownPages[page]))if(typeof content[field]==='string')safe[field]=safeText(content[field],6000);
    clean[key][page]=safe;
   }
  }else if(key==='customSections'){
   if(!Array.isArray(value)||value.length>20)return res.status(400).json({error:'Custom sections limit is 20.'});
   clean[key]=value.map((s,i)=>({id:safeText(s.id||('section-'+(i+1)),80),title:safeText(s.title,180),body:safeText(s.body,4000),visible:s.visible!==false})).filter(s=>s.title&&s.body);
  }else if(key==='portfolioItems'){
   if(!Array.isArray(value)||value.length>40)return res.status(400).json({error:'You can manage up to 40 portfolio items.'});
   if(value.some(x=>(x.imageUrl&&!validHttpUrl(x.imageUrl))||(x.videoUrl&&!validHttpUrl(x.videoUrl))))return res.status(400).json({error:'Portfolio media URLs must be HTTP(S) links.'});
   if(value.some(x=>x.href&&!((String(x.href).startsWith('/')&&!String(x.href).startsWith('//'))||validHttpUrl(x.href))))return res.status(400).json({error:'Portfolio links must be internal paths or HTTP(S) URLs.'});
   clean[key]=value.map((x,i)=>({id:safeText(x.id||('work-'+(i+1)),100),title:safeText(x.title,180),category:safeText(x.category||'CREATIVE',100),label:safeText(x.label||'Concept exploration',100),description:safeText(x.description,2000),imageUrl:safeText(x.imageUrl,1000),videoUrl:safeText(x.videoUrl,1000),href:safeText(x.href||'/contact/',500),visible:x.visible!==false})).filter(x=>x.title&&x.description);
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
