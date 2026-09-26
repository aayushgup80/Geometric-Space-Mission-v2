(()=>{"use strict";
const TOUCAN_URL="https://eylmduhkjrvpowvuejex.supabase.co",TOUCAN_KEY="sb_publishable_a23t-KV73iSoBA29igsnAQ_phuSvlEb";const GSM_URL="https://ccdllfswfhtgcolkugbz.supabase.co",GSM_KEY="sb_publishable_LPd-zxWUKM8c1p2P9sbbuA_EmhtqQr5";
if(!window.supabase){document.getElementById("menu-info").textContent="Supabase failed to load. Open this page through Live Server (http://), not file://.";return}
const sb=window.supabase.createClient(TOUCAN_URL,TOUCAN_KEY),$=id=>document.getElementById(id),canvas=$("game-canvas"),ctx=canvas.getContext("2d",{alpha:false});
let W=0,H=0,state="START",last=0,user,profile,crix=10,score=0,xp=0,level=1,lives=3,kills=0,killFlash=0,killRotation=0,killHue=185,player,bullets=[],enemies=[],stars=[],sparks=[],spawn=0,fireClock=0,abilityClock=0,invuln=0,shieldClock=0,guardClock=0,overdriveClock=0,left=false,right=false,fire=false,fpsFrames=0,fpsStamp=0,fpsValue=0,weapon={damage:25,delay:.22,dual:false,color:"#76ff03"},shipId="ship_default",shipDef={id:"ship_default",name:"GSM Scout",hp:100,speed:330,ability:"Pulse",color:"#00eaff"};
const music=new Audio("sounds/gameplay_music.flac");music.loop=true;music.volume=.28;const killBanner=$("kill-banner"),killCount=$("kill-count"),pauseOverlay=$("pause-overlay");const shell=$("game-container");
async function gsmApi(action,body={}){if(!user?.access_token)throw Error("TOUCAN SESSION EXPIRED");const r=await fetch(GSM_URL+"/functions/v1/toucan-api",{method:"POST",headers:{apikey:GSM_KEY,Authorization:"Bearer "+user.access_token,"Content-Type":"application/json"},body:JSON.stringify({...body,action})});const d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw Error(d?.error||"GAME SERVER REQUEST FAILED");return d}
function musicOn(){music.play().catch(()=>{})}function sound(id){const a=$(id);if(!a)return;try{a.currentTime=0;a.play().catch(()=>{})}catch(e){}}
document.addEventListener("mouseover",e=>{if(e.target.closest("button"))sound("uiHover")});document.addEventListener("click",e=>{if(e.target.closest("button")){sound("uiClick");musicOn()}});
function resize(){W=canvas.clientWidth;H=canvas.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(W*d);canvas.height=Math.floor(H*d);ctx.setTransform(d,0,0,d,0,0);if(player){player.y=H-105;player.x=Math.max(24,Math.min(W-24,player.x))}}
addEventListener("resize",resize);
const SHIPS=[{hp:55,r:13,s:75,score:12,c:"#32e6ff"},{hp:95,r:15,s:92,score:20,c:"#76ff03"},{hp:150,r:17,s:70,score:32,c:"#a55eea"},{hp:240,r:20,s:58,score:55,c:"#ff9d35"},{hp:390,r:23,s:45,score:90,c:"#ff3f67"}];
function nextLevelXp(l){if(l<=1)return 300;if(l===2)return 750;return Math.floor(750*Math.pow(1.5,l-2))}
function xpNeed(l){return Math.floor(100*Math.pow(1.8,l-1))}function levelFor(x){let l=1,total=0;while(l<50){total+=xpNeed(l);if(x<total)return l;l++}return l}
async function boot(){try{const {data:{session}}=await sb.auth.getSession();if(!session){location.replace("login.html");return}user=session;const d=await gsmApi("bootstrap");profile=d.profile;crix=Number(profile.crix||0);level=Number(profile.level||1);const l=d.loadout||{};shipId=l.ship_id||"ship_default";const si=(d.items||[]).find(x=>x.id===shipId);if(si?.stats)shipDef={id:si.id,name:si.name,hp:Number(si.stats.hp||100),speed:Number(si.stats.speed||330),ability:si.stats.ability||"Pulse",color:si.stats.color||"#00eaff"};const w=(d.items||[]).find(x=>x.id===l.weapon_id);if(w?.stats)weapon={damage:Number(w.stats.damage||25),delay:Number(w.stats.fireDelay||.22),dual:Boolean(w.stats.dual),color:"#76ff03"};resize();menu();draw()}
catch(e){console.error(e);$("menu-info").textContent="Could not load mission data. Sign in through Toucan Games and try again."}}
function menu(){ $("menu-title").textContent="MISSION READY";$("menu-info").innerHTML="V2 COMBAT SYSTEMS ONLINE<br><br><b>SHIP:</b> "+shipDef.name+" · <b>ABILITY:</b> "+shipDef.ability+"<br><b>WASD / ARROWS</b> move · <b>SPACE</b> fire · <b>E</b> ability<br>Enemies scale from your current level.<br><br>Level <b>"+level+"</b> · Weapon damage <b>"+weapon.damage+"</b> · Fire rate <b>"+(1/weapon.delay).toFixed(1)+"/s</b>"}
function reset(){score=0;xp=0;lives=3;kills=0;killFlash=0;killRotation=0;killHue=185;spawn=.4;fireClock=0;abilityClock=0;shieldClock=0;guardClock=0;overdriveClock=0;invuln=0;bullets=[];enemies=[];sparks=[];player={x:W/2,y:H-92,r:16,max:shipDef.hp,hp:shipDef.hp};stars=Array.from({length:150},()=>({x:Math.random()*W,y:Math.random()*H,s:.4+Math.random()*1.5,v:15+Math.random()*45}));hud()}
function hud(){$("score-display").textContent=score;$("level-display").textContent=level;$("lives-display").textContent=lives;$("cret-display").textContent=Math.floor(crix);$("xp-display").textContent=xp;$("next-xp-display").textContent=nextLevelXp(level);const hpPct=Math.max(0,player?player.hp/player.max*100:100);$("player-hp-fill").style.width=hpPct+"%";$("hull-readout").textContent=Math.round(hpPct)+"%";$("ability-readout").textContent=abilityClock>0?abilityClock.toFixed(1)+"s":"READY";$("ability-bar-fill").style.width=Math.max(0,(1-abilityClock/8)*100)+"%"}
function toast(t){const el=$("temp-message-container");el.textContent=t;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),1100)}
function scheduleLoop(){if(settings.vsync)requestAnimationFrame(loop);else setTimeout(()=>loop(performance.now()),0)}function launch(){reset();state="RUNNING";pauseOverlay.style.display="none";$("message-box").style.display="none";musicOn();last=performance.now();fpsStamp=last;fpsFrames=0;scheduleLoop()}
function finish(){state="OVER";pauseOverlay.style.display="none";$("message-box").style.display="grid";$("menu-title").textContent=lives?"MISSION ENDED":"SHIP DESTROYED";$("menu-info").innerHTML="SCORE <b>"+score+"</b> · XP <b>"+xp+"</b> · LEVEL <b>"+level+"</b><br><br>Ready for another sortie?";$("start-button").textContent="LAUNCH AGAIN"}
function hit(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy<(a.r+b.r)**2}
function spawnEnemy(){const s=SHIPS[Math.floor(Math.random()*SHIPS.length)],d=1+(level-1)*.13;enemies.push({x:20+Math.random()*(W-40),y:-30,r:s.r,hp:s.hp*d,max:s.hp*d,s:s.s*(1+level*.012),score:s.score,c:s.c,damage:s.r*2*d})}
function shoot(){if(state!=="RUNNING"||fireClock>0)return;fireClock=weapon.delay*(overdriveClock>0?.5:1);const s=$("bulletShoot");if(s){s.volume=.70;s.currentTime=0;s.play().catch(()=>{})}bullets.push({x:player.x,y:player.y-18,v:680,r:3,d:weapon.damage});if(weapon.dual){bullets.push({x:player.x-9,y:player.y-13,v:680,r:3,d:weapon.damage*.7},{x:player.x+9,y:player.y-13,v:680,r:3,d:weapon.damage*.7})}}
function ability(){if(state!=="RUNNING"||abilityClock>0)return;abilityClock=8;
  if(shipId==="ship_nova"){for(const e of enemies)e.hp-=weapon.damage*7;toast("NOVA BURST // CRITICAL")}
  else if(shipId==="ship_orchid"){shieldClock=4;toast("PETAL SHIELD // ACTIVE")}
  else if(shipId==="ship_haul"){score+=Math.floor(Math.max(50,score*.25));toast("SALVAGE // SCORE BOOST")}
  else if(shipId==="ship_hydro"){player.hp=Math.min(player.max,player.hp+Math.floor(player.max*.45));toast("HYDRO REPAIR // +"+Math.floor(player.max*.45)+" HULL")}
  else if(shipId==="ship_zed_black"){for(const e of enemies)e.hp=0;toast("VOID COLLAPSE // PURGED")}
  else if(shipId==="ship_vite"){overdriveClock=8;toast("OVERDRIVE // FIRE RATE x2")}
  else if(shipId==="ship_moraine"){guardClock=8;toast("MORAINE GUARD // DAMAGE REDUCED")}
  else {for(const e of enemies)e.hp-=weapon.damage*3;toast("ECHO PULSE // IMPACT")}
}
function damage(n){if(invuln>0||shieldClock>0||state!=="RUNNING")return;invuln=.6;sound("hullDamage");if(guardClock>0)n*=.45;player.hp=Math.max(0,player.hp-n);if(player.hp<=0){lives=0;hud();finish();return}hud()}
function update(dt){killFlash=Math.max(0,killFlash-dt);shieldClock=Math.max(0,shieldClock-dt);guardClock=Math.max(0,guardClock-dt);overdriveClock=Math.max(0,overdriveClock-dt);if(left)player.x-=shipDef.speed*dt;if(right)player.x+=shipDef.speed*dt;player.x=Math.max(22,Math.min(W-22,player.x));if(fire)shoot();fireClock=Math.max(0,fireClock-dt);abilityClock=Math.max(0,abilityClock-dt);invuln=Math.max(0,invuln-dt);spawn-=dt;if(spawn<=0){spawnEnemy();spawn=Math.max(.22,1.05/(1+level*.05))}for(const b of bullets)b.y-=b.v*dt;bullets=bullets.filter(b=>b.y>-30);for(const e of enemies){e.y+=e.s*dt;if(hit(e,player)){damage(e.damage);e.hp=0}}for(const b of bullets)for(const e of enemies)if(e.hp>0&&hit(b,e)){e.hp-=b.d;b.y=-100;if(e.hp<=0){score+=e.score;kills++;killFlash=.42;killRotation=(killRotation+37)%360;killHue=(killHue+47)%360;killCount.textContent=kills;killBanner.style.color=`hsl(${killHue} 100% 70%)`;showKillRing();burst(e.x,e.y,e.c);toast("+"+e.score+" SCORE") }break}enemies=enemies.filter(e=>e.hp>0&&e.y<H+50);xp=Math.floor(score/10);hud()}
function showKillRing(){let r=$("kill-ring-runtime");if(!r){r=document.createElement("div");r.id="kill-ring-runtime";r.style="position:absolute;z-index:14;left:50%;top:18%;width:110px;height:110px;transform:translate(-50%,-20px);border:2px dashed hsl(var(--kh) 100% 65%);border-radius:50%;box-shadow:0 0 22px hsl(var(--kh) 100% 60% / .3);pointer-events:none";shell.appendChild(r)}r.style.setProperty("--kh",killHue);r.style.animation="gsmKillSpin .65s linear";killBanner.style.color=`hsl(${killHue} 100% 70%)`;killBanner.classList.remove("hide");killBanner.classList.add("show");clearTimeout(killBanner._timer);killBanner._timer=setTimeout(()=>{killBanner.classList.remove("show");killBanner.classList.add("hide")},650);clearTimeout(r._timer);r._timer=setTimeout(()=>r.style.animation="",650)}
function burst(x,y,c){for(let i=0;i<12;i++)sparks.push({x,y,vx:(Math.random()-.5)*150,vy:(Math.random()-.5)*150,t:.35,c})}
function ship(x,y){ctx.save();ctx.translate(x,y);ctx.globalAlpha=invuln>0&&Math.floor(invuln*15)%2===0?.3:1;ctx.shadowBlur=20;ctx.shadowColor=shipDef.color;ctx.fillStyle=shipDef.color;
  ctx.beginPath();
  if(shipId==="ship_nova"){ctx.moveTo(0,-27);ctx.lineTo(24,0);ctx.lineTo(9,9);ctx.lineTo(0,27);ctx.lineTo(-9,9);ctx.lineTo(-24,0);}
  else if(shipId==="ship_orchid"){for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.lineTo(Math.cos(a)*(i%2?9:24),Math.sin(a)*(i%2?9:24));}ctx.closePath();}
  else if(shipId==="ship_haul"){ctx.rect(-23,-14,46,28);}
  else if(shipId==="ship_hydro"){ctx.arc(0,0,22,0,Math.PI*2);}
  else if(shipId==="ship_zed_black"){ctx.moveTo(0,-28);ctx.lineTo(22,8);ctx.lineTo(0,17);ctx.lineTo(-22,8);}
  else if(shipId==="ship_vite"){ctx.moveTo(0,-31);ctx.lineTo(11,20);ctx.lineTo(0,13);ctx.lineTo(-11,20);}
  else if(shipId==="ship_moraine"){ctx.moveTo(-25,16);ctx.lineTo(-17,-14);ctx.lineTo(0,-23);ctx.lineTo(17,-14);ctx.lineTo(25,16);ctx.lineTo(0,9);}
  else {ctx.moveTo(0,-25);ctx.lineTo(17,18);ctx.lineTo(6,12);ctx.lineTo(0,24);ctx.lineTo(-6,12);ctx.lineTo(-17,18);}
  ctx.closePath();ctx.fill();ctx.fillStyle="#effcff";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
  if(shieldClock>0){ctx.strokeStyle="#ff67c8";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,31,0,Math.PI*2);ctx.stroke()}
  if(guardClock>0){ctx.strokeStyle="#a9c0d4";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.stroke()}
  ctx.restore();ctx.globalAlpha=1;ctx.shadowBlur=0}
