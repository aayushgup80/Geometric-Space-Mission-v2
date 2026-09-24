(() => {
const URL="https://ccdllfswfhtgcolkugbz.supabase.co";
const KEY="sb_publishable_LPd-zxWUKM8c1p2P9sbbuA_EmhtqQr5";
const supabase=window.supabase.createClient(URL,KEY);
const $=id=>document.getElementById(id);
let user=null, profile=null, running=false, paused=false, last=0, score=0, level=1, lives=3, crix=0, mtokens=0;
let player, bullets=[], enemies=[], particles=[], stars=[], wave=0, spawnTimer=0, shotTimer=0, abilityTimer=0, boss=null;
const cfg={speed:330,damage:12,fireDelay:.22,abilityCooldown:10,ship:"default",weapon:"default_blaster",pilot:"none",reward:1};
const canvas=$("game"),ctx=canvas.getContext("2d");\nconst gameplayMusic=new Audio("sounds/gameplay_music.flac"); gameplayMusic.loop=true; gameplayMusic.volume=.28;\nfunction startGameplayMusic(){gameplayMusic.play().catch(()=>{});}\nwindow.addEventListener("pointerdown",startGameplayMusic,{once:true}); window.addEventListener("keydown",startGameplayMusic,{once:true});\n

function resize(){canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;if(player){player.y=canvas.height-75;player.x=Math.min(player.x,canvas.width-25)}} window.addEventListener("resize",resize);
function msg(el,t,c="#ff7180"){el.textContent=t;el.style.color=c}
function showOverlay(title,html,button="PLAY MISSION"){document.querySelector(".title").textContent=title;$("missionInfo").innerHTML=html;$("start").textContent=button;$("overlay").style.display="grid"}
function toast(t){$("toast").textContent=t;setTimeout(()=>{if($("toast").textContent===t)$("toast").textContent=""},1200)}
function setHud(){$("score").textContent=Math.floor(score).toLocaleString();$("level").textContent=level;$("lives").textContent=lives;$("crix").textContent=crix.toLocaleString();$("mtokens").textContent=mtokens.toLocaleString()}

async function ensureProfile(u,username){
 const {data,error}=await supabase.from("player_profiles").select("*").eq("id",u.id).maybeSingle();
 if(error)throw error;if(data)return data;
 const {data:created,error:e}=await supabase.from("player_profiles").insert({id:u.id,username:username||u.user_metadata?.username||u.email.split("@")[0],crix:10,m_tokens:0}).select().single();
 if(e)throw e;return created;
}
async function loadAccount(u,username=""){
 user=u;profile=await ensureProfile(u,username);crix=Number(profile.crix||0);mtokens=Number(profile.m_tokens||0);
 $("pilotName").textContent="PILOT // "+(profile.username||u.email);setHud();
 const {data:l}=await supabase.from("player_loadouts").select("*").eq("player_id",u.id).maybeSingle();
 if(l){cfg.ship=l.ship_id||"default";cfg.weapon=l.weapon_id||"default_blaster";cfg.pilot=l.pilot_id||"none"}
 const {data:items}=await supabase.from("game_items").select("*").eq("is_shop_visible",true);
 if(items?.length) window.GSM_CATALOG=items;
 applyCatalogLoadout();
 $("app").style.display="block";resize();renderMissionInfo();
}
async function saveCurrencies(){
 const {data,error}=await supabase.from("player_profiles").update({crix, m_tokens:mtokens, updated_at:new Date().toISOString()}).eq("id",user.id).select().single();
 if(!error)profile=data;setHud();
}
async function saveLoadout(loadout){
 await supabase.from("player_loadouts").upsert({player_id:user.id,...loadout,updated_at:new Date().toISOString()});
 Object.assign(cfg,loadout);
}
function applyCatalogLoadout(){
 const catalog=window.GSM_CATALOG||[];
 const w=catalog.find(x=>x.id===cfg.weapon), s=catalog.find(x=>x.id===cfg.ship), p=catalog.find(x=>x.id===cfg.pilot);
 if(w?.stats){cfg.damage=Number(w.stats.damage||cfg.damage);cfg.fireDelay=Number(w.stats.fireDelay||cfg.fireDelay)}
 if(s?.stats){cfg.speed=Number(s.stats.speed||cfg.speed);lives=Number(s.stats.lives||lives)}
 if(p?.stats?.ability) cfg.pilot=p.id;
 cfg.dual=Boolean(w?.stats?.dual);
}
function renderMissionInfo(){ $("missionInfo").innerHTML=`LEVEL <b>${level}</b><br>Difficulty <b>${(1+level*.12).toFixed(2)}x</b><br>Ship <b>${cfg.ship}</b> · Weapon <b>${cfg.weapon}</b> · Pilot <b>${cfg.pilot}</b><br><span style="color:#00eaff">Move: A/D or ←/→ · Fire: SPACE · Ability: E</span>`; }

function resetGame(){score=0;level=1;lives=3;wave=0;spawnTimer=0;shotTimer=0;abilityTimer=0;boss=null;bullets=[];enemies=[];particles=[];player={x:canvas.width/2,y:canvas.height-75,r:18};stars=Array.from({length:100},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,s:.5+Math.random()*2}));setHud()}
function startGame(){resetGame();running=true;paused=false;$("overlay").style.display="none";last=performance.now();requestAnimationFrame(loop)}
function endGame(){running=false;const reward=Math.max(1,Math.floor(score*.05*cfg.reward));crix+=reward;saveCurrencies();showOverlay("MISSION COMPLETE",`SCORE <b>${Math.floor(score).toLocaleString()}</b><br>CRIX EARNED <b style="color:#ffd166">+${reward}</b><br>LEVEL REACHED <b>${level}</b>`,"REPLAY MISSION")}

