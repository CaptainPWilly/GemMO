(()=>{
'use strict';
const W=8,H=8;
const {WORLD_NODES,SHOP_STOCK,WORLD_HEIGHT,WORLD_ROAD,WORLD_ROAD_BANDIT,WORLD_TREES,WORLD_ROCKS}=globalThis.GEMMO_CONTENT;
let worldState={region:'brackenreach',currentNode:'camp',clearedEncounters:[]},selectedWorldNode='camp',worldHits=[],worldCamera={zoom:1,panX:0,panY:10},worldPointers=new Map(),worldGesture=null,worldTravelAnim=null,worldTravelRoute=null,activeEncounter=null,currentShop=null;
function worldCleared(id){return worldState.clearedEncounters?.includes(id)}
function worldNodeVisible(node){return node.id!=='bandit-pass'||worldCleared('rat')||worldState.currentNode==='bandit-pass'}
function worldCanTravel(from,to){const target=WORLD_NODES[to];return from===to||!!(target&&WORLD_NODES[from]?.neighbors.includes(to)&&worldNodeVisible(target)&&(!target.requires||worldCleared(target.requires)))}
function worldPath(from,to){
 if(!WORLD_NODES[from]||!WORLD_NODES[to]||!worldNodeVisible(WORLD_NODES[to]))return null;
 if(from===to)return [from];
 const queue=[[from]],seen=new Set([from]);
 while(queue.length){
  const path=queue.shift(),node=path[path.length-1];
  for(const next of WORLD_NODES[node]?.neighbors||[]){
   if(seen.has(next)||!worldCanTravel(node,next))continue;
   const route=[...path,next];if(next===to)return route;seen.add(next);queue.push(route);
  }
 }
 return null;
}

const {TYPES,WEIGHTS,ICON,ITEMS,EQUIPMENT_SLOTS,GEAR}=globalThis.GEMMO_CONTENT;
const DEFAULT_EQUIPMENT={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
let equipment={...DEFAULT_EQUIPMENT},inventory=[],chosenGearSlot='chest';
let account=null,accountToken=null,accountSyncTimer=0,lastAccountSync='';let captchaConfig=null,captchaWidgetId=null,captchaToken='',captchaConfigPromise=null,authBusy=false;
function loadAccountToken(){
 let token=null;
 try{token=localStorage.getItem('gemmo.session')||sessionStorage.getItem('gemmo.session')}catch{}
 if(token){try{localStorage.setItem('gemmo.session',token);sessionStorage.removeItem('gemmo.session')}catch{}}
 return token;
}
function rememberAccountToken(token){
 accountToken=token||null;
 try{
  if(accountToken)localStorage.setItem('gemmo.session',accountToken);
  else localStorage.removeItem('gemmo.session');
  sessionStorage.removeItem('gemmo.session');
 }catch{}
}
accountToken=loadAccountToken();
let storedApiBase='';try{storedApiBase=localStorage.getItem('gemmo.apiBase')||''}catch{}const deprecatedApiBases=new Set(['https://gemmo-captainpwilly-api-20260925.onrender.com']);if(deprecatedApiBases.has(storedApiBase)){try{localStorage.removeItem('gemmo.apiBase')}catch{}storedApiBase=''}const localDevHost=['localhost','127.0.0.1'].includes(location.hostname),defaultApiBase=localDevHost?'http://127.0.0.1:8787':'https://gemmo.onrender.com';let apiBase=String(window.GEMMO_API||storedApiBase||defaultApiBase).replace(/\/+$/,'');
const gearById=id=>GEAR.find(g=>g.id===id);
const gearSlotById=id=>EQUIPMENT_SLOTS.find(s=>s.id===id);
function gearStats(loadout=equipment){
 return Object.values(loadout).reduce((out,id)=>{
  const g=gearById(id);if(!g)return out;out.hp+=g.hp||0;out.guard+=g.guard||0;
  for(const color of ['red','blue','green','yellow','purple'])out.caps[color]+=(g.caps?.[color]||0)+(g.allCap||0);
  return out;
 },{hp:0,guard:0,caps:{red:0,blue:0,green:0,yellow:0,purple:0}})
}
function gearBonusText(g){
 if(!g)return 'No bonus';const parts=[];if(g.hp)parts.push('+'+g.hp+' MAX HP');if(g.guard)parts.push('+'+g.guard+' START GUARD');
 for(const color of ['red','blue','green','yellow','purple'])if(g.caps?.[color])parts.push('+'+g.caps[color]+' '+color.toUpperCase()+' CAP');
 if(g.allCap)parts.push('+'+g.allCap+' ALL CAPS');return parts.join(' · ')||'No bonus';
}
function playerMaxHP(){return 18+gearStats().hp}
function canEquipGear(slot,id){
 const def=gearSlotById(slot),g=gearById(id);if(!def||!g||!inventory.includes(id)||def.type!==g.slot)return false;
 return !Object.entries(equipment).some(([other,equipped])=>other!==slot&&equipped===id);
}
function equipGear(slot,id){if(!canEquipGear(slot,id))return false;equipment[slot]=id;return true}
function unequipGear(slot){if(!gearSlotById(slot))return false;equipment[slot]=null;return true}
const DEFAULT_SACK=['dagger',null,null,null,null];
let sack=Array(5).fill(null),charges={red:0,blue:0,green:0,yellow:0,purple:0},screen='splash',chosenSlot=0,enemyTimer=0,motionOff=false;
let actionNumber=1,targetMode=null,pinColumn=-1,pinTurns=0,guardTurns=0,evadeTurns=0;
let buffs={dodge:0,poison:0,regen:0,focus:0,redwake:0,holdfast:0,aftergrowth:0,momentum:0},hintTimer=0,hintDelay=30000,swipeStart=null,suppressClickUntil=0;
function touchActivity(){clearTimeout(hintTimer);document.querySelectorAll('.hintCell').forEach(el=>el.classList.remove('hintCell'));if(hintDelay>0&&screen==='fight'&&!combatPaused&&playerTurn&&!busy&&!targetMode&&pHP>0&&eHP>0)hintTimer=setTimeout(showHint,hintDelay)}
function showHint(){if(hintDelay===0)return;if(screen!=='fight'||!playerTurn||busy||targetMode||pHP<=0||eHP<=0)return;const move=legalMoves()[0];if(move){move.forEach(p=>cellAt(p).classList.add('hintCell'));setLog('HINT: swap the two glowing tiles.')}else void reshuffleBoard()}
const itemById=id=>ITEMS.find(i=>i.id===id);
function sackIsValid(list=sack){if(!Array.isArray(list)||list.length!==5)return false;const equipped=list.filter(Boolean);return equipped.length>=1&&equipped.every(id=>itemById(id))&&new Set(equipped).size===equipped.length}
const ENEMY={
 red:{name:'BOLT',cap:7}, blue:{name:'EVADE',cap:7}, green:{name:'BANDAGE',cap:6}, yellow:{name:'RELOAD',cap:6}, purple:{name:'DEADEYE',cap:10}
};
const ENCOUNTERS={rat:{name:'RAT',maxHP:10},bandit:{name:'BANDIT',maxHP:24}};
function encounterSpec(){return ENCOUNTERS[activeEncounter]||ENCOUNTERS.bandit}
function enemyLabel(){return encounterSpec().name}
function enemyMaxHP(){return encounterSpec().maxHP}
let board=[],selected=null,busy=false,playerTurn=true,freeSwap=false,extraTurn=false,overdrive=false,enemyReload=false,encounterClearSaved=false,encounterSettling=false,activeMatchId=null,activeRewardBudget=null,activeAuthority=null,combatRng=null,combatTranscript=[],matchStartPromise=null,rewardsSettled=false,lossSettlementStarted=false,lastMatchError='',combatPaused=false;
let pHP=18,eHP=24,pGuard=0,eGuard=0,gold=0,xp=0;
let ec={red:0,blue:0,green:0,yellow:0,purple:0};
const $=id=>document.getElementById(id), boardEl=$('board'),logEl=$('log');
function makeCombatRng(seed){let a=Number(seed)>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}
function recordCombatAction(action){if(activeAuthority?.mode==='replay-v1')combatTranscript.push(action)}
function roll(){let total=WEIGHTS.reduce((a,b)=>a+b,0),r=1+Math.floor((combatRng?combatRng():Math.random())*total),a=0;for(let i=0;i<TYPES.length;i++){a+=WEIGHTS[i];if(r<=a)return TYPES[i]}return'red'}
function buildBoard(){board=[];for(let y=0;y<H;y++){let row=[];for(let x=0;x<W;x++){let k=roll(),tries=0;while(tries++<30&&((x>=2&&row[x-1]===k&&row[x-2]===k)||(y>=2&&board[y-1][x]===k&&board[y-2][x]===k)))k=roll();row.push(k)}board.push(row)}if(!legalMoves().length)return buildBoard();render()}
function swap(a,b){[board[a.y][a.x],board[b.y][b.x]]=[board[b.y][b.x],board[a.y][a.x]]}
function k(x,y){return x+','+y}
function findMatches(){
 const cells=new Map(),runs=[];
 function scan(line){
  for(const type of TYPES){
   let run=[];
   const flush=()=>{if(run.length>=3&&run.some(p=>board[p.y][p.x]===type)){
    runs.push({type,len:run.length,cells:run.slice()});
    for(const p of run){const key=k(p.x,p.y);if(!cells.has(key))cells.set(key,{...p,type:board[p.y][p.x]==='wild'?type:board[p.y][p.x]})}
   }run=[]};
   for(const p of line){const t=board[p.y][p.x];if(t===type||t==='wild')run.push(p);else flush()}flush();
  }
 }
 for(let y=0;y<H;y++)scan(Array.from({length:W},(_,x)=>({x,y})));
 for(let x=0;x<W;x++)scan(Array.from({length:H},(_,y)=>({x,y})));
 return cells.size?{cells:[...cells.values()],runs}:null
}
function reservoirCap(color){return sack.reduce((sum,id)=>sum+(itemById(id)?.color===color?itemById(id).cap:0),0)+gearStats().caps[color]}
function legalMoves(){let list=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a={x,y};for(const [dx,dy] of [[1,0],[0,1]]){let nx=x+dx,ny=y+dy;if(nx>=W||ny>=H)continue;let b={x:nx,y:ny};swap(a,b);if(findMatches())list.push([a,b]);swap(a,b)}}return list}
function damageEnemy(n){let blocked=Math.min(eGuard,n);eGuard-=blocked;eHP-=n-blocked;damageFlight('e',n-blocked,blocked)}
function damagePlayer(n){if(buffs.dodge)n=Math.ceil(n/2);let blocked=Math.min(pGuard,n);pGuard-=blocked;pHP-=n-blocked;damageFlight('p',n-blocked,blocked)}
function charge(obj,type,n,cap){obj[type]=Math.min(cap,obj[type]+n)}
function lowestReservoir(exclude){
 const order=['red','blue','green','yellow','purple'];let best=null,bestRatio=Infinity;
 for(const color of order){if(color===exclude)continue;const cap=reservoirCap(color);if(!cap||charges[color]>=cap)continue;const ratio=charges[color]/cap;if(ratio<bestRatio){best=color;bestRatio=ratio}}
 return best;
}
function applyColor(type,n,actor,cascade=0){let notes=[];if(actor==='player'){
 const colored=['red','blue','green','yellow','purple'].includes(type),mult=overdrive&&colored?2:1;
 if(colored){const cap=reservoirCap(type),before=charges[type];charges[type]=Math.min(cap,charges[type]+n*mult);if(cap)notes.push(type+' reservoir +'+(charges[type]-before)+' ('+charges[type]+'/'+cap+')')}
 if(type==='red'){damageEnemy(n*mult);notes.push('Strike '+n*mult);if(buffs.redwake){damageEnemy(2);notes.push('Redwake +2')}}
 if(type==='blue'){pGuard+=n*mult;guardTurns=2;notes.push('Guard +'+n*mult);if(buffs.holdfast){pGuard+=2;guardTurns=2;notes.push('Holdfast +2')}}
 if(type==='green'&&buffs.aftergrowth){const before=pHP;pHP=Math.min(playerMaxHP(),pHP+2);notes.push('Aftergrowth +'+(pHP-before)+' HP')}
 if(type==='yellow'&&buffs.momentum){const target=lowestReservoir('yellow');if(target){const before=charges[target],cap=reservoirCap(target);charges[target]=Math.min(cap,charges[target]+2);notes.push('Momentum: '+target+' +'+(charges[target]-before))}}
 if(mult===2){overdrive=false;notes.push('Overdrive ×2')}
 if(type==='gold'){const before=gold,cap=activeRewardBudget?.gold??Infinity;gold=Math.min(cap,gold+n);notes.push('Gold +'+(gold-before))}
 if(type==='xp'){const before=xp,cap=activeRewardBudget?.xp??Infinity;xp=Math.min(cap,xp+n);notes.push('XP +'+(xp-before))}
 }else{
 if(['red','blue','green','yellow','purple'].includes(type))charge(ec,type,n,ENEMY[type].cap);
 if(type==='red'){let raw=n+(enemyReload?2:0),dm=activeEncounter==='rat'?Math.max(1,Math.ceil(raw/2)):raw;enemyReload=false;damagePlayer(dm);notes.push('Hit '+dm)}
 if(type==='blue'){let v=activeEncounter==='rat'?Math.max(1,Math.ceil(n*.35)):Math.ceil(n*.75);eGuard+=v;evadeTurns=2;notes.push('Evade +'+v)}
 }
 if(type==='env'){damagePlayer(1);damageEnemy(1);notes.push('Rift: both -1')}
 if(cascade>0&&notes.length)notes.push('Cascade '+cascade);
 if(notes.length)setLog((actor==='player'?'You':enemyLabel())+': '+notes.join(' • '));
}
function enemyUseActive(){
 if(activeEncounter==='rat')return false;
 if(ec.purple>=ENEMY.purple.cap){ec.purple=0;damagePlayer(6);announceAbility(enemyLabel(),'DEADEYE','6 damage.');afterAction('enemy');checkEnd();return true}
 if(ec.green>=ENEMY.green.cap&&eHP<=18){ec.green=0;eHP=Math.min(enemyMaxHP(),eHP+5);announceAbility(enemyLabel(),'BANDAGE','+5 HP.');afterAction('enemy');return true}
 if(ec.red>=ENEMY.red.cap){ec.red=0;damagePlayer(5);announceAbility(enemyLabel(),'QUICK SHOT','5 damage.');afterAction('enemy');checkEnd();return true}
 if(ec.blue>=ENEMY.blue.cap&&eGuard<=2){ec.blue=0;eGuard+=6;evadeTurns=2;announceAbility(enemyLabel(),'SIDESTEP','+6 Evade.');afterAction('enemy');return true}
 if(ec.yellow>=ENEMY.yellow.cap){ec.yellow=0;enemyReload=true;announceAbility(enemyLabel(),'RELOAD','next Bolt +2.');afterAction('enemy');return true}
 return false
}

const reducedMotion=()=>motionOff||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let effectOrigin=null,damageAnimations=[];
function cellAt(p){return boardEl.children[p.y*W+p.x]}
function center(el){const r=el.getBoundingClientRect(),a=$('fxLayer').getBoundingClientRect();return {x:r.left+r.width/2-a.left,y:r.top+r.height/2-a.top}}
const MOTION={swap:170,pop:190,flight:340,settle:440};
const shownHP={p:18,e:24},pendingHP={p:0,e:0};
function syncHealth(side){const hp=shownHP[side],max=side==='p'?playerMaxHP():enemyMaxHP();$(side+'fill').style.transform='scaleX('+Math.max(0,hp)/max+')';$(side+'health').setAttribute('aria-valuenow',Math.max(0,hp));$(side+'health').setAttribute('aria-valuemax',max);$(side+'stats').textContent=(side==='p'?Math.max(0,hp)+'/'+max:Math.max(0,hp))+' HP · '+(side==='p'?pGuard+' GUARD':eGuard+' EVADE')}
function animate(el,frames,options){
 if(reducedMotion())return Promise.resolve();
 const animation=el.animate(frames,options);
 return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);animation.cancel();resolve()};const timer=setTimeout(finish,(options.delay||0)+options.duration+100);animation.finished.then(finish,finish)});
}
function burst(origin,color,count=7){
 if(reducedMotion())return;
 for(let i=0;i<count;i++){const p=document.createElement('i'),angle=i/count*Math.PI*2,dist=18+Math.random()*23;p.className='shard';p.style.cssText='left:'+origin.x+'px;top:'+origin.y+'px;background:'+color;
 $('fxLayer').appendChild(p);animate(p,[{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:'translate('+Math.cos(angle)*dist+'px,'+Math.sin(angle)*dist+'px) rotate(160deg) scale(.1)',opacity:0}],{duration:300+Math.random()*100,easing:'cubic-bezier(.12,.7,.25,1)'}).then(()=>p.remove())}
}
async function popCells(cells){
 const points=cells.map(p=>({el:cellAt(p).firstElementChild,origin:center(cellAt(p)),color:{red:'#ff7c80',blue:'#87bdff',green:'#9affba',yellow:'#ffe39b',purple:'#d5acff',gold:'#ffe39b',xp:'#acfbff',env:'#ccdfbc',wild:'#fff'}[board[p.y][p.x]]}));
 await Promise.all(points.map(async({el,origin,color},i)=>{burst(origin,color,Math.min(7,Math.floor(120/points.length)));await animate(el,[{transform:'rotate(45deg) scale(1)',opacity:1},{transform:'rotate(45deg) scale(.82)',opacity:1,offset:.2},{transform:'rotate(65deg) scale(1.28)',opacity:.9,offset:.5},{transform:'rotate(85deg) scale(.15)',opacity:0}],{duration:MOTION.pop,delay:i%3*12,easing:'ease-out'});el.style.opacity='0'}))
}
function damageFlight(side,amount,blocked){
 const destination=center($(side+'health')),origin=effectOrigin||center(boardEl),targetHP=side==='p'?pHP:eHP;pendingHP[side]++;
 const work=(async()=>{
 const dx=destination.x-origin.x,dy=destination.y-origin.y,curve=(side==='p'?-1:1)*Math.min(80,Math.abs(dy)*.3);
 const path=Array.from({length:15},(_,i)=>{const t=i/14;return {transform:'translate3d('+(dx*t+curve*4*t*(1-t)-6)+'px,'+(dy*t-6)+'px,0) rotate('+(t*270)+'deg) scale('+(1-.4*t)+')',opacity:t<.1?t*10:1,offset:t}});
 const trails=Array.from({length:reducedMotion()?0:4},(_,i)=>{const dot=document.createElement('span');dot.className='damageSpark';dot.style.left=origin.x+'px';dot.style.top=origin.y+'px';dot.style.opacity=1-i*.2;$('fxLayer').appendChild(dot);return animate(dot,path,{duration:MOTION.flight,delay:i*18,easing:'cubic-bezier(.4,0,.75,.4)'}).then(()=>dot.remove())});
 await Promise.all(trails);shownHP[side]=Math.max(0,targetHP);pendingHP[side]--;syncHealth(side);burst(destination,'#ffe5a0',10);
 const label=document.createElement('span');label.className='damageNumber';label.textContent=amount?'−'+amount:'BLOCK';label.style.left=destination.x+'px';label.style.top=destination.y+'px';$('fxLayer').appendChild(label);
 void animate($(side+'health'),[{transform:'translateX(0)'},{transform:'translateX(-3px)',offset:.2},{transform:'translateX(2px)',offset:.45},{transform:'translateX(0)'}],{duration:180});
 void animate(label,[{transform:'translate(-50%,0) scale(.75)',opacity:0},{transform:'translate(-50%,-8px) scale(1.15)',opacity:1,offset:.18},{transform:'translate(-50%,-28px) scale(1)',opacity:0}],{duration:540,easing:'ease-out'}).then(()=>label.remove());
 })();damageAnimations.push(work);
}
async function swapMotion(a,b,reverse=false,startProgress=0){
 const ea=cellAt(a).firstElementChild,eb=cellAt(b).firstElementChild;if(!ea||!eb)return;
 const ra=cellAt(a).getBoundingClientRect(),rb=cellAt(b).getBoundingClientRect(),dx=rb.left-ra.left,dy=rb.top-ra.top;
 const base=el=>el.classList.contains('gold')?'':' rotate(45deg)';
 ea.classList.add('movingGem');eb.classList.add('movingGem');
 const frames=(el,x,y)=>reverse?
  [{transform:'translate3d('+x+'px,'+y+'px,0)'+base(el),filter:'brightness(1.35) drop-shadow(0 0 8px #fff1b5)'},{transform:'translate3d(0,0,0)'+base(el),filter:'brightness(1)'}]:
  [{transform:'translate3d('+(x*startProgress)+'px,'+(y*startProgress)+'px,0)'+base(el),filter:'brightness(1.45) drop-shadow(0 0 9px #fff1b5)'},{transform:'translate3d('+x+'px,'+y+'px,0)'+base(el),filter:'brightness(1.25) drop-shadow(0 0 5px #ffe3a0)'}];
 try{await Promise.all([[ea,dx,dy],[eb,-dx,-dy]].map(([el,x,y])=>animate(el,frames(el,x,y),{duration:Math.max(80,MOTION.swap*(reverse?1:1-startProgress*.55)),easing:'cubic-bezier(.18,.82,.22,1)'})))}finally{ea.classList.remove('movingGem');eb.classList.remove('movingGem')}
}
async function fallColumns(){
 const falling=[];for(let x=0;x<W;x++){if(x===pinColumn&&pinTurns>0){for(let y=0;y<H;y++)if(!board[y][x])board[y][x]=roll();continue}const kept=[];for(let y=H-1;y>=0;y--)if(board[y][x])kept.push({type:board[y][x],from:y});
 const missing=H-kept.length;for(let y=H-1,i=0;y>=0;y--,i++){const entry=kept[i];board[y][x]=entry?entry.type:roll();const from=entry?entry.from:y-missing;if(from!==y)falling.push({x,y,from})}}
 render();const step=cellAt({x:0,y:1}).getBoundingClientRect().top-cellAt({x:0,y:0}).getBoundingClientRect().top;
 await Promise.all(falling.map(p=>animate(cellAt(p).firstElementChild,[{transform:'translate3d(0,'+((p.from-p.y)*step)+'px,0) rotate(45deg)',opacity:p.from<0?0:1},{transform:'translate3d(0,3px,0) rotate(45deg) scale(1.04,.96)',opacity:1,offset:.78},{transform:'translate3d(0,-1px,0) rotate(45deg)',opacity:1,offset:.9},{transform:'translate3d(0,0,0) rotate(45deg)',opacity:1}],{duration:280+Math.sqrt(p.y-p.from)*55,delay:p.x*9,easing:'cubic-bezier(.33,0,.67,1)'})));
 if(!findMatches()&&!legalMoves().length)await reshuffleBoard();
}

