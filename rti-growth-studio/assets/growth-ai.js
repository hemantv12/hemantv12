(function(){
'use strict';
var API='https://aa-growth-studio-cms-api.onrender.com/api';
var root=document.getElementById('growthAiRoot');
if(!root)return;
var launcher=document.getElementById('growthAiLauncher');
var panel=document.getElementById('growthAiPanel');
var closeBtn=document.getElementById('growthAiClose');
var form=document.getElementById('growthAiForm');
var submit=document.getElementById('growthAiSubmit');
var feedback=document.getElementById('growthAiFeedback');
var result=document.getElementById('growthAiResult');
var answer=document.getElementById('growthAiAnswer');
var status=document.getElementById('growthAiStatus');
var lastPlan='';
function setOpen(open){panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open){window.setTimeout(function(){var first=form.querySelector('input');if(first)first.focus()},80)}}
launcher.addEventListener('click',function(){setOpen(panel.hidden)});
closeBtn.addEventListener('click',function(){setOpen(false);launcher.focus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden){setOpen(false);launcher.focus()}});
fetch(API+'/public/growth-ai/status').then(function(r){return r.ok?r.json():Promise.reject(new Error('status unavailable'))}).then(function(d){
 status.textContent=d.enabled?'AI ENGINE ONLINE':'AI ENGINE SETUP';
 status.classList.toggle('is-ready',Boolean(d.enabled));
}).catch(function(){status.textContent='GROWTH AI';});
form.addEventListener('submit',async function(e){
 e.preventDefault();
 var data={
  business:form.elements.business.value.trim(),
  service:form.elements.service.value,
  goal:form.elements.goal.value,
  audience:form.elements.audience.value.trim(),
  market:form.elements.market.value.trim(),
  platform:form.elements.platform.value,
  offer:form.elements.offer.value.trim(),
  language:form.elements.language.value
 };
 feedback.className='growth-ai-feedback';
 feedback.textContent='Building your growth blueprint…';
 result.hidden=true;submit.disabled=true;submit.querySelector('span').textContent='…';
 try{
  var response=await fetch(API+'/public/growth-ai',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)});
  var payload={};try{payload=await response.json()}catch(err){}
  if(!response.ok){
   if(payload.code==='AI_NOT_CONFIGURED'){
    feedback.textContent='The Growth AI experience is installed, but the live AI engine still needs to be activated by the website owner. Please use the project enquiry form below in the meantime.';
    status.textContent='AI ACTIVATION PENDING';
   }else feedback.textContent=payload.error||'We could not create the plan just now. Please try again in a moment.';
   return;
  }
  lastPlan=payload.answer||'No plan returned.';
  answer.textContent=lastPlan;
  result.hidden=false;
  feedback.className='growth-ai-feedback is-success';
  feedback.textContent='Your growth blueprint is ready. Tailor the ideas to your market before investing in a campaign.';
  result.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
 }catch(err){
  feedback.textContent='Connection issue. Please try again, or share your goal through the contact form.';
 }finally{
  submit.disabled=false;submit.querySelector('span').textContent='↗';
  if(submit.textContent.indexOf('Build my growth blueprint')===-1)submit.childNodes[0].textContent='Build my growth blueprint ';
 }
});
document.getElementById('growthAiCopy').addEventListener('click',async function(){
 var button=this;
 try{
  if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(lastPlan);
  else{var area=document.createElement('textarea');area.value=lastPlan;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();if(!document.execCommand('copy'))throw new Error('copy failed');area.remove()}
  button.textContent='Copied ✓';
 }catch(err){feedback.textContent='Select the plan text and copy it manually.'}
});
document.getElementById('growthAiUsePlan').addEventListener('click',function(){
 var contact=document.getElementById('contact'),company=document.getElementById('company'),service=document.getElementById('service'),goal=document.getElementById('goal'),business=form.elements.business.value.trim();
 if(company&&!company.value.trim())company.value=business;
 if(service){var selected=form.elements.service.value;service.value=selected==='A connected growth campaign'?'A connected mix of services':(selected||'A connected mix of services');}
 if(goal){goal.value='Growth AI blueprint for '+business+'\n\n'+lastPlan+'\n\nTarget audience: '+form.elements.audience.value.trim()+'\nMarket: '+form.elements.market.value.trim()+'\nPlatform: '+form.elements.platform.value;goal.dispatchEvent(new Event('input',{bubbles:true}));}
 setOpen(false);
 if(contact)contact.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 var nameField=document.getElementById('name');if(nameField)window.setTimeout(function(){nameField.focus()},450);
});
})();