function enemy(e){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.PI);ctx.shadowBlur=14;ctx.shadowColor=e.c;ctx.fillStyle=e.c;ctx.beginPath();ctx.moveTo(0,-e.r*1.2);ctx.lineTo(e.r,e.r*.7);ctx.lineTo(0,e.r*.35);ctx.lineTo(-e.r,e.r*.7);ctx.closePath();ctx.fill();ctx.restore();ctx.shadowBlur=0;const w=e.r*2.5;ctx.fillStyle="#19070b";ctx.fillRect(e.x-w/2,e.y-e.r-8,w,3);ctx.fillStyle="#ff405d";ctx.fillRect(e.x-w/2,e.y-e.r-8,w*Math.max(0,e.hp/e.max),3)}
function draw(){ctx.fillStyle="#02040a";ctx.fillRect(0,0,W,H);for(const s of stars){s.y+=s.v/60;if(s.y>H)s.y=0;ctx.fillStyle="rgba(255,255,255,.65)";ctx.fillRect(s.x,s.y,s.s,s.s)}for(const p of sparks){p.x+=p.vx/60;p.y+=p.vy/60;p.t-=.018;ctx.globalAlpha=Math.max(0,p.t/.35);ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;sparks=sparks.filter(p=>p.t>0);for(const b of bullets){ctx.fillStyle=weapon.color;ctx.shadowBlur=9;ctx.shadowColor=weapon.color;ctx.fillRect(b.x-2,b.y-8,4,13)}ctx.shadowBlur=0;for(const e of enemies)enemy(e);if(player)ship(player.x,player.y);if(killFlash>0){ctx.save();ctx.globalAlpha=Math.min(.34,killFlash*.8);ctx.strokeStyle=`hsl(${killHue} 100% 65%)`;ctx.lineWidth=6;ctx.shadowBlur=24;ctx.shadowColor=ctx.strokeStyle;ctx.strokeRect(3,3,W-6,H-6);ctx.restore()}const shell=$("game-container");shell.style.setProperty("--kill-hue",killHue);if(settings?.fps){let f=$("fps-runtime");if(!f){f=document.createElement("div");f.id="fps-runtime";f.style="position:absolute;right:14px;bottom:10px;z-index:16;color:#6effa8;font:700 10px Orbitron";shell.appendChild(f)}f.textContent="FPS: "+fpsValue;f.style.display="block"}else{const f=$("fps-runtime");if(f)f.style.display="none"}}
function loop(t){if(state!=="RUNNING")return;const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);draw();fpsFrames++;if(t-fpsStamp>=500){fpsValue=Math.round(fpsFrames*1000/(t-fpsStamp));fpsFrames=0;fpsStamp=t;const sf=$("side-fps");if(sf)sf.textContent=fpsValue}scheduleLoop()}
function hold(id,set){const b=$(id),on=e=>{e.preventDefault();set(true);musicOn()},off=e=>{e.preventDefault();set(false)};b.addEventListener("pointerdown",on);b.addEventListener("pointerup",off);b.addEventListener("pointercancel",off);b.addEventListener("pointerleave",off)}
hold("move-left-btn",v=>left=v);hold("move-right-btn",v=>right=v);hold("fire-btn",v=>fire=v);$("ability-btn").addEventListener("pointerdown",e=>{e.preventDefault();ability()});const pauseButton=$("pause-button");if(pauseButton)pauseButton.addEventListener("pointerdown",e=>{e.preventDefault();togglePause()});function togglePause(){if(state==="RUNNING"){state="PAUSED";pauseOverlay.style.display="grid";music.pause();left=false;right=false;fire=false}else if(state==="PAUSED"&&$("network-overlay")?.style.display!=="grid"){state="RUNNING";pauseOverlay.style.display="none";last=performance.now();scheduleLoop();musicOn()}}$("start-button").addEventListener("click",launch);$("resume-button").addEventListener("click",()=>{state="RUNNING";pauseOverlay.style.display="none";last=performance.now();fpsStamp=last;fpsFrames=0;scheduleLoop();musicOn()});$("exit-button").addEventListener("click",()=>location.href="lobby.html");$("settings-button").addEventListener("click",openSettings);$("save-exit-button").addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();saveMissionAndExit();},{capture:true});$("save-exit-button").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();});
addEventListener("keydown",e=>{if(e.code==="Escape"){if(state==="RUNNING"){state="PAUSED";pauseOverlay.style.display="grid";music.pause();left=false;right=false;fire=false}else if(state==="PAUSED"){state="RUNNING";pauseOverlay.style.display="none";last=performance.now();requestAnimationFrame(loop);musicOn()}else if(state==="OVER"){location.href="lobby.html"}return}if(e.code==="ArrowLeft"||e.code==="KeyA")left=true;if(e.code==="ArrowRight"||e.code==="KeyD")right=true;if(e.code==="Space")fire=true;if(e.code==="KeyE")ability();if(e.code==="Enter"&&state!=="RUNNING")launch();if(["ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault()});addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")left=false;if(e.code==="ArrowRight"||e.code==="KeyD")right=false;if(e.code==="Space")fire=false});

// Network safety: pause the mission whenever connectivity is lost.\nfunction setNetworkState(online){const overlay=$("network-overlay");if(!overlay)return;if(online){overlay.style.display="none";if(state==="NETWORK_PAUSED"){state="PAUSED";pauseOverlay.style.display="grid";}}else{if(state==="RUNNING"){state="NETWORK_PAUSED";music.pause();left=false;right=false;fire=false;pauseOverlay.style.display="none";}overlay.style.display="grid";}}\naddEventListener("offline",()=>setNetworkState(false));addEventListener("online",()=>setNetworkState(true));\n// GSM V2 settings + mission persistence
const settings={master:+localStorage.gsmMaster||1,music:+localStorage.gsmMusic||.28,bullet:+localStorage.gsmBullet||.7,damage:+localStorage.gsmDamage||1,ui:+localStorage.gsmUI||1,fps:localStorage.gsmFPS==="1",vsync:localStorage.gsmVsync!=="0"};
function applySettings(){const vs=$("side-vsync");if(vs){vs.textContent=settings.vsync?"ON":"OFF";vs.className=settings.vsync?"good":"warn"}music.volume=settings.master*settings.music;["bulletShoot","hullDamage","uiHover","uiClick"].forEach(id=>{const a=$(id);if(a)a.volume=settings.master*(id==="bulletShoot"?settings.bullet:id==="hullDamage"?settings.damage:settings.ui)});localStorage.gsmMaster=settings.master;localStorage.gsmMusic=settings.music;localStorage.gsmBullet=settings.bullet;localStorage.gsmDamage=settings.damage;localStorage.gsmUI=settings.ui;localStorage.gsmFPS=settings.fps?1:0;localStorage.gsmVsync=settings.vsync?1:0}
function openSettings(){pauseOverlay.style.zIndex=100;let p=$("settings-runtime");if(p){p.style.display="grid";return}p=document.createElement("div");p.id="settings-runtime";p.style="position:absolute;z-index:150;inset:0;display:grid;place-items:center;background:rgba(2,4,10,.94);backdrop-filter:blur(8px)";p.innerHTML='<div style="width:min(560px,88%);padding:28px;border:1px solid #00eaff55;background:#030813;box-shadow:0 0 70px #00eaff18"><h2 style="color:#00eaff;margin-top:0">SYSTEM SETTINGS</h2><div id="settings-fields"></div><button class="btn" id="settings-close">BACK</button></div>';$("game-container").appendChild(p);const fields=$("settings-fields");const add=(id,label,val,step)=>{fields.innerHTML+=`<div style="display:grid;grid-template-columns:1fr 150px 42px;gap:10px;align-items:center;margin:14px 0;font-size:9px;color:#a7b9cb"><span>${label}</span><input id="${id}" type="range" min="0" max="100" value="${Math.round(val*100)}" step="${step||1}"><output id="${id}v" style="color:#00eaff;text-align:right"></output></div>`};add("set-master","MASTER VOLUME",settings.master);add("set-music","GAMEPLAY MUSIC",settings.music);add("set-bullet","BULLET SOUND",settings.bullet);add("set-damage","HULL DAMAGE SOUND",settings.damage);add("set-ui","UI SOUNDS",settings.ui);fields.innerHTML+='<label style="display:flex;gap:12px;align-items:center;margin:14px 0;font-size:9px;color:#a7b9cb"><input id="set-fps" type="checkbox"> SHOW FPS</label><label style="display:flex;gap:12px;align-items:center;margin:14px 0;font-size:9px;color:#a7b9cb"><input id="set-vsync" type="checkbox"> FRAME SYNC</label>';const bind=(id,key)=>{const e=$(id),o=$(id+"v");o.textContent=Math.round(settings[key]*100)+"%";e.oninput=()=>{settings[key]=+e.value/100;o.textContent=e.value+"%";applySettings()}};bind("set-master","master");bind("set-music","music");bind("set-bullet","bullet");bind("set-damage","damage");bind("set-ui","ui");$("set-fps").checked=settings.fps;$("set-vsync").checked=settings.vsync;$("set-fps").onchange=e=>{settings.fps=e.target.checked;applySettings()};$("set-vsync").onchange=e=>{settings.vsync=e.target.checked;applySettings()};$("settings-close").onclick=()=>p.style.display="none"}
applySettings();async function saveMissionAndExit(){
  if(state!=="PAUSED"){toast("PAUSE THE MISSION FIRST");return;}
  pauseOverlay.style.display="grid";
  const btn=$("save-exit-button");
  if(btn.dataset.busy==="1") return;
  btn.dataset.busy="1"; btn.disabled=true; btn.textContent="SAVING...";
  const info=$("temp-message-container");
  info.classList.add("show"); info.textContent="UPLOADING MISSION // PLEASE WAIT";
  try{
    const payload=await gsmApi("save_mission",{score,xp,kills,ship_id:shipId});
    crix=Number(payload.crix??crix);
    info.textContent="MISSION SAVED // +"+Number(payload.earned_crix||0)+" CRIX";
    btn.textContent="SAVED ✓";
    await new Promise(r=>setTimeout(r,650));
    location.href="lobby.html";
  }catch(e){
    console.error("SAVE + EXIT:",e);
    info.textContent="SAVE FAILED // "+(e.message||"TRY AGAIN");
    btn.textContent="RETRY SAVE";btn.disabled=false;btn.dataset.busy="0";
    setTimeout(()=>info.classList.remove("show"),2600);
  }
}
(function(){
  const style=document.createElement("style");
  style.textContent=`
    html,body,#game-container,#game-container *{cursor:none!important}
    #gsm-cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:9999;pointer-events:none;transform:translate3d(-100px,-100px,0) rotate(45deg);filter:drop-shadow(0 0 7px rgba(255,70,85,.75));transition:transform .035s linear}
    #gsm-cursor:before{content:"";position:absolute;inset:2px;background:#ff4655;clip-path:polygon(0 0,100% 0,66% 35%,58% 100%,42% 100%,34% 48%,0 35%);box-shadow:0 0 10px #ff4655}
    #gsm-cursor:after{content:"";position:absolute;left:7px;top:7px;width:8px;height:8px;background:#fff;clip-path:polygon(0 0,100% 0,55% 100%);opacity:.95}
    .gsm-cursor-trail{position:fixed;width:5px;height:5px;border-radius:50%;background:#ff4655;pointer-events:none;z-index:9998;opacity:.5;box-shadow:0 0 9px #ff4655;animation:gsmCursorFade .34s ease-out forwards}
    .gsm-cursor-click{position:fixed;width:24px;height:24px;border:2px solid #fff;border-radius:50%;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);animation:gsmCursorClick .38s ease-out forwards}
    @keyframes gsmCursorFade{to{transform:scale(.1);opacity:0}}
    @keyframes gsmCursorClick{to{transform:translate(-50%,-50%) scale(2.1);opacity:0}}
  `;
  document.head.appendChild(style);
  document.body.classList.add("gsm-custom-cursor");
  const cursor=document.createElement("div");cursor.id="gsm-cursor";document.body.appendChild(cursor);
  let lastTrail=0;
  addEventListener("pointermove",e=>{
    cursor.style.transform=`translate3d(${e.clientX-3}px,${e.clientY-3}px,0) rotate(45deg)`;
    if(performance.now()-lastTrail>34){
      const t=document.createElement("i");t.className="gsm-cursor-trail";t.style.left=e.clientX+"px";t.style.top=e.clientY+"px";document.body.appendChild(t);setTimeout(()=>t.remove(),360);lastTrail=performance.now();
    }
  },{passive:true});
  addEventListener("pointerdown",e=>{
    const ring=document.createElement("i");ring.className="gsm-cursor-click";ring.style.left=e.clientX+"px";ring.style.top=e.clientY+"px";document.body.appendChild(ring);setTimeout(()=>ring.remove(),400);
  },{passive:true});
})();
(function(){const s=document.createElement("style");s.textContent="@keyframes gsmKillSpin{to{transform:translate(-50%,-20px) rotate(360deg)}}#game-container:after{display:none!important}";document.head.appendChild(s)})();
boot();setNetworkState(navigator.onLine);})();