async function resolve(matches,actor,target,cascade=0){busy=true;let counts={};for(const p of matches.cells){let type=p.type||board[p.y][p.x];counts[type]=(counts[type]||0)+1}let makeWild=null,match4=false;for(const run of matches.runs){if(run.len>=4)match4=true;if(run.len>=5&&!makeWild){makeWild=run.cells.find(p=>target&&p.x===target.x&&p.y===target.y)||run.cells[Math.floor(run.cells.length/2)]}}
 render();const wildCount=matches.cells.filter(p=>board[p.y][p.x]==='wild').length;if(wildCount)setLog(wildCount+' Wild'+(wildCount===1?' substitutes':'s substitute')+' in this match. Only matched tiles are removed.');await popCells(matches.cells);
 for(const [type,n] of Object.entries(counts)){effectOrigin=center(cellAt(matches.cells.find(p=>(p.type||board[p.y][p.x])===type)));applyColor(type,n,actor,cascade)}effectOrigin=null;
 for(const p of matches.cells)board[p.y][p.x]='';if(makeWild){board[makeWild.y][makeWild.x]='wild';setLog('Five-match: a Wild was forged. Wilds substitute for any tile type in a line of 3+.')}if(match4&&actor==='player'){extraTurn=true;setLog('Four-or-more match: you earn an extra turn.')}
 await fallColumns();await Promise.all(damageAnimations.splice(0));checkEnd();if(pHP<=0||eHP<=0){busy=false;return}let next=findMatches();if(next){busy=false;return resolve(next,actor,null,cascade+1)}busy=false;afterAction(actor)}
