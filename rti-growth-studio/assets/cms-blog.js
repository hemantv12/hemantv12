(function(){
'use strict';
var API='https://aa-growth-studio-cms-api.onrender.com/api',grid=document.getElementById('postGrid'),state=document.getElementById('blogState'),count=document.getElementById('postCount'),area=document.getElementById('journalArea');
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function date(v){if(!v)return '';try{return new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}catch(e){return ''}}
function safeImage(v){try{var u=new URL(v);return(u.protocol==='http:'||u.protocol==='https:')?u.href:''}catch(e){return ''}}
function setState(msg,bad){state.textContent=msg;state.className='blog-state'+(bad?' error':'')}
function card(p,i){
 var img=safeImage(p.cover_image),label=(p.category||'INSIGHTS').toUpperCase(),letter=(p.title||'AA').trim().split(/\s+/).slice(0,2).join('<br>');
 return '<article class="post-card"><div class="post-art '+(img?'with-image':'')+'"><span class="art-index">JOURNAL / '+String(i+1).padStart(2,'0')+'</span>'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy" onerror="this.remove()">':'<span class="art-word">'+letter+'</span>')+'</div><div class="post-body"><div class="post-meta"><span>'+esc(label)+'</span><span>·</span><span>'+esc(date(p.published_at))+'</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(p.excerpt||'A note from the AA Growth Studio journal.')+'</p><a class="read-link" href="/blog/?post='+encodeURIComponent(p.slug)+'">Read the article <span>↗</span></a></div></article>'
}
async function article(slug){
 setState('Opening article…');count.textContent='SINGLE ARTICLE';try{var r=await fetch(API+'/public/blogs/'+encodeURIComponent(slug));var d=await r.json();if(!r.ok)throw new Error(d.error||'Article not found.');
 var p=d.post,img=safeImage(p.cover_image);area.innerHTML='<article class="article-view"><a class="back-journal" href="/blog/">← BACK TO JOURNAL</a><div class="article-category">'+esc(p.category||'INSIGHTS')+'</div><h1>'+esc(p.title)+'</h1><p class="article-excerpt">'+esc(p.excerpt||'')+'</p><div class="article-meta">AA GROWTH STUDIO · '+esc(date(p.published_at))+'</div>'+(img?'<img class="article-cover" src="'+esc(img)+'" alt="">':'')+'<div class="article-content">'+esc(p.content||'').split(/\n\s*\n/).map(function(x){return '<p>'+x.replace(/\n/g,'<br>')+'</p>'}).join('')+'</div><a class="back-journal" href="/blog/">← ALL ARTICLES</a></article>';
 document.title=p.title+' — AA Growth Studio';var meta=document.querySelector('meta[name="description"]');if(meta)meta.content=p.excerpt||p.title;
 }catch(e){setState(e.message,true);count.textContent='ARTICLE UNAVAILABLE';}}
async function init(){
 var params=new URLSearchParams(location.search),single=params.get('post');if(single){await article(single);return}
 try{var r=await fetch(API+'/public/blogs');var d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load articles.');var posts=d.posts||[];count.textContent=posts.length+' '+(posts.length===1?'ARTICLE':'ARTICLES');if(!posts.length){setState('The journal is getting ready. New ideas and articles will appear here soon.');return}state.textContent='';state.style.display='none';grid.innerHTML=posts.map(card).join('');}
 catch(e){setState('The journal could not be loaded right now. Please refresh in a moment.',true);count.textContent='TRY AGAIN';}
}
init();
})();