const keys={};window.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(e.code==="KeyP"&&running){paused=!paused;if(!paused){last=performance.now();requestAnimationFrame(loop)}}if(e.code==="KeyE"&&running)ability()});window.addEventListener("keyup",e=>keys[e.code]=false);
function shoot(){if(shotTimer>0||!running)return;shotTimer=cfg.fireDelay;bullets.push({x:player.x,y:player.y-22,v:620,r:4,d:cfg.damage});if(cfg.dual)bullets.push({x:player.x-12,y:player.y-15,v:620,r:3,d:cfg.damage*.7},{x:player.x+12,y:player.y-15,v:620,r:3,d:cfg.damage*.7})}
function ability(){if(abilityTimer>0||!running)return;abilityTimer=cfg.abilityCooldown;if(cfg.pilot==="pilot_luuk"){lives=Math.min(5,lives+1);toast("BATTLE MEDITATION")}else{for(const e of enemies)e.hp-=cfg.damage*3;toast("SPECIAL ABILITY")}
 setHud()}
function spawnEnemy(){const elite=Math.random()<Math.min(.2,level*.012);const r=10+Math.random()*13;const hp=(18+level*4)*(elite?3:1);enemies.push({x:r+Math.random()*(canvas.width-r*2),y:-r,r,hp,max:hp,v:70+level*7+(elite?35:0),elite})}
function spawnBoss(){boss={x:canvas.width/2,y:90,r:38,hp:550+level*120,max:550+level*120,v:75};$("boss").style.display="block";$("bossName").textContent="GEOMETRIC WARDEN // LV "+level}
function hit(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy<(a.r+b.r)**2}
function update(dt){
 if(keys.ArrowLeft||keys.KeyA)player.x-=cfg.speed*dt;if(keys.ArrowRight||keys.KeyD)player.x+=cfg.speed*dt;player.x=Math.max(22,Math.min(canvas.width-22,player.x));
 if(keys.Space)shoot();shotTimer=Math.max(0,shotTimer-dt);abilityTimer=Math.max(0,abilityTimer-dt);
 spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();spawnTimer=Math.max(.22,1.0-level*.025)}
 if(level>=5&&wave%12===0&&wave>0&&!boss)spawnBoss();
 for(const b of bullets)b.y-=b.v*dt;bullets=bullets.filter(b=>b.y>-30);
 for(const e of enemies){e.y+=e.v*dt;if(hit(e,player)){e.hp=0;lives--;if(lives<=0){endGame();return}}}
 for(const b of bullets)for(const e of enemies)if(e.hp>0&&hit(b,e)){e.hp-=b.d;b.y=-100;if(e.hp<=0){score+=e.elite?60:20;crix+=e.elite?2:1;}}
 enemies=enemies.filter(e=>e.hp>0&&e.y<canvas.height+60);wave++;
 if(boss){boss.x+=Math.sin(performance.now()/700)*boss.v*dt;boss.x=Math.max(60,Math.min(canvas.width-60,boss.x));if(Math.random()<dt*.04)bullets.push({x:boss.x,y:boss.y+30,v:-260,r:7,d:0});for(const b of bullets)if(b.d>0&&hit(b,boss)){boss.hp-=b.d;b.y=-100}$("bossBar").style.width=Math.max(0,boss.hp/boss.max*100)+"%";if(boss.hp<=0){score+=500;crix+=50;boss=null;$("boss").style.display="none";toast("WARDEN DESTROYED +50 CRIX")}}
 const next=Math.floor(score/500)+1;if(next>level){level=next;toast("LEVEL UP // "+level);cfg.damage+=2;cfg.speed+=6;cfg.fireDelay=Math.max(.08,cfg.fireDelay*.97);cfg.abilityCooldown=Math.max(5,cfg.abilityCooldown-.25)}
 setHud();
}
function draw(){
 ctx.fillStyle="#02040a";ctx.fillRect(0,0,canvas.width,canvas.height);for(const s of stars){s.y+=.4;if(s.y>canvas.height)s.y=0;ctx.fillStyle="#ffffff88";ctx.fillRect(s.x,s.y,s.s,s.s)}
 ctx.save();ctx.translate(player.x,player.y);ctx.fillStyle=cfg.ship==="frost"?"#00d9ff":cfg.ship==="viper"?"#76ff03":"#00eaff";ctx.shadowBlur=18;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(15,18);ctx.lineTo(0,11);ctx.lineTo(-15,18);ctx.closePath();ctx.fill();ctx.restore();
 for(const b of bullets){ctx.fillStyle=b.d? "#7dff70":"#ff4d67";ctx.shadowBlur=10;ctx.shadowColor=ctx.fillStyle;ctx.fillRect(b.x-2,b.y-8,4,12)}ctx.shadowBlur=0;
 for(const e of enemies){ctx.strokeStyle=e.elite?"#ffb000":"#ff405d";ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#ff405d33";ctx.fill()}
 if(boss){ctx.strokeStyle="#ff1744";ctx.lineWidth=5;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.r,0,Math.PI*2);ctx.stroke()}
}
function loop(t){if(!running)return;const dt=Math.min(.033,(t-last)/1000);last=t;if(!paused){update(dt);draw()}else{draw();ctx.fillStyle="#fff";ctx.font="900 26px Orbitron";ctx.textAlign="center";ctx.fillText("PAUSED",canvas.width/2,canvas.height/2)}if(running)requestAnimationFrame(loop)}

$("start").onclick=()=>{if(!running)startGame()};$("logout").onclick=async()=>{await supabase.auth.signOut();location.reload()};
for(const [id,code] of [["left","ArrowLeft"],["right","ArrowRight"]]){const b=$(id);b.onpointerdown=()=>keys[code]=true;b.onpointerup=()=>keys[code]=false;b.onpointerleave=()=>keys[code]=false}
$("fire").onpointerdown=()=>keys.Space=true;$("fire").onpointerup=()=>keys.Space=false;$("ability").onclick=ability;


(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.user){location.replace("login.html");return}try{await loadAccount(session.user)}catch(e){console.error(e);location.replace("login.html")}})();

})();