async function trySwap(a,b,actor,force=false,startProgress=0){
 if(busy)return false;busy=true;
 if(actor==='player')recordCombatAction({t:'swap',ax:a.x,ay:a.y,bx:b.x,by:b.y});

 await swapMotion(a,b,false,startProgress);swap(a,b);

 const m=findMatches();
 if(!m&&!force){swap(a,b);await swapMotion(a,b,true);setLog('That swap makes no match.');busy=false;render();return false}
 if(m)await resolve(m,actor,b,0);else{busy=false;setLog('Quickstep repositions the board.');afterAction(actor);render()}return true
}
function collapse(){for(let x=0;x<W;x++){let kept=[];for(let y=H-1;y>=0;y--)if(board[y][x])kept.push(board[y][x]);let i=0;for(let y=H-1;y>=0;y--)board[y][x]=i<kept.length?kept[i++]:roll()}if(!legalMoves().length)buildBoard()}
async function reshuffleBoard(){
 const wasBusy=busy;busy=true;clearTimeout(hintTimer);setLog('NO MOVES — sweeping the board and dealing fresh gems. HP and reservoirs stay.','system');
 await Promise.all(Array.from(boardEl.children).map((el,i)=>animate(el,[{transform:'translateX(0)',opacity:1},{transform:'translateX(50px)',opacity:0}],{duration:260,delay:Math.floor(i/8)*25,easing:'ease-in'})));
 buildBoard();await Promise.all(Array.from(boardEl.children).map((el,i)=>animate(el,[{transform:'translateY(-25px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:280,delay:(i%8)*20,easing:'ease-out'})));busy=wasBusy;render();touchActivity();
}
function afterAction(actor){
 actionNumber++;
 if(pHP<=0||eHP<=0){playerTurn=true;render();checkEnd();return}
 if(actor==='enemy'){
  if(buffs.poison){damageEnemy(2);setLog('VENOM: Enemy takes 2 damage.');buffs.poison--}
  if(buffs.regen){pHP=Math.min(playerMaxHP(),pHP+2);setLog('RESTORING VERSE: heal 2 HP.');buffs.regen--}
  if(buffs.focus){for(const color of Object.keys(charges))charges[color]=Math.min(reservoirCap(color),charges[color]+1);setLog('RESONANCE: +1 to each equipped reservoir.');buffs.focus--}
  if(buffs.dodge)buffs.dodge--;
  if(pinTurns&&!--pinTurns){pinColumn=-1;setLog('EARTHBIND ends: columns fall normally again.')}
  if(guardTurns&&!--guardTurns){pGuard=0;setLog('Your Guard expires.')}
 }else if(evadeTurns&&!--evadeTurns){eGuard=0;setLog('Enemy Evade expires.')}
 if(actor==='player'){
  for(const key of ['redwake','holdfast','aftergrowth','momentum'])if(buffs[key])buffs[key]--;
  if(extraTurn){extraTurn=false;playerTurn=true;setLog('Extra turn: you move again.')}else{playerTurn=false;enemyTimer=setTimeout(enemyMove,520)}
 }else playerTurn=true;
 render();checkEnd();touchActivity();
}
async function applyTarget(p){
 const mode=targetMode;targetMode=null;busy=true;recordCombatAction({t:'target',x:p.x,y:p.y});
 if(mode==='pin'){pinColumn=p.x;pinTurns=1;setLog('EARTHBIND: column '+(p.x+1)+' is pinned through the next enemy action.');busy=false;afterAction('player');return}
 if(mode==='paint')board[p.y][p.x]='red';
 if(mode==='wildcraft')board[p.y][p.x]='wild';
 if(mode==='rotate')board[p.y].unshift(board[p.y].pop());
 render();const m=findMatches();if(m)await resolve(m,'player',p);else{busy=false;afterAction('player')}
}
function activate(index){
 if(screen!=='fight'||!playerTurn||busy||freeSwap||targetMode||pHP<=0||eHP<=0)return;
 const spec=itemById(sack[index]);if(!spec||charges[spec.color]<spec.cap){if(spec)setLog(spec.name+' needs '+(spec.cap-charges[spec.color])+' more charge.');return}
 if(spec.kind==='boost'&&overdrive){setLog('Overdrive is already primed. Make a colored match first.');return}
 recordCombatAction({t:'ability',slot:index});touchActivity();charges[spec.color]-=spec.cap;const guardBefore=pGuard;effectOrigin=center($('slots').children[index]);
 if(spec.kind==='damage')damageEnemy(spec.power);
 if(spec.kind==='guard')pGuard+=spec.power;
 if(spec.kind==='heal')pHP=Math.min(playerMaxHP(),pHP+spec.power);
 if(spec.kind==='hybrid'){damageEnemy(3);pGuard+=3}
 if(spec.kind==='shelter'){pGuard+=3;pHP=Math.min(playerMaxHP(),pHP+2)}
 if(spec.kind==='leech'){pHP=Math.min(playerMaxHP(),pHP+2);damageEnemy(3)}
 if(spec.kind==='renew'){pHP=Math.min(playerMaxHP(),pHP+4);pGuard+=4}
 if(spec.kind==='boost')overdrive=true;
 if(spec.kind==='dodge')buffs.dodge=2;
 if(spec.kind==='poison')buffs.poison=2;
 if(spec.kind==='regen')buffs.regen=3;
 if(spec.kind==='focus')buffs.focus=2;
 if(spec.kind==='red_attune')buffs.redwake=4;
 if(spec.kind==='blue_attune')buffs.holdfast=4;
 if(spec.kind==='green_attune')buffs.aftergrowth=4;
 if(spec.kind==='yellow_attune')buffs.momentum=4;
 if(spec.kind==='haste')extraTurn=true;
 if(spec.kind==='siphon'){damageEnemy(2);const color=Object.keys(ec).sort((a,b)=>ec[b]-ec[a])[0],amount=Math.min(3,ec[color]);ec[color]-=amount;charges.purple=Math.min(reservoirCap('purple'),charges.purple+amount)}
 if(pGuard>guardBefore)guardTurns=2;
 if(['pin','paint','wildcraft','rotate'].includes(spec.kind))targetMode=spec.kind;

 effectOrigin=null;announceAbility('You',spec.name,spec.desc+' Spent '+spec.cap+' '+spec.color+' charge.');
 if(targetMode){selected=null;setLog('Choose a '+(targetMode==='rotate'?'row':targetMode==='pin'?'column':'tile')+' on the board.');render();return}
 if(spec.kind==='swap'){freeSwap=true;selected=null;render()}else afterAction('player');
 checkEnd();render();
}
async function enemyMove(){if(screen!=='fight'||combatPaused||playerTurn||busy||pHP<=0||eHP<=0)return;if(enemyUseActive())return;let moves=legalMoves();if(!moves.length){await reshuffleBoard();moves=legalMoves();if(!moves.length){afterAction('enemy');return}}let best=moves[0],bestScore=-Infinity;for(const mv of moves){swap(mv[0],mv[1]);let m=findMatches(),score=0;if(m)for(const p of m.cells){let t=p.type||board[p.y][p.x];score+=({red:4,purple:3,green:eHP<18?3:1,yellow:2,blue:2,gold:0,xp:0,env:1}[t]||0)}swap(mv[0],mv[1]);if(score>bestScore){bestScore=score;best=mv}}trySwap(best[0],best[1],'enemy')}
function tapCell(x,y){touchActivity();if(screen!=='fight'||!playerTurn||busy||pHP<=0||eHP<=0)return;let p={x,y};if(targetMode){void applyTarget(p);return}if(!selected){selected=p;render();return}let dist=Math.abs(selected.x-x)+Math.abs(selected.y-y);if(dist===1){let a=selected;selected=null;if(freeSwap){freeSwap=false;trySwap(a,p,'player',true)}else trySwap(a,p,'player',false)}else{selected=p;render()}}
async function startMatchTicket(){
 if(!accountToken||!activeEncounter)return null;
 try{
  const data=await accountRequest('/v1/matches/start',{method:'POST',body:{encounterId:activeEncounter}});
  activeMatchId=data.match?.matchId||null;activeRewardBudget=data.match?.rewardBudget||null;activeAuthority=data.match?.authority||null;combatRng=activeAuthority?.mode==='replay-v1'?makeCombatRng(activeAuthority.seed):null;
  if(activeRewardBudget){gold=Math.min(gold,activeRewardBudget.gold);xp=Math.min(xp,activeRewardBudget.xp);render()}lastMatchError='';return activeMatchId;
 }catch(error){activeMatchId=null;lastMatchError=error.message||'match_start_failed';return null}
}
async function ensureMatchTicket(){
 if(activeMatchId)return activeMatchId;
 if(matchStartPromise)await matchStartPromise;
 if(activeMatchId)return activeMatchId;
 matchStartPromise=startMatchTicket();
 await matchStartPromise;
 return activeMatchId;
}
function saveErrorText(error){
 const code=error?.message||lastMatchError||'save_failed';
 const map={
  account_server_unreachable:'SERVER UNREACHABLE',
  unauthorized:'SESSION EXPIRED',
  encounter_not_here:'ENCOUNTER STATE MISMATCH',
  match_not_found:'MATCH NOT FOUND',
  invalid_match_result:'INVALID MATCH RESULT',
  invalid_combat_proof:'INVALID COMBAT PROOF',
  combat_proof_failed:'VICTORY NOT VERIFIED',
  server_error:'SERVER ERROR',
  rate_limited:'SERVER BUSY'
 };
 return map[code]||code.replaceAll('_',' ').toUpperCase();
}
async function settleVictory(){
 if(rewardsSettled||encounterSettling||!accountToken)return;
 encounterSettling=true;$('resultMenu').disabled=true;$('resultRetry').hidden=true;$('resultText').textContent='SAVING…';
 try{
  if(!await ensureMatchTicket())throw Object.assign(new Error(lastMatchError||'match_start_failed'),{status:0});
  const unlockedRat=activeEncounter==='rat'&&!worldCleared('rat');
  let data;
  const resultBody={matchId:activeMatchId,won:true,gold,xp};if(activeAuthority?.mode==='replay-v1')resultBody.transcript=combatTranscript;
  try{data=await accountRequest('/v1/matches/settle',{method:'POST',body:resultBody})}
  catch(error){
   if(error.status===0||error.status>=500){await new Promise(resolve=>setTimeout(resolve,650));data=await accountRequest('/v1/matches/settle',{method:'POST',body:resultBody})}
   else throw error;
  }
  applyAccount(data.account);rewardsSettled=true;encounterClearSaved=activeEncounter!=='rat'||worldCleared('rat');
  const awardedGold=data.settlement?.gold??gold,awardedXp=data.settlement?.xp??xp;
  $('resultText').textContent='+'+awardedGold+' GOLD · +'+awardedXp+' XP'+(unlockedRat&&worldCleared('rat')?' · BANDIT PATH UNLOCKED':'');
 }catch(error){$('resultText').textContent='SAVE FAILED · '+saveErrorText(error);$('resultRetry').hidden=false}
 finally{encounterSettling=false;$('resultMenu').disabled=false}
}
async function settleDefeat(){
 if(lossSettlementStarted||!accountToken)return;
 lossSettlementStarted=true;
 try{
  if(!await ensureMatchTicket())return;
  await accountRequest('/v1/matches/settle',{method:'POST',body:{matchId:activeMatchId,won:false,gold:0,xp:0}});
 }catch{}
}
function checkEnd(){if(pHP<=0||eHP<=0)clearTimeout(hintTimer);if(screen!=='fight')return;if(eHP<=0||pHP<=0){eHP=Math.max(0,eHP);pHP=Math.max(0,pHP);const won=eHP<=0;$('resultTitle').textContent=won?'VICTORY':'DEFEAT';$('resultText').textContent=won?'SAVING…':'';$('result').classList.add('show');if(won)void settleVictory();else void settleDefeat();render()}}
let combatHistory=[],logSequence=0;
function setLog(message,kind='event'){
 logEl.textContent=message;
 combatHistory.push({message,kind,seq:++logSequence});if(combatHistory.length>100)combatHistory.shift();
 const entry=document.createElement('div');entry.className='historyEntry '+kind;entry.textContent=logSequence+' · '+message;$('historyEntries').appendChild(entry);
 while($('historyEntries').children.length>100)$('historyEntries').firstElementChild.remove();
 $('historyEntries').scrollTop=$('historyEntries').scrollHeight;
}
function announceAbility(actor,name,description){
 const enemy=actor!=='You';$('abilityBanner').hidden=false;$('abilityBanner').className='abilityBanner '+(enemy?'enemyAbility':'');
 $('abilityActor').textContent=enemy?'LAST ABILITY · '+actor:'LAST ABILITY · YOU';$('abilityName').textContent=name.toUpperCase();$('abilityDetail').textContent=description;
 setLog(actor+' uses '+name.toUpperCase()+' — '+description,'ability');
 void animate($('abilityBanner'),[{transform:'translateY(6px) scale(.97)',opacity:.4},{transform:'translateY(0) scale(1)',opacity:1}],{duration:220,easing:'ease-out'});
}
function flash(){let f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go')}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function render(){renderStatuses();boardEl.innerHTML='';for(let y=0;y<H;y++)for(let x=0;x<W;x++){let type=board[y]?.[x]||'',c=document.createElement('button');c.className='cell'+(selected&&selected.x===x&&selected.y===y?' sel':'')+(freeSwap&&selected&&Math.abs(selected.x-x)+Math.abs(selected.y-y)===1?' freeTarget':'');c.setAttribute('aria-label',(type||'Empty')+' gem, row '+(y+1)+', column '+(x+1));c.innerHTML=type?'<span class="gem '+type+'" data-i="'+ICON[type]+'"></span>':'';c.addEventListener('click',()=>{if(Date.now()>suppressClickUntil)tapCell(x,y)});if(x===pinColumn&&pinTurns)c.classList.add('pinnedCell');boardEl.appendChild(c)}$('pstats').textContent=pHP+' HP · '+pGuard+' GUARD';$('enemyName').textContent=enemyLabel();$('estats').textContent=eHP+' HP · '+eGuard+' EVADE';$('gold').textContent='GOLD '+gold+(activeRewardBudget?'/'+activeRewardBudget.gold:'');$('xp').textContent='XP '+xp+(activeRewardBudget?'/'+activeRewardBudget.xp:'');$('turnText').textContent=freeSwap?'QUICKSTEP':(playerTurn?'YOUR MOVE':enemyLabel()+' MOVES');$('turnText').style.color=freeSwap?'var(--y)':(playerTurn?'var(--g)':'var(--r)');for(const [side,hp] of [['p',pHP],['e',eHP]]){if(!pendingHP[side])shownHP[side]=hp;syncHealth(side)}$('leaveFight').disabled=busy||!playerTurn||pendingHP.p>0||pendingHP.e>0;renderSlots()}
function renderSlots(){
 $('reservoirs').innerHTML=['red','blue','green','yellow','purple'].map(color=>'<span style="--c:var(--'+color[0]+')">'+color.toUpperCase()+' <b>'+charges[color]+'/'+reservoirCap(color)+'</b></span>').join('');
 $('slots').innerHTML=sack.map((id,i)=>{const v=itemById(id);if(!v)return '<button class="slot" disabled data-slot="'+i+'" style="--c:#5f5a4e"><div class="orb"></div><div class="slotName">Empty</div><div class="effect">Earn a gem</div><div class="charge">—</div></button>';const ready=charges[v.color]>=v.cap;return '<button class="slot '+(ready?'ready':'')+'" data-slot="'+i+'" style="--c:var(--'+v.color[0]+')" title="'+v.desc+'"><div class="orb"></div><div class="slotName">'+v.item+'</div><div class="effect">'+v.name+'</div><div class="charge">'+(ready?'USE · '+v.cap:charges[v.color]+' / '+v.cap)+'</div></button>'}).join('');
 document.querySelectorAll('.slot:not(:disabled)').forEach(b=>b.onclick=()=>activate(Number(b.dataset.slot)));
}
$('sacksBtn').onclick=()=>{const boxes=document.querySelectorAll('.sackGrid .sack');boxes[0].innerHTML='<h3>YOUR SACK</h3>'+sack.map(id=>{const v=itemById(id);return '<div class="line">'+(v?v.item+' — '+v.name:'Empty')+'</div>'}).join('');boxes[1].innerHTML=activeEncounter==='rat'?'<h3>RAT</h3><div class="line">Red — Bite</div><div class="line">Blue — Evade</div>':'<h3>BANDIT</h3><div class="line">Red — Bolt</div><div class="line">Blue — Evade</div><div class="line">Green — Bandage</div><div class="line">Yellow — Reload</div><div class="line">Purple — Deadeye</div>';$('modal').classList.add('show')};$('closeModal').onclick=()=>$('modal').classList.remove('show');

async function accountRequest(path,options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})};if(accountToken)headers.Authorization='Bearer '+accountToken;
 let response;try{response=await fetch(apiBase+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body)})}catch{throw Object.assign(new Error('account_server_unreachable'),{status:0})}
 let data={};try{data=await response.json()}catch{}
 if(!response.ok)throw Object.assign(new Error(data.error||'account_request_failed'),{status:response.status,data});
 return data;
}
async function loadCaptchaConfig(){
 if(captchaConfig)return captchaConfig;if(captchaConfigPromise)return captchaConfigPromise;
 captchaConfigPromise=(async()=>{try{const data=await accountRequest('/v1/config');captchaConfig=data.captcha||{enabled:false};return captchaConfig}catch{captchaConfig={enabled:false};return captchaConfig}finally{captchaConfigPromise=null}})();
 return captchaConfigPromise;
}
function resetCaptcha(){captchaToken='';if(captchaConfig?.enabled&&$('captchaHint'))$('captchaHint').textContent='Checking human verification…';if(captchaWidgetId!==null&&window.turnstile){try{window.turnstile.reset(captchaWidgetId)}catch{}}}
async function renderCaptcha(){
 const config=await loadCaptchaConfig(),wrap=$('captchaWrap');if(!wrap)return;
 if(!config?.enabled||account){wrap.hidden=true;return}
 wrap.hidden=false;$('captchaHint').textContent=captchaToken?'Human check ready.':'Checking human verification…';
 const mount=()=>{
  if(account||!captchaConfig?.enabled)return;
  if(!window.turnstile){setTimeout(mount,120);return}
  if(captchaWidgetId!==null)return;
  captchaWidgetId=window.turnstile.render('#turnstileWidget',{
   sitekey:captchaConfig.siteKey,theme:'dark',appearance:'always',size:'flexible',action:'auth',
   callback:token=>{captchaToken=token;$('captchaHint').textContent='Human check ready.'},
   'expired-callback':()=>{captchaToken='';$('captchaHint').textContent='Human check expired — checking again…'},
   'error-callback':()=>{captchaToken='';$('captchaHint').textContent='Human check unavailable — retrying…'}
  });
 };
 mount();
}
function applyAccount(next){
 if(!next)return;account=next;
 if(Array.isArray(next.sack)&&next.sack.length===5)sack=next.sack.map(id=>id&&itemById(id)?id:null);
 if(next.equipment&&typeof next.equipment==='object'){const clean={...DEFAULT_EQUIPMENT};for(const def of EQUIPMENT_SLOTS){const id=next.equipment[def.id];if(id&&gearById(id)?.slot===def.type)clean[def.id]=id}equipment=clean}
 if(Array.isArray(next.inventory))inventory=next.inventory.filter(id=>gearById(id));
 if(next.world&&WORLD_NODES[next.world.currentNode]){worldState={region:next.world.region||'brackenreach',currentNode:next.world.currentNode,clearedEncounters:Array.isArray(next.world.clearedEncounters)?next.world.clearedEncounters:[]};selectedWorldNode=worldState.currentNode}
 lastAccountSync=JSON.stringify({sack,equipment});
 drawAccount();
}
function saveDeviceSettings(){try{localStorage.setItem('gemmo.motionOff',String(motionOff));localStorage.setItem('gemmo.hintDelay',String(hintDelay));localStorage.setItem('gemmo.apiBase',apiBase)}catch{}}
function scheduleAccountSync(){
 if(!accountToken||!account||account.needsStarter||!sackIsValid())return;
 clearTimeout(accountSyncTimer);accountSyncTimer=setTimeout(()=>void syncAccountLoadout(),250);
}
async function syncAccountLoadout(){
 if(!accountToken||!account||account.needsStarter||!sackIsValid())return;
 const signature=JSON.stringify({sack,equipment});if(signature===lastAccountSync)return;
 try{
  await accountRequest('/v1/account/sack',{method:'PUT',body:{sack}});
  const data=await accountRequest('/v1/account/equipment',{method:'PUT',body:{equipment}});
  account=data.account||account;lastAccountSync=signature;$('accountStatus').textContent='Account loadout synced.';
 }catch(error){
  if(error.status===401){clearAccountSession();$('accountStatus').textContent='Session expired. Log in again.'}
  else $('accountStatus').textContent='Sync failed: '+error.message;
 }
}
const STARTER_CHOICES=[{color:'red',id:'dagger'},{color:'yellow',id:'sling'},{color:'blue',id:'crystal-wand'}];
function drawStarter(){
 $('starterGrid').innerHTML=STARTER_CHOICES.map(choice=>{
  const v=itemById(choice.id);
  return '<button class="starterGem" data-starter="'+v.id+'" style="--c:var(--'+v.color[0]+')"><span class="starterCost">'+v.cap+'</span><span class="starterGemIcon itemGem '+v.color+'"></span><small>'+v.color.toUpperCase()+'</small><b>'+v.item+'</b><strong>'+v.name+'</strong><p>'+v.desc+'</p></button>'
 }).join('');
 document.querySelectorAll('.starterGem').forEach(b=>b.onclick=()=>void chooseStarterGem(b.dataset.starter))
}
async function chooseStarterGem(gemId){if(!accountToken||!account?.needsStarter)return;$('starterStatus').textContent='Binding your first gem…';document.querySelectorAll('.starterGem').forEach(b=>b.disabled=true);try{const data=await accountRequest('/v1/account/starter',{method:'POST',body:{gemId}});applyAccount(data.account);$('starterStatus').textContent='First gem claimed.';showScreen('world')}catch(error){$('starterStatus').textContent=error.message.replaceAll('_',' ');document.querySelectorAll('.starterGem').forEach(b=>b.disabled=false)}}
function worldIso(x,y,z,canvas){
 const tw=58*worldCamera.zoom,th=29*worldCamera.zoom,zh=15*worldCamera.zoom;
 return {x:canvas.clientWidth/2+(x-y)*tw/2+worldCamera.panX,y:92+(x+y)*th/2-z*zh+worldCamera.panY};
}
function worldPoly(ctx,pts,fill,stroke='#0003'){ctx.beginPath();pts.forEach((p,i)=>(i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function worldColor(x,y,road){if(road)return ['#9a865b','#8c774e','#aa9465'][(x+y)%3];return ['#627451','#6c7e58','#71865e','#5b6d4b'][(x*3+y*5)%4]}
function drawWorld(){
 const canvas=$('worldCanvas');if(!canvas?.getContext)return;const wrap=$('worldViewport'),rect=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 if(canvas.width!==Math.floor(rect.width*dpr)||canvas.height!==Math.floor(rect.height*dpr)){canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px'}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
 const tw=58*worldCamera.zoom,th=29*worldCamera.zoom,zh=15*worldCamera.zoom;
 const tile=(x,y)=>{const z=WORLD_HEIGHT[y]?.[x]||0,p=worldIso(x,y,z,canvas),top=[{x:p.x,y:p.y-th/2},{x:p.x+tw/2,y:p.y},{x:p.x,y:p.y+th/2},{x:p.x-tw/2,y:p.y}],base=worldIso(x,y,0,canvas),road=WORLD_ROAD.has(x+','+y)||(worldCleared('rat')&&WORLD_ROAD_BANDIT.has(x+','+y));if(z>0){worldPoly(ctx,[top[1],top[2],{x:base.x,y:base.y+th/2},{x:base.x+tw/2,y:base.y}],'#3d4936');worldPoly(ctx,[top[2],top[3],{x:base.x-tw/2,y:base.y},{x:base.x,y:base.y+th/2}],'#35402f')}worldPoly(ctx,top,worldColor(x,y,road),'#25291f55')};
 for(let s=0;s<=16;s++)for(let y=0;y<9;y++){const x=s-y;if(x>=0&&x<9)tile(x,y)}
 const objectPoint=(x,y)=>worldIso(x,y,(WORLD_HEIGHT[y]?.[x]||0)+.15,canvas);
 ctx.lineCap='round';
 for(const [x,y] of WORLD_TREES){const p=objectPoint(x,y),scale=worldCamera.zoom;ctx.strokeStyle='#4b3828';ctx.lineWidth=3*scale;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-16*scale);ctx.stroke();ctx.fillStyle='#314c32';ctx.beginPath();ctx.moveTo(p.x,p.y-34*scale);ctx.lineTo(p.x+13*scale,p.y-10*scale);ctx.lineTo(p.x-13*scale,p.y-10*scale);ctx.closePath();ctx.fill();ctx.fillStyle='#426040';ctx.beginPath();ctx.moveTo(p.x,p.y-27*scale);ctx.lineTo(p.x+10*scale,p.y-12*scale);ctx.lineTo(p.x-10*scale,p.y-12*scale);ctx.closePath();ctx.fill()}
 for(const [x,y] of WORLD_ROCKS){const p=objectPoint(x,y),s=worldCamera.zoom;worldPoly(ctx,[{x:p.x,y:p.y-8*s},{x:p.x+8*s,y:p.y-2*s},{x:p.x+5*s,y:p.y+5*s},{x:p.x-7*s,y:p.y+4*s},{x:p.x-9*s,y:p.y-2*s}],'#77766a')}
 // Roads between world nodes.
 ctx.strokeStyle='#c1a36b';ctx.lineWidth=5*worldCamera.zoom;ctx.globalAlpha=.75;
 const done=new Set();for(const node of Object.values(WORLD_NODES).filter(worldNodeVisible))for(const n of node.neighbors){if(!worldNodeVisible(WORLD_NODES[n]))continue;const key=[node.id,n].sort().join('|');if(done.has(key))continue;done.add(key);const a=objectPoint(node.x,node.y),b=objectPoint(WORLD_NODES[n].x,WORLD_NODES[n].y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;
 worldHits=[];
 for(const node of Object.values(WORLD_NODES).filter(worldNodeVisible)){const p=objectPoint(node.x,node.y),current=node.id===worldState.currentNode,selected=node.id===selectedWorldNode,s=worldCamera.zoom;
  if(node.id==='camp'){ctx.fillStyle='#7c4c2d';ctx.beginPath();ctx.moveTo(p.x,p.y-22*s);ctx.lineTo(p.x+15*s,p.y);ctx.lineTo(p.x-15*s,p.y);ctx.closePath();ctx.fill();ctx.fillStyle='#e69245';ctx.beginPath();ctx.arc(p.x+13*s,p.y-2*s,3*s,0,Math.PI*2);ctx.fill()}
  if(node.id==='shrine'){ctx.fillStyle='#8a897c';ctx.fillRect(p.x-5*s,p.y-23*s,10*s,22*s);ctx.fillStyle='#aaa899';ctx.fillRect(p.x-9*s,p.y-25*s,18*s,5*s)}
  if(node.kind==='shop'){ctx.fillStyle=node.id==='gem-shop'?'#654f83':'#725135';ctx.fillRect(p.x-14*s,p.y-17*s,28*s,17*s);ctx.fillStyle='#d7bb82';ctx.beginPath();ctx.moveTo(p.x-18*s,p.y-18*s);ctx.lineTo(p.x+18*s,p.y-18*s);ctx.lineTo(p.x+12*s,p.y-28*s);ctx.lineTo(p.x-12*s,p.y-28*s);ctx.closePath();ctx.fill()}
  if(node.id==='rat'){ctx.strokeStyle='#5a4031';ctx.lineWidth=2*s;ctx.beginPath();ctx.arc(p.x,p.y-18*s,6*s,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(p.x-4*s,p.y-24*s,2*s,0,Math.PI*2);ctx.arc(p.x+3*s,p.y-24*s,2*s,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x+6*s,p.y-18*s);ctx.quadraticCurveTo(p.x+17*s,p.y-24*s,p.x+18*s,p.y-14*s);ctx.stroke()}
  if(node.id==='bandit-pass'){ctx.strokeStyle='#4f3123';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-27*s);ctx.stroke();ctx.fillStyle='#9a3f32';ctx.beginPath();ctx.moveTo(p.x,p.y-27*s);ctx.lineTo(p.x+16*s,p.y-22*s);ctx.lineTo(p.x,p.y-15*s);ctx.closePath();ctx.fill()}
  ctx.beginPath();ctx.arc(p.x,p.y-5*s,(selected?11:8)*s,0,Math.PI*2);ctx.fillStyle=node.kind==='encounter'?'#a7493d':current?'#f2d68f':'#d3bf83';ctx.fill();ctx.strokeStyle=selected?'#fff1bc':'#4e432d';ctx.lineWidth=selected?3:2;ctx.stroke();
  ctx.font=(selected?'bold ':'')+Math.max(9,10*s)+'px Georgia';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=3;ctx.strokeStyle='#151713';ctx.strokeText(node.name,p.x,p.y-35*s);ctx.fillStyle='#f4dfab';ctx.fillText(node.name,p.x,p.y-35*s);
  worldHits.push({id:node.id,x:p.x,y:p.y-5*s,r:24*s});
 }
 const fromNode=WORLD_NODES[worldTravelAnim?.from||worldState.currentNode],toNode=WORLD_NODES[worldTravelAnim?.to||worldState.currentNode],t=worldTravelAnim?.progress||0;
 const wx=fromNode.x+(toNode.x-fromNode.x)*t,wy=fromNode.y+(toNode.y-fromNode.y)*t,wz=(WORLD_HEIGHT[fromNode.y]?.[fromNode.x]||0)+((WORLD_HEIGHT[toNode.y]?.[toNode.x]||0)-(WORLD_HEIGHT[fromNode.y]?.[fromNode.x]||0))*t;
 const wp=worldIso(wx,wy,wz+.2,canvas),walk=worldTravelAnim?Math.sin(t*Math.PI*8):0,ss=worldCamera.zoom;
 ctx.strokeStyle='#30261d';ctx.lineWidth=2.5*ss;ctx.beginPath();ctx.moveTo(wp.x-2*ss,wp.y-5*ss);ctx.lineTo(wp.x-6*ss-walk*2*ss,wp.y+5*ss);ctx.moveTo(wp.x+2*ss,wp.y-5*ss);ctx.lineTo(wp.x+6*ss+walk*2*ss,wp.y+5*ss);ctx.stroke();
 ctx.strokeStyle='#e0c58f';ctx.beginPath();ctx.moveTo(wp.x,wp.y-14*ss);ctx.lineTo(wp.x+walk*5*ss,wp.y-4*ss);ctx.stroke();
 ctx.fillStyle='#6d3e2c';ctx.fillRect(wp.x-5*ss,wp.y-16*ss,10*ss,12*ss);ctx.fillStyle='#e1b985';ctx.beginPath();ctx.arc(wp.x,wp.y-21*ss,5*ss,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7df9d';ctx.beginPath();ctx.moveTo(wp.x,wp.y-31*ss);ctx.lineTo(wp.x+5*ss,wp.y-25*ss);ctx.lineTo(wp.x,wp.y-22*ss);ctx.lineTo(wp.x-5*ss,wp.y-25*ss);ctx.closePath();ctx.fill();
 drawWorldCard();
}
function drawWorldCard(){
 const node=WORLD_NODES[selectedWorldNode]||WORLD_NODES[worldState.currentNode],current=WORLD_NODES[worldState.currentNode];
 $('worldKind').textContent=node.kind==='encounter'?'⚔ MOB':node.kind.toUpperCase();$('worldNodeName').textContent=node.name;$('worldNodeDesc').textContent='';$('worldNodeDesc').hidden=true;
 const btn=$('worldAction');btn.hidden=true;btn.disabled=false;btn.dataset.action='none';
 if(node.id===current.id&&!worldTravelRoute){
  if(node.encounter){btn.hidden=false;btn.textContent='FIGHT '+node.name.toUpperCase();btn.dataset.action='fight'}
  else if(node.shop){btn.hidden=false;btn.textContent=node.shop==='gem-shop'?'OPEN GEM SHOP':'OPEN ITEM SHOP';btn.dataset.action='shop'}
 }
}
function animateWorldTravel(from,to){
 if(reducedMotion()||from===to)return Promise.resolve();
 return new Promise(resolve=>{const start=performance.now(),duration=620;worldTravelAnim={from,to,progress:0};const step=now=>{worldTravelAnim.progress=Math.min(1,(now-start)/duration);drawWorld();if(worldTravelAnim.progress<1)requestAnimationFrame(step);else{worldTravelAnim=null;resolve()}};requestAnimationFrame(step)})
}
async function travelWorld(nodeId){
 if(!account||!accountToken||worldTravelRoute)return;
 const route=worldPath(worldState.currentNode,nodeId);if(!route||route.length<2){selectedWorldNode=nodeId;drawWorld();return}
 const destination=nodeId;worldTravelRoute=route.slice();selectedWorldNode=destination;drawWorld();
 try{
  for(let i=1;i<route.length;i++){
   const from=worldState.currentNode,to=route[i];let nextAccount;
   try{const data=await accountRequest('/v1/world/move',{method:'POST',body:{nodeId:to}});nextAccount=data.account}
   catch(error){$('worldNodeDesc').hidden=false;$('worldNodeDesc').textContent='Travel failed: '+error.message.replaceAll('_',' ');break}
   await animateWorldTravel(from,to);
   applyAccount(nextAccount);selectedWorldNode=destination;drawWorld();
  }
 }finally{worldTravelAnim=null;worldTravelRoute=null;selectedWorldNode=worldState.currentNode;drawWorld()}
}
function enterWorld(){selectedWorldNode=worldState.currentNode;showScreen('world');requestAnimationFrame(drawWorld)}
function shopItemData(id){const gem=itemById(id);if(gem)return {id,name:gem.item,sub:gem.name,desc:gem.desc,color:gem.color};const gear=gearById(id);if(gear)return {id,name:gear.name,sub:'LEVEL '+gear.level+' · '+gear.slot.toUpperCase(),desc:gear.desc,color:null};return null}
function openShop(shopId){if(!account||worldState.currentNode!==shopId)return;currentShop=shopId;showScreen('shop');drawShop()}
function drawShop(){
 const stock=SHOP_STOCK[currentShop]||[],owned=new Set(account?.inventory||[]),gold=account?.profile?.gold||0;
 $('shopTitle').textContent=currentShop==='gem-shop'?'Facet Cart':'Roadside Outfitter';$('shopEyebrow').textContent=currentShop==='gem-shop'?'GEM SHOP':'ITEM SHOP';$('shopGold').textContent=gold+' GOLD';
 $('shopGrid').innerHTML=stock.map(entry=>{const v=shopItemData(entry.id),has=owned.has(entry.id);if(!v)return '';return '<button class="shopItem" data-buy="'+entry.id+'" style="'+(v.color?'--c:var(--'+v.color[0]+')':'')+'" '+(has?'disabled':'')+'><small>'+(v.color?v.color.toUpperCase():'GEAR')+'</small><b>'+v.name+'</b><strong>'+entry.price+' GOLD · '+(has?'OWNED':'BUY')+'</strong><p>'+v.sub+'<br>'+v.desc+'</p></button>'}).join('');
 document.querySelectorAll('.shopItem:not(:disabled)').forEach(b=>b.onclick=()=>void buyShopItemClient(b.dataset.buy));
}
async function buyShopItemClient(itemId){
 if(!account||!currentShop)return;$('shopStatus').textContent='Buying…';
 try{const data=await accountRequest('/v1/shop/buy',{method:'POST',body:{shopId:currentShop,itemId}});applyAccount(data.account);$('shopStatus').textContent='Purchased.';drawShop()}
 catch(error){$('shopStatus').textContent=error.message.replaceAll('_',' ')}
}
function clearAccountSession(){
 account=null;accountToken=null;lastAccountSync='';sack=Array(5).fill(null);equipment={...DEFAULT_EQUIPMENT};inventory=[];worldState={region:'brackenreach',currentNode:'camp',clearedEncounters:[]};selectedWorldNode='camp';currentShop=null;
 rememberAccountToken(null);drawAccount()
}
async function refreshAccount(){
 if(!accountToken)return false;
 try{const data=await accountRequest('/v1/account');applyAccount(data.account);return true}
 catch(error){if(error.status===401)clearAccountSession();else $('accountStatus').textContent='Account server unavailable.';return false}
}
function drawAccount(){
 const logged=!!account;
 $('accountLoggedOut').hidden=logged;$('accountLoggedIn').hidden=!logged;
 if(logged){$('accountName').textContent=account.user.username;$('accountLevel').textContent='LV '+account.profile.level;$('accountXP').textContent='XP '+account.profile.xp;$('accountGold').textContent='GOLD '+account.profile.gold}
 $('captchaWrap').hidden=logged||!captchaConfig?.enabled;
}
function setAuthBusy(value){
 authBusy=value;$('loginBtn').disabled=value;$('registerBtn').disabled=value;
}
async function submitAuth(mode){
 if(authBusy)return;
 const username=$('accountUsername').value,password=$('accountPassword').value;
 if(password.length<6){$('accountStatus').textContent='Password must be at least 6 characters.';return}
 const config=await loadCaptchaConfig();if(config?.enabled&&!captchaToken){$('accountStatus').textContent='Human verification is still running.';void renderCaptcha();return}
 setAuthBusy(true);$('accountStatus').textContent=mode==='register'?'Creating account…':'Logging in…';
 try{
  const data=await accountRequest('/v1/auth/'+mode,{method:'POST',body:{username,password,captchaToken}});
  rememberAccountToken(data.token);$('accountPassword').value='';applyAccount(data.account);$('accountStatus').textContent='Account secure and synced.';showScreen('menu');
 }catch(error){
  const message={
   invalid_username_or_password:'Invalid username or password.',
   login_temporarily_locked:'Too many failed logins. Try again in about 10 minutes.',
   captcha_required:'Human verification was missing. Try again.',
   captcha_failed:'Human verification was rejected. Try again.',
   captcha_unavailable:'Human verification service is unavailable. Try again.',
   rate_limited:'Too many attempts. Try again shortly.'
  }[error.message];
  $('accountStatus').textContent=message||error.message.replaceAll('_',' ');
 }finally{setAuthBusy(false);resetCaptcha()}
}
async function logoutAccount(){try{if(accountToken)await accountRequest('/v1/auth/logout',{method:'POST'})}catch{}clearAccountSession();$('accountStatus').textContent='Logged out.'}
function save(){saveDeviceSettings();scheduleAccountSync()}
try{localStorage.removeItem?.('gemmo.sack.v1');localStorage.removeItem?.('gemmo.equipment.v1');localStorage.removeItem?.('gemmo.inventory.v1');localStorage.removeItem?.('gemmo.worldNode')}catch{}
try{motionOff=localStorage.getItem('gemmo.motionOff')==='true';const savedHint=localStorage.getItem('gemmo.hintDelay');if(savedHint!==null&&['0','15000','30000'].includes(savedHint))hintDelay=Number(savedHint)}catch{}
function animateScreenChange(previous,next){
 if(motionOff||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const target=next==='fight'?document.querySelector('.game'):$(next+'Page'),veil=$('screenVeil');
 if(target)target.animate([
  {opacity:0,transform:'translate3d(0,12px,0) scale(.992)',filter:'blur(3px)'},
  {opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0)'}
 ],{duration:280,easing:'cubic-bezier(.2,.82,.2,1)'});
 if(veil)veil.animate([{opacity:0},{opacity:.32,offset:.28},{opacity:0}],{duration:300,easing:'ease-out'});
}
function showScreen(next){
 clearTimeout(hintTimer);if(!account&&!['splash','account','settings'].includes(next))next='account';
 const previous=screen;screen=next;
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==next+'Page');document.querySelector('.game').hidden=next!=='fight';$('leaveFight').hidden=next!=='fight';
 if(next==='sack')drawSack();if(next==='inventory')drawInventory();if(next==='starter')drawStarter();if(next==='world')requestAnimationFrame(drawWorld);if(next==='shop')drawShop();
 if(next==='account'){drawAccount();void renderCaptcha();if(accountToken&&!account)void refreshAccount()}
 if(next==='menu'){const gs=gearStats();$('playBtn').disabled=!!account&&!account.needsStarter&&!sackIsValid();$('sackSummary').textContent=(account?account.inventory.filter(id=>itemById(id)).length+' gems owned · ':'')+sack.filter(Boolean).length+'/5 equipped';$('gearSummary').textContent='LV 1 · '+Object.values(equipment).filter(Boolean).length+'/8 gear · '+playerMaxHP()+' Max HP · '+gs.guard+' Starting Guard'}
 if(previous!==next){const raf=window.requestAnimationFrame||globalThis.requestAnimationFrame;if(raf)raf(()=>animateScreenChange(previous,next));else setTimeout(()=>animateScreenChange(previous,next),0)}save();
}
function drawSack(){
 const ownedGemIds=account?new Set(account.inventory.filter(id=>itemById(id))):null;
 const ownedGems=ITEMS.filter(v=>!ownedGemIds||ownedGemIds.has(v.id));
 $('sackEquippedCount').textContent=sack.filter(Boolean).length+'/5';
 $('sackOwnedCount').textContent=ownedGems.length+' owned';
 $('loadout').innerHTML=sack.map((id,i)=>{
  const v=itemById(id),chosen=i===chosenSlot;
  if(!v)return '<button class="equip sackSlot empty '+(chosen?'chosen':'')+'" data-index="'+i+'"><span class="sackSlotNumber">'+(i+1)+'</span><span class="sackPlus">+</span><b>Empty</b></button>';
  return '<button class="equip sackSlot '+(chosen?'chosen':'')+'" data-index="'+i+'" style="--c:var(--'+v.color[0]+')"><span class="sackSlotNumber">'+(i+1)+'</span><span class="cardCost">'+v.cap+'</span><span class="sackGem itemGem '+v.color+'"></span><b>'+v.item+'</b><span>'+v.color.toUpperCase()+'</span></button>'
 }).join('');
 document.querySelectorAll('.equip').forEach(b=>b.onclick=()=>{chosenSlot=Number(b.dataset.index);drawSack()});
 const query=$('itemSearch').value.trim().toLowerCase(),filter=$('colorFilter').value;
 const visible=ownedGems.filter(v=>(filter==='all'||v.color===filter)&&[v.item,v.name,v.desc].join(' ').toLowerCase().includes(query));
 $('collection').innerHTML=visible.map(v=>{
  const other=sack.findIndex((id,i)=>i!==chosenSlot&&id===v.id),locked=other>=0,equipped=sack[chosenSlot]===v.id;
  return '<button class="itemCard '+(equipped?'equipped':'')+'" data-item="'+v.id+'" style="--c:var(--'+v.color[0]+')" '+(locked?'disabled aria-disabled="true"':'')+'><span class="cardCost">'+v.cap+'</span><span class="itemGem '+v.color+'"></span><small>'+v.color.toUpperCase()+'</small><b>'+v.item+'</b><strong>'+v.name+'</strong><p>'+v.desc+'</p><em>'+(equipped?'EQUIPPED':locked?'IN SLOT '+(other+1):'TAP TO EQUIP')+'</em></button>'
 }).join('');
 document.querySelectorAll('.itemCard:not(:disabled)').forEach(b=>b.onclick=()=>{
  const id=b.dataset.item;if(sack.some((equipped,i)=>i!==chosenSlot&&equipped===id))return;
  sack[chosenSlot]=id;chosenSlot=(chosenSlot+1)%5;save();drawSack()
 });
 $('equipHint').textContent=account?'Slot '+(chosenSlot+1)+' selected · '+sack.filter(Boolean).length+'/5 equipped':'Slot '+(chosenSlot+1)+' selected';
}
function drawInventory(){
 const stats=gearStats(),caps=Object.entries(stats.caps).filter(([,v])=>v).map(([k,v])=>'<b>+'+v+' '+k.toUpperCase()+' CAP</b>').join('');$('equipmentStats').innerHTML='<b>LEVEL 1</b><b>'+playerMaxHP()+' MAX HP</b><b>'+stats.guard+' STARTING GUARD</b>'+caps;$('inventoryCount').textContent=inventory.length+' physical items owned.';
 $('equipmentGrid').innerHTML=EQUIPMENT_SLOTS.map(def=>{const g=gearById(equipment[def.id]);return '<button class="gearSlot '+(def.id===chosenGearSlot?'chosen':'')+'" data-gear-slot="'+def.id+'"><small>'+def.label.toUpperCase()+'</small><b>'+(g?g.name:'Empty')+'</b><span>'+(g?(g.hp?'+'+g.hp+' HP ':'')+(g.guard?'+'+g.guard+' GUARD':''):'Choose gear')+'</span></button>'}).join('');
 document.querySelectorAll('.gearSlot').forEach(b=>b.onclick=()=>{chosenGearSlot=b.dataset.gearSlot;drawInventory()});
 const def=gearSlotById(chosenGearSlot);
 $('inventoryGrid').innerHTML=inventory.map(id=>gearById(id)).filter(Boolean).map(g=>{const elsewhere=Object.entries(equipment).find(([slot,id])=>slot!==chosenGearSlot&&id===g.id);const compatible=def&&def.type===g.slot&&!elsewhere;const current=equipment[chosenGearSlot]===g.id;return '<button class="gearCard" data-gear="'+g.id+'" '+(!compatible&&!current?'disabled aria-disabled="true"':'')+'><small>LV '+g.level+' · '+g.slot.toUpperCase()+'</small><b>'+g.name+'</b><strong>'+(g.hp?'+'+g.hp+' MAX HP ':'')+(g.guard?'+'+g.guard+' START GUARD':'')+'</strong><p>'+g.desc+'</p><small>'+(current?'EQUIPPED HERE':elsewhere?'EQUIPPED · '+gearSlotById(elsewhere[0]).label:compatible?'EQUIP TO '+def.label:'SELECT A '+g.slot.toUpperCase()+' SLOT')+'</small></button>'}).join('');
 document.querySelectorAll('.gearCard:not(:disabled)').forEach(b=>b.onclick=()=>{if(equipGear(chosenGearSlot,b.dataset.gear)){save();drawInventory()}});
}
function pauseCombatView(){combatPaused=true;clearTimeout(enemyTimer);clearTimeout(hintTimer)}
function resumeCombatView(){combatPaused=false;if(screen==='fight'&&!playerTurn&&!busy&&pHP>0&&eHP>0)enemyTimer=setTimeout(()=>void enemyMove(),300);else touchActivity()}
function openCombatMenu(){if(screen!=='fight')return;pauseCombatView();$('combatMenuStatus').textContent='';$('combatMenuPanel').hidden=false}
function closeCombatMenu(){if($('combatMenuPanel').hidden)return;$('combatMenuPanel').hidden=true;resumeCombatView()}
function openCombatGemology(){
 pauseCombatView();$('combatMenuPanel').hidden=true;
 const grid=document.querySelector('#gemologyPage .gemologyGrid'),rules=document.querySelector('#gemologyPage .rulebook');
 $('combatGemologyContent').innerHTML=(grid?.outerHTML||'')+(rules?.outerHTML||'');$('combatGemologyPanel').hidden=false;
}
function closeCombatGemology(){$('combatGemologyPanel').hidden=true;resumeCombatView()}
function drawCombatEquip(){
 const sackHtml=sack.map((id,i)=>{const v=itemById(id);return '<div class="combatEquipItem"><small>SACK '+(i+1)+'</small><b>'+(v?v.item:'Empty')+'</b><span>'+(v?v.color.toUpperCase()+' · '+v.name:'')+'</span></div>'}).join('');
 const gearHtml=EQUIPMENT_SLOTS.map(def=>{const g=gearById(equipment[def.id]);return '<div class="combatEquipItem"><small>'+def.label.toUpperCase()+'</small><b>'+(g?g.name:'Empty')+'</b><span>'+(g?gearBonusText(g):'')+'</span></div>'}).join('');
 $('combatEquipContent').innerHTML='<div class="combatEquipGrid">'+sackHtml+gearHtml+'</div>';
}
function openEquipDrawer(){if(screen!=='fight')return;pauseCombatView();drawCombatEquip();$('equipDrawer').hidden=false;void animate($('equipDrawer'),[{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'})}
async function closeEquipDrawer(){if($('equipDrawer').hidden)return;await animate($('equipDrawer'),[{transform:'translateY(0)'},{transform:'translateY(100%)'}],{duration:180,easing:'ease-in'});$('equipDrawer').hidden=true;resumeCombatView()}
function surrenderFight(){
 if(screen!=='fight')return;if(busy||pendingHP.p||pendingHP.e){$('combatMenuStatus').textContent='Finish the current action first.';return}
 $('combatMenuPanel').hidden=true;combatPaused=false;clearTimeout(enemyTimer);pHP=0;shownHP.p=0;syncHealth('p');setLog('You surrendered.','system');checkEnd();
}
function startFight(){
 clearTimeout(hintTimer);actionNumber=1;targetMode=null;pinColumn=-1;pinTurns=guardTurns=evadeTurns=0;buffs={dodge:0,poison:0,regen:0,focus:0,redwake:0,holdfast:0,aftergrowth:0,momentum:0};
 if(account?.needsStarter||!sackIsValid())return;
 if(account){const owned=new Set(account.inventory.filter(id=>itemById(id)));if(sack.filter(Boolean).some(id=>!owned.has(id)))return}
 clearTimeout(enemyTimer);board=[];selected=null;busy=false;playerTurn=true;freeSwap=false;extraTurn=false;overdrive=false;enemyReload=false;combatPaused=false;activeMatchId=null;activeRewardBudget=null;activeAuthority=null;combatRng=null;combatTranscript=[];matchStartPromise=null;rewardsSettled=false;lossSettlementStarted=false;
 const gear=gearStats();pHP=playerMaxHP();eHP=enemyMaxHP();pGuard=gear.guard;eGuard=gold=xp=0;guardTurns=pGuard?2:0;charges={red:0,blue:0,green:0,yellow:0,purple:0};ec={red:0,blue:0,green:0,yellow:0,purple:0};shownHP.p=pHP;shownHP.e=eHP;pendingHP.p=pendingHP.e=0;damageAnimations=[];effectOrigin=null;
 encounterClearSaved=activeEncounter!=='rat'||worldCleared('rat');encounterSettling=false;lastMatchError='';$('resultMenu').disabled=false;$('resultRetry').hidden=true;$('resultText').textContent='';$('fxLayer').innerHTML='';$('result').classList.remove('show');$('modal').classList.remove('show');combatHistory=[];logSequence=0;$('historyEntries').innerHTML='';$('historyPanel').hidden=true;$('combatMenuPanel').hidden=true;$('combatGemologyPanel').hidden=true;$('equipDrawer').hidden=true;$('abilityBanner').hidden=true;showScreen('fight');
 if(accountToken){
  busy=true;setLog('SYNCING MATCH…','system');render();matchStartPromise=startMatchTicket();
  void matchStartPromise.then(()=>{busy=false;if(!activeMatchId){combatPaused=true;setLog('MATCH SERVER UNREACHABLE — RETURN TO WORLD','system');render();return}board=[];buildBoard();setLog(enemyLabel()+' · '+eHP+' HP');render();touchActivity()});
 }else{buildBoard();setLog(enemyLabel()+' · '+eHP+' HP');render();touchActivity()}
}
function leaveFight(){clearTimeout(hintTimer);if(busy||encounterSettling||(eHP<=0&&!rewardsSettled)||pendingHP.p||pendingHP.e)return;clearTimeout(enemyTimer);combatPaused=false;$('historyPanel').hidden=true;$('combatMenuPanel').hidden=true;$('combatGemologyPanel').hidden=true;$('equipDrawer').hidden=true;$('result').classList.remove('show');$('modal').classList.remove('show');enterWorld()}
$('enterBtn').onclick=async()=>{if(account){showScreen('menu');return}if(accountToken&&await refreshAccount()){showScreen('menu');return}showScreen('account')};$('playBtn').onclick=()=>{if(account?.needsStarter){showScreen('starter');return}enterWorld()};$('openSack').onclick=()=>showScreen('sack');$('openInventory').onclick=()=>showScreen('inventory');$('openAccount').onclick=()=>showScreen('account');$('openGemology').onclick=()=>showScreen('gemology');$('openSettings').onclick=()=>showScreen('settings');
document.querySelectorAll('.menuBack').forEach(b=>b.onclick=()=>showScreen(account?'menu':'splash'));$('shopBack').onclick=()=>enterWorld();
$('worldCamp').onclick=()=>showScreen('menu');$('worldZoomIn').onclick=()=>{worldCamera.zoom=Math.min(1.55,worldCamera.zoom+.12);drawWorld()};$('worldZoomOut').onclick=()=>{worldCamera.zoom=Math.max(.68,worldCamera.zoom-.12);drawWorld()};
$('worldAction').onclick=()=>{const action=$('worldAction').dataset.action;if(action==='fight'){activeEncounter=WORLD_NODES[selectedWorldNode].encounter;startFight()}if(action==='shop')openShop(WORLD_NODES[selectedWorldNode].shop)};
function worldPair(){const p=[...worldPointers.values()];return p.length>=2?[p[0],p[1]]:null}
function worldDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function worldMid(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
$('worldViewport').addEventListener('pointerdown',e=>{
 worldPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});$('worldViewport').setPointerCapture?.(e.pointerId);$('worldViewport').classList.add('dragging');
 const pair=worldPair();
 if(pair){const mid=worldMid(...pair);worldGesture={type:'pinch',startDist:Math.max(1,worldDistance(...pair)),startMid:mid,startZoom:worldCamera.zoom,startPanX:worldCamera.panX,startPanY:worldCamera.panY,moved:true}}
 else worldGesture={type:'pan',id:e.pointerId,startX:e.clientX,startY:e.clientY,startPanX:worldCamera.panX,startPanY:worldCamera.panY,moved:false};
});
$('worldViewport').addEventListener('pointermove',e=>{
 const p=worldPointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;
 const pair=worldPair();
 if(pair){
  if(worldGesture?.type!=='pinch'){const mid=worldMid(...pair);worldGesture={type:'pinch',startDist:Math.max(1,worldDistance(...pair)),startMid:mid,startZoom:worldCamera.zoom,startPanX:worldCamera.panX,startPanY:worldCamera.panY,moved:true}}
  const mid=worldMid(...pair),ratio=worldDistance(...pair)/worldGesture.startDist,newZoom=Math.max(.68,Math.min(1.65,worldGesture.startZoom*ratio)),scale=newZoom/worldGesture.startZoom,rect=$('worldViewport').getBoundingClientRect(),cx=rect.width/2,cy=92;
  worldCamera.zoom=newZoom;worldCamera.panX=(mid.x-rect.left)-cx-((worldGesture.startMid.x-rect.left)-cx-worldGesture.startPanX)*scale;worldCamera.panY=(mid.y-rect.top)-cy-((worldGesture.startMid.y-rect.top)-cy-worldGesture.startPanY)*scale;drawWorld();return;
 }
 if(worldGesture?.type==='pan'&&worldGesture.id===e.pointerId){const dx=e.clientX-worldGesture.startX,dy=e.clientY-worldGesture.startY;if(Math.hypot(dx,dy)>5)worldGesture.moved=true;worldCamera.panX=worldGesture.startPanX+dx;worldCamera.panY=worldGesture.startPanY+dy;drawWorld()}
});
function endWorldPointer(e,cancel=false){
 const gesture=worldGesture,p=worldPointers.get(e.pointerId);worldPointers.delete(e.pointerId);
 if(!cancel&&gesture?.type==='pan'&&!gesture.moved&&p&&worldPointers.size===0&&!worldTravelRoute){const rect=$('worldCanvas').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,hit=worldHits.filter(h=>Math.hypot(h.x-x,h.y-y)<=h.r).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(hit){selectedWorldNode=hit.id;drawWorld();if(hit.id!==worldState.currentNode)void travelWorld(hit.id)}}
 if(worldPointers.size===1){const [id,left]=worldPointers.entries().next().value;worldGesture={type:'pan',id,startX:left.x,startY:left.y,startPanX:worldCamera.panX,startPanY:worldCamera.panY,moved:true}}
 else if(worldPointers.size===0){worldGesture=null;$('worldViewport').classList.remove('dragging')}
}
$('worldViewport').addEventListener('pointerup',e=>endWorldPointer(e));$('worldViewport').addEventListener('pointercancel',e=>endWorldPointer(e,true));
window.addEventListener?.('resize',()=>{if(screen==='world')drawWorld()});
$('colorFilter').onchange=drawSack;$('itemSearch').oninput=drawSack;$('emptySlot').onclick=()=>{sack[chosenSlot]=null;drawSack();save()};$('unequipGear').onclick=()=>{unequipGear(chosenGearSlot);save();drawInventory()};
$('hintDelay').value=String(hintDelay);$('hintDelay').onchange=()=>{hintDelay=Number($('hintDelay').value);touchActivity();save()};
$('motionToggle').checked=motionOff;$('motionToggle').onchange=()=>{motionOff=$('motionToggle').checked;save()};
$('apiBase').value=apiBase;$('apiBase').onchange=()=>{apiBase=$('apiBase').value.trim().replace(/\/+$/,'')||'https://gemmo.onrender.com';saveDeviceSettings();$('accountStatus').textContent='Account API updated.'};
$('loginBtn').onclick=()=>void submitAuth('login');$('registerBtn').onclick=()=>void submitAuth('register');$('logoutBtn').onclick=()=>void logoutAccount();$('syncAccountBtn').onclick=()=>{lastAccountSync='';void syncAccountLoadout()};
$('historyBtn').onclick=openEquipDrawer;$('closeEquipDrawer').onclick=()=>void closeEquipDrawer();$('leaveFight').onclick=openCombatMenu;$('closeCombatMenu').onclick=closeCombatMenu;$('combatGemologyBtn').onclick=openCombatGemology;$('closeCombatGemology').onclick=closeCombatGemology;$('surrenderBtn').onclick=surrenderFight;$('resultRetry').onclick=()=>void settleVictory();$('resultMenu').onclick=()=>{if(!encounterSettling)leaveFight()};

function renderStatuses(){
 $('turnBadge').textContent='✦ TURN '+actionNumber+' ✦';
 const tags=[
 ['Guard',pGuard,guardTurns,'Absorbs incoming damage point for point. Expires after 2 enemy actions; gaining Guard refreshes the duration.'],
 ['Bandit Evade',eGuard,evadeTurns,'Absorbs damage point for point. Expires after 2 of your actions; gaining Evade refreshes it.'],
 ['Veilstep',buffs.dodge,buffs.dodge,'Halves incoming damage, rounded up. Duration counts remaining enemy actions.'],
 ['Venom',buffs.poison,buffs.poison,'Deals 2 damage after each Bandit action. Guard can absorb it.'],
 ['Verse',buffs.regen,buffs.regen,'Heals 2 HP after each Bandit action, up to your Max HP.'],
 ['Resonance',buffs.focus,buffs.focus,'Adds 1 charge to every equipped color after each Bandit action.'],
 ['Redwake',buffs.redwake,buffs.redwake,'For your remaining attuned actions, every Red match resolution deals +2 flat bonus damage, including cascades.'],
 ['Holdfast',buffs.holdfast,buffs.holdfast,'For your remaining attuned actions, every Blue match resolution grants +2 bonus Guard, including cascades.'],
 ['Aftergrowth',buffs.aftergrowth,buffs.aftergrowth,'For your remaining attuned actions, every Green match resolution heals 2 HP, including cascades.'],
 ['Momentum',buffs.momentum,buffs.momentum,'For your remaining attuned actions, every Yellow match resolution sends +2 charge to your most depleted other equipped color, including cascades.'],
 ['Pinned column',pinTurns,pinTurns,'Matched gaps refill in place. Surviving gems in the pinned column do not fall. Lasts through the next enemy action.']
 ];
 $('statusTags').innerHTML=tags.filter(t=>t[1]>0||t[0]==='Guard'||t[0]==='Bandit Evade').map(t=>'<button class="statusTag" title="'+t[3]+'" data-help="'+t[3]+'">'+t[0]+' '+(t[0]==='Guard'||t[0]==='Bandit Evade'?t[1]+' · ':'')+t[2]+' turns</button>').join('');
 document.querySelectorAll('.statusTag').forEach(b=>b.onclick=()=>setLog(b.dataset.help,'system'));
}
function clearSwipePreview(){
 if(!swipeStart)return;for(const key of ['sourceEl','targetEl']){const el=swipeStart[key];if(el){el.style.transform='';el.classList.remove(key==='sourceEl'?'draggingGem':'dragNeighbor')}}
 cellAt({x:swipeStart.x,y:swipeStart.y})?.classList.remove('swipeOrigin');if(swipeStart.target)cellAt(swipeStart.target)?.classList.remove('swipeTarget');
}
function updateSwipePreview(event){
 if(!swipeStart||event.pointerId!==swipeStart.pointerId)return;const dx=event.clientX-swipeStart.clientX,dy=event.clientY-swipeStart.clientY,rect=boardEl.getBoundingClientRect(),cellW=rect.width/8,cellH=rect.height/8,horizontal=Math.abs(dx)>Math.abs(dy),sx=horizontal?Math.sign(dx):0,sy=horizontal?0:Math.sign(dy),target={x:swipeStart.x+sx,y:swipeStart.y+sy};
 if(Math.max(Math.abs(dx),Math.abs(dy))<4||target.x<0||target.x>7||target.y<0||target.y>7)return;
 if(swipeStart.target&&(swipeStart.target.x!==target.x||swipeStart.target.y!==target.y)){swipeStart.targetEl&&(swipeStart.targetEl.style.transform='',swipeStart.targetEl.classList.remove('dragNeighbor'));cellAt(swipeStart.target)?.classList.remove('swipeTarget')}
 swipeStart.target=target;const sourceCell=cellAt({x:swipeStart.x,y:swipeStart.y}),targetCell=cellAt(target),source=sourceCell?.firstElementChild,targetEl=targetCell?.firstElementChild;if(!source||!targetEl)return;
 swipeStart.sourceEl=source;swipeStart.targetEl=targetEl;source.classList.add('draggingGem');targetEl.classList.add('dragNeighbor');sourceCell.classList.add('swipeOrigin');targetCell.classList.add('swipeTarget');
 const max=horizontal?cellW:cellH,raw=horizontal?dx:dy,move=Math.max(-max,Math.min(max,raw)),progress=Math.min(1,Math.abs(move)/max);swipeStart.progress=progress;
 const base=source.classList.contains('gold')?'':' rotate(45deg)',otherBase=targetEl.classList.contains('gold')?'':' rotate(45deg)';
 source.style.transform='translate3d('+(horizontal?move:0)+'px,'+(horizontal?0:move)+'px,0)'+base+' scale('+(1+.08*progress)+')';
 targetEl.style.transform='translate3d('+(horizontal?-move*.22:0)+'px,'+(horizontal?0:-move*.22)+'px,0)'+otherBase+' scale('+(1-.04*progress)+')';
}
boardEl.addEventListener('pointerdown',event=>{
 if(screen!=='fight'||busy||!playerTurn)return;
 const rect=boardEl.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*8),y=Math.floor((event.clientY-rect.top)/rect.height*8);
 if(x<0||x>7||y<0||y>7)return;swipeStart={x,y,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,target:null,progress:0};boardEl.setPointerCapture?.(event.pointerId);touchActivity();
});
boardEl.addEventListener('pointermove',event=>{if(swipeStart)updateSwipePreview(event)});
boardEl.addEventListener('pointerup',event=>{
 if(!swipeStart||event.pointerId!==swipeStart.pointerId)return;const a={...swipeStart},dx=event.clientX-a.clientX,dy=event.clientY-a.clientY,progress=a.progress||0;clearSwipePreview();swipeStart=null;
 if(Math.max(Math.abs(dx),Math.abs(dy))<16)return;suppressClickUntil=Date.now()+450;touchActivity();
 if(targetMode){tapCell(a.x,a.y);return}
 const b={x:a.x+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0),y:a.y+(Math.abs(dx)>Math.abs(dy)?0:Math.sign(dy))};
 if(b.x<0||b.x>7||b.y<0||b.y>7||busy||!playerTurn)return;selected=null;const force=freeSwap;freeSwap=false;void trySwap(a,b,'player',force,progress);
});
boardEl.addEventListener('pointercancel',event=>{if(swipeStart&&event.pointerId===swipeStart.pointerId){clearSwipePreview();swipeStart=null}});
document.querySelector('.app').addEventListener('pointerdown',touchActivity);document.querySelector('.app').addEventListener('keydown',touchActivity);

showScreen('splash');
})();
