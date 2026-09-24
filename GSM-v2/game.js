(() => {
"use strict";
const SUPABASE_URL="https://ccdllfswfhtgcolkugbz.supabase.co";
const SUPABASE_KEY="sb_publishable_LPd-zxWUKM8c1p2P9sbbuA_EmhtqQr5";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const canvas=$("game"),ctx=canvas.getContext("2d");
let user=null,profile=null,catalog=[];
let running=false,paused=false,last=0,score=0,xp=0,level=1,lives=3;
let crix=0,mtokens=0,player=null,bullets=[],enemies=[],particles=[],stars=[];
let spawnTimer=0,shotTimer=0,abilityTimer=0,collisionInvuln=0,boss=null;
let redeemedScore=0;

const cfg={speed:330,damage:12,fireDelay:.22,abilityCooldown:10,ship:"ship_default",weapon:"weapon_default_blaster",pilot:"none",dual:false};
const SHIPS=[
 {id:"ship_default",name:"GSM Scout",hp:100,damage:10,speed:95,score:15,collision:18,color:"#00eaff"},
 {id:"ship_frost",name:"Frost",hp:150,damage:16,speed:82,score:25,collision:24,color:"#55d9ff"},
 {id:"ship_viper",name:"Viper",hp:220,damage:24,speed:105,score:40,collision:32,color:"#7dff55"},
 {id:"ship_permafrost",name:"Permafrost",hp:330,damage:36,speed:70,score:65,collision:45,color:"#b58cff"},
 {id:"ship_volt",name:"Volt",hp:500,damage:55,speed:120,score:100,collision:65,color:"#ffb84d"}
];
const gameplayMusic=new Audio("sounds/gameplay_music.flac");gameplayMusic.loop=true;gameplayMusic.volume=.28;
function startMusic(){gameplayMusic.play().catch(()=>{})}
window.addEventListener("pointerdown",startMusic,{once:true});window.addEventListener("keydown",startMusic,{once:true});

const uiHover=$("uiHover"),uiClick=$("uiClick");
function sound(a){try{a.currentTime=0;a.play().catch(()=>{})}catch(e){}}
document.addEventListener("mouseover",e=>{if(e.target.closest("button,a"))sound(uiHover)});
document.addEventListener("click",e=>{if(e.target.closest("button,a")){sound(uiClick);startMusic()}});

function resize(){
 canvas.width=Math.max(320,canvas.clientWidth);canvas.height=Math.max(320,canvas.clientHeight);
 if(player){player.y=canvas.height-88;player.x=Math.max(25,Math.min(canvas.width-25,player.x))}
}
window.addEventListener("resize",resize);

async function ensureProfile(u){
 const {data,error}=await sb.from("player_profiles").select("*").eq("id",u.id).maybeSingle();
 if(error)throw error;if(data)return data;
 const username=u.user_metadata?.username||u.email.split("@")[0];
 const {data:created,error:e}=await sb.from("player_profiles").insert({id:u.id,username,crix:10,m_tokens:0}).select().single();
 if(e)throw e;return created;
}
async function loadAccount(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.user){location.replace("login.html");return false}
 user=session.user;profile=await ensureProfile(user);
 crix=Number(profile.crix||0);mtokens=Number(profile.m_tokens||0);
 const {data:l}=await sb.from("player_loadouts").select("*").eq("player_id",user.id).maybeSingle();
 if(l){cfg.ship=l.ship_id||cfg.ship;cfg.weapon=l.weapon_id||cfg.weapon;cfg.pilot=l.pilot_id||"none"}
 const {data:items}=await sb.from("game_items").select("*").eq("is_shop_visible",true);
 catalog=items||[];
 applyLoadout();
 $("pilotName").textContent="PILOT // "+(profile.username||user.email.split("@")[0]);
 setHud();resize();renderMissionInfo();return true;
}
function applyLoadout(){
 const w=catalog.find(x=>x.id===cfg.weapon),s=catalog.find(x=>x.id===cfg.ship);
 if(w?.stats){cfg.damage=Number(w.stats.damage||12);cfg.fireDelay=Number(w.stats.fireDelay||.22);cfg.dual=Boolean(w.stats.dual)}
 if(s?.stats)cfg.speed=Number(s.stats.speed||330);
}
function xpThreshold(lvl){return Math.floor(100*Math.pow(1.8,lvl-1))}
function totalXpForLevel(lvl){let total=0;for(let i=1;i<lvl;i++)total+=xpThreshold(i);return total}
function calculateLevel(){
 let l=1;
 while(xp>=totalXpForLevel(l+1)&&l<100)l++;
 return l;
}
function setHud(){
 $("score").textContent=Math.floor(score).toLocaleString();
 $("level").textContent=level;$("lives").textContent=lives;
 $("xp").textContent=xp.toLocaleString();
 $("nextXp").textContent=xpThreshold(level).toLocaleString();
 $("crix").textContent=Math.floor(crix).toLocaleString();
 $("mtokens").textContent=Math.floor(mtokens).toLocaleString();
 if(player)$("playerHealth").style.width=Math.max(0,player.hp/player.maxHp*100)+"%";
}
function renderMissionInfo(){
 const diff=(1+(level-1)*.14).toFixed(2);
 $("missionInfo").innerHTML="LEVEL <b>"+level+"</b> · DIFFICULTY <b>"+diff+"x</b><br>XP = SCORE ÷ 10 · Next level requires <b>"+xpThreshold(level)+" XP</b><br>Controls: <b>A/D or ◀/▶</b> move · <b>SPACE / FIRE</b> shoot · <b>E / ⚡</b> ability";
}
function toast(t){$("toast").textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>$("toast").textContent="",1100)}

