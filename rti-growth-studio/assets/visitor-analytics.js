(function(){
'use strict';
if(location.pathname==='/admin'||location.pathname.indexOf('/admin/')===0)return;
var trackingEnabled=!(navigator.doNotTrack==='1'||window.doNotTrack==='1');
var API_BASE='https://aa-growth-studio-cms-api.onrender.com/api';
var ANALYTICS_API=API_BASE+'/public/analytics/collect';
var sid='',isNew=false;
try{
 sid=sessionStorage.getItem('aaVisitorSession')||'';
 if(!/^[a-zA-Z0-9_-]{12,80}$/.test(sid)){sid=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('aa-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));sessionStorage.setItem('aaVisitorSession',sid);isNew=true;}
}catch(e){return;}
function cleanPath(){return (location.pathname||'/').slice(0,300)||'/'}
function readReferrer(){
 try{if(!document.referrer)return '';var u=new URL(document.referrer);return u.origin===location.origin?'':u.hostname.toLowerCase().slice(0,180)}catch(e){return ''}
}
function q(name){try{return new URLSearchParams(location.search).get(name)||''}catch(e){return ''}}
var referrerHost=readReferrer(),utmSource=q('utm_source').slice(0,100),utmMedium=q('utm_medium').slice(0,80),utmCampaign=q('utm_campaign').slice(0,120);
var source=utmSource||(q('gclid')?'Google Ads':q('fbclid')?'Meta Ads':referrerHost||'Direct / unknown');
function readClient(){
 var s=navigator.userAgent||'',device=/iPad|Tablet/i.test(s)?'tablet':/Mobi|Android|iPhone/i.test(s)?'mobile':'desktop';
 var browser=/Edg\//.test(s)?'Edge':/OPR\//.test(s)?'Opera':/Firefox\//.test(s)?'Firefox':/Chrome\//.test(s)?'Chrome':/Safari\//.test(s)?'Safari':'Other';
 var os=/Windows/.test(s)?'Windows':/Android/.test(s)?'Android':/iPhone|iPad|iPod/.test(s)?'iOS':/Mac OS X|Macintosh/.test(s)?'macOS':/Linux/.test(s)?'Linux':'Other';
 var tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
 var width=window.innerWidth||0,viewport=width>=1024?'desktop':width<640?'mobile':'tablet';
 return {deviceType:device,browser:browser,os:os,language:(navigator.language||'').slice(0,40),timezone:tz.slice(0,80),viewportClass:viewport};
}
var meta=readClient();
function send(type,details){
 if(!trackingEnabled)return;
 var payload={sessionId:sid,eventType:type,pagePath:cleanPath(),details:String(details||'').slice(0,180),referrerHost:referrerHost,source:source,utmMedium:utmMedium,utmCampaign:utmCampaign,deviceType:meta.deviceType,browser:meta.browser,os:meta.os,language:meta.language,timezone:meta.timezone,viewportClass:meta.viewportClass};
 try{fetch(ANALYTICS_API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(function(){})}catch(e){}
}
if(isNew)send('session_start','');
send('page_view','');
var scrollSent={25:false,50:false,75:false,100:false};
function trackScroll(){
 var doc=document.documentElement,span=Math.max(1,doc.scrollHeight-window.innerHeight),pct=Math.min(100,Math.round((window.scrollY||0)/span*100));
 [25,50,75,100].forEach(function(n){if(pct>=n&&!scrollSent[n]){scrollSent[n]=true;send('scroll',n+'% depth')}});
}
window.addEventListener('scroll',trackScroll,{passive:true});
document.addEventListener('click',function(e){
 var node=e.target&&e.target.closest?e.target.closest('a,button,[role="button"]'):null;if(!node)return;
 if(node.tagName==='A'){
  try{var u=new URL(node.href,location.href),detail=u.origin===location.origin?'link: '+u.pathname:'external domain: '+u.hostname;send(u.origin===location.origin?'click':'outbound_click',detail)}catch(err){send('click','link')}
 }else{
  var label=node.getAttribute('aria-label')||node.getAttribute('data-analytics-label')||node.id||'button';
  send('click','button: '+String(label).slice(0,140));
 }
},true);
var formStarted=new WeakSet();
document.addEventListener('focusin',function(e){
 var input=e.target;if(!input||!/^(INPUT|SELECT|TEXTAREA)$/.test(input.tagName))return;
 var form=input.closest('form');if(!form||formStarted.has(form))return;formStarted.add(form);send('form_start','form: '+String(form.id||'unnamed').slice(0,80));
},true);
document.addEventListener('submit',function(e){
 var form=e.target;if(form&&form.tagName==='FORM')send('form_submit','form: '+String(form.id||'unnamed').slice(0,80));
},true);
var beat=function(){if(document.visibilityState==='visible')send('heartbeat','')};
window.setInterval(beat,25000);
document.addEventListener('visibilitychange',function(){if(document.visibilityState!=='visible')send('heartbeat','')});
window.addEventListener('pagehide',function(){send('heartbeat','')});

// Site-wide conversion experience: one clear action, short lead form, and direct contact on every public page.
function firstTouch(){
 var old={};try{old=JSON.parse(sessionStorage.getItem('aaLeadFirstTouch')||'{}')||{}}catch(e){}
 if(old.source)return old;
 var params=new URLSearchParams(location.search),host='';
 try{host=document.referrer?new URL(document.referrer).hostname.toLowerCase():''}catch(e){}
 var us=(params.get('utm_source')||'').slice(0,100),um=(params.get('utm_medium')||'').slice(0,80),uc=(params.get('utm_campaign')||'').slice(0,120);
 var src=us||(params.get('gclid')?'Google Ads':params.get('fbclid')?'Meta Ads':host||'Direct / unknown');
 if(!us&&host){if(host.indexOf('instagram.com')>=0)src='Instagram';else if(host.indexOf('facebook.com')>=0||host.indexOf('fb.com')>=0)src='Facebook';else if(host.indexOf('google.')>=0)src='Google';else if(host.indexOf('bing.com')>=0)src='Bing';}
 var result={source:src,utm_source:us,utm_medium:um,utm_campaign:uc,fbclid:(params.get('fbclid')||'').slice(0,300),landing_page:(location.pathname||'/').slice(0,300),referrer_host:host.slice(0,180)};
 try{sessionStorage.setItem('aaLeadFirstTouch',JSON.stringify(result))}catch(e){}
 return result;
}
function newEventId(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID()}catch(e){}return 'lead-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function installConversionExperience(){
 if(!document.body||document.getElementById('aaConversionDock')||location.pathname==='/admin'||location.pathname.indexOf('/admin/')===0)return;
 var css=document.createElement('link');css.rel='stylesheet';css.href='/assets/conversion-system.css';document.head.appendChild(css);
 var dock=document.createElement('aside');dock.id='aaConversionDock';dock.className='aa-conversion-dock';dock.setAttribute('aria-label','Contact AA Growth Studio');
 dock.innerHTML="<div class='aa-dock-copy'><span class='aa-dock-kicker'>YOUR NEXT MOVE</span><strong>Let's move your business forward.</strong><small>Tell us your goals. We'll discuss scope, timeline and pricing.</small></div><button type='button' class='aa-dock-primary' data-aa-convert>Discuss your project <span aria-hidden='true'>↗</span></button><a class='aa-dock-whatsapp' href='https://wa.me/917466039959?text=Hi%20AA%20Growth%20Studio%2C%20I%27d%20like%20to%20discuss%20a%20project%20for%20my%20business.%20Please%20share%20your%20services%2C%20process%20and%20pricing.' target='_blank' rel='noopener noreferrer' aria-label='Chat with AA Growth Studio on WhatsApp'>WhatsApp ↗</a><a class='aa-dock-call' href='tel:+917466039959' aria-label='Call AA Growth Studio'>Call</a>";
 var modal=document.createElement('div');modal.id='aaConversionModal';modal.className='aa-conversion-modal';modal.hidden=true;modal.setAttribute('aria-hidden','true');
 modal.innerHTML="<div class='aa-conversion-backdrop' data-aa-close></div><section class='aa-conversion-card' role='dialog' aria-modal='true' aria-labelledby='aaLeadTitle'><button type='button' class='aa-conversion-close' data-aa-close aria-label='Close'>×</button><div class='aa-conversion-eyebrow'>AA GROWTH STUDIO / START HERE</div><h2 id='aaLeadTitle'>Let's discuss your <em>next project.</em></h2><p class='aa-conversion-intro'>Tell us what you need. We'll review your enquiry and follow up to discuss scope, timelines and pricing.</p><form id='aaQuickLeadForm'><div class='aa-lead-grid'><label>Your name *<input name='name' autocomplete='name' maxlength='120' required placeholder='Name'></label><label>Mobile / WhatsApp *<input name='mobile_number' type='tel' inputmode='tel' autocomplete='tel' maxlength='32' required placeholder='+91…'></label><label class='aa-lead-full'>Business email (optional)<input name='email' type='email' autocomplete='email' maxlength='250' placeholder='you@business.com'></label><label class='aa-lead-full'>What do you need? *<select name='service' required><option value=''>Choose one</option><option>Meta Ads & lead generation</option><option>Social media management</option><option>Video, reels & creative</option><option>Branding & graphic design</option><option>Website / app development</option><option>Growth strategy</option><option>Other / not sure yet</option></select></label><label class='aa-lead-full'>Main goal (optional)<textarea name='goal' maxlength='1500' rows='2' placeholder='More qualified leads, stronger brand, better website…'></textarea></label></div><label class='aa-consent-row'><input type='checkbox' name='meta_consent' value='yes'><span>Allow Meta ad-conversion measurement for this enquiry (optional). This does not subscribe you to marketing messages.</span></label><button class='aa-lead-submit' type='submit'>Send my enquiry <span aria-hidden='true'>↗</span></button><p class='aa-lead-status' id='aaLeadStatus' role='status' aria-live='polite'></p><small class='aa-lead-privacy'>Your details go to the studio enquiry dashboard and are used to respond to this request.</small></form></section>";
 document.body.appendChild(dock);document.body.appendChild(modal);
 function closeModal(){modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('aa-conversion-open')}
 function openModal(){modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('aa-conversion-open');send('conversion_modal_open','project enquiry form');var card=modal.querySelector('.aa-conversion-card');modal.scrollTop=0;if(card)card.scrollTop=0;window.requestAnimationFrame(function(){modal.scrollTop=0;if(card)card.scrollTop=0;var x=modal.querySelector("input[name='name']");if(x){try{x.focus({preventScroll:true})}catch(e){x.focus()}}})}
 dock.querySelector('[data-aa-convert]').addEventListener('click',function(){send('cta_click','discuss your project');openModal()});
 modal.querySelectorAll('[data-aa-close]').forEach(function(x){x.addEventListener('click',closeModal)});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)closeModal()});
 dock.querySelector('.aa-dock-whatsapp').addEventListener('click',function(){send('whatsapp_click','sticky contact CTA')});
 dock.querySelector('.aa-dock-call').addEventListener('click',function(){send('call_click','sticky contact CTA')});
 function fbCookie(name){var parts=document.cookie.split(';');for(var i=0;i<parts.length;i++){var p=parts[i].trim();if(p.indexOf(name+'=')===0){try{return decodeURIComponent(p.slice(name.length+1))}catch(e){return ''}}}return ''}
 var form=modal.querySelector('#aaQuickLeadForm');
 form.addEventListener('submit',async function(e){
  e.preventDefault();var button=form.querySelector('.aa-lead-submit'),status=modal.querySelector('#aaLeadStatus'),fd=new FormData(form),touch=firstTouch(),eventId=newEventId();
  var payload={name:fd.get('name'),email:fd.get('email'),mobile_number:fd.get('mobile_number'),company:'',service:fd.get('service'),goal:fd.get('goal'),source:touch.source,utm_source:touch.utm_source,utm_medium:touch.utm_medium,utm_campaign:touch.utm_campaign,landing_page:touch.landing_page,referrer_host:touch.referrer_host,current_page:location.pathname,visitor_session_id:sid,event_id:eventId,meta_consent:fd.get('meta_consent')==='yes',fbp:fbCookie('_fbp'),fbc:fbCookie('_fbc')||(touch.fbclid&&/^[A-Za-z0-9._-]{1,300}$/.test(touch.fbclid)?'fb.1.'+Date.now()+'.'+touch.fbclid:'')};
  button.disabled=true;button.textContent='Sending enquiry…';status.className='aa-lead-status';status.textContent='Saving your enquiry securely…';
  try{
   var response=await fetch(API_BASE+'/public/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'}),data=await response.json().catch(function(){return{}});
   if(!response.ok)throw new Error(data.error||'Could not save your enquiry. Please try WhatsApp.');
   status.className='aa-lead-status is-success';status.textContent='Thank you! Your enquiry is saved. Reference #'+data.enquiryId+'. Our team can now follow up with you.';
   form.reset();
   if(payload.meta_consent&&data.pixelId)loadMetaPixel(data.pixelId,eventId);
   button.textContent='Enquiry received ✓';window.setTimeout(closeModal,3600);
  }catch(err){status.className='aa-lead-status is-error';status.textContent=err.message||'Could not save. Please try again or use WhatsApp.';button.disabled=false;button.innerHTML='Send my enquiry <span aria-hidden="true">↗</span>'}
 });
}
function loadMetaPixel(pixelId,eventId){
 if(!pixelId||!/^\d{5,30}$/.test(String(pixelId)))return;
 if(!window.fbq){var n=window.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!window._fbq)window._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];var s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(s)}
 try{window.fbq('init',String(pixelId));window.fbq('track','PageView');window.fbq('track','Lead',{}, {eventID:eventId})}catch(e){}
}
window.aaTrackMetaLead=loadMetaPixel;
firstTouch();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installConversionExperience,{once:true});else installConversionExperience();
})();
