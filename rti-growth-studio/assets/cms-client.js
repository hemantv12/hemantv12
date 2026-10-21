(function(){
'use strict';
var API='https://aa-growth-studio-cms-api.onrender.com/api';
function q(s,r){return (r||document).querySelector(s)}
function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function put(selector,value){var el=q(selector);if(el&&typeof value==='string'&&value.trim())el.textContent=value}
function putFirstText(el,value){if(!el||typeof value!=='string'||!value.trim())return;for(var i=0;i<el.childNodes.length;i++){if(el.childNodes[i].nodeType===3&&el.childNodes[i].nodeValue.trim()){el.childNodes[i].nodeValue=' '+value;return}}}
function hrefSafe(value){if(typeof value!=='string')return '#contact';if(value.charAt(0)==='/'&&value.indexOf('//')!==0)return value;try{var u=new URL(value);if(u.protocol==='http:'||u.protocol==='https:')return u.href}catch(e){}return '#contact'}
function make(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function addBlogLinks(show){
 var nav=q('.nav-links'),footer=q('.footer-links');
 [[nav,'Contact'],[footer,'Privacy']].forEach(function(info){
  var parent=info[0],targetText=info[1];if(!parent)return;
  var existing=q('a[data-blog-link]',parent);
  if(!show){if(existing)existing.remove();return}
  if(existing)return;
  var a=make('a','', 'Blog');a.href='/blog/';a.dataset.blogLink='1';
  var target=qa('a',parent).find(function(x){return x.textContent.trim()===targetText});
  if(target)parent.insertBefore(a,target);else parent.appendChild(a);
 });
}
function renderServices(items){
 var grid=q('.services-grid');if(!grid||!Array.isArray(items)||!items.length)return;
 grid.textContent='';
 items.forEach(function(s,i){
  var a=make('a','service-card reveal is-visible');a.href=hrefSafe(s.href);
  var top=make('div','service-card-top');top.appendChild(make('span','service-number',String(i+1).padStart(2,'0')+' / '+(s.category||'SERVICE')));
  top.appendChild(make('span','service-mark',s.icon||'✳'));
  a.appendChild(top);a.appendChild(make('h3','',s.title||'Service'));a.appendChild(make('p','',s.short_description||''));
  var cta=make('span','service-cta','Explore service');cta.appendChild(make('span','','↗'));a.appendChild(cta);grid.appendChild(a);
 });
}
function renderSections(items){
 qa('.cms-custom-section').forEach(function(e){e.remove()});
 if(!Array.isArray(items))return;
 var studio=q('#studio');
 items.filter(function(x){return x&&x.visible!==false&&x.title&&x.body}).forEach(function(x){
  var section=make('section','section cms-custom-section');var wrap=make('div','wrap');
  var head=make('div','section-head reveal is-visible');var main=make('div','section-head-main');
  main.appendChild(make('div','eyebrow','More from the studio'));main.appendChild(make('h2','section-title',x.title));
  head.appendChild(main);head.appendChild(make('p','',x.body));wrap.appendChild(head);section.appendChild(wrap);
  if(studio)studio.parentNode.insertBefore(section,studio);else document.querySelector('main')?.appendChild(section);
 });
}
function apply(data){
 var s=data.settings||{};
 if(s.brandName){put('.topline .wrap strong',s.brandName);qa('.brand-copy strong').forEach(function(e){e.textContent=s.brandName});document.title=s.seoTitle||s.brandName}
 if(s.brandTagline)qa('.brand-copy small').forEach(function(e){e.textContent=s.brandTagline});
 put('.hero-copy .eyebrow',s.heroEyebrow);
 put('.hero-copy h1 .line:nth-child(1)',s.heroLineOne);
 put('.hero-copy h1 .line:nth-child(2)',s.heroLineTwo);
 putFirstText(q('.hero-copy h1 .line:nth-child(3)'),s.heroLineThree);
 put('.hero-copy h1 .line:nth-child(3) em',s.heroHighlight);
 put('.hero-copy .hero-description',s.heroDescription);
 put('.hero-actions .btn-lime',s.heroPrimaryCta);put('.hero-actions .btn-outline',s.heroSecondaryCta);
 put('.work-section .section-head .eyebrow',s.workEyebrow);
 var workTitle=q('.work-section .section-title');if(workTitle){var lines=qa('.line',workTitle);putFirstText(workTitle,s.workTitleLineOne);var serif=q('.serif',workTitle),coral=q('.coral',workTitle);if(s.workTitleLineTwo){var words=s.workTitleLineTwo.trim().split(/\s+/);var final=words.pop()||'';if(serif)serif.textContent=words.join(' ');if(coral)coral.textContent=final;}}
 put('.work-section .section-head>p',s.workIntro);
 put('.statement .eyebrow',s.statementEyebrow);
 var stat=q('.statement h2');if(stat){putFirstText(stat,s.statementTitleLineOne);put('.statement h2 em',s.statementTitleLineTwo)}
 put('.statement-grid>div>p',s.statementBody);
 put('.studio-copy .eyebrow',s.studioEyebrow);var studioTitle=q('.studio-copy h2');if(studioTitle){putFirstText(studioTitle,s.studioTitleLineOne);put('.studio-copy h2 em',s.studioTitleLineTwo)}
 var studioParas=qa('.studio-copy>p');if(studioParas[0]&&s.studioParagraphOne)studioParas[0].textContent=s.studioParagraphOne;if(studioParas[1]&&s.studioParagraphTwo)studioParas[1].textContent=s.studioParagraphTwo;
 put('.team-section .section-head .eyebrow',s.teamEyebrow);var teamTitle=q('.team-section .section-title');if(teamTitle){putFirstText(teamTitle,s.teamTitleLineOne);(function(){var ser=q('.team-section .section-title .serif'),cor=q('.team-section .section-title .coral'),words=(s.teamTitleLineTwo||'').trim().split(/\s+/);if(ser&&cor&&words.length){cor.textContent=words.pop();ser.textContent=words.join(' ')}else if(cor)cor.textContent=s.teamTitleLineTwo||''})()}
 put('.team-section .section-head>p',s.teamIntro);
 put('.founder-card .team-role',s.founderRole);put('.founder-card .team-info h3',s.founderName);put('.founder-card .team-info p',s.founderBio);
 if(s.founderImage){var pic=q('.founder-card .team-photo');if(pic){pic.src=hrefSafe(s.founderImage);pic.loading='lazy'}}
 put('.contact-intro .eyebrow',s.contactEyebrow);
 var contactTitle=q('.contact-intro h2');if(contactTitle){putFirstText(contactTitle,s.contactTitleLineOne);put('.contact-intro h2 em',s.contactTitleLineTwo)}
 put('.contact-intro>p',s.contactDescription);
 var details=q('.contact-detail');if(details){
  details.textContent='';details.appendChild(make('strong',( ''), (s.brandName||'AA Growth Studio')+' · Gurugram'));
  details.appendChild(make('div','',s.contactAddressLineOne||'Office 302, Third Floor, Building 1644'));
  details.appendChild(make('div','',s.contactAddressLineTwo||'Sector 15, Gurugram, Haryana, India'));
  if(s.contactPhone){var p=make('a','','Call: '+s.contactPhone);p.href='tel:'+s.contactPhone.replace(/[^\d+]/g,'');details.appendChild(p);details.appendChild(make('span','',' · '))}
  if(s.contactEmail){var m=make('a','','Email: '+s.contactEmail);m.href='mailto:'+s.contactEmail;details.appendChild(m);details.appendChild(make('br',''))}
  var map=make('a','','Find us on Google Maps ↗');map.href=hrefSafe(s.mapUrl);map.target='_blank';map.rel='noopener noreferrer';details.appendChild(map);
 }
 put('.site-footer .footer-copy',s.footerTagline);
 var description=q('meta[name="description"]');if(description&&s.seoDescription)description.setAttribute('content',s.seoDescription);
 var og=q('meta[property="og:description"]');if(og&&s.seoDescription)og.setAttribute('content',s.seoDescription);
 addBlogLinks(s.showBlogLink!==false);
 renderServices(data.services);
 renderSections(s.customSections);
 var formFoot=q('.form-footnote');if(formFoot)formFoot.textContent='Submitting sends your project details to the studio dashboard so the team can review your enquiry. Your details are not published publicly.';
 var social= q('.footer-links');if(social){
  qa('a[data-social-link]',social).forEach(function(a){a.remove()});
  [['instagramUrl','Instagram'],['linkedinUrl','LinkedIn']].forEach(function(pair){if(s[pair[0]]&&hrefSafe(s[pair[0]])!=='#contact'){var a=make('a','',''+pair[1]+' ↗');a.href=hrefSafe(s[pair[0]]);a.target='_blank';a.rel='noopener noreferrer';a.dataset.socialLink='1';social.appendChild(a)}});
 }
}
fetch(API+'/public/site').then(function(r){if(!r.ok)throw new Error('CMS unavailable');return r.json()}).then(apply).catch(function(){});
var form=q('#briefForm');
if(form)form.addEventListener('submit',function(){
 var d=new FormData(form),payload={name:d.get('name'),email:d.get('email'),company:d.get('company'),service:d.get('service'),goal:d.get('goal')};
 var status=q('#formStatus');if(status)status.textContent='Saving your enquiry…';
 fetch(API+'/public/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Could not save enquiry');return d})}).then(function(d){if(status)status.textContent='Your enquiry has been saved to the studio dashboard. Reference #'+d.enquiryId+'.'}).catch(function(e){if(status)status.textContent='Your brief is ready, but the enquiry could not reach the dashboard. Please copy it and contact the studio directly.'});
});
})();