function resetGame(){
 score=0;xp=0;level=1;lives=3;spawnTimer=.4;shotTimer=0;abilityTimer=0;collisionInvuln=0;
 bullets=[];enemies=[];particles=[];boss=null;redeemedScore=0;
 player={x:canvas.width/2,y:canvas.height-88,r:18,maxHp:100,hp:100};
 stars=Array.from({length:110},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,s:.5+Math.random()*2,v:20+Math.random()*50}));
 $("boss").style.display="none";setHud();renderMissionInfo();
}
function startGame(){resetGame();running=true;paused=false;$("overlay").style.display="none";last=performance.now();requestAnimationFrame(loop);startMusic()}
function missionComplete(){
 running=false;
 const redeem=Math.floor(score/10);
 $("title").textContent="MISSION COMPLETE";
 $("missionInfo").innerHTML="SCORE <b>"+Math.floor(score).toLocaleString()+"</b><br>XP GAINED <b>"+xp.toLocaleString()+"</b> · LEVEL <b>"+level+"</b><br>Available redemption: <b>"+redeem+" CRIX</b> (10 SCORE = 1 CRIX)";
 $("redeem").style.display=redeem>0?"inline-block":"none";
 $("redeem").disabled=redeem<=redeemedScore;
 $("start").textContent="LAUNCH MISSION";
 $("overlay").style.display="grid";
}
function redeem(){
 const available=Math.floor(score/10)-redeemedScore;
 if(available<=0)return;
 crix+=available;redeemedScore+=available;setHud();
 $("redeem").disabled=true;
 $("missionInfo").innerHTML="SCORE <b>"+Math.floor(score).toLocaleString()+"</b><br>REDEEMED <b style='color:#ffd166'>+"+available+" CRIX</b><br>New balance: <b>"+Math.floor(crix).toLocaleString()+" CRIX</b>";
 saveCurrencies();
 toast("SCORE REDEEMED // +"+available+" CRIX");
}
async function saveCurrencies(){
 // Currency writes are intentionally not performed from the browser because authenticated UPDATE is disabled by RLS/table privileges.
 // The earned balance is reflected in-session; a secure RPC/Edge Function should handle persistent rewards.
}
function damagePlayer(amount){
 if(collisionInvuln>0)return;
 player.hp-=amount;collisionInvuln=.65;
 if(player.hp<=0){lives--;player.hp=player.maxHp;lives<=0?missionComplete():toast("HULL BREACH // LIFE LOST")}
 setHud();
}
function spawnEnemy(){
 const weights=SHIPS.map((s,i)=>Math.max(1,i+1+level*.025));
 let r=Math.random()*weights.reduce((a,b)=>a+b,0),ship=SHIPS[0];
 for(let i=0;i<SHIPS.length;i++){r-=weights[i];if(r<=0){ship=SHIPS[i];break}}
 const diff=1+(level-1)*.14;
 const hp=ship.hp*diff*(1+Math.random()*.15);
 const scale=canvas.width<600?.72:1;
 enemies.push({ship,x:25+Math.random()*(canvas.width-50),y:-35,r:ship.id==="ship_volt"?24:16, hp,maxHp:hp, damage:ship.damage*diff, speed:ship.speed*(1+level*.015), score:ship.score, color:ship.color,scale});
}
function shoot(){
 if(!running||shotTimer>0)return;
 shotTimer=cfg.fireDelay;
 bullets.push({x:player.x,y:player.y-25,v:720,r:4,d:cfg.damage,player:true});
 if(cfg.dual){bullets.push({x:player.x-11,y:player.y-18,v:720,r:3,d:cfg.damage*.7,player:true},{x:player.x+11,y:player.y-18,v:720,r:3,d:cfg.damage*.7,player:true})}
}
function ability(){
 if(!running||abilityTimer>0)return;
 abilityTimer=cfg.abilityCooldown;
 for(const e of enemies)e.hp-=cfg.damage*2.5;
 toast("ABILITY // IMPACT PULSE");
}
function hit(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy<(a.r+b.r)**2}
function updateDifficulty(){
 const newLevel=calculateLevel();
 if(newLevel>level){
   level=newLevel;
   cfg.fireDelay=Math.max(.09,cfg.fireDelay*.985);
   cfg.damage+=Math.min(8,1+Math.floor(level/4));
   player.maxHp=Math.min(180,player.maxHp+5);player.hp=Math.min(player.maxHp,player.hp+20);
   toast("LEVEL UP // "+level);
   renderMissionInfo();
 }
}
function update(dt){
 const diff=1+(level-1)*.14;
 if(keys.left)player.x-=cfg.speed*dt;
 if(keys.right)player.x+=cfg.speed*dt;
 player.x=Math.max(24,Math.min(canvas.width-24,player.x));
 if(keys.fire)shoot();
 shotTimer=Math.max(0,shotTimer-dt);abilityTimer=Math.max(0,abilityTimer-dt);collisionInvuln=Math.max(0,collisionInvuln-dt);

 spawnTimer-=dt;
 if(spawnTimer<=0){spawnEnemy();spawnTimer=Math.max(.25,1.05/(1+level*.045))}

 for(const b of bullets)b.y-=b.v*dt;
 bullets=bullets.filter(b=>b.y>-40);

 for(const e of enemies){
   e.y+=e.speed*dt;
   if(hit(e,player)){damagePlayer(e.damage);e.hp=0;burst(e.x,e.y,e.color)}
 }
 for(const b of bullets){
   for(const e of enemies){
     if(e.hp>0&&hit(b,e)){e.hp-=b.d;b.y=-100;if(e.hp<=0){score+=e.score;burst(e.x,e.y,e.color);toast("+"+e.score+" SCORE")};break}
   }
 }
 enemies=enemies.filter(e=>e.hp>0&&e.y<canvas.height+60);
 xp=Math.floor(score/10);
 updateDifficulty();
 setHud();
}
function burst(x,y,color){for(let i=0;i<8;i++)particles.push({x,y,vx:(Math.random()-.5)*120,vy:(Math.random()-.5)*120,life:.35,color})}
function drawShip(x,y,r,color,playerShip=false){
 ctx.save();ctx.translate(x,y);
 if(!playerShip)ctx.rotate(Math.PI);
 ctx.fillStyle=color;ctx.shadowBlur=16;ctx.shadowColor=color;
 ctx.beginPath();ctx.moveTo(0,-r*1.25);ctx.lineTo(r*.8,r*.75);ctx.lineTo(0,r*.35);ctx.lineTo(-r*.8,r*.75);ctx.closePath();ctx.fill();
 ctx.fillStyle="#eaffff";ctx.globalAlpha=.75;ctx.fillRect(-2,-r*.35,4,r*.7);ctx.restore();ctx.globalAlpha=1;ctx.shadowBlur=0;
}
function draw(){
 ctx.fillStyle="#02040a";ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const s of stars){s.y+=s.v/60;if(s.y>canvas.height)s.y=0;ctx.fillStyle="#ffffff77";ctx.fillRect(s.x,s.y,s.s,s.s)}
 for(const p of particles){p.x+=p.vx/60;p.y+=p.vy/60;p.life-=.02;ctx.globalAlpha=Math.max(0,p.life/.35);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
 if(player&&collisionInvuln<=0||player&&Math.floor(collisionInvuln*12)%2===0)drawShip(player.x,player.y,player.r,"#00eaff",true);
 for(const b of bullets){ctx.fillStyle="#8cff70";ctx.shadowBlur=9;ctx.shadowColor="#8cff70";ctx.fillRect(b.x-2,b.y-9,4,14)}ctx.shadowBlur=0;
 for(const e of enemies){
   drawShip(e.x,e.y,e.r,e.color,false);
   const w=e.r*2.5,h=4,ratio=Math.max(0,e.hp/e.maxHp);
   ctx.fillStyle="#16070a";ctx.fillRect(e.x-w/2,e.y-e.r-9,w,h);
   ctx.fillStyle="#ff405d";ctx.fillRect(e.x-w/2,e.y-e.r-9,w*ratio,h);
 }
}
function loop(t){
 if(!running)return;
 const dt=Math.min(.033,(t-last)/1000);last=t;
 if(!paused)update(dt);
 draw();
 if(paused){ctx.fillStyle="#ffffff";ctx.font="900 24px Orbitron";ctx.textAlign="center";ctx.fillText("PAUSED",canvas.width/2,canvas.height/2)}
 requestAnimationFrame(loop);
}

