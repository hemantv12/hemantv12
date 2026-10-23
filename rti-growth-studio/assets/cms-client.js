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
 var stock=["https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1500&q=85"];grid.textContent='';items.forEach(function(s,i){
 var a=make('a','service-card reveal is-visible');a.href=hrefSafe(s.href);var visual=make('div','service-visual'),img=make('img','service-visual-image');img.src=s.image_url?hrefSafe(s.image_url):stock[i%stock.length];img.alt=s.title||'Creative service';img.loading='lazy';img.onerror=function(){visual.remove()};visual.appendChild(img);a.appendChild(visual);
 var top=make('div','service-card-top');top.appendChild(make('span','service-number',String(i+1).padStart(2,'0')+' / '+(s.category||'SERVICE')));top.appendChild(make('span','service-mark',s.icon||'✳'));a.appendChild(top);a.appendChild(make('h3','',s.title||'Service'));a.appendChild(make('p','',s.short_description||''));var cta=make('span','service-cta','Explore service');cta.appendChild(make('span','','↗'));a.appendChild(cta);grid.appendChild(a)});
}

function renderPortfolio(items){
 var grid=q('.work-grid');if(!grid||!Array.isArray(items)||!items.length)return;
 grid.textContent='';
 items.filter(function(x){return x&&x.visible!==false&&x.title&&x.description}).forEach(function(p,i){
  var card=make('article','work-card reveal is-visible'+(i===0?' wide':''));
  var art=make('div','work-art cms-work-art work-theme-'+(i%5));
  var stockImages=["https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1500&q=85","https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1500&q=85"],imgUrl=p.imageUrl?hrefSafe(p.imageUrl):stockImages[i%stockImages.length],videoUrl=p.videoUrl?hrefSafe(p.videoUrl):'';
  if(videoUrl&&videoUrl!=='#contact'){var vid=make('video','cms-work-video');vid.src=videoUrl;vid.autoplay=true;vid.muted=true;vid.loop=true;vid.playsInline=true;vid.controls=true;vid.preload='metadata';if(imgUrl&&imgUrl!=='#contact')vid.poster=imgUrl;vid.setAttribute('aria-label','Video portfolio: '+p.title);vid.onerror=function(){vid.remove()};art.appendChild(vid)}else if(imgUrl&&imgUrl!=='#contact'){var img=make('img','cms-work-image');img.src=imgUrl;img.alt=p.title||'AA Growth Studio creative work';img.loading='lazy';img.onerror=function(){img.remove()};art.appendChild(img)}
  var motif=make('div','cms-art-motif');motif.appendChild(make('span','cms-art-ring'));motif.appendChild(make('span','cms-art-letter',(p.category||'AA').replace(/[^a-z0-9 ]/gi,'').split(/\s+/).map(function(w){return w.charAt(0)}).join('').slice(0,3).toUpperCase()||'AA'));art.appendChild(motif);
  var sticker=make('span','art-sticker',(p.label||'Concept exploration').toUpperCase());art.appendChild(sticker);
  var info=make('div','work-info'),meta=make('div','work-meta');meta.appendChild(make('span','',String(i+1).padStart(2,'0')+' / '+(p.category||'CREATIVE')));meta.appendChild(make('span','work-tag',p.label||'Concept exploration'));
  info.appendChild(meta);info.appendChild(make('h3','',p.title));info.appendChild(make('p','',p.description));
  var link=make('a','text-link','Explore this work');link.href=hrefSafe(p.href);var arrow=make('span','','↗');link.appendChild(arrow);info.appendChild(link);
  card.appendChild(art);card.appendChild(info);grid.appendChild(card);
 });
}
function renderTeam(items,settings){
 var grid=q('.team-grid');if(!grid)return;
 var founder=q('.founder-card',grid);if(!founder)return;
 grid.textContent='';grid.appendChild(founder);
 (Array.isArray(items)?items:[]).filter(function(m){return m&&m.visible!==false&&m.name&&m.role}).forEach(function(m,i){
  var card=make('article','team-card reveal is-visible');
  var portrait=make('div','team-portrait');
  if(m.imageUrl&&hrefSafe(m.imageUrl)!=='#contact'){var img=make('img','team-photo ready');img.src=hrefSafe(m.imageUrl);img.alt=m.name;img.loading='lazy';img.onerror=function(){img.remove();portrait.appendChild(make('div','cms-team-monogram',m.name.split(/\s+/).map(function(w){return w.charAt(0)}).join('').slice(0,2).toUpperCase()))};portrait.appendChild(img)}
  else{var monogram=make('div','cms-team-monogram',m.name.split(/\s+/).map(function(w){return w.charAt(0)}).join('').slice(0,2).toUpperCase());portrait.appendChild(monogram)}
  portrait.appendChild(make('span','portrait-stamp','Team profile'));card.appendChild(portrait);
  var meta=make('div','team-info');meta.appendChild(make('span','team-role',m.role));meta.appendChild(make('h3','',m.name));meta.appendChild(make('p','',m.bio||''));card.appendChild(meta);grid.appendChild(card);
 });
 var note=q('.team-note');if(note)note.textContent=(items||[]).filter(function(m){return m&&m.visible!==false}).length?'Team profiles are managed directly from the studio dashboard.':'Team profiles are managed directly from the studio dashboard. Add names, roles, bios and photo URLs whenever your team grows.';
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
function contentPageKey(path){
 var p=String(path||'/').replace(/\/index\.html$/,'').replace(/\/+$/,'');
 if(!p||p==='/')return null;
 p=p.replace(/^\//,'');
 if(p==='services'||p==='work'||p==='studio'||p==='team'||p==='contact')return p;
 if(/^services\/(social-media|video-motion|brand-design|websites|app-uiux|paid-media)$/.test(p))return p;
 return null;
}
function updatePageHeading(el,lineOne,lineTwo){
 if(!el)return;
 var a=typeof lineOne==='string'?lineOne.trim():'',b=typeof lineTwo==='string'?lineTwo.trim():'';
 if(!a&&!b)return;
 var serif=q('.serif',el),coral=q('.coral',el),em=q('em',el);
 if(serif&&coral&&b){
  var words=b.split(/\s+/),last=words.pop()||'';
  var nodes=Array.prototype.slice.call(el.childNodes),changed=false;
  for(var i=0;i<nodes.length;i++)if(nodes[i].nodeType===3&&nodes[i].nodeValue.trim()){nodes[i].nodeValue=a+' ';changed=true;break}
  if(!changed){var first=el.querySelector('span');if(first)first.textContent=a}
  serif.textContent=words.join(' ');coral.textContent=last;return;
 }
 if(em&&b){
  var child=Array.prototype.slice.call(el.childNodes),set=false;
  for(var j=0;j<child.length;j++)if(child[j].nodeType===3&&child[j].nodeValue.trim()){child[j].nodeValue=a+' ';set=true;break}
  if(!set){var textSpan=el.querySelector('span');if(textSpan)textSpan.textContent=a}
  em.textContent=b;return;
 }
 el.textContent=[a,b].filter(Boolean).join(' ');
}
function updateServiceSectionHeading(el,lineOne,lineTwo){
 if(!el){return}
 var a=String(lineOne||'').trim(),b=String(lineTwo||'').trim(),br=q('br',el),em=q('em',el);
 if(!br||!em){updatePageHeading(el,a,b);return}
 var nodes=Array.prototype.slice.call(el.childNodes),brAt=nodes.indexOf(br),emAt=nodes.indexOf(em);
 for(var i=0;i<brAt;i++)if(nodes[i].nodeType===3&&nodes[i].nodeValue.trim()){nodes[i].nodeValue=a+' ';break}
 var words=b.split(/\s+/).filter(Boolean),last=words.pop()||'';
 for(var j=brAt+1;j<emAt;j++)if(nodes[j].nodeType===3){nodes[j].nodeValue=words.length?words.join(' ')+' ':' ';break}
 em.textContent=last;
}
function applyPageContent(all,path){
 var key=contentPageKey(path);if(!key)return;
 var v=all&&all[key];if(!v)return;
 var hero=q('.aa-page-hero')||q('.service-hero');
 if(hero){
  var eyebrow=q('.eyebrow',hero),title=q('h1',hero),intro=q('p',hero);
  if(eyebrow&&v.heroEyebrow)eyebrow.textContent=v.heroEyebrow;
  if(title&&(v.heroTitleLineOne||v.heroTitleLineTwo))updatePageHeading(title,v.heroTitleLineOne,v.heroTitleLineTwo);
  if(intro&&v.heroIntro)intro.textContent=v.heroIntro;
 }
 if(key==='services'){
  var wrap=q('.services-intro'),sectionTitle=wrap&&q('h2',wrap),sectionBody=wrap&&q('p',wrap),sectionEyebrow=wrap&&q('.eyebrow',wrap);
  if(sectionEyebrow&&v.sectionEyebrow)sectionEyebrow.textContent=v.sectionEyebrow;
  if(sectionTitle&&(v.sectionTitleLineOne||v.sectionTitleLineTwo))updatePageHeading(sectionTitle,v.sectionTitleLineOne,v.sectionTitleLineTwo);
  if(sectionBody&&v.sectionBody)sectionBody.textContent=v.sectionBody;
 }else if(key==='work'){
  var workTitle=q('.work-section .section-title'),workEye=q('.work-section .section-head .eyebrow'),workBody=q('.work-section .section-head>p');
  if(workEye&&v.sectionEyebrow)workEye.textContent=v.sectionEyebrow;
  if(workTitle&&(v.sectionTitleLineOne||v.sectionTitleLineTwo))updatePageHeading(workTitle,v.sectionTitleLineOne,v.sectionTitleLineTwo);
  if(workBody&&v.sectionBody)workBody.textContent=v.sectionBody;
 }else{
  var panel=q('.aa-content-panel');
  if(panel){
   var sectionEye=q('.eyebrow',panel),sectionTitle=q('h2',panel),paras=qa('p',panel);
   if(sectionEye&&v.sectionEyebrow)sectionEye.textContent=v.sectionEyebrow;
   if(sectionTitle&&(v.sectionTitleLineOne||v.sectionTitleLineTwo)){if(key.startsWith('services/'))updateServiceSectionHeading(sectionTitle,v.sectionTitleLineOne,v.sectionTitleLineTwo);else updatePageHeading(sectionTitle,v.sectionTitleLineOne,v.sectionTitleLineTwo)}
   if(paras[0]&&v.sectionBody)paras[0].textContent=v.sectionBody;
  }
 }
}
function apply(data){
 var s=data.settings||{};
 var route=location.pathname.replace(/\/+$/,'')||'/';
 if(route!=='/'&&route!=='/index.html'){addBlogLinks(s.showBlogLink!==false);applyPageContent(s.pageContent||{},route);return}
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
  details.appendChild(make('div','',s.contactAddressLineOne||'Gurugram, Haryana, India'));
  details.appendChild(make('div','',s.contactAddressLineTwo||'Serving clients across India and worldwide'));
  if(s.contactPhone){var p=make('a','','Call: '+s.contactPhone);p.href='tel:'+s.contactPhone.replace(/[^\d+]/g,'');details.appendChild(p);details.appendChild(make('span','',' · '))}
  if(s.contactEmail){var m=make('a','','Email: '+s.contactEmail);m.href='mailto:'+s.contactEmail;details.appendChild(m);details.appendChild(make('br',''))}
  var mapUrl=hrefSafe(s.mapUrl);if(s.mapUrl&&mapUrl!=='#contact'){var map=make('a','','Find us on Google Maps ↗');map.href=mapUrl;map.target='_blank';map.rel='noopener noreferrer';details.appendChild(map);}
 }
 put('.site-footer .footer-copy',s.footerTagline);
 var description=q('meta[name="description"]');if(description&&s.seoDescription)description.setAttribute('content',s.seoDescription);
 var og=q('meta[property="og:description"]');if(og&&s.seoDescription)og.setAttribute('content',s.seoDescription);
 addBlogLinks(s.showBlogLink!==false);
 renderServices(data.services);
 renderPortfolio(s.portfolioItems);
 renderTeam(s.teamMembers,s);
 renderSections(s.customSections);
 var formFoot=q('.form-footnote');if(formFoot)formFoot.textContent='Submitting sends your project details to the studio dashboard so the team can review your enquiry. Your details are not published publicly.';
 var social= q('.footer-links');if(social){
  qa('a[data-social-link]',social).forEach(function(a){a.remove()});
  [['instagramUrl','Instagram'],['linkedinUrl','LinkedIn']].forEach(function(pair){if(s[pair[0]]&&hrefSafe(s[pair[0]])!=='#contact'){var a=make('a','',''+pair[1]+' ↗');a.href=hrefSafe(s[pair[0]]);a.target='_blank';a.rel='noopener noreferrer';a.dataset.socialLink='1';social.appendChild(a)}});
 }
}
fetch(API+'/public/site').then(function(r){if(!r.ok)throw new Error('CMS unavailable');return r.json()}).then(apply).catch(function(){});
var form=q('#briefForm');
if(form)form.addEventListener('submit',function(e){e.preventDefault();
 var d=new FormData(form),touch={};try{touch=JSON.parse(sessionStorage.getItem('aaLeadFirstTouch')||'{}')||{}}catch(e){}var sid='';try{sid=sessionStorage.getItem('aaVisitorSession')||''}catch(e){}var host='';try{host=document.referrer?new URL(document.referrer).hostname:''}catch(e){}var payload={name:d.get('name'),email:d.get('email'),mobile_number:d.get('mobile_number'),company:d.get('company'),service:d.get('service'),goal:d.get('goal'),source:touch.source||host||'Direct / unknown',utm_source:touch.utm_source||'',utm_medium:touch.utm_medium||'',utm_campaign:touch.utm_campaign||'',landing_page:touch.landing_page||location.pathname,referrer_host:touch.referrer_host||host,current_page:location.pathname,visitor_session_id:sid};
 var status=q('#formStatus');if(status)status.textContent='Saving your enquiry…';
 fetch(API+'/public/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Could not save enquiry');return d})}).then(function(d){if(status)status.textContent='Your enquiry has been saved to the studio dashboard. Reference #'+d.enquiryId+'.'}).catch(function(e){if(status)status.textContent='Your brief is ready, but the enquiry could not reach the dashboard. Please copy it and contact the studio directly.';var foot=q('.form-footnote');if(foot)foot.textContent='Your brief is ready, but saving failed. Please copy the brief above and contact the studio directly.'});
});
})();