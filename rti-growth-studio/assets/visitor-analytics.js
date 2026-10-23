(function(){
'use strict';
if(location.pathname==='/admin'||location.pathname.indexOf('/admin/')===0)return;
if(navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
var API='https://aa-growth-studio-cms-api.onrender.com/api/public/analytics/collect';
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
 var payload={sessionId:sid,eventType:type,pagePath:cleanPath(),details:String(details||'').slice(0,180),referrerHost:referrerHost,source:source,utmMedium:utmMedium,utmCampaign:utmCampaign,deviceType:meta.deviceType,browser:meta.browser,os:meta.os,language:meta.language,timezone:meta.timezone,viewportClass:meta.viewportClass};
 try{fetch(API,{method:'POST',mode:'cors',cache:'no-store',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(function(){})}catch(e){}
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
})();