const keys={left:false,right:false,fire:false};
window.addEventListener("keydown",e=>{
 if(e.code==="ArrowLeft"||e.code==="KeyA")keys.left=true;
 if(e.code==="ArrowRight"||e.code==="KeyD")keys.right=true;
 if(e.code==="Space")keys.fire=true;
 if(e.code==="KeyE")ability();
 if(e.code==="KeyP"&&running){paused=!paused;if(!paused)last=performance.now()}
 if(["ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();
});
window.addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")keys.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")keys.right=false;if(e.code==="Space")keys.fire=false});

function holdButton(id,key){
 const b=$(id);
 const on=e=>{e.preventDefault();keys[key]=true;startMusic()};
 const off=e=>{e.preventDefault();keys[key]=false};
 b.addEventListener("pointerdown",on);b.addEventListener("pointerup",off);b.addEventListener("pointercancel",off);b.addEventListener("pointerleave",off);
}
holdButton("left","left");holdButton("right","right");holdButton("fire","fire");
$("ability").addEventListener("pointerdown",e=>{e.preventDefault();ability()});
$("start").addEventListener("click",()=>startGame());
$("redeem").addEventListener("click",redeem);
$("logout").addEventListener("click",async()=>{await sb.auth.signOut();location.replace("login.html")});
$("profileBtn").addEventListener("click",()=>window.dispatchEvent(new CustomEvent("gsm-profile",{detail:{user,profile,crix,mtokens}})));

(async()=>{try{if(await loadAccount()){resize();draw()}}catch(e){console.error(e);location.replace("login.html")}})();
})();