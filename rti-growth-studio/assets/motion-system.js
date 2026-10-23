(function(){'use strict';
var root=document.documentElement,body=document.body;
if(!body)return;
if(location.pathname!=='/admin'&&location.pathname.indexOf('/admin/')!==0&&!window.__aaVisitorAnalyticsLoader){
 window.__aaVisitorAnalyticsLoader=true;
 var visitorScript=document.createElement('script');visitorScript.src='/assets/visitor-analytics.js';visitorScript.async=true;document.head.appendChild(visitorScript);
}
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
root.classList.add('motion-enhanced');if(reduce){root.classList.add('motion-reduced');return}
var progress=document.createElement('div');progress.className='aa-scroll-progress';progress.setAttribute('aria-hidden','true');progress.innerHTML='<span></span>';body.insertBefore(progress,body.firstChild);
var header=document.querySelector('.site-header,.blog-header');
var raf=0;
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function updateScroll(){raf=0;var doc=root,st=window.scrollY||doc.scrollTop||0,max=doc.scrollHeight-window.innerHeight,p=max>0?clamp(st/max,0,1):0;root.style.setProperty('--aa-scroll-progress',p.toFixed(4));body.classList.toggle('has-scrolled',st>12);if(header)header.classList.toggle('is-scrolled',st>12);
 document.querySelectorAll('[data-aa-parallax]').forEach(function(el){var r=el.getBoundingClientRect(),mid=r.top+r.height/2-window.innerHeight/2,depth=Number(el.getAttribute('data-aa-parallax'))||.035;el.style.setProperty('--aa-parallax-y',clamp(-mid*depth,-28,28).toFixed(1)+'px')});
}
function requestScroll(){if(!raf)raf=window.requestAnimationFrame(updateScroll)}
window.addEventListener('scroll',requestScroll,{passive:true});window.addEventListener('resize',requestScroll,{passive:true});updateScroll();
var selectors=[
 'main>section','.journal-area','.blog-hero','.site-footer','.blog-footer',
 '.hero-copy','.hero-visual','.hero-bottomline','.hero-index','.section-head','.work-card:not(.reveal)','.service-card',
 '.growth-promo-inner','.contact-intro','.brief-form','.statement-grid','.service-hero-copy','.service-hero-grid>div',
 '.service-detail','.process-item','.team-card','.team-placeholder','.service-hero-art',
 '.page-hero','.page-hero-copy','.page-hero-art','.split-section>div','.feature-panel','.faq-item',
 '.blog-hero .hero-overline','.blog-hero h1','.blog-hero>p','.blog-hero .hero-bottom','.journal-head','.post-card','.blog-closer',
 '.article-view>.article-category','.article-view>h1','.article-view>.article-excerpt','.article-view>.article-meta','.article-cover','.article-content',
 '.forge-hero-copy','.forge-hero-stage','.forge-section-head','.forge-form','.forge-concept','.forge-copy-panel','.forge-transparency','.forge-last-inner',
 '.gl-hero-grid>div','.gl-section-head','.gl-tool-grid','.gl-last-inner',
 '.contact-panel','.contact-detail','.contact-section .eyebrow','.brief-result',
 '.stat-card','.panel','.media-library-card','.insight-action','.row-item','.login-card','.login-brand','.sidebar','.app-topbar','.dashboard-grid>*,.table-wrap'
];
var unique=new Set(),els=[];
selectors.forEach(function(sel){try{document.querySelectorAll(sel).forEach(function(el){if(unique.has(el)||el.classList.contains('reveal')||el.closest('.reveal'))return;unique.add(el);els.push(el)})}catch(e){}});
var staggerGroups=['.work-grid','.services-grid','.post-grid','.team-grid','.process-grid','.forge-concept-grid','.services-list','.service-details','.feature-grid'];
staggerGroups.forEach(function(sel){document.querySelectorAll(sel).forEach(function(group){group.querySelectorAll(':scope > *').forEach(function(el,i){if(el.classList.contains('reveal')||el.closest('.reveal'))return;el.style.setProperty('--motion-delay',Math.min(i,5)*75+'ms')})})});
els.forEach(function(el,i){
 el.classList.add('motion-reveal');
 if(el.matches('.hero-copy,.service-hero-copy,.forge-hero-copy,.contact-intro'))el.classList.add('motion-from-left');
 else if(el.matches('.hero-visual,.service-hero-art,.forge-hero-stage'))el.classList.add('motion-from-right');
 else if(el.matches('.forge-concept,.post-card'))el.classList.add('motion-pop');
 if(el.matches('.hero-visual,.service-hero-art,.forge-hero-stage,.blog-hero'))el.setAttribute('data-aa-parallax',el.matches('.blog-hero')?'.018':'.035');
});
var observer=null;
if('IntersectionObserver'in window){
 observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;entry.target.classList.add('motion-in');observer.unobserve(entry.target)})},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
 els.forEach(function(el){observer.observe(el)});
}else{els.forEach(function(el){el.classList.add('motion-in')})}
var processed=new WeakSet(els);
function scanAdded(node){
 if(!node||node.nodeType!==1)return;
 var added=[];
 selectors.forEach(function(sel){try{if(node.matches(sel))added.push(node);node.querySelectorAll(sel).forEach(function(el){added.push(el)})}catch(e){}});
 added.forEach(function(el){if(processed.has(el)||el.classList.contains('reveal')||el.closest('.reveal'))return;processed.add(el);el.classList.add('motion-reveal');if(el.matches('.hero-copy,.service-hero-copy,.forge-hero-copy,.contact-intro'))el.classList.add('motion-from-left');else if(el.matches('.hero-visual,.service-hero-art,.forge-hero-stage'))el.classList.add('motion-from-right');else if(el.matches('.forge-concept,.post-card,.stat-card,.insight-action'))el.classList.add('motion-pop');if(observer)observer.observe(el);else el.classList.add('motion-in')});
}
if('MutationObserver'in window){var contentObserver=new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(scanAdded)})});contentObserver.observe(body,{childList:true,subtree:true})}
if(window.matchMedia('(hover:hover) and (pointer:fine)').matches){
 var magnets=document.querySelectorAll('.btn,.growth-btn,.blog-cta,.forge-action-primary,.forge-action-secondary');
 magnets.forEach(function(el){el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.setProperty('--aa-magnet-x',(x*5).toFixed(1)+'px');el.style.setProperty('--aa-magnet-y',(y*4).toFixed(1)+'px')});el.addEventListener('pointerleave',function(){el.style.setProperty('--aa-magnet-x','0px');el.style.setProperty('--aa-magnet-y','0px')})});
 var stage=document.querySelector('.hero-visual,.service-hero-art,.forge-hero-stage');if(stage){stage.addEventListener('pointermove',function(e){var r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.setProperty('--aa-pointer-x',(x*7).toFixed(1)+'deg');stage.style.setProperty('--aa-pointer-y',(y*-5).toFixed(1)+'deg')});stage.addEventListener('pointerleave',function(){stage.style.removeProperty('--aa-pointer-x');stage.style.removeProperty('--aa-pointer-y')})}
}
/* Cross-document transitions are enabled through CSS where the browser supports them. */
window.addEventListener('pageshow',requestScroll);
})();