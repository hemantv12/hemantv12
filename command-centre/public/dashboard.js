(function(){
'use strict';
var token=sessionStorage.getItem('aa_cc_token')||'';
var currentView='overview';
var cache={overview:null,visitors:null,enquiries:[],meta:null,connected:null};
var localPlans=JSON.parse(localStorage.getItem('aa_cc_plans')||'[]');
var localPosts=JSON.parse(localStorage.getItem('aa_cc_posts')||'[]');
var titles={overview:'Overview',command:'AI Command',ads:'Ads & Audiences',social:'Social Studio',leads:'Leads CRM',analytics:'Channel Analytics',content:'Content Studio',integrations:'Integrations',settings:'Settings & Safety'};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(v){if(v===null||v===undefined||v==='')return '—';var n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-US'):'Unavailable';}
function shortDate(v){if(!v)return '—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleString();}
function toast(message){var t=document.getElementById('toast');t.textContent=message;t.classList.remove('hidden');setTimeout(function(){t.classList.add('hidden');},3800);}
async function api(path,options){
 options=options||{};var headers={'Accept':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(options.body!==undefined)headers['Content-Type']='application/json';
 var response=await fetch('/api'+path,{method:options.method||'GET',headers:headers,body:options.body===undefined?undefined:JSON.stringify(options.body),cache:'no-store'});
 var data=await response.json().catch(function(){return {error:'Unexpected server response.'};});
 if(!response.ok){var err=new Error(data.error||'Request failed ('+response.status+').');err.status=response.status;throw err;}
 return data;
}
function showLogin(){document.getElementById('login').classList.remove('hidden');document.getElementById('app').classList.add('hidden');}
function showApp(){document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');}
function setView(view){
 if(!titles[view])return;currentView=view;document.getElementById('topTitle').textContent=titles[view];
 document.querySelectorAll('[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===view);});
 renderView();document.querySelector('.sidebar').classList.remove('mobile-open');if(view==='leads')loadLeads();if(view==='analytics'||view==='integrations'||view==='ads'||view==='social')loadConnectedData('30d');
}
function card(label,value,foot,icon){return '<div class="card"><div class="card-head"><span class="metric-label">'+esc(label)+'</span><span class="metric-icon">'+icon+'</span></div><div class="metric-value">'+esc(value)+'</div><div class="metric-foot">'+esc(foot)+'</div></div>';}
function empty(message){return '<div class="empty">'+esc(message)+'</div>';}
function money(v,currency){
 if(v===null||v===undefined||v==='')return 'Unavailable';
 var n=Number(v);if(!Number.isFinite(n))return 'Unavailable';
 return (currency||'USD')+' '+n.toLocaleString('en-US',{maximumFractionDigits:2});
}
function sourceSync(runRows,connector,account){
 return (runRows||[]).find(function(r){return r.connector===connector&&(!account||r.account_id===account);})||null;
}
function renderOverview(){
 var o=cache.overview,d=cache.connected||{},m=d.meta_ads||{},fb=d.facebook_organic||{},ig=d.instagram||{},ga=d.ga4||{},sc=d.search_console||{};
 var accounts=m.accounts||[],ads=m.ads||[],active=ads.filter(function(a){return a.effective_status==='ACTIVE';}).length;
 var metaSpendRows=accounts.reduce(function(n,a){return n+(Number(a.spend_rows)||0);},0);
 var spend=metaSpendRows?accounts.reduce(function(n,a){return n+(Number(a.spend)||0);},0):null;
 var leadsRows=accounts.reduce(function(n,a){return n+(Number(a.lead_rows)||0);},0);
 var leads=leadsRows?accounts.reduce(function(n,a){return n+(Number(a.leads)||0);},0):null;
 var metaCurrency=(accounts.find(function(a){return a.spend_rows>0;})||accounts[0]||{}).currency||'—';
 var gsc=sc.summary||{},igs=ig.summary||{},fbs=fb.summary||{};
 var lastSync=(d.sync_runs||[]).reduce(function(best,r){return !best||new Date(r.fetched_at)>new Date(best.fetched_at)?r:best;},null);
 var adMetrics=metaSpendRows?'Insights returned':'Ads exist · Insights unavailable';
 document.getElementById('view').innerHTML=
 '<div class="page-head"><div><div class="eyebrow">AA Growth Studio / Live data room</div><h1>Marketing performance</h1><p>Connected Windsor snapshots · Last 30 days, with Instagram latest-day reach shown separately.</p></div><div class="head-actions"><button class="btn" data-go="integrations">Connections</button><button class="btn primary" id="connectedRefresh">↻ Reload saved data</button></div></div>'+
 '<div class="grid stats">'+
 card('Meta spend · 30d',money(spend,metaCurrency),'Meta account insights · '+adMetrics,'$')+
 card('Active Meta ads',fmt(active),'Across separately listed accounts','↗')+
 card('Instagram reach · latest day',fmt(igs.latest_day_reach),'Latest available daily insight','◎')+
 card('Google search clicks · 30d',fmt(gsc.clicks),'Search Console · '+fmt(gsc.impressions)+' impressions','⌕')+
 '</div>'+
 '<div class="grid split"><section class="card"><div class="card-head"><div><div class="eyebrow">Meta Ads / Account separation</div><h3>Ad account health</h3></div><span class="status-pill '+(accounts.length?'ok':'warn')+'">'+accounts.length+' account snapshots</span></div>'+
 (accounts.length?'<div class="table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th>Account</th><th>Ads</th><th>Spend</th><th>Leads</th></tr></thead><tbody>'+accounts.map(function(a){return '<tr><td><strong>'+esc(a.account_name||a.account_id)+'</strong><div class="tiny">'+esc(a.account_id)+'</div></td><td>'+fmt(a.ad_objects)+' <span class="tiny">('+fmt(a.active_ads)+' active)</span></td><td>'+money(a.spend,a.currency)+'</td><td>'+fmt(a.leads)+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="empty">No Meta Ads account rows returned by Windsor yet.</div>')+
 '<p class="small muted section-gap">Null spend or leads means Meta returned no usable insight value. It is not a zero.</p><button class="btn" data-go="ads">Open Ads Manager view →</button></section>'+
 '<section class="card"><div class="card-head"><div><div class="eyebrow">Organic channels</div><h3>Recent social activity</h3></div><span class="status-pill '+((Number(fbs.posts)||0)+(Number(igs.days)||0)>0?'ok':'warn')+'">Snapshot</span></div>'+
 '<div class="rows">'+
 row('Facebook Page posts · 30d',fmt(fbs.posts),'')+
 row('Facebook post impressions',fmt(fbs.impressions),'')+
 row('Instagram insight days',fmt(igs.days),'')+
 row('Instagram likes · 30d',fmt(igs.likes),'')+
 row('Instagram comments · 30d',fmt(igs.comments),'')+
 row('Instagram shares · 30d',fmt(igs.shares),'')+
 '</div><button class="btn" data-go="analytics">Open channel analytics →</button></section></div>'+
 '<div class="grid split section-gap"><section class="card"><div class="card-head"><div><div class="eyebrow">Search Console</div><h3>Organic search visibility</h3></div><span class="status-pill '+(Number(gsc.rows)>0?'ok':'warn')+'">'+fmt(gsc.rows)+' query rows</span></div>'+
 '<div class="grid thirds">'+planItem('Clicks',fmt(gsc.clicks))+planItem('Impressions',fmt(gsc.impressions))+planItem('Average position',gsc.avg_position==null?'Unavailable':Number(gsc.avg_position).toFixed(1))+'</div>'+
 (sc.queries&&sc.queries.length?'<div class="table-wrap section-gap"><table class="data-table"><thead><tr><th>Search query</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr></thead><tbody>'+sc.queries.slice(0,5).map(function(q){return '<tr><td>'+esc(q.query)+'</td><td>'+fmt(q.clicks)+'</td><td>'+fmt(q.impressions)+'</td><td>'+ (q.position==null?'Unavailable':Number(q.position).toFixed(1))+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Search Console query rows returned for this range.'))+'</section>'+
 '<section class="card"><div class="card-head"><div><div class="eyebrow">Data freshness</div><h3>Last source syncs</h3></div><span class="status-pill '+(lastSync?'ok':'warn')+'">'+(lastSync?'Snapshot imported':'No snapshots')+'</span></div>'+
 (d.sync_runs&&d.sync_runs.length?d.sync_runs.map(function(r){return '<div class="rowline"><div><strong>'+esc(r.connector)+'</strong><div class="tiny">'+esc(r.account_id)+'</div></div><div style="text-align:right"><span class="status-pill '+(r.status==='synced'?'ok':'warn')+'">'+esc(r.status)+'</span><div class="tiny">'+esc(shortDate(r.fetched_at))+'</div></div></div>';}).join(''):empty('No source history yet.'))+
 '<div class="notice info section-gap">This is a one-time snapshot import. Hourly auto-sync is not active yet; the Windsor → Neon bridge still needs to be configured.</div><button class="btn" data-go="integrations">Finish data bridge setup</button></section></div>'+
 '<div class="notice info section-gap">GA4 returned '+fmt(ga.summary&&ga.summary.days)+' data rows. No GA4 sessions/conversions have been reported in this snapshot. Data sources are shown separately; no values are combined across accounts.</div>'+growthSignals(d,accounts,ads,ga);
 document.getElementById('connectedRefresh').onclick=async function(){await loadConnectedData('7d');if(currentView==='overview')renderOverview();toast('Stored dashboard data reloaded.');};
}

function growthSignals(d,accounts,ads,ga){
 var items=[];
 if(ads.length&&accounts.every(function(a){return Number(a.spend_rows)===0&&Number(a.impression_rows)===0;}))items.push({tone:'warn',title:'Meta Ads delivery metrics missing',body:'Ad objects exist, but spend, impressions and leads were not returned. Check delivery, account access and reporting date range in Meta.'});
 if(accounts.some(function(a){return a.account_id==='1830321494777827'&&Number(a.ad_objects)===0;}))items.push({tone:'warn',title:'Agency ad account returned no rows',body:'AA Growth Studio (1830321494777827) has no ad objects in this snapshot. Confirm the intended ad account and access.'});
 if(!Number(ga.summary&&ga.summary.days))items.push({tone:'warn',title:'GA4 data needs attention',body:'The connected GA4 source returned no rows. Confirm the property and reporting access before using website-session or conversion numbers.'});
 if(((d.facebook_organic||{}).summary||{}).posts||((d.instagram||{}).summary||{}).days)items.push({tone:'ok',title:'Organic social reporting is available',body:'Facebook Page and Instagram snapshots are loaded. These are imported read-only metrics, not publishing connections.'});
 return '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Growth signals / Recommended checks</div><h3>What needs attention</h3></div><span class="status-pill">'+items.length+' signals</span></div>'+(items.length?items.map(function(x){return '<div class="rowline"><div><strong>'+esc(x.title)+'</strong><div class="small muted">'+esc(x.body)+'</div></div><span class="status-pill '+(x.tone==='ok'?'ok':'warn')+'">'+(x.tone==='ok'?'Available':'Review')+'</span></div>';}).join(''):empty('No immediate data-quality signals.'))+'</section>';
}
function row(label,value,state){return '<div class="rowline"><span class="muted">'+esc(label)+'</span><span class="status-pill '+state+'">'+esc(value)+'</span></div>';}
function recentRows(rows){
 if(!rows.length)return empty('No leads have been saved in this new CRM yet.');
 return '<div class="table-wrap"><table class="data-table" style="min-width:490px"><thead><tr><th>Name</th><th>Service</th><th>Status</th><th>Date</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td><strong>'+esc(r.name)+'</strong><div class="tiny">'+esc(r.email||r.mobile_number||'')+'</div></td><td>'+esc(r.service)+'</td><td><span class="status-pill '+(r.status==='new'?'warn':'')+'">'+esc(r.status)+'</span></td><td>'+esc(shortDate(r.created_at))+'</td></tr>';}).join('')+'</tbody></table></div>';
}
function sourceBars(rows){
 if(!rows.length)return empty('No traffic source data is available for this date range.');
 var max=Math.max.apply(null,rows.map(function(x){return Number(x.visits)||0;}))||1;
 return '<div class="bar-list">'+rows.slice(0,7).map(function(x){return '<div><div class="bar-top"><span>'+esc(x.source)+'</span><strong>'+fmt(x.visits)+'</strong></div><div class="bar-track"><div class="bar-fill" style="width:'+Math.round((Number(x.visits)||0)/max*100)+'%"></div></div></div>';}).join('')+'</div>';
}
function openLeadModal(){
 var el=document.getElementById('modal');el.classList.remove('hidden');
 document.getElementById('modalContent').innerHTML='<div class="card-head"><h3>Add a lead</h3><button class="btn ghost" id="closeLeadModal">✕</button></div>'+
 '<form id="leadForm"><div class="field"><label>Name</label><input class="control" id="leadName" required maxlength="120"></div>'+
 '<div class="grid thirds"><div class="field"><label>Email</label><input class="control" id="leadEmail" type="email"></div><div class="field"><label>Phone / WhatsApp</label><input class="control" id="leadPhone"></div><div class="field"><label>Country / market</label><select class="control" id="leadMarket"><option>USA</option><option>India</option><option>Other</option></select></div></div>'+
 '<div class="grid thirds"><div class="field"><label>Company</label><input class="control" id="leadCompany"></div><div class="field"><label>Service</label><input class="control" id="leadService" required placeholder="Website, social, app…"></div><div class="field"><label>Source</label><select class="control" id="leadSource"><option>manual</option><option>Website</option><option>Referral</option><option>Meta Ads</option><option>Instagram</option><option>Other</option></select></div></div>'+
 '<div class="field"><label>Notes</label><textarea class="control" id="leadNotes" rows="3"></textarea></div><div class="inline"><button class="btn primary" type="submit">Save lead</button></div></form>';
 document.getElementById('closeLeadModal').onclick=function(){el.classList.add('hidden');};
 document.getElementById('leadForm').onsubmit=async function(e){e.preventDefault();var body={name:document.getElementById('leadName').value,email:document.getElementById('leadEmail').value,mobile_number:document.getElementById('leadPhone').value,market:document.getElementById('leadMarket').value,company:document.getElementById('leadCompany').value,service:document.getElementById('leadService').value,source:document.getElementById('leadSource').value,notes:document.getElementById('leadNotes').value};try{await api('/admin/enquiries',{method:'POST',body:body});el.classList.add('hidden');toast('Lead saved to the new database.');await loadLeads();}catch(error){toast(error.message);}};
}
function renderLeads(){
 var rows=cache.enquiries||[];
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Pipeline / First-party enquiries</div><h1>Leads CRM</h1><p>Website enquiries saved by your existing AA Growth contact form.</p></div><div class="head-actions"><button class="btn" id="leadsRefresh">↻ Refresh</button><button class="btn" id="addLead">+ Add lead</button><button class="btn primary" id="exportLeads">Export CSV</button></div></div>'+
 '<div class="notice info" style="margin-bottom:14px">These are leads saved in your new Command Centre database. Add leads manually for now; your old website enquiry history has not been copied.</div>'+
 '<div class="card"><div class="inline" style="margin-bottom:15px"><input id="leadSearch" class="control" placeholder="Search name, email, company or service" style="max-width:360px"><select id="leadFilter" class="control" style="max-width:170px"><option value="">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="replied">Replied</option><option value="closed">Closed</option></select><span class="tiny right">'+rows.length+' records returned</span></div><div id="leadTable" class="table-wrap"></div></div>';
 function paint(){
  var q=(document.getElementById('leadSearch').value||'').toLowerCase(),f=document.getElementById('leadFilter').value;
  var filtered=rows.filter(function(r){return (!f||r.status===f)&&[r.name,r.email,r.company,r.service,r.source].join(' ').toLowerCase().includes(q);});
  var el=document.getElementById('leadTable');
  if(!filtered.length){el.innerHTML=empty('No enquiries match this filter.');return;}
  el.innerHTML='<table class="data-table"><thead><tr><th>Contact</th><th>Company</th><th>Service</th><th>Source</th><th>Status</th><th>Received</th></tr></thead><tbody>'+filtered.map(function(r){return '<tr><td><strong>'+esc(r.name)+'</strong><div class="tiny">'+esc(r.email||r.mobile_number||'')+'</div></td><td>'+esc(r.company||'—')+'</td><td>'+esc(r.service||'—')+'</td><td>'+esc(r.source||'—')+'</td><td><select class="control statusChange" data-id="'+esc(r.id)+'" style="padding:6px;min-width:110px"><option value="new" '+(r.status==='new'?'selected':'')+'>New</option><option value="in_progress" '+(r.status==='in_progress'?'selected':'')+'>In progress</option><option value="replied" '+(r.status==='replied'?'selected':'')+'>Replied</option><option value="closed" '+(r.status==='closed'?'selected':'')+'>Closed</option></select></td><td>'+esc(shortDate(r.created_at))+'</td></tr>';}).join('')+'</tbody></table>';
  el.querySelectorAll('.statusChange').forEach(function(sel){sel.addEventListener('change',async function(){try{await api('/admin/enquiries/'+sel.dataset.id,{method:'PATCH',body:{status:sel.value}});toast('Lead status updated.');await loadLeads();}catch(e){toast(e.message);}});});
 }
 document.getElementById('leadSearch').addEventListener('input',paint);document.getElementById('leadFilter').addEventListener('change',paint);
 document.getElementById('leadsRefresh').onclick=loadLeads;document.getElementById('addLead').onclick=openLeadModal;
 document.getElementById('exportLeads').onclick=function(){downloadCSV(rows,'aa-growth-website-enquiries.csv');};paint();
}
function downloadCSV(rows,filename){
 if(!rows||!rows.length){toast('There are no records to export.');return;}
 var cols=Object.keys(rows[0]),csv=[cols.join(',')].concat(rows.map(function(r){return cols.map(function(k){return '"'+String(r[k]==null?'':r[k]).replace(/"/g,'""')+'"';}).join(',');})).join('\r\n');
 var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
function renderSocial(){
 var d=cache.connected||{},ig=d.instagram||{},fb=d.facebook_organic||{},i=ig.summary||{},f=fb.summary||{},daily=(ig.daily||[]).slice().reverse(),posts=(fb.posts_data||[]).slice();
 var interactions=(Number(i.likes)||0)+(Number(i.comments)||0)+(Number(i.shares)||0);
 var top=posts.slice().sort(function(a,b){return (Number(b.post_impressions)||0)-(Number(a.post_impressions)||0);}).slice(0,5);
 var trend=daily.slice(-14),maxReach=Math.max.apply(null,trend.map(function(x){return Number(x.reach)||0;}))||1;
 var bars=trend.length?'<div class="social-bars">'+trend.map(function(x){var h=Math.max(4,Math.round((Number(x.reach)||0)/maxReach*100));return '<div class="social-bar-col"><div class="social-bar-value">'+fmt(x.reach)+'</div><div class="social-bar-track"><div class="social-bar-fill" style="height:'+h+'%"></div></div><div class="social-bar-label">'+esc(String(x.date||'').slice(5))+'</div></div>';}).join('')+'</div>':empty('No Instagram reach trend is available for this date range.');
 document.getElementById('view').innerHTML=
 '<div class="page-head"><div><div class="eyebrow">Organic growth / Social performance</div><h1>Social Studio</h1><p>Read-only Instagram and Facebook reporting, top content and a direct route into content production.</p></div><div class="head-actions"><button class="btn" id="socialRefresh">↻ Reload saved data</button><button class="btn primary" data-go="content">Create content draft</button></div></div>'+
 '<div class="grid stats">'+card('Instagram reach · latest day',fmt(i.latest_day_reach),'Daily reach; not unique 30-day reach','◎')+card('Instagram interactions · 30d',fmt(interactions),'Likes + comments + shares','✳')+card('Facebook Page posts · 30d',fmt(f.posts),'Imported organic post records','▤')+card('Facebook impressions · 30d',fmt(f.impressions),'Post-level impressions; not unique reach','◉')+'</div>'+
 '<div class="grid split"><section class="card"><div class="card-head"><div><div class="eyebrow">Instagram Professional</div><h3>Daily reach trend</h3></div><span class="status-pill">'+fmt(i.days)+' insight days</span></div>'+bars+'<p class="tiny section-gap">Bars show daily reach values. Daily reach must not be added together as unique monthly people.</p></section>'+
 '<section class="card"><div class="card-head"><div><div class="eyebrow">Publishing workflow</div><h3>Content production</h3></div><span class="status-pill warn">Drafts only</span></div>'+
 '<div class="metric-value">'+fmt(localPosts.length)+'</div><p class="small muted">Saved content drafts in the Command Centre.</p><div class="rows">'+row('Instagram publishing','Not connected here','warn')+row('Facebook publishing','Not connected here','warn')+row('Draft storage','Neon database','ok')+'</div><div class="inline section-gap"><button class="btn primary" data-go="content">Open Content Studio</button><button class="btn" data-go="integrations">Connection status</button></div></section></div>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Facebook Organic / Content intelligence</div><h3>Top posts by impressions</h3></div><span class="status-pill">'+top.length+' shown</span></div>'+
 (top.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Post copy</th><th>Impressions</th><th>Clicks</th><th>Reactions</th></tr></thead><tbody>'+top.map(function(p){return '<tr><td>'+esc(p.date||'—')+'</td><td>'+esc((p.post_message||'Photo / media post').slice(0,145))+'</td><td>'+fmt(p.post_impressions)+'</td><td>'+fmt(p.post_clicks)+'</td><td>'+fmt(p.post_reactions_by_type_total)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Facebook post rows are available for this range.'))+
 '<div class="notice info section-gap">The dashboard can analyse imported organic metrics and save new content drafts. It cannot publish, schedule, reply to comments or send DMs from this screen yet.</div></section>'+
 '<div class="inline section-gap"><button class="btn" id="exportSocial">Export social snapshot</button><button class="btn" data-go="analytics">Open full channel analytics</button></div>';
 document.getElementById('socialRefresh').onclick=async function(){var ok=await loadConnectedData('30d');if(ok)toast('Stored social data reloaded.');};
 document.getElementById('exportSocial').onclick=function(){downloadText('aa-growth-social-snapshot.json',JSON.stringify({range:d.range,instagram:{summary:i,daily:daily},facebook:{summary:f,topPosts:top}},null,2));};
}
function renderAnalytics(){
 var d=cache.connected||{},ig=d.instagram||{},fb=d.facebook_organic||{},sc=d.search_console||{},ga=d.ga4||{};
 var g=sc.summary||{},i=ig.summary||{},f=fb.summary||{},a=ga.summary||{};
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Connected channel reporting</div><h1>Analytics</h1><p>Windsor.ai snapshots from Instagram, Facebook Page, Google Search Console and GA4.</p></div><div class="head-actions"><select id="rangeSelect" class="control" style="width:145px"><option value="7d">Last 7 days</option><option value="30d" selected>Last 30 days</option></select><button class="btn" id="analyticsRefresh">↻ Refresh</button></div></div>'+
 '<div class="grid stats">'+card('Instagram reach · latest day',fmt(i.latest_day_reach),'Daily metric, not 30-day unique reach','◎')+card('Instagram interactions',fmt((Number(i.likes)||0)+(Number(i.comments)||0)+(Number(i.shares)||0)),'Likes + comments + shares','✳')+card('Facebook post impressions',fmt(f.impressions),'Selected period','▤')+card('Search Console clicks',fmt(g.clicks),'Selected period','⌕')+'</div>'+
 '<div class="grid split"><section class="card"><div class="card-head"><div><div class="eyebrow">Instagram Professional</div><h3>Daily insight trend</h3></div><span class="status-pill">'+fmt(i.days)+' days returned</span></div>'+
 (ig.daily&&ig.daily.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Reach</th><th>Likes</th><th>Comments</th><th>Shares</th></tr></thead><tbody>'+ig.daily.map(function(r){return '<tr><td>'+esc(r.date)+'</td><td>'+fmt(r.reach)+'</td><td>'+fmt(r.likes)+'</td><td>'+fmt(r.comments)+'</td><td>'+fmt(r.shares)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Instagram insight rows returned.'))+
 '<p class="tiny section-gap">Impressions are unavailable where the connector returned NULL. Reach is a per-day value; do not sum it as unique monthly reach.</p></section>'+
 '<section class="card"><div class="card-head"><div><div class="eyebrow">Facebook Page</div><h3>Recent organic posts</h3></div><span class="status-pill">'+fmt(f.posts)+' posts</span></div>'+
 '<div class="rows">'+row('Post impressions',fmt(f.impressions),'')+row('Post clicks',fmt(f.clicks),'')+row('Reactions',fmt(f.reactions),'')+
 '</div><div class="notice info section-gap">Post-level impressions are not unique people reached. This is organic Page performance, not paid Ads Manager delivery.</div></section></div>'+
 '<div class="grid split section-gap"><section class="card"><div class="card-head"><div><div class="eyebrow">Google Search Console</div><h3>Queries with impressions</h3></div><span class="status-pill">'+fmt(g.queries)+' queries</span></div>'+
 (sc.queries&&sc.queries.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>'+sc.queries.map(function(q){return '<tr><td>'+esc(q.query)+'</td><td>'+fmt(q.clicks)+'</td><td>'+fmt(q.impressions)+'</td><td>'+(q.ctr==null?'Unavailable':(Number(q.ctr)*100).toFixed(1)+'%')+'</td><td>'+(q.position==null?'Unavailable':Number(q.position).toFixed(1))+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Search Console queries returned.'))+
 '</section><section class="card"><div class="card-head"><div><div class="eyebrow">Google Analytics 4</div><h3>Website traffic</h3></div><span class="status-pill warn">'+(Number(a.days)>0?'Data returned':'No rows returned')+'</span></div>'+
 '<div class="grid thirds">'+planItem('Sessions',fmt(a.sessions))+planItem('Key events',fmt(a.conversions))+planItem('Last date',a.latest_date||'Unavailable')+'</div>'+
 '<p class="small muted section-gap">GA4 account is listed in Windsor, but it returned no rows for this snapshot. Confirm the GA4 property and reporting access before using these metrics.</p></section></div>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Organic content library</div><h3>Latest Facebook Page posts</h3></div><span class="status-pill">'+(fb.posts||0)+' posts in source window</span></div>'+
 (fb.posts_data&&fb.posts_data.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Post</th><th>Impressions</th><th>Clicks</th><th>Reactions</th></tr></thead><tbody>'+fb.posts_data.slice(0,20).map(function(p){return '<tr><td>'+esc(p.date)+'</td><td>'+esc((p.post_message||'').slice(0,130)||'Photo / media post')+'</td><td>'+fmt(p.post_impressions)+'</td><td>'+fmt(p.post_clicks)+'</td><td>'+fmt(p.post_reactions_by_type_total)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Facebook Page post rows returned.'))+'</section>'+
 '<div class="notice info section-gap">Last imported: '+esc((d.sync_runs||[]).map(function(r){return r.connector+' '+shortDate(r.fetched_at);}).join(' · ')||'not available')+'. These are stored snapshots, not live streaming analytics. Recurring sync setup is still pending.</div>';
 document.getElementById('rangeSelect').value=d.range||'30d';
 document.getElementById('rangeSelect').onchange=function(){loadConnectedData(this.value);};
 document.getElementById('analyticsRefresh').onclick=function(){loadConnectedData(document.getElementById('rangeSelect').value);};
}

function renderAds(){
 var d=cache.connected||{},m=d.meta_ads||{},accounts=m.accounts||[],ads=m.ads||[];
 var available=accounts.reduce(function(n,a){return n+(Number(a.spend_rows)||0);},0);
 var spend=available?accounts.reduce(function(n,a){return n+(Number(a.spend)||0);},0):null;
 var spendCurrency=(accounts.find(function(a){return a.spend_rows>0;})||accounts[0]||{}).currency||'—';
 var active=ads.filter(function(a){return a.effective_status==='ACTIVE';}).length;
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Paid media / Meta Ads</div><h1>Ads Manager</h1><p>Two Meta ad-account sources are kept separate. Insights availability is shown exactly as returned.</p></div><button class="btn primary" id="adsRefresh">↻ Refresh snapshot</button></div>'+
 '<div class="grid stats">'+card('Spend · last 30d',money(spend,spendCurrency),available?'Meta reporting':'No numeric spend returned','$')+card('Ad objects',fmt(ads.length),'Returned by Meta','▣')+card('Active ads',fmt(active),'Effective status ACTIVE','↗')+card('Leads',accounts.some(function(a){return a.lead_rows>0;})?fmt(accounts.reduce(function(n,a){return n+(Number(a.leads)||0);},0)):'Unavailable','Meta lead metric','◎')+'</div>'+
 '<div class="notice danger section-gap">Meta returned 2 active ad objects under “Hemant Verma”, but its spend, impressions, reach, clicks and lead insight fields are NULL. The AA Growth Studio ad account returned no rows. NULL means unavailable—not zero. No campaigns have been changed.</div>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Ad account inventory</div><h3>Connected account sources</h3></div><span class="status-pill ok">'+accounts.length+' sources</span></div>'+
 (accounts.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Account</th><th>Objects</th><th>Active</th><th>Currency</th><th>Spend rows</th><th>Lead rows</th></tr></thead><tbody>'+accounts.map(function(a){return '<tr><td><strong>'+esc(a.account_name||a.account_id)+'</strong><div class="tiny">'+esc(a.account_id)+'</div></td><td>'+fmt(a.ad_objects)+'</td><td>'+fmt(a.active_ads)+'</td><td>'+esc(a.currency||'—')+'</td><td>'+fmt(a.spend_rows)+'</td><td>'+fmt(a.lead_rows)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No Meta Ads rows are stored yet.'))+'</section>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Campaign / Ad delivery objects</div><h3>Returned ads</h3></div><span class="status-pill">'+ads.length+' rows</span></div>'+
 (ads.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Ad</th><th>Account</th><th>Status</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Leads</th></tr></thead><tbody>'+ads.map(function(a){return '<tr><td><strong>'+esc(a.ad_name||a.ad_id)+'</strong><div class="tiny">Ad ID '+esc(a.ad_id)+'</div></td><td>'+esc(a.account_name||a.account_id)+'</td><td><span class="status-pill '+(a.effective_status==='ACTIVE'?'ok':'warn')+'">'+esc(a.effective_status||'Unavailable')+'</span></td><td>'+money(a.spend,a.account_currency)+'</td><td>'+fmt(a.impressions)+'</td><td>'+fmt(a.clicks)+'</td><td>'+fmt(a.actions_lead)+'</td></tr>';}).join('')+'</tbody></table></div>':empty('No ad objects were returned for this reporting window.'))+'</section>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Audience Lab</div><h3>Retargeting & audience briefs</h3></div><span class="status-pill warn">Planning only</span></div><div class="grid thirds">'+
 '<div class="plan-item"><label>Prospecting</label><strong>US small-business owners researching web, app and creative services.</strong><p class="small muted">Strategy hypothesis, not a measured Meta audience.</p></div>'+
 '<div class="plan-item"><label>Website retargeting</label><strong>Relevant service-page visitors who did not submit an enquiry.</strong><p class="small muted">Needs Pixel/CAPI data and Custom Audiences permission.</p></div>'+
 '<div class="plan-item"><label>Social engagement</label><strong>Instagram/Facebook engagers and video viewers.</strong><p class="small muted">Needs audience-creation permission and eligible audience size.</p></div></div></section>'+
 '<div class="inline section-gap"><button class="btn" data-go="integrations">Manage data connections</button><button class="btn" data-go="command">Draft a campaign plan</button></div>';
 document.getElementById('adsRefresh').onclick=function(){loadConnectedData('30d');};
}

function renderIntegrations(){
 var d=cache.connected||{},m=d.meta_ads||{},fb=d.facebook_organic||{},ig=d.instagram||{},ga=d.ga4||{},sc=d.search_console||{},runs=d.sync_runs||[];
 function latest(conn,account){return runs.find(function(r){return r.connector===conn&&(!account||r.account_id===account);})||null;}
 function state(run,rows){if(!run)return {label:'Not imported',className:'warn'};if(Number(rows)>0)return {label:'Snapshot imported',className:'ok'};return {label:'No rows returned',className:'warn'};}
 var metaAgency=latest('facebook','1830321494777827'),metaOwner=latest('facebook','1483425516986252'),fbRun=latest('facebook_organic','1454190361104294'),igRun=latest('instagram','17841464848354217'),gaRun=latest('googleanalytics4','225503662'),scRun=latest('searchconsole','sc-domain:aagrowthstudio.com');
 var fbStatus=state(fbRun,(fb.summary||{}).posts),igStatus=state(igRun,(ig.summary||{}).days),gaStatus=state(gaRun,(ga.summary||{}).days),scStatus=state(scRun,(sc.summary||{}).rows);
 function last(r){return r?shortDate(r.fetched_at):'Not imported';}
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Connections / Data access</div><h1>Integrations</h1><p>Verified Windsor sources, latest imported data and automation status.</p></div><button class="btn primary" id="intRefresh">↻ Refresh snapshot</button></div>'+
 '<section class="card"><div class="card-head"><div><div class="eyebrow">Meta Ads</div><h3>Ad account sources</h3></div><span class="status-pill ok">Windsor data imported</span></div>'+
 '<div class="rows">'+row('AA Growth Studio · 1830321494777827',metaAgency?fmt(metaAgency.rows_returned)+' rows returned': 'Not imported',metaAgency&&Number(metaAgency.rows_returned)>0?'ok':'warn')+
 row('Hemant Verma · 1483425516986252',metaOwner?fmt(metaOwner.rows_returned)+' ad objects': 'Not imported',metaOwner&&Number(metaOwner.rows_returned)>0?'ok':'warn')+
 row('Last Meta import',last(metaOwner),'')+
 '</div><p class="small muted">The Hemant Verma-named account returned two ACTIVE ad objects, but spend, impressions, reach, clicks and lead metrics were NULL. The AA Growth Studio ad account returned no rows. The accounts remain separate.</p></section>'+
 '<div class="grid thirds section-gap"><section class="card"><div class="eyebrow">Facebook Organic</div><h3>AA Growth Studio Page</h3><span class="status-pill '+fbStatus.className+'">'+fbStatus.label+'</span><div class="metric-value">'+fmt((fb.summary||{}).posts)+'</div><p class="small muted">Posts in last 7 days · account 1454190361104294</p><div class="tiny">'+esc(last(fbRun))+'</div></section>'+
 '<section class="card"><div class="eyebrow">Instagram Insights</div><h3>@aagrowthstudio</h3><span class="status-pill '+igStatus.className+'">'+igStatus.label+'</span><div class="metric-value">'+fmt((ig.summary||{}).days)+'</div><p class="small muted">Daily insights in last 7 days · account 17841464848354217</p><div class="tiny">'+esc(last(igRun))+'</div></section>'+
 '<section class="card"><div class="eyebrow">Google Search Console</div><h3>aagrowthstudio.com</h3><span class="status-pill '+scStatus.className+'">'+scStatus.label+'</span><div class="metric-value">'+fmt((sc.summary||{}).rows)+'</div><p class="small muted">Query rows in last 30 days · sc-domain:aagrowthstudio.com</p><div class="tiny">'+esc(last(scRun))+'</div></section></div>'+
 '<div class="grid split section-gap"><section class="card"><div class="eyebrow">Google Analytics 4</div><h3>Website Analytics</h3><span class="status-pill '+gaStatus.className+'">'+gaStatus.label+'</span><div class="rows section-gap">'+row('GA4 property','hemant-3ca03 · 225503662','')+row('Sessions',fmt((ga.summary||{}).sessions),'')+row('Key events',fmt((ga.summary||{}).conversions),'')+
 '</div><p class="small muted">The property is connected in Windsor, but the last 30-day query returned no rows using the valid GA4 fields. Confirm the property has active traffic/reporting access before relying on GA4 metrics.</p></section>'+
 '<section class="card"><div class="eyebrow">CRM / Other tools</div><h3>Other connected sources</h3><div class="rows">'+row('HubSpot','Connected in Windsor · not yet imported','warn')+row('WhatsApp Business','Not connected to this dashboard','warn')+row('Instagram publishing','Not wired in this dashboard','warn')+row('Facebook publishing','Not wired in this dashboard','warn')+'</div><p class="small muted">Publishing permissions in Windsor do not automatically connect the web dashboard. No social post will be sent from here yet.</p></section></div>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Recurring data refresh</div><h3>Daily Windsor → Neon sync</h3></div><span class="status-pill warn">Scheduled · first run pending</span></div>'+
 '<div class="grid thirds">'+planItem('Next schedule','Daily · 5:00 PM Asia/Kolkata')+planItem('Automation','AA Growth — Leads & Community')+planItem('Destination','Neon Free · windsor schema')+'</div>'+
 '<div class="rows section-gap">'+row('Latest imported snapshot',last(metaOwner),'')+row('Data scope','Meta Ads, Facebook Organic, Instagram, GA4, Search Console','')+row('Permissions','Read-only reporting; no Ads writes','ok')+'</div>'+
 '<div class="notice info section-gap">The initial snapshot has been imported. The existing daily 5 PM task now includes the database upsert. Its first scheduled run has not yet completed, so recurring sync is not marked verified until a successful run is recorded.</div></section>'+
 '<div class="notice info section-gap">Campaign creation, campaign edits, budget changes, retargeting audience creation, and social publishing remain disabled from this dashboard. Live data visibility does not imply write permission.</div>';
 document.getElementById('intRefresh').onclick=async function(){await loadConnectedData('30d');toast('Stored data reloaded.');};
}

function renderSettings(){
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Controls / Guardrails</div><h1>Settings & safety</h1><p>Operating defaults for AA Growth Studio.</p></div></div>'+
 '<div class="grid split"><section class="card"><div class="eyebrow">Business defaults</div><h3>Growth profile</h3><div class="rows">'+row('Business','AA Growth Studio','ok')+row('Website','aagrowthstudio.com','ok')+row('Primary market','United States','ok')+row('Secondary market','India','ok')+row('Timezone','Asia/Kolkata','ok')+row('Brand voice','Premium · direct · human','ok')+'</div></section>'+
 '<section class="card"><div class="eyebrow">Spend safeguards</div><h3>Campaign controls</h3><div class="rows">'+row('Campaign launch','Disabled','warn')+row('Budget editing','Disabled','warn')+row('Approval before spend','Required','ok')+row('Global kill switch','ON · no spending actions','ok')+'</div><div class="notice info section-gap">No campaign can be launched or budget changed in this version. Drafts are planning documents only.</div></section></div>'+
 '<section class="card section-gap"><div class="eyebrow">Storage & uptime</div><h3>Where your data lives</h3><div class="rows">'+row('New dashboard login','Neon Free database branch','ok')+row('Campaign plans & content drafts','Saved in database','ok')+row('Leads CRM','Saved in database','ok')+row('Hosting','Render Free · may sleep','warn')+row('Old CMS data','Separate · not changed','ok')+'</div><p class="small muted">The new dashboard starts with an empty workspace. Old website enquiry history is not copied into it. The original CMS and website database were left untouched.</p></section>'+
 '<section class="card section-gap"><div class="eyebrow">Account</div><h3>Change your dashboard password</h3><p class="small muted">Your new dashboard password is separate from the old CMS password. You can change it here after signing in.</p><button class="btn" id="changePassword">Change dashboard password</button></section>';
 document.getElementById('changePassword').onclick=function(){openPasswordModal();};
}
function openPasswordModal(){
 var el=document.getElementById('modal');el.classList.remove('hidden');
 document.getElementById('modalContent').innerHTML='<div class="card-head"><h3>Change CMS password</h3><button class="btn ghost" id="closeModal">✕</button></div><div class="field"><label>Current password</label><input id="oldPass" class="control" type="password"></div><div class="field"><label>New password (12+ characters)</label><input id="newPass" class="control" type="password"></div><button class="btn primary" id="savePassword">Update password</button>';
 document.getElementById('closeModal').onclick=function(){el.classList.add('hidden');};
 document.getElementById('savePassword').onclick=async function(){try{await api('/admin/password',{method:'POST',body:{currentPassword:document.getElementById('oldPass').value,newPassword:document.getElementById('newPass').value}});toast('Password updated. Sign in again.');logout();}catch(e){toast(e.message);}};
}
function renderContent(){
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Editorial workflow</div><h1>Content Studio</h1><p>Build post ideas, carousels and reel scripts. Drafts are saved in your new Command Centre database.</p></div><span class="status-pill warn">Database drafts</span></div>'+
 '<section class="card"><div class="field"><label>What should we create?</label><textarea class="control" id="contentBrief" placeholder="Example: Create a 5-slide carousel for US business owners about why their website is losing leads."></textarea></div><div class="inline"><select class="control" id="contentFormat" style="max-width:170px"><option>Carousel</option><option>Instagram Reel</option><option>Single post</option><option>LinkedIn post</option></select><select class="control" id="contentMarket" style="max-width:150px"><option>USA</option><option>India</option></select><button class="btn primary" id="makeContent">Create draft</button></div><div id="contentOutput" class="section-gap"></div></section>'+
 '<section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Saved in your database</div><h3>Content drafts</h3></div><span class="status-pill">'+localPosts.length+' saved</span></div>'+
 (localPosts.length?localPosts.map(function(p,i){return '<div class="rowline"><div><strong>'+esc(p.title)+'</strong><div class="tiny">'+esc(p.format)+' · '+esc(p.market)+' · '+esc(shortDate(p.createdAt))+'</div></div><button class="btn ghost" data-post-export="'+i+'">Export</button></div>';}).join(''):empty('No content drafts have been saved yet.'))+'</section>'+
 '<div class="notice info section-gap">Social scheduling and publishing are not connected. This screen produces editable content drafts only; it does not publish anything to Instagram or Facebook.</div>';
 document.getElementById('makeContent').onclick=async function(){var brief=document.getElementById('contentBrief').value.trim(),format=document.getElementById('contentFormat').value,market=document.getElementById('contentMarket').value;if(!brief){toast('Add a short content brief first.');return;}var draft=createContentDraft(brief,format,market);try{var saved=await api('/admin/content-drafts',{method:'POST',body:draft});draft=saved.draft||draft;}catch(e){toast(e.message);return;}localPosts.unshift(draft);localStorage.setItem('aa_cc_posts',JSON.stringify(localPosts));document.getElementById('contentOutput').innerHTML='<div class="copy-block"><div class="eyebrow">Draft created · Not published</div><h3>'+esc(draft.title)+'</h3><p>'+esc(draft.body).replace(/\n/g,'<br>')+'</p><button class="btn" id="copyContent">Copy draft</button></div>';document.getElementById('copyContent').onclick=function(){navigator.clipboard.writeText(draft.body);toast('Draft copied.');};};
 document.querySelectorAll('[data-post-export]').forEach(function(b){b.onclick=function(){var p=localPosts[Number(b.dataset.postExport)];downloadText(p.title+'.txt',p.body);};});
}
function createContentDraft(brief,format,market){
 var service=detectService(brief),topic=service==='General growth'?'growth':service.toLowerCase();
 var title=market==='USA'?'The '+topic+' advantage':'A smarter way to grow with '+topic;
 var body=format==='Carousel'?'Slide 1 — '+(brief.slice(0,90))+'\nSlide 2 — The problem: disconnected marketing creates friction and missed opportunities.\nSlide 3 — The shift: make the message, creative, landing page and follow-up work together.\nSlide 4 — The practical move: choose one audience, one offer and one measurable next step.\nSlide 5 — Make the next step clear. AA Growth Studio | aagrowthstudio.com\n\nCaption: '+brief+'\n\nCTA: Start with a clearer growth plan.':
 format==='Instagram Reel'?'Hook (0–3s): '+brief+'\nScene 2 (3–7s): Show the friction your customer recognises.\nScene 3 (7–13s): Present one clear solution with a visual example.\nScene 4 (13–18s): Show the outcome the customer wants—without promising guaranteed results.\nEnd card (18–20s): AA Growth Studio · aagrowthstudio.com':
 brief+'\n\nA strong idea starts with a clear problem, a specific audience and one useful next step.\n\nAA Growth Studio | aagrowthstudio.com';
 return {title:title,format:format,market:market,body:body,createdAt:new Date().toISOString()};
}
function detectService(text){
 var s=text.toLowerCase();if(/app|mobile|software|product ui/.test(s))return 'App development';if(/website|web design|landing page/.test(s))return 'Website design';if(/social media|instagram|content/.test(s))return 'Social media';if(/video|reel|motion|editing/.test(s))return 'Video and motion';if(/brand|logo|identity|graphic/.test(s))return 'Brand design';if(/meta ads|facebook ads|lead generation|campaign/.test(s))return 'Meta Ads';return 'General growth';
}
function parseCommand(raw){
 var text=raw.trim(),lower=text.toLowerCase(),service=detectService(text),market=/\b(india|indian|inr|rupees|₹)\b/i.test(text)?'India':'USA';
 var money=text.match(/[$₹]\s?([\d,]+(?:\.\d+)?)/),budget=money?Number(money[1].replace(/,/g,'')):null,currency=money&&money[0].includes('₹')?'INR':(market==='India'?'INR':'USD');
 if(!budget){var alt=text.match(/([\d,]+(?:\.\d+)?)\s*(?:usd|dollars?|inr|rupees?)(?:\s*(?:\/|per)\s*day)?/i);if(alt)budget=Number(alt[1].replace(/,/g,''));}
 var isRetarget=/retarget|remarket|website visitors|site visitors/.test(lower),isContent=/reel|carousel|post|content|caption/.test(lower),isCampaign=/campaign|ads|lead generation|lead gen/.test(lower);
 var objective=/traffic|website visits|clicks/.test(lower)?'Traffic':(/awareness|reach|brand awareness/.test(lower)?'Awareness':'Leads');
 if(isRetarget){
  return {kind:'audience',name:'Retargeting audience brief',market:market,service:service,objective:'Retargeting',budget:budget,currency:currency,summary:'Build a retargeting plan for relevant website visitors and social engagers.',audiences:['Website visitors to relevant service pages','Visitors who did not complete the enquiry form','Instagram/Facebook engagers and video viewers'],requirements:['Meta Pixel or Conversions API data source','Sufficient eligible audience size','ads_management / Custom Audiences permission','Privacy notice and lawful consent where required'],status:'Brief only — audience not created'};
 }
 if(isContent&&!isCampaign){return {kind:'content',brief:text,market:market,format:/reel/.test(lower)?'Instagram Reel':(/carousel/.test(lower)?'Carousel':'Single post')};}
 return {kind:'campaign',name:market+' | '+service+' | '+objective,market:market,service:service,objective:objective,budget:budget,currency:currency,summary:'Draft a '+objective.toLowerCase()+' campaign for '+service+' in '+market+'.',audience:market==='USA'?'Small-business owners, founders and marketing decision-makers actively evaluating '+service.toLowerCase()+'.':'Indian founders, SMEs and decision-makers looking for '+service.toLowerCase()+'.',exclusions:['Existing customers and converted leads','Irrelevant job seekers and people outside the service area','Low-intent or unrelated interests after reviewing actual results'],placements:'Advantage+ placements as a starting hypothesis; validate against delivery and lead quality.',landing:'https://aagrowthstudio.com',form:['Name','Work email','Business name','Country','Service required','Project timeline','Approximate budget range'],tracking:['Confirm Meta Pixel and Conversions API status','Verify website enquiry event','Use UTMs for campaign/ad-set/ad naming','Test lead routing and response time'],angles:[
  {title:'Problem / outcome',hook:'Your website should do more than look good.',copy:'A stronger digital presence starts with a clear user journey, a credible message and a next step people can take.',cta:'Learn More'},
  {title:'Proof of process',hook:'From first click to a real enquiry.',copy:'Connect strategy, creative and conversion tracking so every part of the campaign has a job to do.',cta:'Get Started'},
  {title:'Clarity / differentiation',hook:'Stop blending in with every other option.',copy:'Give your business a sharper point of view with thoughtful design and a campaign built around the right customer.',cta:'Contact Us'}
 ],status:'Draft only — not sent to Meta'};
}
function renderCommand(){
 document.getElementById('view').innerHTML='<div class="page-head"><div><div class="eyebrow">Natural language / Campaign desk</div><h1>What should we work on?</h1><p>Type a command in English or Hinglish. This free build turns common requests into editable plans.</p></div><span class="status-pill warn">Local planning engine</span></div>'+
 '<section class="command-box"><div class="eyebrow">Ask AA</div><textarea id="commandInput" class="control" placeholder="Create a lead generation campaign for website development in the USA, $40/day.&#10;Draft a retargeting plan for website visitors.&#10;Give me 3 reel ideas for app development in India."></textarea><div class="inline" style="justify-content:space-between;margin-top:10px"><div class="tiny">No AI subscription · No publishing · No spend actions</div><button class="btn primary" id="runCommand">Run command →</button></div><div class="quick-prompts"><button class="chip" data-prompt="Create a lead generation campaign for website development in USA, $40/day">USA lead campaign</button><button class="chip" data-prompt="Draft a retargeting plan for website visitors">Retargeting brief</button><button class="chip" data-prompt="Create a 5-slide carousel about social media strategy for US founders">5-slide carousel</button><button class="chip" data-prompt="Show me last 7 days website lead performance">Website performance</button></div></section>'+
 '<div id="commandOutput"></div><section class="card section-gap"><div class="card-head"><div><div class="eyebrow">Saved in this browser</div><h3>Campaign plans & briefs</h3></div><button class="btn" id="exportPlans">Export all</button></div>'+
 (localPlans.length?localPlans.map(function(p,i){return '<div class="rowline"><div><strong>'+esc(p.name)+'</strong><div class="tiny">'+esc(p.market)+' · '+esc(p.objective)+' · '+esc(shortDate(p.createdAt))+'</div></div><div class="inline"><span class="status-pill warn">Draft</span><button class="btn ghost" data-plan-export="'+i+'">Export</button></div></div>';}).join(''):empty('Your saved campaign briefs will appear here.'))+'</section>';
 document.querySelectorAll('[data-prompt]').forEach(function(b){b.onclick=function(){document.getElementById('commandInput').value=b.dataset.prompt;};});
 document.getElementById('runCommand').onclick=runCommand;
 document.getElementById('commandInput').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){runCommand();}});
 document.getElementById('exportPlans').onclick=function(){downloadText('aa-growth-campaign-drafts.json',JSON.stringify(localPlans,null,2));};
 document.querySelectorAll('[data-plan-export]').forEach(function(b){b.onclick=function(){var p=localPlans[Number(b.dataset.planExport)];downloadText(p.name+'.json',JSON.stringify(p,null,2));};});
}
async function runCommand(){
 var input=document.getElementById('commandInput').value.trim();if(!input){toast('Type a command first.');return;}
 var out=document.getElementById('commandOutput'),lower=input.toLowerCase();
 if(/last 7 days|performance|how many leads|website leads|visitor analytics/.test(lower)){setView('analytics');toast('Showing connected channel reporting.');return;}
 var result=parseCommand(input);
 if(result.kind==='content'){var draft=createContentDraft(result.brief,result.format,result.market);try{var saved=await api('/admin/content-drafts',{method:'POST',body:draft});draft=saved.draft||draft;}catch(e){toast(e.message);return;}localPosts.unshift(draft);localStorage.setItem('aa_cc_posts',JSON.stringify(localPosts));out.innerHTML='<div class="card"><div class="eyebrow">Content draft created</div><h3>'+esc(draft.title)+'</h3><p class="small muted">'+esc(draft.body).replace(/\n/g,'<br>')+'</p><span class="status-pill warn">Not published</span><div class="inline section-gap"><button class="btn" id="cmdCopy">Copy text</button><button class="btn" id="cmdExport">Export text</button></div></div>';document.getElementById('cmdCopy').onclick=function(){navigator.clipboard.writeText(draft.body);toast('Copied.');};document.getElementById('cmdExport').onclick=function(){downloadText(draft.title+'.txt',draft.body);};return;}
 result.createdAt=new Date().toISOString();try{if(result.kind==='audience'){await api('/admin/audiences',{method:'POST',body:result});}else{var savedPlan=await api('/admin/plans',{method:'POST',body:result});if(savedPlan.plan)result.id=savedPlan.plan.id;}}catch(e){toast(e.message);return;}localPlans.unshift(result);localStorage.setItem('aa_cc_plans',JSON.stringify(localPlans));
 if(result.kind==='audience'){
  out.innerHTML='<div class="card"><div class="eyebrow">Audience Lab / Saved brief</div><div class="inline"><h3>'+esc(result.name)+'</h3><span class="status-pill warn">'+esc(result.status)+'</span></div><p class="muted small">'+esc(result.summary)+'</p><div class="plan-grid">'+planItem('Market',result.market)+planItem('Service',result.service)+planItem('Potential segments',result.audiences.join(' · '))+planItem('Requirements',result.requirements.join(' · '))+'</div><div class="notice info section-gap">No audience has been created in Meta. This is a research brief only; the current connector does not have Custom Audiences permission.</div><button class="btn section-gap" id="exportOne">Export brief</button></div>';
 }else{
  out.innerHTML='<div class="card"><div class="eyebrow">Campaign Builder / Draft saved</div><div class="inline"><h3>'+esc(result.name)+'</h3><span class="status-pill warn">'+esc(result.status)+'</span></div><p class="muted small">'+esc(result.summary)+'</p><div class="plan-grid">'+planItem('Objective',result.objective)+planItem('Market',result.market)+planItem('Service',result.service)+planItem('Daily budget',result.budget?result.currency+' '+fmt(result.budget):'Not specified — set before launch')+planItem('Audience hypothesis',result.audience)+planItem('Placements',result.placements)+planItem('Landing page',result.landing)+planItem('Lead form',result.form.join(' · '))+planItem('Tracking checklist',result.tracking.join(' · '))+'</div><div class="divider"></div><div class="eyebrow">Creative directions</div>'+result.angles.map(function(a,i){return '<div class="copy-block"><div class="tiny">Angle 0'+(i+1)+' · '+esc(a.title)+'</div><h3>'+esc(a.hook)+'</h3><p>'+esc(a.copy)+'</p><span class="status-pill">'+esc(a.cta)+'</span></div>';}).join('')+'<div class="notice danger">This is a strategy draft, not a verified audience forecast. No campaign has been created or launched. Confirm targeting, tracking, policy and budget in Meta before any spend.</div><div class="inline section-gap"><button class="btn" id="exportOne">Export campaign brief</button><button class="btn" data-go="ads">Check Ads permissions</button></div></div>';
 }
 document.getElementById('exportOne').onclick=function(){downloadText(result.name+'.json',JSON.stringify(result,null,2));};
}
function planItem(label,value){return '<div class="plan-item"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong></div>';}
function downloadText(name,content){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain'}));a.download=name.replace(/[\\/:*?"<>|]/g,'-');a.click();URL.revokeObjectURL(a.href);}
async function loadSavedData(){
 try{
  var results=await Promise.all([api('/admin/plans'),api('/admin/audiences'),api('/admin/content-drafts')]);
  localPlans=(results[0].plans||[]).map(function(r){return Object.assign({},r.plan||{},{id:r.id,name:r.name,market:r.market,objective:r.objective,createdAt:r.created_at});}).concat((results[1].audiences||[]).map(function(r){return Object.assign({},r.brief||{},{id:r.id,name:r.name,market:r.market,createdAt:r.created_at,kind:'audience'});}));
  localPosts=(results[2].drafts||[]).map(function(r){return Object.assign({},r,{createdAt:r.created_at});});
  localStorage.setItem('aa_cc_plans',JSON.stringify(localPlans));localStorage.setItem('aa_cc_posts',JSON.stringify(localPosts));
 }catch(e){toast('Could not load saved drafts: '+e.message);}
}
async function loadOverview(){
 try{var result=await api('/admin/overview');cache.overview=result;}catch(e){if(e.status===401)return logout();cache.overview={enquiries:'Unavailable',newEnquiries:'Unavailable',recentEnquiries:[]};toast(e.message);}
 try{cache.visitors=await api('/admin/visitors?range=7d');}catch(e){cache.visitors=null;}
 try{cache.connected=await api('/admin/connected-data?range=30d');}catch(e){cache.connected=null;}
 await loadMeta(false);if(currentView==='overview')renderOverview();
}
async function loadLeads(){try{var r=await api('/admin/enquiries');cache.enquiries=r.enquiries||[];renderLeads();}catch(e){toast(e.message);}}
async function loadVisitors(range){try{cache.visitors=await api('/admin/visitors?range='+(range||'7d'));renderAnalytics();}catch(e){toast(e.message);document.getElementById('view').innerHTML='<div class="empty">Could not load website analytics. '+esc(e.message)+'</div>';}}
async function loadConnectedData(range){
 try{cache.connected=await api('/admin/connected-data?range='+(range||'30d'));if(currentView==='overview'||currentView==='ads'||currentView==='integrations'||currentView==='analytics')renderView();}
 catch(e){if(e.status===401)return logout();toast('Could not read connected data: '+e.message);}
}
async function loadMeta(render){try{cache.meta=await api('/admin/meta/status');}catch(e){cache.meta=null;}if(render!==false){if(currentView==='integrations')renderIntegrations();if(currentView==='ads')renderAds();if(currentView==='overview')renderOverview();}}
function renderView(){
 if(currentView==='overview')renderOverview();
 if(currentView==='command')renderCommand();
 if(currentView==='ads')renderAds();
 if(currentView==='social')renderSocial();
 if(currentView==='leads')renderLeads();
 if(currentView==='analytics')renderAnalytics();
 if(currentView==='content')renderContent();
 if(currentView==='integrations')renderIntegrations();
 if(currentView==='settings')renderSettings();
}
function logout(){token='';sessionStorage.removeItem('aa_cc_token');cache={overview:null,visitors:null,enquiries:[],meta:null,connected:null};showLogin();}
async function boot(){
 if(!token){showLogin();return;}
 try{var me=await api('/admin/me');showApp();document.getElementById('sideUsername').textContent=me.username||'Connected';await loadSavedData();setView('overview');await loadOverview();document.getElementById('lastSync').textContent='Synced '+new Date().toLocaleTimeString();}catch(e){logout();document.getElementById('loginError').textContent=e.message||'Please sign in again.';}
}
document.getElementById('loginForm').addEventListener('submit',async function(e){
 e.preventDefault();var btn=document.getElementById('loginButton'),err=document.getElementById('loginError');err.textContent='';btn.disabled=true;btn.textContent='Connecting…';
 try{var r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('username').value.trim(),password:document.getElementById('password').value})});var data=await r.json().catch(function(){return {};});if(!r.ok)throw new Error(data.error||'Sign in failed.');token=data.token;sessionStorage.setItem('aa_cc_token',token);document.getElementById('password').value='';await boot();}
 catch(error){err.textContent=error.message||'Unable to sign in.';}
 finally{btn.disabled=false;btn.textContent='Sign in to Command Centre';}
});
document.getElementById('logoutButton').onclick=logout;
document.getElementById('refreshButton').onclick=async function(){await loadOverview();if(currentView==='leads')await loadLeads();if(currentView==='analytics')await loadConnectedData('30d');document.getElementById('lastSync').textContent='Synced '+new Date().toLocaleTimeString();toast('Dashboard refreshed.');};
document.getElementById('sideNav').addEventListener('click',function(e){var b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
document.getElementById('sideNav2').addEventListener('click',function(e){var b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
document.getElementById('mobileNav').addEventListener('click',function(e){var b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
document.getElementById('view').addEventListener('click',function(e){var b=e.target.closest('[data-go]');if(b)setView(b.dataset.go);});
document.getElementById('menuButton').onclick=function(){document.querySelector('.sidebar').classList.toggle('mobile-open');};
document.getElementById('modal').addEventListener('click',function(e){if(e.target.id==='modal')e.currentTarget.classList.add('hidden');});
boot();
})();