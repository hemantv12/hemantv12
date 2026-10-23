(function(){
'use strict';
const body=document.body;
const siteIntro=document.getElementById('siteIntro');
if(siteIntro&&document.documentElement.classList.contains('aa-intro-pending')){try{sessionStorage.setItem('aaIntroSeen','1')}catch(e){}window.setTimeout(function(){siteIntro.classList.add('is-done');document.documentElement.classList.remove('aa-intro-pending');window.setTimeout(function(){siteIntro.remove()},460)},1030)}else if(siteIntro){siteIntro.remove()}
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
body.classList.add('js-motion');
document.querySelectorAll('[data-year]').forEach(function(el){el.textContent=String(new Date().getFullYear())});
document.querySelectorAll('.nav-shell').forEach(function(nav){
 const toggle=nav.querySelector('.menu-toggle'), links=nav.querySelector('.nav-links');
 if(!toggle||!links)return;
 function close(){links.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');toggle.textContent='☰'}
 toggle.addEventListener('click',function(){const open=links.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');toggle.textContent=open?'×':'☰'});
 links.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close)});
});
if(!reduced&&'IntersectionObserver'in window){
 const observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}})},{threshold:.09,rootMargin:'0px 0px -25px 0px'});
 document.querySelectorAll('.reveal').forEach(function(el){observer.observe(el)});
}else{document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('is-visible')})}
const scene=document.querySelector('.scene');
if(scene&&!reduced&&window.matchMedia('(hover:hover) and (pointer:fine)').matches){
 let raf=0,rx=0,ry=0;
 scene.addEventListener('pointermove',function(e){const r=scene.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;rx=y*-7;ry=x*8;if(!raf)raf=requestAnimationFrame(function(){scene.style.setProperty('--rx',rx.toFixed(2)+'deg');scene.style.setProperty('--ry',ry.toFixed(2)+'deg');raf=0})});
 scene.addEventListener('pointerleave',function(){scene.style.setProperty('--rx','0deg');scene.style.setProperty('--ry','0deg')});
}
document.querySelectorAll('[data-portrait]').forEach(function(photo){
 const fallback=document.getElementById(photo.dataset.fallback||'portraitFallback');
 fetch(photo.dataset.portrait,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('portrait not available');return r.text()}).then(function(raw){
 const encoded=raw.trim();if(!encoded.startsWith('UklGR'))throw new Error('portrait encoding mismatch');
 photo.onload=function(){photo.classList.add('ready');if(fallback)fallback.hidden=true};
 photo.onerror=function(){photo.removeAttribute('src')};
 photo.src='data:image/webp;base64,'+encoded;
 }).catch(function(){if(fallback)fallback.textContent='HV'});
});
const form=document.getElementById('briefForm');
 if(form){const p=new URLSearchParams(location.search),g=p.get('goal'),s=p.get('service'),gf=form.querySelector('[name="goal"]'),sf=form.querySelector('[name="service"]');if(gf&&g&&!gf.value)gf.value=g.slice(0,5000);if(sf&&s){const o=Array.prototype.find.call(sf.options,function(x){return x.value===s||x.textContent.trim()===s});if(o)sf.value=o.value||o.textContent.trim();}}
if(form){
 const result=document.getElementById('briefResult'),textEl=document.getElementById('briefText'),status=document.getElementById('formStatus'),copy=document.getElementById('copyBrief');let brief='';
 form.addEventListener('submit',function(e){
  e.preventDefault();if(!form.reportValidity())return;const d=new FormData(form);
  brief='PROJECT ENQUIRY — AA GROWTH STUDIO\n\nName: '+d.get('name')+'\nBusiness: '+d.get('company')+'\nEmail: '+d.get('email')+'\nMobile: '+d.get('mobile_number')+'\nService: '+d.get('service')+'\n\nProject goal:\n'+d.get('goal')+'\n\nPrepared: '+new Date().toLocaleDateString();
  textEl.textContent=brief;result.classList.add('show');status.textContent='';copy.textContent='Copy brief';
  result.scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'});
 });
 copy.addEventListener('click',async function(){
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(brief)}else{const area=document.createElement('textarea');area.value=brief;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('copy unavailable')}
   status.textContent='Brief copied. Paste it into your email or message.';copy.textContent='Copied ✓';
  }catch(err){status.textContent='Copy was blocked by the browser. Select and copy the brief text above.'}
 });
}
document.querySelectorAll('[data-copy-email]').forEach(function(btn){btn.addEventListener('click',async function(){const value=btn.dataset.copyEmail;try{await navigator.clipboard.writeText(value);btn.textContent='Copied ✓'}catch(e){window.location.href='mailto:'+value}})});
})();