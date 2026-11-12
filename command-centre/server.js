'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 10000);
const CMS_API = (process.env.CMS_API_URL || 'https://aa-growth-studio-cms-api.onrender.com').replace(/\/+$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');
const loginAttempts = new Map();

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache'
  });
  res.end(body);
}
function json(res, status, value) { send(res, status, JSON.stringify(value)); }
async function readBody(req, maxBytes=1024*1024) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  if (!size) return {};
  const raw=Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { throw new Error('Invalid JSON body.'); }
}
function limited(ip) {
  const now=Date.now(), slot=loginAttempts.get(ip) || {count:0,until:now+15*60*1000};
  if(now>slot.until){slot.count=0;slot.until=now+15*60*1000;}
  slot.count++; loginAttempts.set(ip,slot);
  if(loginAttempts.size>5000) for(const [key,value] of loginAttempts) if(now>value.until) loginAttempts.delete(key);
  return slot.count<=10;
}
async function upstream(pathname, method, body, token) {
  const url=new URL(pathname, CMS_API);
  const headers={Accept:'application/json'};
  if(body!==undefined) headers['Content-Type']='application/json';
  if(token) headers.Authorization='Bearer '+token;
  const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(80000)});
  const raw=await response.text();
  let payload;
  try{payload=raw?JSON.parse(raw):{};}catch{payload={error:'Upstream returned an unexpected response.'};}
  return {status:response.status,payload};
}
function permitted(pathname,method) {
  const exact={
    '/api/admin/me':['GET'],
    '/api/admin/overview':['GET'],
    '/api/admin/visitors':['GET'],
    '/api/admin/enquiries':['GET'],
    '/api/admin/meta/status':['GET'],
    '/api/admin/meta/settings':['POST'],
    '/api/admin/meta/connect-url':['POST'],
    '/api/admin/meta/sync':['POST'],
    '/api/admin/meta/disconnect':['POST'],
    '/api/admin/password':['POST']
  };
  if(exact[pathname]) return exact[pathname].includes(method);
  return /^\/api\/admin\/enquiries\/[1-9]\d*$/.test(pathname) && method==='PATCH';
}
async function handle(req,res) {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/health') return json(res,200,{ok:true,service:'AA Growth Command Centre',hosting:'Render Free',cmsApi:CMS_API});
  if(url.pathname==='/api/login' && req.method==='POST') {
    const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0].trim();
    if(!limited(ip)) return json(res,429,{error:'Too many login attempts. Wait 15 minutes and try again.'});
    try{
      const body=await readBody(req,16*1024);
      const result=await upstream('/api/admin/login','POST',{username:String(body.username||''),password:String(body.password||'')});
      return json(res,result.status,result.payload);
    }catch(error){return json(res,502,{error:error.message||'Could not reach the AA Growth CMS API.'});}
  }
  if(url.pathname.startsWith('/api/admin/')) {
    if(!permitted(url.pathname,req.method)) return json(res,404,{error:'This dashboard action is not enabled.'});
    const auth=String(req.headers.authorization||'');
    if(!auth.startsWith('Bearer ') || auth.length>5000) return json(res,401,{error:'Please sign in again.'});
    let body;
    if(req.method!=='GET') {
      try{body=await readBody(req,1024*1024);}catch(error){return json(res,400,{error:error.message});}
    }
    const query=url.search || '';
    try{
      const result=await upstream(url.pathname+query,req.method,body,auth.slice(7));
      return json(res,result.status,result.payload);
    }catch(error){return json(res,502,{error:'The connected AA Growth CMS API is unavailable. It may be waking from its free-tier sleep.'});}
  }
  if(req.method!=='GET' && req.method!=='HEAD') return json(res,405,{error:'Method not allowed.'});
  const requested=url.pathname==='/'?'/index.html':url.pathname;
  const resolved=path.resolve(PUBLIC_DIR,'.'+requested);
  if(!resolved.startsWith(PUBLIC_DIR+path.sep)) return json(res,400,{error:'Invalid path.'});
  fs.readFile(resolved,(error,data)=>{
    if(error) return json(res,404,{error:'Not found.'});
    const ext=path.extname(resolved).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
    send(res,200,data,types[ext]||'application/octet-stream');
  });
}
http.createServer((req,res)=>{handle(req,res).catch(()=>json(res,500,{error:'Unexpected server error.'}));}).listen(PORT,'0.0.0.0',()=>console.log('AA Growth Command Centre listening on '+PORT));
