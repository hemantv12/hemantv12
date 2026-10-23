(function(){
'use strict';
var canvas=document.getElementById('neonCanvas'),view=document.getElementById('gameViewport');
if(!canvas||!view)return;
var ctx=canvas.getContext('2d');
if(!ctx)return;
var $=function(id){return document.getElementById(id)};
var overlay=$('gameOverlay'),startBtn=$('startGame'),statusEl=$('gameStatus'),scoreEl=$('scoreValue'),bestEl=$('bestValue'),runsEl=$('runsValue'),speedEl=$('speedValue'),missionEl=$('missionValue'),toastEl=$('gameToast'),comboBadge=$('comboBadge'),comboValue=$('comboValue'),shieldBadge=$('shieldBadge'),hud=$('gameHud'),pauseBtn=$('pauseGame'),soundBtn=$('soundToggle');
var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var width=1000,height=620,dpr=1,mode='ready',lane=1,playerX=0,items=[],particles=[],stars=[],elapsed=0,score=0,best=readNum('aaNeonRushBest',0),runs=readNum('aaNeonRushRuns',0),speed=.39,spawnTimer=.6,roadOffset=0,combo=0,comboTimer=0,shield=false,soundOn=false,audio=null,lastTime=0,toastTimer=0,frame=0,swipeStart=null;
function readNum(k,fallback){try{var n=Number(localStorage.getItem(k));return Number.isFinite(n)&&n>=0?n:fallback}catch(e){return fallback}}
function writeNum(k,n){try{localStorage.setItem(k,String(n))}catch(e){}}
function pad(n,len){return String(Math.max(0,Math.floor(n))).padStart(len,'0').slice(-len)}
function rand(a,b){return a+Math.random()*(b-a)}
function randomLane(){return Math.floor(Math.random()*3)}
function resize(){var r=view.getBoundingClientRect();if(r.width<1||r.height<1)return;width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);stars=[];for(var i=0;i<70;i++)stars.push({x:Math.random()*width,y:Math.random()*height*.62,r:rand(.35,1.4),a:rand(.15,.75),s:rand(2,13)})}
function laneX(l,z){var horizon=height*.18,bottom=height*.99,p=Math.pow(Math.max(0,Math.min(1,z)),1.45),roadHalf=width*(.11+.37*p);return width/2+(l-1)*roadHalf*.61}
function roadY(z){return height*.18+Math.pow(Math.max(0,Math.min(1,z)),1.45)*height*.82}
function setText(el,t){if(el)el.textContent=t}
function sound(freq,duration,type){if(!soundOn)return;try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audio)audio=new AC();if(audio.state==='suspended')audio.resume();var o=audio.createOscillator(),g=audio.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.055,audio.currentTime+.012);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration+.025)}catch(e){}}
function showToast(t){setText(toastEl,t);toastEl.classList.add('show');toastTimer=.9}
function showOverlay(kind){
 overlay.classList.remove('is-hidden');
 if(kind==='ready'){setText($('overlayKicker'),'READY PLAYER ONE');$('overlayTitle').innerHTML='Chase the<br><em>high score.</em>';setText($('overlayCopy'),'Collect energy. Dodge glitches. Survive the speed-up.');startBtn.innerHTML='<span>▶</span> START RUN <b>↗</b>';setText(statusEl,'SYSTEM READY')}
 else if(kind==='paused'){setText($('overlayKicker'),'RUN PAUSED');$('overlayTitle').innerHTML='Take a<br><em>breather.</em>';setText($('overlayCopy'),'Your run is frozen. The neon is going nowhere.');startBtn.innerHTML='<span>▶</span> RESUME RUN <b>↗</b>';setText(statusEl,'PAUSED')}
 else if(kind==='over'){setText($('overlayKicker'),'RUN COMPLETE / SIGNAL LOST');$('overlayTitle').innerHTML='One more<br><em>run?</em>';setText($('overlayCopy'),'Score '+pad(score,6)+' · Best '+pad(best,6)+'. Every run is another chance.');startBtn.innerHTML='<span>↻</span> RUN IT BACK <b>↗</b>';setText(statusEl,'SIGNAL LOST')}
}
function resetRun(){items=[];particles=[];lane=1;playerX=0;elapsed=0;score=0;speed=.39;spawnTimer=.45;roadOffset=0;combo=0;comboTimer=0;shield=false;lastTime=0;setText(scoreEl,pad(score,6));setText(speedEl,'1.0×');setText(missionEl,'Catch the glow.');comboBadge.hidden=true;shieldBadge.hidden=true;hud.hidden=false;setText(statusEl,'RUN IN PROGRESS');mode='running';overlay.classList.add('is-hidden');runs++;writeNum('aaNeonRushRuns',runs);setText(runsEl,pad(runs,2));sound(440,.09,'triangle')}
function startOrResume(){if(mode==='paused'){mode='running';lastTime=0;overlay.classList.add('is-hidden');setText(statusEl,'RUN IN PROGRESS');sound(620,.07,'triangle');return}resetRun()}
function pause(){if(mode!=='running')return;mode='paused';showOverlay('paused');setText(statusEl,'PAUSED');sound(250,.08,'sine')}
function gameOver(){if(mode!=='running')return;mode='over';if(score>best){best=score;writeNum('aaNeonRushBest',best)}setText(bestEl,pad(best,6));setText(missionEl,'Run it back.');showOverlay('over');sound(110,.28,'sawtooth');for(var i=0;i<24;i++)burst(width/2,height*.56,'#ff4fd8',1.5)}
function move(dir){if(mode!=='running')return;var next=Math.max(0,Math.min(2,lane+dir));if(next===lane)return;lane=next;for(var i=0;i<4;i++)particles.push({x:laneX(lane,.88)+rand(-8,8),y:height*.81+rand(-5,10),vx:rand(-45,45),vy:rand(-100,-20),life:rand(.16,.42),age:0,size:rand(1,3),color:'#45f7ff'});sound(340+lane*100,.045,'triangle')}
function spawn(){var r=Math.random(),type=r<.51?'block':r<.965?'orb':'shield',l=randomLane();items.push({lane:l,z:0,type:type,phase:rand(0,6),checked:false});if(type==='block'&&Math.random()<.16){var safe=Math.floor(Math.random()*3);items=items.filter(function(a){return !(a.z<.01&&a.type==='block')});for(var j=0;j<3;j++)if(j!==safe)items.push({lane:j,z:0,type:'block',phase:rand(0,6),checked:false});items.push({lane:safe,z:0,type:'orb',phase:0,checked:false})}}
function burst(x,y,color,mult){for(var i=0;i<(reduced?5:14)*mult;i++){var a=Math.random()*Math.PI*2,v=rand(35,210);particles.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.2,.65),age:0,size:rand(1.3,4),color:color})}}
function collect(it){var x=laneX(it.lane,it.z),y=roadY(it.z);if(it.type==='orb'){combo=comboTimer>0?Math.min(9,combo+1):1;comboTimer=2.15;var gain=100*combo;score+=gain;showToast('+'+gain+' ENERGY'+(combo>1?'  /  ×'+combo:''));setText(missionEl,combo>=4?'Unreal momentum.':'Energy secured.');sound(600+combo*100,.11,'sine');burst(x,y,'#d8ff65',combo>=4?2:1)}else if(it.type==='shield'){if(shield){score+=150;showToast('SHIELD CHARGED  +150');burst(x,y,'#45f7ff',1);sound(880,.14,'sine')}else{shield=true;showToast('SHIELD ONLINE  ◈');burst(x,y,'#45f7ff',1.5);sound(760,.18,'triangle')}shieldBadge.hidden=false}}
function handleHit(it){var x=laneX(it.lane,it.z),y=roadY(it.z);if(shield){shield=false;shieldBadge.hidden=true;it.type='spent';score+=50;showToast('SHIELD ABSORBED HIT  +50');burst(x,y,'#45f7ff',1.8);sound(420,.2,'triangle')}else{burst(x,y,'#ff4fd8',2);gameOver()}}
function update(dt){
 if(mode!=='running')return;elapsed+=dt;speed=.39+Math.min(.38,elapsed*.0048);roadOffset=(roadOffset+dt*(.7+speed*1.8))%1;score+=dt*(7+speed*4);
 spawnTimer-=dt;if(spawnTimer<=0){spawn();spawnTimer=Math.max(.51,.92-elapsed*.0045)+rand(-.12,.14)}
 comboTimer=Math.max(0,comboTimer-dt);if(comboTimer===0)combo=0;comboBadge.hidden=combo<2;setText(comboValue,'×'+combo);
 for(var i=items.length-1;i>=0;i--){var it=items[i];it.z+=speed*dt;if(it.z>=.855&&!it.checked){it.checked=true;if(it.lane===lane){if(it.type==='block')handleHit(it);else if(it.type==='orb'||it.type==='shield')collect(it)}}
  if(it.z>1.14||it.type==='spent')items.splice(i,1);
 }
 for(var p=particles.length-1;p>=0;p--){var q=particles[p];q.age+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=150*dt;if(q.age>=q.life)particles.splice(p,1)}
 playerX+=(lane-playerX)*Math.min(1,dt*12);
 setText(scoreEl,pad(score,6));setText(speedEl,(speed/.39).toFixed(1)+'×');
 if(elapsed>45)setText(missionEl,'Velocity is climbing.');else if(elapsed>20)setText(missionEl,'Find the rhythm.');setText(bestEl,pad(Math.max(best,score),6));
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastEl.classList.remove('show')}
}
function poly(points,fill,stroke,lw){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(var i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke()}}
function drawBackground(t){var g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,'#080b16');g.addColorStop(.55,'#11152c');g.addColorStop(1,'#17122a');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 var glow=ctx.createRadialGradient(width*.5,height*.2,2,width*.5,height*.22,width*.55);glow.addColorStop(0,'#26315c77');glow.addColorStop(1,'#080b1600');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 stars.forEach(function(s){ctx.globalAlpha=s.a*(.72+.28*Math.sin(t*s.s+s.x));ctx.fillStyle='#b9d9ff';ctx.fillRect(s.x,s.y,s.r,s.r)});ctx.globalAlpha=1;
 var hy=height*.18;ctx.strokeStyle='#ff4fd832';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(width*.32,hy);ctx.lineTo(width*.68,hy);ctx.stroke();
 ctx.save();ctx.globalAlpha=.25;ctx.strokeStyle='#9580ff';ctx.lineWidth=1;for(var i=-9;i<=9;i++){ctx.beginPath();ctx.moveTo(width/2+i*4,hy);ctx.lineTo(width/2+i*width*.06,height);ctx.stroke()}ctx.restore()
}
function drawRoad(){var hy=height*.18,topHalf=width*.105,bottomHalf=width*.47;
 var road=ctx.createLinearGradient(0,hy,0,height);road.addColorStop(0,'#12152a');road.addColorStop(.45,'#10172b');road.addColorStop(1,'#17132d');
 poly([[width/2-topHalf,hy],[width/2+topHalf,hy],[width/2+bottomHalf,height],[width/2-bottomHalf,height]],road,'#394367',1);
 ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#45f7ff';ctx.strokeStyle='#45f7ff8c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(width/2-topHalf,hy);ctx.lineTo(width/2-bottomHalf,height);ctx.moveTo(width/2+topHalf,hy);ctx.lineTo(width/2+bottomHalf,height);ctx.stroke();ctx.restore();
 for(var d=1;d<=2;d++){var xTop=width/2+(-1+2*d/3)*topHalf,xBot=width/2+(-1+2*d/3)*bottomHalf;ctx.strokeStyle=d===1?'#9580ff7c':'#9580ff7c';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xTop,hy);ctx.lineTo(xBot,height);ctx.stroke()}
 for(var k=0;k<13;k++){var z=(k/13+roadOffset)%1,y=roadY(z),half=topHalf+(bottomHalf-topHalf)*Math.pow(z,1.45);ctx.globalAlpha=.08+z*.27;ctx.strokeStyle=k%3===0?'#45f7ff':'#8ca0df';ctx.lineWidth=.5+z*1.2;ctx.beginPath();ctx.moveTo(width/2-half,y);ctx.lineTo(width/2+half,y);ctx.stroke()}
 ctx.globalAlpha=1;
 for(var a=0;a<20;a++){var z=(a/20+roadOffset*.55)%1,y=roadY(z),half=topHalf+(bottomHalf-topHalf)*Math.pow(z,1.45);ctx.fillStyle=a%2===0?'#45f7ff1f':'#ff4fd817';ctx.fillRect(width/2-half,y,Math.max(1,half*.018),2+z*3);ctx.fillRect(width/2+half-Math.max(1,half*.018),y,Math.max(1,half*.018),2+z*3)}
}
function drawObject(it,t){var z=Math.min(1,it.z),x=laneX(it.lane,z),y=roadY(z),scale=.17+z*1.25,size=(12+z*22),pulse=1+Math.sin(t*8+it.phase)*.09;
 if(it.type==='block'){var w=size*1.75,h=size*1.65,deep=size*.42;ctx.save();ctx.shadowBlur=12+z*18;ctx.shadowColor='#ff4fd8';poly([[x-w/2,y-h],[x+w/2,y-h],[x+w/2,y],[x-w/2,y]],'#401a43','#ff4fd8',Math.max(1,z*2));poly([[x-w/2,y-h],[x-w/2+deep,y-h-deep*.5],[x+w/2+deep,y-h-deep*.5],[x+w/2,y-h]],'#a13e91','#ff8be6',1);poly([[x+w/2,y-h],[x+w/2+deep,y-h-deep*.5],[x+w/2+deep,y-deep*.5],[x+w/2,y]],'#622d77','#ff7ce2',1);ctx.strokeStyle='#ffd1f7';ctx.globalAlpha=.55;ctx.lineWidth=Math.max(.7,z);ctx.beginPath();ctx.moveTo(x-w*.34,y-h*.68);ctx.lineTo(x+w*.34,y-h*.68);ctx.stroke();ctx.restore()}
 else{ctx.save();var c=it.type==='shield'?'#45f7ff':'#d8ff65';ctx.shadowBlur=12+z*20;ctx.shadowColor=c;ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,scale*2.2);ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(x,y-size*.65,size*.75*pulse,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=c;if(it.type==='shield'){ctx.save();ctx.translate(x,y-size*.65);ctx.rotate(Math.PI/4);ctx.fillRect(-size*.45,-size*.45,size*.9,size*.9);ctx.restore();ctx.strokeStyle='#f0ffff';ctx.lineWidth=Math.max(1,scale);ctx.beginPath();ctx.arc(x,y-size*.65,size*.32,0,Math.PI*2);ctx.stroke()}else{ctx.beginPath();ctx.arc(x,y-size*.65,size*.4*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f6ffcf';ctx.beginPath();ctx.arc(x-size*.12,y-size*.77,size*.11,0,Math.PI*2);ctx.fill()}ctx.restore()}
}
function drawPlayer(t){var x=width/2+(playerX-1)*width*.285,y=height*.825,pulse=1+Math.sin(t*8)*.07;
 ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#45f7ff';ctx.beginPath();ctx.ellipse(x,y+13,29*pulse,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
 ctx.save();ctx.shadowBlur=24;ctx.shadowColor=shield?'#45f7ff':'#45f7ffcc';var grd=ctx.createLinearGradient(x-17,y-24,x+18,y+25);grd.addColorStop(0,'#f3ffff');grd.addColorStop(.45,'#45f7ff');grd.addColorStop(1,'#796eff');poly([[x,y-27*pulse],[x+18,y+12],[x+7,y+9],[x+3,y+21],[x-3,y+21],[x-7,y+9],[x-18,y+12]],grd,'#d6ffff',1.2);
 ctx.shadowBlur=0;poly([[x,y-15],[x+5,y+7],[x,y+4],[x-5,y+7]],'#fff',null);ctx.fillStyle='#9580ff';ctx.fillRect(x-2,y+19,4,6);ctx.restore();
 if(shield){ctx.save();ctx.strokeStyle='#45f7ffb3';ctx.lineWidth=2;ctx.shadowBlur=18;ctx.shadowColor='#45f7ff';ctx.beginPath();ctx.ellipse(x,y,32+Math.sin(t*5)*3,39+Math.sin(t*5)*3,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
}
function drawParticles(){particles.forEach(function(p){ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.color;ctx.shadowBlur=8;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;ctx.shadowBlur=0}
function render(t){ctx.clearRect(0,0,width,height);drawBackground(t);drawRoad();items.slice().sort(function(a,b){return a.z-b.z}).forEach(function(it){if(it.z<1.1)drawObject(it,t)});drawPlayer(t);drawParticles();if(mode==='ready'){ctx.fillStyle='#45f7ff';ctx.globalAlpha=.08+Math.sin(t*2)*.03;ctx.fillRect(0,height*.18,width,1);ctx.globalAlpha=1}}
function loop(timestamp){if(!lastTime)lastTime=timestamp;var dt=Math.min((timestamp-lastTime)/1000,.04);lastTime=timestamp;frame++;if(mode==='running')update(dt);render(timestamp/1000);window.requestAnimationFrame(loop)}
function setupSound(){soundOn=!soundOn;soundBtn.setAttribute('aria-pressed',String(soundOn));setText(soundBtn,soundOn?'SOUND ON ♪':'SOUND OFF ♪');if(soundOn)sound(560,.08,'sine')}
startBtn.addEventListener('click',startOrResume);
pauseBtn.addEventListener('click',pause);
$('restartGame').addEventListener('click',function(){resetRun()});
$('moveLeft').addEventListener('pointerdown',function(e){e.preventDefault();move(-1)});
$('moveRight').addEventListener('pointerdown',function(e){e.preventDefault();move(1)});
soundBtn.addEventListener('click',setupSound);
window.addEventListener('keydown',function(e){var k=e.key.toLowerCase();if(['arrowleft','arrowright',' ','a','d'].indexOf(k)<0)return;if(mode==='running')e.preventDefault();if(k==='arrowleft'||k==='a')move(-1);else if(k==='arrowright'||k==='d')move(1);else if(k===' '){e.preventDefault();if(mode==='running')pause();else if(mode==='paused')startOrResume()}});
view.addEventListener('touchstart',function(e){if(!e.changedTouches||!e.changedTouches.length)return;swipeStart={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY,time:Date.now()}},{passive:true});
view.addEventListener('touchend',function(e){if(!swipeStart||!e.changedTouches||!e.changedTouches.length)return;var dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)*1.2)move(dx>0?1:-1);swipeStart=null},{passive:true});
document.addEventListener('visibilitychange',function(){if(document.hidden&&mode==='running')pause()});
window.addEventListener('resize',resize);
resize();setText(bestEl,pad(best,6));setText(runsEl,pad(runs,2));setText(scoreEl,pad(0,6));showOverlay('ready');window.requestAnimationFrame(loop);
})();