(()=>{
'use strict';
const W=8,H=8,COMBAT_CORE=globalThis.GEMMO_COMBAT_CORE,COMBAT_RULES=globalThis.GEMMO_COMBAT_RULES,PROGRESSION=globalThis.GEMMO_PROGRESSION,ENCOUNTERS=globalThis.GEMMO_ENCOUNTERS,STORY=globalThis.GEMMO_STORY;if(!COMBAT_CORE||!COMBAT_RULES||!PROGRESSION||!ENCOUNTERS||!STORY)throw new Error('geMMO runtime dependencies missing');
const {WORLD_NODES,SHOP_STOCK,WORLD_HEIGHT,WORLD_ROAD,WORLD_ROAD_BANDIT,WORLD_ROAD_SENTINEL,WORLD_TREES,WORLD_ROCKS}=globalThis.GEMMO_CONTENT;
let worldState={region:'brackenreach',currentNode:'camp',clearedEncounters:[]},selectedWorldNode='camp',worldHits=[],worldCamera={zoom:1,panX:0,panY:10},worldPointers=new Map(),worldGesture=null,worldTravelAnim=null,worldTravelRoute=null,activeEncounter=null,currentShop=null;
let worldDrawFrame=0,worldDrawTimer=0,worldLastDraw=0;
const coarsePointer=!!window.matchMedia?.('(pointer:coarse)').matches;
const mobilePerformance=coarsePointer||!!navigator.connection?.saveData||(Number(navigator.deviceMemory)||8)<=4;
function scheduleWorldDraw(){
 if(worldDrawFrame||worldDrawTimer||screen!=='world')return;
 const queueFrame=()=>{worldDrawFrame=requestAnimationFrame(now=>{worldDrawFrame=0;if(screen!=='world')return;worldLastDraw=now;drawWorld()})};
 const delay=mobilePerformance?Math.max(0,30-(performance.now()-worldLastDraw)):0;
 if(delay>0)worldDrawTimer=setTimeout(()=>{worldDrawTimer=0;queueFrame()},delay);else queueFrame();
}
function worldCleared(id){return worldState.clearedEncounters?.includes(id)}
function worldNodeUnlocked(node){return !!node&&(!node.requires||worldCleared(node.requires))&&(!node.requiresQuest||questStatus(node.requiresQuest)==='completed')}
function worldNodeVisible(node){return !!node&&(worldNodeUnlocked(node)||worldState.currentNode===node.id)}
function worldCanTravel(from,to){if(account?.needsStarter&&from!==to)return false;const target=WORLD_NODES[to];return from===to||!!(target&&WORLD_NODES[from]?.neighbors.includes(to)&&worldNodeVisible(target)&&worldNodeUnlocked(target))}
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

const {TYPES,WEIGHTS,ICON,EFFECT_LIBRARY,ITEMS,CONSUMABLES,EQUIPMENT_SLOTS,GEAR}=globalThis.GEMMO_CONTENT;
const {comboChargeTypes,comboChargeBonus}=COMBAT_RULES;
const COLOR_BALANCE=globalThis.GEMMO_COLOR_BALANCE,ENEMY_LOADOUTS=globalThis.GEMMO_ENEMY_LOADOUTS;
const {BRANCHES:SKILL_BRANCHES,SKILL_BY_ID,xpProgress,skillEffects,skillRank,requirementMet,pointsSpent}=PROGRESSION;
const {CUTSCENES,QUESTS,NPCS,DIALOGUES}=STORY;
const DEFAULT_EQUIPMENT={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
let equipment={...DEFAULT_EQUIPMENT},inventory=[],inventoryItems=[],combatConsumables={},chosenGearSlot='chest';
let account=null,accountToken=null,accountSyncTimer=0,lastAccountSync='';let captchaConfig=null,captchaWidgetId=null,captchaToken='',captchaConfigPromise=null,authBusy=false;
let activeStory=null,storyBusy=false;
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
const consumableById=id=>CONSUMABLES.find(v=>v.id===id);
const gearSlotById=id=>EQUIPMENT_SLOTS.find(s=>s.id===id);
function gearStats(loadout=equipment){
 return Object.values(loadout).reduce((out,id)=>{
  const g=gearById(id);if(!g)return out;out.hp+=g.hp||0;out.guard+=g.guard||0;
  for(const color of ['red','blue','green','yellow','purple']){out.caps[color]+=(g.caps?.[color]||0)+(g.allCap||0);out.chargeGain[color]+=g.chargeGain?.[color]||0}
  return out;
 },{hp:0,guard:0,caps:{red:0,blue:0,green:0,yellow:0,purple:0},chargeGain:{red:0,blue:0,green:0,yellow:0,purple:0}})
}
function gearBonusText(g){
 if(!g)return 'No bonus';const parts=[];if(g.hp)parts.push('+'+g.hp+' MAX HP');if(g.guard)parts.push('+'+g.guard+' START GUARD');
 for(const color of ['red','blue','green','yellow','purple']){if(g.caps?.[color])parts.push('+'+g.caps[color]+' '+color.toUpperCase()+' MAX CHARGE');if(g.chargeGain?.[color])parts.push('✦ +'+g.chargeGain[color]+' '+color.toUpperCase()+' CHARGE / MATCH')}
 if(g.allCap)parts.push('+'+g.allCap+' MAX CHARGE · ALL COLORS');if(g.weaponGemSlots)parts.push('+'+g.weaponGemSlots+' WEAPON SLOT'+(g.weaponGemSlots===1?'':'S'));return parts.join(' · ')||'No bonus';
}
const GEAR_SLOT_ICON={head:'◒',chest:'▣',hands:'✦',legs:'Ⅱ',feet:'⌁',necklace:'◇',ring:'○'};
function gearSlotIcon(type){return GEAR_SLOT_ICON[type]||'▣'}
function openLoadoutScreen(next,origin=screen){loadoutReturnScreen=origin==='world'?'world':'menu';showScreen(next)}
function leaveMenuPage(){if(['sack','inventory'].includes(screen)&&loadoutReturnScreen==='world'){enterWorld();return}showScreen(account?'menu':'splash')}
function currentSkillIds(){return account?.skills?.purchased||[]}
function currentSkillEffects(){return skillEffects(currentSkillIds(),screen==='fight'?(activeAuthority?.mode||'replay-v7'):'replay-v4')}
function playerMaxHP(){return 18+gearStats().hp+currentSkillEffects().maxHP}
function matchPower(color,loadout=sack){const key=color==='red'?'attack':color==='blue'?'defense':null;if(!key)return 0;return loadout.reduce((sum,id)=>{const gem=itemById(id);return sum+(gem?.color===color?(gem[key]||0):0)},0)}
function weaponDamage(color,loadout=sack){return GEMMO_WEAPON_GEMS.weaponMatchDamage(loadout,color,itemById)}
function gemMatchStatText(gem){if(gem?.gemType==='weapon')return 'ATK '+Math.max(1,gem.attack||0)+(gem.defense?' · DEF '+gem.defense:'');return COLOR_BALANCE.ROLES[gem?.color]||''}
function canEquipGear(slot,id){
 const def=gearSlotById(slot),g=gearById(id);if(!def||!g||!inventory.includes(id)||def.type!==g.slot)return false;
 return !Object.entries(equipment).some(([other,equipped])=>other!==slot&&equipped===id);
}
function equipGear(slot,id){if(!canEquipGear(slot,id))return false;equipment[slot]=id;return true}
function unequipGear(slot){if(!gearSlotById(slot))return false;equipment[slot]=null;return true}
const DEFAULT_SACK=[null,null,null,null,null];
let sack=Array(5).fill(null),charges={red:0,blue:0,green:0,yellow:0,purple:0},screen='splash',chosenSlot=0,loadoutReturnScreen='menu',enemyTimer=0,motionOff=false,textSize='large';
let actionNumber=1,targetMode=null,targetKeepsTurn=false,armedAbilitySlot=-1,armedConsumableId=null,pinColumn=-1,pinTurns=0,guardTurns=0,evadeTurns=0,renderedTurnOwner='';
let buffs={dodge:0,reflect:0,poison:0,regen:0,focus:0,redwake:0,holdfast:0,aftergrowth:0,momentum:0},enemyEffects={bleed:0,stun:0,disarm:0,silence:0,mark:0},hintTimer=0,hintDelay=30000,swipeStart=null,suppressClickUntil=0;
function touchActivity(){clearTimeout(hintTimer);document.querySelectorAll('.hintCell').forEach(el=>el.classList.remove('hintCell'));if(hintDelay>0&&screen==='fight'&&!combatPaused&&playerTurn&&!busy&&!targetMode&&!freeSwap&&pHP>0&&eHP>0)hintTimer=setTimeout(showHint,hintDelay)}
function showHint(){if(hintDelay===0)return;if(screen!=='fight'||!playerTurn||busy||targetMode||freeSwap||pHP<=0||eHP<=0)return;const move=legalMoves()[0];if(move){move.forEach(p=>cellAt(p).classList.add('hintCell'));setLog('HINT: swap the two glowing tiles.')}else void reshuffleBoard()}
const combatItemById=id=>{const gem=ITEMS.find(i=>i.id===id);return gem&&activeAuthority?.mode?{...COLOR_BALANCE.gemSpec(gem.legacy,activeAuthority.mode),gemType:gem.gemType}:gem};
const itemById=id=>screen==='fight'?combatItemById(id):ITEMS.find(i=>i.id===id);
let procsUsed=[];
function colorRuleState(){return {version:activeAuthority?.mode||'replay-v7',sack,skill:currentSkillEffects(),buffs,procsUsed,charges,ec,pHP,pGuard,guardTurns}}
function weaponGemEffects(){return [currentSkillEffects(),...Object.values(equipment).map(gearById).filter(Boolean)]}
function sackIsValid(list=sack){if(!Array.isArray(list)||list.length!==5)return false;const equipped=list.filter(Boolean);return GEMMO_WEAPON_GEMS.validWeaponGems(list,weaponGemEffects())&&equipped.length>=1&&equipped.every(id=>itemById(id))&&new Set(equipped).size===equipped.length}
function encounterSpec(id=activeEncounter){return ENCOUNTERS.forVersion(id||'bandit',activeAuthority?.mode||'replay-v7')||ENCOUNTERS.bandit}
function usesEnemyGems(){return ENEMY_LOADOUTS.isCurrent(activeAuthority?.mode||'replay-v7')}
function enemyGemState(){return {hp:eHP,maxHP:enemyMaxHP(),guard:eGuard,charge:ec,opponentCharge:charges,silenced:enemyEffects.silence,disarmed:enemyEffects.disarm}}
function enemyGems(){return ENEMY_LOADOUTS.gems(encounterSpec(),combatItemById)}
function enemyReservoir(type){return usesEnemyGems()?{name:type.toUpperCase(),cap:ENEMY_LOADOUTS.cap(encounterSpec(),type,combatItemById),visible:enemyGems().some(g=>g.color===type)}:encounterSpec().reservoirs[type]}
function enemyLabel(){return encounterSpec().name}
function enemyMaxHP(){return encounterSpec().maxHP}
function scaledEnemyValue(value,scale,min=0){return Math.max(min,Math.ceil(value*scale))}
function enemyMoveScore(type){
 if(usesEnemyGems())return ENEMY_LOADOUTS.score(encounterSpec(),type,combatItemById,enemyGemState());
 const ai=encounterSpec().ai;
 if(type==='green')return eHP<ai.woundedBelow?ai.greenWounded:ai.greenHealthy;
 return ai[type]||0;
}
let resumedArmedSpec=null,resumedConsumablePaid=false,combatCheckpointQueue=Promise.resolve();
let board=[],boardBonus=[],selected=null,busy=false,playerTurn=true,freeSwap=false,extraTurn=false,enemyExtraTurn=false,overdrive=false,enemyReload=false,encounterClearSaved=false,encounterSettling=false,activeMatchId=null,activeRewardBudget=null,activeAuthority=null,combatRng=null,combatTranscript=[],matchStartPromise=null,rewardsSettled=false,lossSettlementStarted=false,lastMatchError='',combatPaused=false;
let pHP=18,eHP=24,pGuard=0,eGuard=0,gold=0,xp=0;
let ec={red:0,blue:0,green:0,yellow:0,purple:0};
const $=id=>document.getElementById(id), boardEl=$('board'),logEl=$('log');
function makeCombatRng(seed){return COMBAT_CORE.makeRng(seed)}
function combatJournalKey(matchId=activeMatchId){return 'gemmo.match.'+(account?.user?.id||'local')+'.'+matchId}
function persistCombatJournal(){if(!activeMatchId)return;try{localStorage.setItem(combatJournalKey(),JSON.stringify(combatTranscript))}catch{}}
function clearCombatJournal(){try{localStorage.removeItem(combatJournalKey())}catch{}}
function recordCombatAction(action){if(!['replay-v1','replay-v2','replay-v3','replay-v4','replay-v5','replay-v6','replay-v7'].includes(activeAuthority?.mode))return;combatTranscript.push(action);persistCombatJournal();if(!accountToken||!activeMatchId)return;const matchId=activeMatchId,transcript=JSON.parse(JSON.stringify(combatTranscript));combatCheckpointQueue=combatCheckpointQueue.catch(()=>{}).then(()=>accountRequest('/v1/matches/checkpoint',{method:'POST',body:{matchId,transcript}})).catch(error=>{lastMatchError=error.message;return null})}
async function flushCombatCheckpoint(){await combatCheckpointQueue;if(activeMatchId&&accountToken)return accountRequest('/v1/matches/checkpoint',{method:'POST',body:{matchId:activeMatchId,transcript:combatTranscript}})}

function roll(){let total=WEIGHTS.reduce((a,b)=>a+b,0),r=1+Math.floor((combatRng?combatRng():Math.random())*total),a=0;for(let i=0;i<TYPES.length;i++){a+=WEIGHTS[i];if(r<=a)return TYPES[i]}return'red'}
function rollBonus(){return activeAuthority?.mode==='replay-v1'?0:COMBAT_RULES.rollGemBonus(combatRng||Math.random)}
function rollTile(){return {type:roll(),bonus:rollBonus()}}
function buildBoard(){board=[];boardBonus=[];for(let y=0;y<H;y++){let row=[],bonuses=[];for(let x=0;x<W;x++){let k=roll(),tries=0;while(tries++<30&&((x>=2&&row[x-1]===k&&row[x-2]===k)||(y>=2&&board[y-1][x]===k&&board[y-2][x]===k)))k=roll();row.push(k);bonuses.push(rollBonus())}board.push(row);boardBonus.push(bonuses)}if(!legalMoves().length)return buildBoard();render()}
function swap(a,b){COMBAT_CORE.swap(board,a,b);COMBAT_CORE.swap(boardBonus,a,b)}
function findMatches(){return COMBAT_CORE.findMatches(board,TYPES)}
function reservoirCap(color){const skills=currentSkillEffects();return sack.reduce((sum,id)=>sum+(itemById(id)?.color===color?itemById(id).cap:0),0)+gearStats().caps[color]+skills.allCap+skills.caps[color]}
function legalMoves(){return COMBAT_CORE.legalMoves(board,TYPES)}
function damageEnemy(n,pierceGuard=false){if(enemyEffects.mark&&n>0){n+=3;enemyEffects.mark=0;setLog('HUNTER’S MARK: +3 damage.')}let blocked=pierceGuard?0:Math.min(eGuard,n);eGuard-=blocked;eHP-=n-blocked;damageFlight('e',n-blocked,blocked)}
function damagePlayer(n,pierceGuard=false){if(buffs.dodge)n=Math.ceil(n/2);let blocked=pierceGuard?0:Math.min(pGuard,n),dealt=n-blocked;pGuard-=blocked;pHP-=dealt;damageFlight('p',dealt,blocked);if(buffs.reflect&&dealt>0){buffs.reflect=0;const reflected=Math.max(1,Math.ceil(dealt/2));damageEnemy(reflected);setLog('REPRISAL: reflected '+reflected+' damage.')}}
function charge(obj,type,n,cap){obj[type]=Math.min(cap,obj[type]+n)}
function lowestReservoir(exclude){
 const order=['red','blue','green','yellow','purple'];let best=null,bestRatio=Infinity;
 for(const color of order){if(color===exclude)continue;const cap=reservoirCap(color);if(!cap||charges[color]>=cap)continue;const ratio=charges[color]/cap;if(ratio<bestRatio){best=color;bestRatio=ratio}}
 return best;
}
function applyColor(type,n,actor,cascade=0,comboBonus=false){let notes=[];if(actor==='player'){
 const colored=['red','blue','green','yellow','purple'].includes(type),mult=!comboBonus&&overdrive&&colored?2:1;
 if(colored){const cap=reservoirCap(type),before=charges[type],gearGain=gearStats().chargeGain[type]||0,skillGain=currentSkillEffects().chargeGain[type]||0,matchGain=!comboBonus&&n>=3?gearGain+skillGain:0;charges[type]=Math.min(cap,charges[type]+n*mult+matchGain);if(cap)notes.push(type+' reservoir +'+(charges[type]-before)+(matchGain?' · resonance +'+matchGain:'')+' ('+charges[type]+'/'+cap+')')}
 const legacyWeaponRule=['replay-v1','replay-v2'].includes(activeAuthority?.mode);
 const colorState=colorRuleState();if(!comboBonus){COLOR_BALANCE.applyColorPerk(colorState,type,n,{lookup:itemById,maxHP:playerMaxHP(),cap:reservoirCap});pHP=colorState.pHP;pGuard=colorState.pGuard;guardTurns=colorState.guardTurns;}
 const attack=legacyWeaponRule?(type==='red'?matchPower('red'):0):weaponDamage(type);if(attack){const value=n*mult*attack+COLOR_BALANCE.strikeBonus(colorState,attack,comboBonus);damageEnemy(value);notes.push(type+' strike '+value+' · ATK '+attack)}
 if(!COLOR_BALANCE.isCurrent(colorState.version)&&type==='red'&&!comboBonus&&buffs.redwake){damageEnemy(2);notes.push('Redwake +2')}
 if(type==='blue'){const defense=matchPower('blue'),value=n*mult*defense;pGuard+=value;if(value||!COLOR_BALANCE.isCurrent(colorState.version))guardTurns=2;if(value){notes.push('Guard +'+value+' · DEF '+defense);}if(COLOR_BALANCE.attuneProc(colorState,'holdfast',comboBonus)){pGuard+=2;guardTurns=2;notes.push('Holdfast +2')}}
 if(type==='green'&&COLOR_BALANCE.attuneProc(colorState,'aftergrowth',comboBonus)){const before=pHP;pHP=Math.min(playerMaxHP(),pHP+2);notes.push('Aftergrowth +'+(pHP-before)+' HP')}
 if(type==='yellow'&&COLOR_BALANCE.attuneProc(colorState,'momentum',comboBonus)){const target=lowestReservoir('yellow');if(target){const before=charges[target],cap=reservoirCap(target);charges[target]=Math.min(cap,charges[target]+2);notes.push('Momentum: '+target+' +'+(charges[target]-before))}}
 if(!comboBonus&&mult===2){overdrive=false;notes.push('Overdrive ×2')}
 if(type==='gold'){const before=gold,cap=activeRewardBudget?.gold??Infinity;gold=Math.min(cap,gold+n);notes.push('Gold +'+(gold-before))}
 if(type==='xp'){const before=xp,cap=activeRewardBudget?.xp??Infinity;xp=Math.min(cap,xp+n);notes.push('XP +'+(xp-before))}
 }else if(usesEnemyGems()){
 const cap=enemyReservoir(type)?.cap||0;if(cap)charge(ec,type,n,cap);
 const attack=GEMMO_WEAPON_GEMS.weaponMatchDamage(encounterSpec().sack,type,combatItemById);
 if(attack&&!enemyEffects.disarm){damagePlayer(n*attack);notes.push(type+' strike '+n*attack)}
 if(cap)notes.push(type+' charge '+ec[type]+'/'+cap);
 }else{
 const reservoir=enemyReservoir(type);if(reservoir)charge(ec,type,n,reservoir.cap);
 if(type==='red'){const rules=encounterSpec().match,raw=n+(!comboBonus&&enemyReload?(rules.reloadBonus||0):0),dm=scaledEnemyValue(raw,rules.redScale,rules.redMin);if(!comboBonus)enemyReload=false;if(enemyEffects.disarm){notes.push('Disarmed: Red damage prevented')}else{damagePlayer(dm);notes.push('Hit '+dm)}}
 if(type==='blue'){const rules=encounterSpec().match,v=scaledEnemyValue(n,rules.blueScale,rules.blueMin);eGuard+=v;evadeTurns=2;notes.push('Guard +'+v)}
 }
 if(cascade>0&&notes.length&&!comboBonus)notes.push('Cascade '+cascade);
 if(notes.length&&!comboBonus)setLog((actor==='player'?'You':enemyLabel())+': '+notes.join(' • '));
}
function enemyAbilityReady(ability){
 const reservoir=enemyReservoir(ability.color);if(!reservoir||ec[ability.color]<reservoir.cap)return false;
 if(ability.when?.hpAtMost!==undefined&&eHP>ability.when.hpAtMost)return false;
 if(ability.when?.guardAtMost!==undefined&&eGuard>ability.when.guardAtMost)return false;
 return true;
}
function enemyUseActive(){
 if(usesEnemyGems()){
  const encounter=encounterSpec(),view=enemyGemState(),gem=ENEMY_LOADOUTS.choose(encounter,combatItemById,view);if(!gem)return false;
  const before=eGuard,hpBefore=eHP;
  ENEMY_LOADOUTS.cast(gem,view,{encounter,lookup:combatItemById,damage:damagePlayer});
  eHP+=view.hp-hpBefore;eGuard=view.guard;if(eGuard>before)evadeTurns=2;
  announceAbility(enemyLabel(),gem.name,gem.desc,gem.color);afterAction('enemy');checkEnd();return true;
 }
 if(enemyEffects.silence)return false;
 const ability=encounterSpec().actives.find(enemyAbilityReady);if(!ability)return false;
 ec[ability.color]=0;let detail=ability.detail;
 if(ability.kind==='damage'){if(ability.disarmable&&enemyEffects.disarm)detail=ability.blockedDetail||'Disarmed — no damage.';else damagePlayer(ability.power)}
 else if(ability.kind==='heal')eHP=Math.min(enemyMaxHP(),eHP+ability.power);
 else if(ability.kind==='guard'){eGuard+=ability.power;evadeTurns=2}
 else if(ability.kind==='reload')enemyReload=true;
 else if(ability.kind==='drain'){const color=COMBAT_RULES.fullestChargeColor(charges);if(color){const amount=Math.min(ability.power,charges[color]);charges[color]-=amount;detail='Drained '+amount+' '+color+' charge.'}else detail='No charge to drain.'}
 else return false;
 announceAbility(enemyLabel(),ability.name,detail,ability.color);afterAction('enemy');checkEnd();return true;
}

const reducedMotion=()=>motionOff||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const performanceMode=()=>mobilePerformance;
const luxuryFX=()=>!mobilePerformance&&!reducedMotion();
let effectOrigin=null,damageAnimations=[];
function cellAt(p){return boardEl.children[p.y*W+p.x]}
function center(el){const r=el.getBoundingClientRect(),a=$('fxLayer').getBoundingClientRect();return {x:r.left+r.width/2-a.left,y:r.top+r.height/2-a.top}}
function effectCenter(el){return reducedMotion()?null:center(el)}
const MOTION={swap:170,pop:190,flight:340,settle:440};
const shownHP={p:18,e:24},pendingHP={p:0,e:0};
function syncHealth(side){const hp=shownHP[side],max=side==='p'?playerMaxHP():enemyMaxHP();$(side+'fill').style.transform='scaleX('+Math.max(0,hp)/max+')';$(side+'health').setAttribute('aria-valuenow',Math.max(0,hp));$(side+'health').setAttribute('aria-valuemax',max);$(side+'stats').textContent=(side==='p'?Math.max(0,hp)+'/'+max:Math.max(0,hp))+' HP · '+(side==='p'?pGuard+' GUARD':eGuard+' GUARD')}
function animate(el,frames,options){
 if(reducedMotion())return Promise.resolve();
 const animation=el.animate(frames,options);
 return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);animation.cancel();resolve()};const timer=setTimeout(finish,(options.delay||0)+options.duration+100);animation.finished.then(finish,finish)});
}
const GEM_POP={
 red:{duration:235,shards:5,easing:'cubic-bezier(.16,.82,.2,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(1.18,.68)',opacity:1,offset:.28},
  {transform:b+' scale(.58,1.3)',opacity:.92,offset:.58},
  {transform:b+' scale(.05)',opacity:0}
 ]},
 blue:{duration:255,shards:4,easing:'cubic-bezier(.18,.76,.18,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.76,1.18)',opacity:1,offset:.3},
  {transform:b+' scale(1.28,.42)',opacity:.9,offset:.65},
  {transform:b+' scale(.05,.01)',opacity:0}
 ]},
 green:{duration:270,shards:4,easing:'cubic-bezier(.16,.78,.2,1)',frames:b=>[
  {transform:b+' translateY(0) scale(1)',opacity:1},
  {transform:b+' translateY(2px) scale(.82,1.18)',opacity:1,offset:.28},
  {transform:b+' translateY(-8px) scale(1.2,.7)',opacity:.9,offset:.65},
  {transform:b+' translateY(-13px) scale(.06)',opacity:0}
 ]},
 yellow:{duration:220,shards:5,easing:'cubic-bezier(.1,.9,.18,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.68)',opacity:1,offset:.2},
  {transform:b+' scale(1.52)',opacity:.94,offset:.56},
  {transform:b+' scale(.05)',opacity:0}
 ]},
 purple:{duration:280,shards:4,easing:'cubic-bezier(.22,.7,.16,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.42)',opacity:1,offset:.36},
  {transform:b+' scale(1.34)',opacity:.78,offset:.72},
  {transform:b+' scale(.04)',opacity:0}
 ]},
 gold:{duration:245,shards:5,easing:'cubic-bezier(.14,.84,.18,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.78)',opacity:1,offset:.24},
  {transform:b+' scale(1.36)',opacity:.94,offset:.6},
  {transform:b+' scale(.07)',opacity:0}
 ]},
 xp:{duration:230,shards:5,easing:'cubic-bezier(.12,.88,.18,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.62)',opacity:1,offset:.22},
  {transform:b+' scale(1.5,.84)',opacity:.92,offset:.58},
  {transform:b+' scale(.04)',opacity:0}
 ]},
 wild:{duration:290,shards:6,easing:'cubic-bezier(.16,.8,.18,1)',frames:b=>[
  {transform:b+' scale(1)',opacity:1},
  {transform:b+' scale(.52)',opacity:1,offset:.3},
  {transform:b+' scale(1.42)',opacity:.84,offset:.7},
  {transform:b+' scale(.03)',opacity:0}
 ]}
};
function popAccent(origin,type,color,delay=0){
 if(reducedMotion()||!origin)return;
 const el=document.createElement('i');
 el.className='popAccent popAccent-'+type;
 let css='',frames=[],duration=320;
 if(type==='red'){
  css='width:28px;height:4px;background:'+color+';border-radius:2px;';
  frames=[
   {transform:'translate(-50%,-50%) scaleX(.35)',opacity:1},
   {transform:'translate(-50%,-50%) scaleX(1.9)',opacity:1,offset:.34},
   {transform:'translate(calc(-50% - 18px),-50%) scaleX(.5)',opacity:0}
  ];
 }else if(type==='blue'){
  css='width:5px;height:26px;background:'+color+';border-radius:2px;';
  frames=[
   {transform:'translate(-50%,-60%) scaleY(.3)',opacity:1},
   {transform:'translate(-50%,-20%) scaleY(1.65)',opacity:1,offset:.42},
   {transform:'translate(-50%,22px) scaleY(.35)',opacity:0}
  ];
 }else if(type==='green'){
  css='width:13px;height:13px;background:'+color+';border-radius:50% 50% 50% 12%;';
  frames=[
   {transform:'translate(-50%,-50%) scale(.45)',opacity:1},
   {transform:'translate(-50%,-15px) scale(1.15)',opacity:1,offset:.46},
   {transform:'translate(-50%,-34px) scale(.35)',opacity:0}
  ];
  duration=360;
 }else if(type==='yellow'){
  css='width:30px;height:3px;background:'+color+';border-radius:2px;box-shadow:0 0 0 1px '+color+'55;';
  frames=[
   {transform:'translate(-50%,-50%) scaleX(.2)',opacity:1},
   {transform:'translate(-50%,-50%) scaleX(2.15)',opacity:1,offset:.38},
   {transform:'translate(-50%,-50%) scaleX(.2)',opacity:0}
  ];
 }else if(type==='purple'){
  css='width:30px;height:30px;border:3px solid '+color+';border-radius:50%;';
  frames=[
   {transform:'translate(-50%,-50%) scale(1.75)',opacity:.95},
   {transform:'translate(-50%,-50%) scale(.35)',opacity:1,offset:.62},
   {transform:'translate(-50%,-50%) scale(.06)',opacity:0}
  ];
  duration=380;
 }else if(type==='gold'){
  css='width:11px;height:11px;background:'+color+';border-radius:50%;border:1px solid #fff3b0;';
  frames=[
   {transform:'translate(-50%,-50%) scale(.7)',opacity:1},
   {transform:'translate(-50%,-18px) scale(1.25)',opacity:1,offset:.5},
   {transform:'translate(-50%,-31px) scale(.45)',opacity:0}
  ];
  duration=360;
 }else if(type==='xp'){
  el.textContent='✦';
  css='width:30px;height:30px;color:'+color+';font:bold 30px/30px Georgia,serif;text-align:center;';
  frames=[
   {transform:'translate(-50%,-50%) scale(.3)',opacity:1},
   {transform:'translate(-50%,-50%) scale(1.75)',opacity:1,offset:.48},
   {transform:'translate(-50%,-50%) scale(.5)',opacity:0}
  ];
 }else{
  css='width:34px;height:34px;border:4px solid transparent;border-top-color:#ff7785;border-right-color:#ffe17b;border-bottom-color:#77efa3;border-left-color:#87bdff;border-radius:50%;';
  frames=[
   {transform:'translate(-50%,-50%) scale(.35)',opacity:1},
   {transform:'translate(-50%,-50%) scale(1.65)',opacity:1,offset:.52},
   {transform:'translate(-50%,-50%) scale(.55)',opacity:0}
  ];
  duration=390;
 }
 el.style.cssText='position:absolute;left:'+origin.x+'px;top:'+origin.y+'px;z-index:9;pointer-events:none;'+css;
 $('fxLayer').appendChild(el);
 animate(el,frames,{duration,delay,easing:'cubic-bezier(.14,.8,.18,1)'}).then(()=>el.remove());
}
function popGhost(el,origin,type,color,delay=0){
 if(reducedMotion()||!el||!origin)return Promise.resolve();
 const rect=el.getBoundingClientRect(),ghost=document.createElement('span'),gold=type==='gold',base=gold?'rotate(0deg)':'rotate(45deg)';
 ghost.className='gem popGhost '+type;
 ghost.dataset.i=ICON[type]||'';
 const size=Math.max(18,Math.round(Math.max(rect.width,rect.height)));
 ghost.style.cssText='position:absolute;left:'+(origin.x-size/2)+'px;top:'+(origin.y-size/2)+'px;width:'+size+'px;height:'+size+'px;margin:0;z-index:8;pointer-events:none;filter:none;';
 $('fxLayer').appendChild(ghost);
 const frames={
  red:[
   {transform:base+' translateX(0) scale(1)',opacity:1},
   {transform:base+' translateX(-10px) scale(1.35,.7)',opacity:1,offset:.38},
   {transform:base+' translateX(18px) scale(.22,.95)',opacity:0}
  ],
  blue:[
   {transform:base+' translateY(0) scale(1)',opacity:1},
   {transform:base+' translateY(8px) scale(.78,1.35)',opacity:1,offset:.42},
   {transform:base+' translateY(24px) scale(.18,.4)',opacity:0}
  ],
  green:[
   {transform:base+' translateY(0) scale(1)',opacity:1},
   {transform:base+' translateY(-10px) scale(1.18,.88)',opacity:1,offset:.46},
   {transform:base+' translateY(-26px) scale(.28)',opacity:0}
  ],
  yellow:[
   {transform:base+' scale(1)',opacity:1},
   {transform:base+' scale(1.8,.42)',opacity:1,offset:.46},
   {transform:base+' scale(.15,1.5)',opacity:0}
  ],
  purple:[
   {transform:base+' scale(1)',opacity:1},
   {transform:base+' scale(.26)',opacity:1,offset:.58},
   {transform:base+' scale(.03)',opacity:0}
  ],
  gold:[
   {transform:base+' translateY(0) scale(1)',opacity:1},
   {transform:base+' translateY(-12px) scale(1.25)',opacity:1,offset:.5},
   {transform:base+' translateY(-30px) scale(.3)',opacity:0}
  ],
  xp:[
   {transform:base+' scale(1)',opacity:1},
   {transform:base+' scale(1.9,.55)',opacity:1,offset:.46},
   {transform:base+' scale(.2)',opacity:0}
  ],
  wild:[
   {transform:base+' scale(1)',opacity:1},
   {transform:base+' scale(.4)',opacity:1,offset:.38},
   {transform:base+' scale(1.95)',opacity:.82,offset:.72},
   {transform:base+' scale(.05)',opacity:0}
  ]
 }[type]||[];
 return animate(ghost,frames,{duration:type==='wild'?360:type==='purple'?345:320,delay,easing:'cubic-bezier(.14,.8,.18,1)'}).then(()=>ghost.remove());
}
function burst(origin,color,count=4,type='red'){
 if(reducedMotion()||!origin)return;
 const shape={red:[7,3,'1px'],blue:[4,6,'1px'],green:[5,5,'50%'],yellow:[3,8,'1px'],purple:[6,4,'1px'],gold:[5,5,'50%'],xp:[3,7,'1px'],wild:[5,5,'50%']}[type]||[5,5,'1px'];
 for(let i=0;i<count;i++){
  const p=document.createElement('i'),angle=(i/count)*Math.PI*2+(type==='yellow'?.2:type==='purple'?.4:0),dist=24+(i%3)*9;
  p.className='shard shard-'+type;p.style.cssText='left:'+origin.x+'px;top:'+origin.y+'px;background:'+color+';color:'+color+';width:'+shape[0]+'px;height:'+shape[1]+'px;border-radius:'+shape[2]+';';
  $('fxLayer').appendChild(p);
  animate(p,[{transform:'translate(-50%,-50%) scale(1.2)',opacity:1},{transform:'translate('+Math.cos(angle)*dist+'px,'+Math.sin(angle)*dist+'px) scale(.06)',opacity:0}],{duration:320+i*16,easing:'cubic-bezier(.12,.72,.25,1)'}).then(()=>p.remove())
 }
}
async function popCells(cells){
 const palette={red:'#ff7c80',blue:'#87bdff',green:'#9affba',yellow:'#ffe39b',purple:'#d5acff',gold:'#ffe39b',xp:'#acfbff',wild:'#fff'};
 const points=cells.map(p=>{const type=board[p.y][p.x],cell=cellAt(p),el=cell?.firstElementChild;return {el,origin:cell?center(cell):null,type,color:palette[type]||'#fff'}});
 const ghostStep=Math.max(1,Math.ceil(points.length/12)),burstBudget=Math.max(1,Math.floor(30/Math.max(1,points.length)));
 await Promise.all(points.map(async({el,origin,type,color},i)=>{
  if(!el)return;
  const pop=GEM_POP[type]||GEM_POP.red,base=type==='gold'?'rotate(0deg)':'rotate(45deg)';
  if(i%ghostStep===0){const delay=(i%3)*8;void popGhost(el,origin,type,color,delay);popAccent(origin,type,color,delay)}
  burst(origin,color,Math.min(pop.shards,burstBudget),type);
  await animate(el,[
   {transform:base+' scale(1)',opacity:1},
   {transform:base+' scale(.72)',opacity:.9,offset:.35},
   {transform:base+' scale(.08)',opacity:0}
  ],{duration:205,delay:(i%3)*8,easing:'cubic-bezier(.2,.72,.2,1)'});
  el.style.opacity='0';
 }))
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
 try{await Promise.all([[ea,dx,dy],[eb,-dx,-dy]].map(([el,x,y])=>animate(el,frames(el,x,y).map(frame=>{if(el.classList.contains('chargedGem'))delete frame.filter;return frame}),{duration:Math.max(80,MOTION.swap*(reverse?1:1-startProgress*.55)),easing:'cubic-bezier(.18,.82,.22,1)'})))}finally{ea.classList.remove('movingGem');eb.classList.remove('movingGem')}
}
async function fallColumns(){
 const falling=[];for(let x=0;x<W;x++){if(x===pinColumn&&pinTurns>0){for(let y=0;y<H;y++)if(!board[y][x]){const tile=rollTile();board[y][x]=tile.type;boardBonus[y][x]=tile.bonus}continue}const kept=[];for(let y=H-1;y>=0;y--)if(board[y][x])kept.push({type:board[y][x],bonus:boardBonus[y][x]||0,from:y});
 const missing=H-kept.length;for(let y=H-1,i=0;y>=0;y--,i++){const entry=kept[i];const tile=entry||rollTile();board[y][x]=tile.type;boardBonus[y][x]=tile.bonus;const from=entry?entry.from:y-missing;if(from!==y)falling.push({x,y,from})}}
 render();const step=cellAt({x:0,y:1}).getBoundingClientRect().top-cellAt({x:0,y:0}).getBoundingClientRect().top;
 await Promise.all(falling.map(p=>animate(cellAt(p).firstElementChild,[{transform:'translate3d(0,'+((p.from-p.y)*step)+'px,0) rotate(45deg)',opacity:p.from<0?0:1},{transform:'translate3d(0,3px,0) rotate(45deg) scale(1.04,.96)',opacity:1,offset:.78},{transform:'translate3d(0,-1px,0) rotate(45deg)',opacity:1,offset:.9},{transform:'translate3d(0,0,0) rotate(45deg)',opacity:1}],{duration:280+Math.sqrt(p.y-p.from)*55,delay:p.x*9,easing:'cubic-bezier(.33,0,.67,1)'})));
 if(!findMatches()&&!legalMoves().length)await reshuffleBoard();
}

async function resolve(matches,actor,target,cascade=0,keepTurn=false,comboRoots=null){busy=true;let counts={},broken={};for(const p of matches.cells){let actual=board[p.y][p.x],type=p.type||actual;const value=1+(boardBonus[p.y]?.[p.x]||0);counts[type]=(counts[type]||0)+value;broken[actual]=(broken[actual]||0)+value}if(!comboRoots)comboRoots=comboChargeTypes(counts);recordBrokenGems(broken);let makeWild=null,match4=false;for(const run of matches.runs){if(run.len>=4)match4=true;if(run.len>=5&&!makeWild){makeWild=run.cells.find(p=>target&&p.x===target.x&&p.y===target.y)||run.cells[Math.floor(run.cells.length/2)]}}
 render();const wildCount=matches.cells.filter(p=>board[p.y][p.x]==='wild').length;if(wildCount)setLog(wildCount+' Wild'+(wildCount===1?' substitutes':'s substitute')+' in this match. Only matched tiles are removed.');await popCells(matches.cells);
 for(const [type,n] of Object.entries(counts)){effectOrigin=center(cellAt(matches.cells.find(p=>(p.type||board[p.y][p.x])===type)));applyColor(type,n,actor,cascade)}effectOrigin=null;
 if(cascade>0){const bonus=comboChargeBonus(cascade);for(const type of comboRoots)applyColor(type,bonus,actor,cascade,true);recordComboCharge(comboRoots,bonus,cascade+1)}
 for(const p of matches.cells){board[p.y][p.x]='';boardBonus[p.y][p.x]=0}if(makeWild){board[makeWild.y][makeWild.x]='wild';boardBonus[makeWild.y][makeWild.x]=0;setLog('Five-match: a Wild was forged. Wilds substitute for any tile type in a line of 3+.')}if(match4&&actor==='enemy'&&usesEnemyGems())enemyExtraTurn=true;if(match4&&actor==='player'){extraTurn=true;setLog('Four-or-more match: you earn an extra turn.')}
 await fallColumns();await Promise.all(damageAnimations.splice(0));checkEnd();if(pHP<=0||eHP<=0){busy=false;return}let next=findMatches();if(next){busy=false;return resolve(next,actor,null,cascade+1,keepTurn,comboRoots)}busy=false;afterAction(actor,keepTurn)}
async function trySwap(a,b,actor,force=false,startProgress=0){
 if(busy)return false;busy=true;
 if(actor==='player')recordCombatAction({t:'swap',ax:a.x,ay:a.y,bx:b.x,by:b.y});

 await swapMotion(a,b,false,startProgress);swap(a,b);

 const m=findMatches();
 if(!m&&!force){swap(a,b);await swapMotion(a,b,true);setLog('That swap makes no match.');busy=false;render();return false}
 if(!activeCombatMove)beginCombatMove(actor,force&&!m?'QUICKSTEP':'MATCH');
 if(m)await resolve(m,actor,b,0);else{busy=false;setLog('Quickstep repositions the board.');afterAction(actor);render()}return true
}
function collapse(){for(let x=0;x<W;x++){let kept=[];for(let y=H-1;y>=0;y--)if(board[y][x])kept.push({type:board[y][x],bonus:boardBonus[y][x]||0});let i=0;for(let y=H-1;y>=0;y--){const tile=i<kept.length?kept[i++]:rollTile();board[y][x]=tile.type;boardBonus[y][x]=tile.bonus}}if(!legalMoves().length)buildBoard()}
async function reshuffleBoard(){
 const wasBusy=busy;busy=true;clearTimeout(hintTimer);setLog('NO MOVES — sweeping the board and dealing fresh gems. HP and reservoirs stay.','system');
 await Promise.all(Array.from(boardEl.children).map((el,i)=>animate(el,[{transform:'translateX(0)',opacity:1},{transform:'translateX(50px)',opacity:0}],{duration:260,delay:Math.floor(i/8)*25,easing:'ease-in'})));
 buildBoard();await Promise.all(Array.from(boardEl.children).map((el,i)=>animate(el,[{transform:'translateY(-25px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:280,delay:(i%8)*20,easing:'ease-out'})));busy=wasBusy;render();touchActivity();
}
function afterAction(actor,keepTurn=false){
 actionNumber++;
 if(pHP<=0||eHP<=0){playerTurn=true;render();checkEnd();return}
 if(actor==='enemy'){
  if(buffs.poison){damageEnemy(2);setLog('VENOM: Enemy takes 2 damage.');buffs.poison--}
  if(enemyEffects.bleed){damageEnemy(2);setLog('BLEED: Enemy takes 2 damage.');enemyEffects.bleed--}
  if(buffs.regen){pHP=Math.min(playerMaxHP(),pHP+2);setLog('RESTORING VERSE: heal 2 HP.');buffs.regen--}
  if(buffs.focus){for(const color of Object.keys(charges))charges[color]=Math.min(reservoirCap(color),charges[color]+1);setLog('RESONANCE: +1 to each equipped reservoir.');buffs.focus--}
  if(buffs.dodge)buffs.dodge--;
  if(enemyEffects.silence)enemyEffects.silence--;
  if(enemyEffects.disarm)enemyEffects.disarm--;
  if(pinTurns&&!--pinTurns){pinColumn=-1;setLog('EARTHBIND ends: columns fall normally again.')}
  if(guardTurns&&!--guardTurns){pGuard=0;setLog('Your Guard expires.')}
 }else if(evadeTurns&&!--evadeTurns){eGuard=0;setLog('Enemy Guard expires.')}
 if(pHP<=0||eHP<=0){playerTurn=true;render();checkEnd();return}
 if(actor==='player'){
  procsUsed=[];
  for(const key of ['redwake','holdfast','aftergrowth','momentum'])if(buffs[key])buffs[key]--;
  if(keepTurn){playerTurn=true;setLog('Quick effect: your turn continues.')}
  else if(extraTurn){extraTurn=false;playerTurn=true;setLog('Extra turn: you move again.')}
  else{playerTurn=false;enemyTimer=setTimeout(enemyMove,520)}
 }else if(usesEnemyGems()&&(keepTurn||enemyExtraTurn)){enemyExtraTurn=false;playerTurn=false;enemyTimer=setTimeout(enemyMove,520)}else playerTurn=true;
 finishCombatMove();render();checkEnd();touchActivity();
}

function commitArmedAbility(){
 if(resumedArmedSpec){const spec=resumedArmedSpec;resumedArmedSpec=null;return spec}
 const index=armedAbilitySlot;if(index<0)return null;const spec=itemById(sack[index]);if(!spec)return null;
 armedAbilitySlot=-1;recordCombatAction({t:'ability',slot:index});beginCombatMove('player',spec.name);effectOrigin=effectCenter($('slots').children[index]);
 announceAbility('You',spec.name,spec.desc+' Spent '+spec.cap+' '+spec.color+' charge.',spec.color);effectOrigin=null;return spec;
}
function cancelArmedAbility(index){
 if(index!==armedAbilitySlot)return false;const spec=itemById(sack[index]);if(!spec)return false;
 charges[spec.color]=Math.min(reservoirCap(spec.color),charges[spec.color]+spec.cap);targetMode=null;targetKeepsTurn=false;freeSwap=false;selected=null;armedAbilitySlot=-1;
 setLog(spec.name+' cancelled. No charge spent.','system');render();touchActivity();return true;
}
async function applyTarget(p){
 const mode=targetMode,keepTurn=targetKeepsTurn;
 if(mode==='consumable_break'){
  const item=consumableById(armedConsumableId);if(!item||(!resumedConsumablePaid&&!combatConsumableCount(item.id))||!activeMatchId){targetMode=null;armedConsumableId=null;render();return}
  busy=true;
  try{
   if(!resumedConsumablePaid){await flushCombatCheckpoint();const data=await accountRequest('/v1/matches/consume',{method:'POST',body:{matchId:activeMatchId,itemId:item.id}});combatConsumables[item.id]--;applyAccount(data.account);recordCombatAction({t:'consume',itemId:item.id})}resumedConsumablePaid=false;
   recordCombatAction({t:'target',x:p.x,y:p.y});beginCombatMove('player','ITEM · '+item.name);const type=board[p.y][p.x];if(type)recordBrokenGems({[type]:1+(boardBonus[p.y]?.[p.x]||0)});
   targetMode=null;targetKeepsTurn=false;armedConsumableId=null;effectOrigin=effectCenter(cellAt(p));await popCells([p]);effectOrigin=null;board[p.y][p.x]='';boardBonus[p.y][p.x]=0;await fallColumns();setLog('CHERRY BOMB: destroyed one '+(type||'board')+' gem.','system');
   render();const m=findMatches();if(m)await resolve(m,'player',p,0,false,null);else{busy=false;afterAction('player',false)}
  }catch(error){busy=false;targetMode=null;targetKeepsTurn=false;armedConsumableId=null;setLog('Cherry Bomb failed: '+error.message.replaceAll('_',' '),'system');render();touchActivity()}
  return;
 }
 if(!mode||!commitArmedAbility())return;targetMode=null;targetKeepsTurn=false;busy=true;recordCombatAction({t:'target',x:p.x,y:p.y});let comboRoots=null;
 if(mode==='pin'){pinColumn=p.x;pinTurns=1;setLog('EARTHBIND: column '+(p.x+1)+' is pinned through the next enemy action.');busy=false;afterAction('player',keepTurn);return}
 if(mode==='weapon_paint'){const color=itemById(sack.find(GEMMO_WEAPON_GEMS.isWeaponGem))?.color;if(color)board[p.y][p.x]=color;}
 if(mode==='paint')board[p.y][p.x]='red';
 if(mode==='wildcraft')board[p.y][p.x]='wild';
 if(mode==='rotate'){board[p.y].unshift(board[p.y].pop());boardBonus[p.y].unshift(boardBonus[p.y].pop())}
 if(mode==='reroll'){const tile=rollTile();board[p.y][p.x]=tile.type;boardBonus[p.y][p.x]=tile.bonus}
 if(mode==='blast'&&COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')){const color=itemById(sack.find(GEMMO_WEAPON_GEMS.isWeaponGem))?.color;if(color)charges[color]=Math.min(reservoirCap(color),charges[color]+2);}
 if(['break','blast','purge'].includes(mode)){
  let cells=[];
  if(mode==='break')cells=[p];
  if(mode==='blast')cells=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>q.x>=0&&q.x<W&&q.y>=0&&q.y<H);
  if(mode==='purge'){const chosen=board[p.y][p.x];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]===chosen)cells.push({x,y})}
  if(cells.length){
   const broken={};for(const q of cells){const type=board[q.y][q.x];if(type)broken[type]=(broken[type]||0)+1+(boardBonus[q.y]?.[q.x]||0)}recordBrokenGems(broken);comboRoots=comboChargeTypes(broken);
   if(mode==='break'){const type=board[p.y][p.x];if(type){effectOrigin=effectCenter(cellAt(p));applyColor(type,1+(boardBonus[p.y]?.[p.x]||0),'player');effectOrigin=null}}
   await popCells(cells);for(const q of cells){board[q.y][q.x]='';boardBonus[q.y][q.x]=0}await fallColumns();
  }
 }
 render();const m=findMatches();if(m)await resolve(m,'player',p,comboRoots!==null?1:0,keepTurn,comboRoots);else{busy=false;afterAction('player',keepTurn)}
}

function activate(index){
 if(screen!=='fight'||!playerTurn||busy||pHP<=0||eHP<=0)return;
 if(cancelArmedAbility(index))return;if(freeSwap||targetMode)return;
 const spec=itemById(sack[index]);if(spec?.kind==='weapon_paint'&&!sack.some(GEMMO_WEAPON_GEMS.isWeaponGem)){setLog('Equip a weapon to use Flux.');return}if(!spec||charges[spec.color]<spec.cap){if(spec)setLog(spec.name+' needs '+(spec.cap-charges[spec.color])+' more charge.');return}
 if(spec.kind==='boost'&&overdrive){setLog('Overdrive is already primed. Make a colored match first.');return}
 const needsTarget=['pin','paint','weapon_paint','wildcraft','rotate','break','blast','reroll','purge','swap'].includes(spec.kind);
 touchActivity();charges[spec.color]-=spec.cap;
 if(needsTarget){
  armedAbilitySlot=index;selected=null;
  if(spec.kind==='swap')freeSwap=true;else{targetMode=spec.kind;targetKeepsTurn=spec.turnCost===0}
  setLog('Choose a '+(spec.kind==='swap'?'swap':targetMode==='rotate'?'row':targetMode==='pin'?'column':'tile')+' on the board · tap '+spec.name+' again to cancel.');render();return;
 }
 recordCombatAction({t:'ability',slot:index});beginCombatMove('player',spec.name);const guardBefore=pGuard;effectOrigin=effectCenter($('slots').children[index]);
 if(usesEnemyGems()&&ENEMY_LOADOUTS.supports(spec.kind)){
  const view={hp:pHP,maxHP:playerMaxHP(),guard:pGuard,charge:charges,opponentCharge:ec};
  ENEMY_LOADOUTS.cast(spec,view,{encounter:{sack},lookup:itemById,damage:damageEnemy,capacity:reservoirCap,paid:true});
  pHP=view.hp;pGuard=view.guard;if(pGuard>guardBefore)guardTurns=2;if(spec.onHitSilence)enemyEffects.silence=spec.onHitSilence;
  effectOrigin=null;announceAbility('You',spec.name,spec.desc+' Spent '+spec.cap+' '+spec.color+' charge.',spec.color);afterAction('player',spec.turnCost===0);checkEnd();render();return;
 }
 if(spec.kind==='damage')damageEnemy(spec.power,spec.pierceGuard);
 if(spec.onHitGuard)pGuard+=spec.onHitGuard;
 if(spec.onHitHeal)pHP=Math.min(playerMaxHP(),pHP+spec.onHitHeal);
 if(spec.onHitSilence)enemyEffects.silence=spec.onHitSilence;
 if(spec.onHitSteal)COLOR_BALANCE.stealCharge(colorRuleState(),spec.onHitSteal,{lookup:itemById,cap:reservoirCap});
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
 if(spec.kind==='siphon'){damageEnemy(2);const color=Object.keys(ec).sort((a,b)=>ec[b]-ec[a])[0],amount=Math.min(3,ec[color]);ec[color]-=amount;const target=COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')?itemById(sack.find(GEMMO_WEAPON_GEMS.isWeaponGem))?.color:'purple';if(target)charges[target]=Math.min(reservoirCap(target),charges[target]+amount)}
 if(spec.kind==='quick_damage')damageEnemy(spec.power);
 if(spec.kind==='execute')damageEnemy(eHP<=8?10:spec.power);
 if(spec.kind==='breach'){eGuard=0;damageEnemy(spec.power)}
 if(spec.kind==='bleed')enemyEffects.bleed=2;
 if(spec.kind==='reflect')buffs.reflect=1;
 if(spec.kind==='stun')enemyEffects.stun=1;
 if(spec.kind==='disarm')enemyEffects.disarm=1;
 if(spec.kind==='cleanse')pHP=Math.min(playerMaxHP(),pHP+spec.power);
 if(spec.kind==='mark')enemyEffects.mark=1;
 if(spec.kind==='silence')enemyEffects.silence=1;
 if(pGuard>guardBefore)guardTurns=2;
 effectOrigin=null;announceAbility('You',spec.name,spec.desc+' Spent '+spec.cap+' '+spec.color+' charge.',spec.color);afterAction('player',spec.turnCost===0);
 checkEnd();render();
}
async function enemyMove(){if(screen!=='fight'||combatPaused||playerTurn||busy||pHP<=0||eHP<=0)return;if(enemyEffects.stun){enemyEffects.stun=0;setLog('STUN: '+enemyLabel()+' loses its action.');afterAction('enemy');return}if(enemyUseActive())return;let moves=legalMoves();if(!moves.length){await reshuffleBoard();moves=legalMoves();if(!moves.length){afterAction('enemy');return}}let best=moves[0],bestScore=-Infinity;for(const mv of moves){swap(mv[0],mv[1]);let m=findMatches(),score=0;if(m)for(const p of m.cells){let t=p.type||board[p.y][p.x];score+=enemyMoveScore(t)*(1+(boardBonus[p.y]?.[p.x]||0))}swap(mv[0],mv[1]);if(score>bestScore){bestScore=score;best=mv}}return trySwap(best[0],best[1],'enemy')}
function tapCell(x,y){touchActivity();if(screen!=='fight'||!playerTurn||busy||pHP<=0||eHP<=0)return;let p={x,y};if(targetMode){void applyTarget(p);return}if(!selected){selected=p;render();return}let dist=Math.abs(selected.x-x)+Math.abs(selected.y-y);if(dist===1){let a=selected;selected=null;if(freeSwap){if(!commitArmedAbility()){freeSwap=false;render();return}freeSwap=false;trySwap(a,p,'player',true)}else trySwap(a,p,'player',false)}else{selected=p;render()}}
async function startMatchTicket(){
 if(!accountToken||!activeEncounter)return null;
 try{
  if(!await syncAccountLoadout())throw new Error('loadout_not_synced');
  const data=await accountRequest('/v1/matches/start',{method:'POST',body:{encounterId:activeEncounter}});
  applyAccount(data.account);activeMatchId=data.match?.matchId||null;activeRewardBudget=data.match?.rewardBudget||null;activeAuthority=data.match?.authority||null;combatRng=['replay-v1','replay-v2','replay-v3','replay-v4','replay-v5','replay-v6','replay-v7'].includes(activeAuthority?.mode)?makeCombatRng(activeAuthority.seed):null;
  if(activeRewardBudget){gold=Math.min(gold,activeRewardBudget.gold);xp=Math.min(xp,activeRewardBudget.xp);render()}lastMatchError='';return activeMatchId;
 }catch(error){activeMatchId=null;lastMatchError=error.message||'match_start_failed';if(error.message==='unfinished_match'){await refreshAccount();enterWorld()}return null}
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
  const firstClear=!worldCleared(activeEncounter),unlockText=encounterSpec().unlockText;
  let data;
  const resultBody={matchId:activeMatchId,won:true,gold,xp};if(['replay-v1','replay-v2','replay-v3','replay-v4','replay-v5','replay-v6','replay-v7'].includes(activeAuthority?.mode))resultBody.transcript=combatTranscript;
  try{data=await accountRequest('/v1/matches/settle',{method:'POST',body:resultBody})}
  catch(error){
   if(error.status===0||error.status>=500){await new Promise(resolve=>setTimeout(resolve,650));data=await accountRequest('/v1/matches/settle',{method:'POST',body:resultBody})}
   else throw error;
  }
  const previousLevel=account?.profile?.level||1;applyAccount(data.account);clearCombatJournal();rewardsSettled=true;encounterClearSaved=worldCleared(activeEncounter);
  const awardedGold=data.settlement?.gold??gold,awardedXp=data.settlement?.xp??xp,newLevel=account?.profile?.level||previousLevel,levelGain=Math.max(0,newLevel-previousLevel),points=account?.skills?.availablePoints||0;
  $('resultText').textContent='+'+awardedGold+' GOLD · +'+awardedXp+' XP'+(levelGain?' · LEVEL '+newLevel+'! · '+points+' SKILL POINT'+(points===1?'':'S'):'')+(firstClear&&worldCleared(activeEncounter)&&unlockText?' · '+unlockText:'');
 }catch(error){$('resultText').textContent='SAVE FAILED · '+saveErrorText(error);$('resultRetry').hidden=false}
 finally{encounterSettling=false;$('resultMenu').disabled=false}
}
async function settleDefeat(){
 if(lossSettlementStarted||encounterSettling||!accountToken)return;
 lossSettlementStarted=true;encounterSettling=true;$('resultMenu').disabled=true;$('resultRetry').hidden=true;$('resultText').textContent='SAVING…';
 try{
  if(!await ensureMatchTicket())throw new Error(lastMatchError||'match_start_failed');
  const body={matchId:activeMatchId,won:false,gold:0,xp:0};if(['replay-v1','replay-v2','replay-v3','replay-v4','replay-v5','replay-v6','replay-v7'].includes(activeAuthority?.mode))body.transcript=combatTranscript;
  const data=await accountRequest('/v1/matches/settle',{method:'POST',body});applyAccount(data.account);clearCombatJournal();
  $('resultText').textContent=data.settlement?.respawnNode?'You awaken at '+WORLD_NODES[data.settlement.respawnNode].name+'.':account?.world?.currentNode===account?.world?.checkpoint?'You awaken at '+WORLD_NODES[account.world.currentNode].name+'.':'No rewards earned.';
 }catch(error){lossSettlementStarted=false;$('resultText').textContent='Could not save your result. Please retry.';$('resultRetry').hidden=false}
 finally{encounterSettling=false;$('resultMenu').disabled=false}
}
function checkEnd(){if(pHP<=0||eHP<=0)clearTimeout(hintTimer);if(screen!=='fight')return;if(eHP<=0||pHP<=0){eHP=Math.max(0,eHP);pHP=Math.max(0,pHP);const won=eHP<=0;$('resultTitle').textContent=won?'VICTORY':'DEFEAT';$('resultText').textContent=won?'SAVING…':'';$('result').classList.add('show');if(won)void settleVictory();else void settleDefeat();render()}}
let combatHistory=[],logSequence=0,activeCombatMove=null;
function setLog(message,kind='event'){
 logEl.textContent=message;logEl.dataset.kind=kind;
}
function moveActorLabel(actor){return actor==='player'?'YOU':enemyLabel()}
function renderMoveHistory(){
 const host=$('moveHistory');if(!host)return;
 if(!combatHistory.length){host.innerHTML='<article class="moveHistoryItem moveHistoryPlaceholder latest" aria-hidden="true"><div class="moveHistoryMeta"><small>&nbsp;</small><strong>&nbsp;</strong></div><div class="moveBreaks"><span class="moveNoBreak">&nbsp;</span></div></article>';return}
 host.innerHTML=combatHistory.slice(-3).reverse().map((move,index)=>{
  const breaks=Object.entries(move.breaks||{}).filter(([,value])=>value>0).map(([type,value])=>'<span class="moveBreak'+(move.anchorGrowth?.[type]?' comboAnchor':'')+'" style="--anchor-scale:'+(1+Math.min(.38,(move.anchorGrowth?.[type]||0)*.065))+';--anchor-glow:'+Math.min(18,4+(move.anchorGrowth?.[type]||0)*2)+'px;--c:var(--'+type[0]+')" data-gem="'+type+'" title="'+type+' value '+value+'"><span class="historyGemVisual gem '+type+'" data-i="'+(ICON[type]||'')+'"></span><b>'+value+'</b></span>').join('');
  const ability=move.ability?'<span class="moveAbilityChip" style="--c:var(--'+(move.ability.color?.[0]||'gold')+')"><i>✦</i><b>ABILITY</b></span>':'';
  return '<article class="moveHistoryItem '+move.actor+' '+(move.ability?'abilityMove ':'')+(index===0?'latest':'')+'"><div class="moveHistoryMeta"><small>'+move.actorLabel+(move.comboDepth?' · COMBO '+move.comboDepth:'')+'</small><strong>'+move.label+'</strong></div><div class="moveBreaks">'+ability+breaks+(ability||breaks?'':'<span class="moveNoBreak">—</span>')+'</div></article>';
 }).join('');
}
function beginCombatMove(actor,label){
 const move={anchorGrowth:{},id:++logSequence,actor,actorLabel:moveActorLabel(actor),label:String(label||'MATCH').toUpperCase(),breaks:{},ability:null};
 combatHistory.push(move);if(combatHistory.length>12)combatHistory.shift();activeCombatMove=move;renderMoveHistory();return move;
}
function recordBrokenGems(counts){
 if(!activeCombatMove||!counts)return;
 for(const [type,value] of Object.entries(counts))activeCombatMove.breaks[type]=(activeCombatMove.breaks[type]||0)+value;
 renderMoveHistory();
}
function recordComboCharge(types,amount,comboNumber){
 if(!activeCombatMove||!types?.length||amount<=0)return;
 const priorGrowth={...activeCombatMove.anchorGrowth};activeCombatMove.anchorGrowth=activeCombatMove.anchorGrowth||{};
 for(const type of types){activeCombatMove.breaks[type]=(activeCombatMove.breaks[type]||0)+amount;activeCombatMove.anchorGrowth[type]=(activeCombatMove.anchorGrowth[type]||0)+amount}
 activeCombatMove.comboDepth=comboNumber;renderMoveHistory();
 for(const type of types){const gem=document.querySelector('.moveHistoryItem.latest .moveBreak[data-gem="'+type+'"]');if(!gem)continue;gem.dataset.charge='+'+amount+'!';gem.classList.add('comboCharging');const before=1+Math.min(.38,(priorGrowth[type]||0)*.065),after=1+Math.min(.38,activeCombatMove.anchorGrowth[type]*.065);void animate(gem,[{transform:'scale('+before+')',filter:'brightness(1)'},{transform:'scale('+(after+.14)+')',filter:'brightness(1.9)',offset:.45},{transform:'scale('+after+')',filter:'brightness(1.2)'}],{duration:560,easing:'cubic-bezier(.16,1,.3,1)'})}
}
function finishCombatMove(){activeCombatMove=null}
function announceAbility(actor,name,description,color='gold'){
 const enemy=actor!=='You';if(!activeCombatMove)beginCombatMove(enemy?'enemy':'player',name);
 activeCombatMove.ability={name,description,color};renderMoveHistory();setLog(actor+' uses '+name.toUpperCase()+' — '+description,'ability');
 const card=document.querySelector('.moveHistoryItem.latest');if(card)void animate(card,[{transform:'translateY(3px) scale(.98)',opacity:.6},{transform:'translateY(0) scale(1)',opacity:1}],{duration:220,easing:'ease-out'});
}
function flash(){let f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go')}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function updateTurnCue(){
 const owner=playerTurn?'player':'enemy',game=document.querySelector('.game'),badge=$('turnBadge');
 if(game){game.classList.remove('turn-player','turn-enemy');game.classList.add('turn-'+owner)}
 badge.classList.remove('turn-player','turn-enemy');badge.classList.add('turn-'+owner);
 badge.textContent=owner==='player'?'✦ YOUR TURN · '+actionNumber:'⚔ '+enemyLabel().toUpperCase()+' TURN · '+actionNumber;
 if(renderedTurnOwner!==owner){
  badge.classList.remove('turnPulse');if(!reducedMotion()){void badge.offsetWidth;badge.classList.add('turnPulse')}
  renderedTurnOwner=owner;
 }
}
function enemyIntent(){
 if(enemyEffects.stun)return {state:'blocked',text:'STUNNED · next action skipped'};
 if(enemyEffects.silence)return {state:'blocked',text:'SILENCED · cannot cast next action'};
 if(usesEnemyGems()){
  const ready=ENEMY_LOADOUTS.choose(encounterSpec(),combatItemById,enemyGemState());
  if(ready)return {state:'ready',text:'READY · '+ready.name+' · '+ready.cap+' '+ready.color.toUpperCase(),detail:ready.desc};
  const next=enemyGems().slice().sort((a,b)=>(a.cap-ec[a.color])-(b.cap-ec[b.color]))[0];
  return next?{state:'building',text:'BUILDING '+next.name+' · '+ec[next.color]+'/'+next.cap,detail:next.desc}:{state:'building',text:'WATCH THE BOARD'};
 }
 const abilities=encounterSpec().actives||[],ready=abilities.find(enemyAbilityReady);
 if(ready)return {state:'ready',text:'READY · '+ready.name+' · '+(ready.disarmable&&enemyEffects.disarm?ready.blockedDetail:ready.intent||ready.detail),detail:ready.detail};
 const building=abilities.filter(a=>enemyReservoir(a.color)?.visible).sort((a,b)=>(enemyReservoir(a.color).cap-ec[a.color])-(enemyReservoir(b.color).cap-ec[b.color]))[0];
 if(building)return {state:'building',text:'BUILDING '+building.name+' · '+ec[building.color]+'/'+enemyReservoir(building.color).cap};
 return {state:'building',text:'WATCH THE BOARD · enemy chooses a match'};
}
function renderEnemyIntent(){const intent=enemyIntent(),el=$('enemyIntent');el.textContent=intent.text;el.dataset.state=intent.state;el.title=intent.detail||intent.text}
let enemyDockRenderKey=null;
function renderEnemyChargeGauges(){
 const dock=$('enemyChargeGauges');
 if(usesEnemyGems()){
  const gems=enemyGems(),weapon=ENEMY_LOADOUTS.weapon(encounterSpec(),combatItemById),badge=$('enemyWeapon');
  badge.hidden=false;badge.style.setProperty('--c','var(--'+weapon.color[0]+')');badge.textContent='⚔ '+weapon.color.toUpperCase()+' · '+weapon.item;badge.setAttribute('aria-label','Inspect '+enemyLabel()+' loadout. '+weapon.color+' weapon: '+weapon.item);
  dock.classList.add('enemyGemDock');
  const html=gems.map((g,i)=>'<button class="enemyGem '+(ec[g.color]>=g.cap?'ready':'')+'" data-enemy-gem="'+g.id+'" style="--c:var(--'+g.color[0]+')" aria-label="Inspect '+g.item+', '+g.color+', '+ec[g.color]+' charge, costs '+g.cap+'">'+liquidChargeGem(g,'enemy'+i,Math.min(100,ec[g.color]/g.cap*100))+'<b>'+ec[g.color]+'/'+g.cap+'</b></button>').join('');
  if(html!==enemyDockRenderKey){enemyDockRenderKey=html;dock.innerHTML=html;dock.querySelectorAll?.('[data-enemy-gem]')?.forEach(b=>b.onclick=()=>openCombatSacks(b.dataset.enemyGem))}return;
 }
 $('enemyWeapon').hidden=true;dock.classList.remove('enemyGemDock');
 const colors=['red','blue','green','yellow','purple'],enemy=encounterSpec();
 const html=colors.map(color=>{const reservoir=enemy.reservoirs?.[color],active=!!reservoir?.visible,cap=reservoir?.cap||0,value=active?Math.min(cap,ec[color]||0):0,ratio=cap?Math.max(0,Math.min(1,value/cap)):0,label=reservoir?.name||color.toUpperCase();return '<div class="enemyChargeGauge '+color+(active?'':' inactive')+'" style="--c:var(--'+color[0]+');--fill:'+(ratio*100)+'%" title="'+label+' · '+(active?value+'/'+cap:'inactive')+'"><span class="enemyChargeDot"></span><span class="enemyChargeTrack"><i></i></span><b>'+(active?value+'/'+cap:'—')+'</b></div>'}).join('');
 if(html!==enemyDockRenderKey){enemyDockRenderKey=html;dock.innerHTML=html}
}
function render(){renderStatuses();boardEl.innerHTML='';for(let y=0;y<H;y++)for(let x=0;x<W;x++){let type=board[y]?.[x]||'',c=document.createElement('button');c.className='cell'+(selected&&selected.x===x&&selected.y===y?' sel':'')+(freeSwap&&selected&&Math.abs(selected.x-x)+Math.abs(selected.y-y)===1?' freeTarget':'');const bonus=boardBonus[y]?.[x]||0;c.setAttribute('aria-label',(type||'Empty')+' gem'+(bonus?' plus '+bonus+' value':'' )+', row '+(y+1)+', column '+(x+1));c.innerHTML=type?'<span class="gem '+type+(bonus?' chargedGem':'')+'" data-i="'+ICON[type]+'"></span>':'';c.addEventListener('click',()=>{if(Date.now()>suppressClickUntil)tapCell(x,y)});if(x===pinColumn&&pinTurns)c.classList.add('pinnedCell');boardEl.appendChild(c)}$('pstats').textContent='♥ '+pHP+' · ◈ '+pGuard;$('enemyName').textContent=enemyLabel();$('estats').textContent='♥ '+eHP+' · ◌ '+eGuard;$('gold').textContent='◆ '+gold+(activeRewardBudget?'/'+activeRewardBudget.gold:'');$('xp').textContent='XP '+xp+(activeRewardBudget?'/'+activeRewardBudget.xp:'');$('turnText').textContent=freeSwap?'↯ QUICKSTEP':(playerTurn?'✦ YOU':'⚔ '+enemyLabel().toUpperCase());$('turnText').style.color=freeSwap?'var(--y)':(playerTurn?'var(--g)':'var(--r)');renderEnemyChargeGauges();renderEnemyIntent();for(const [side,hp] of [['p',pHP],['e',eHP]]){if(!pendingHP[side])shownHP[side]=hp;syncHealth(side)}$('leaveFight').disabled=busy||!playerTurn||pendingHP.p>0||pendingHP.e>0;renderSlots()}
const chargeGemShapes={red:'16,4 48,4 60,20 52,52 32,62 12,52 4,20',blue:'32,2 60,30 32,62 4,30',green:'22,3 42,3 58,20 54,48 32,62 10,48 6,20',yellow:'32,2 60,48 48,60 16,60 4,48',purple:'20,3 44,3 58,32 44,61 20,61 6,32'};
const chargeGemLevels=new Map();
function liquidChargeGem(v,slot,fill){
 const key=slot+':'+v.id,prior=chargeGemLevels.get(key)??fill;chargeGemLevels.set(key,fill);
 const points=chargeGemShapes[v.color],clip='chargeGemClip'+slot,gradient='chargeGemLiquid'+slot,glass='chargeGemGlass'+slot,animate=prior!==fill&&!reducedMotion(),justReady=animate&&prior<100&&fill>=100;
 return '<svg class="liquidChargeGem '+(justReady?'readyPulse':'')+'" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="'+clip+'"><polygon points="'+points+'"/></clipPath><linearGradient id="'+gradient+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c)"/><stop offset=".16" stop-color="var(--c)"/><stop offset="1" stop-color="var(--c)" stop-opacity=".5"/></linearGradient><linearGradient id="'+glass+'" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".3"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".13"/></linearGradient></defs><polygon class="chargeGemShell" points="'+points+'"/><g clip-path="url(#'+clip+')"><g class="gemLiquid '+(animate?'liquidRise':'')+'" style="--liquid-from:'+(64*(1-prior/100))+'px;--liquid-to:'+(64*(1-fill/100))+'px"><rect x="0" y="0" width="64" height="64" fill="url(#'+gradient+')"/><path d="M0 1 Q16 -3 32 1 T64 1" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/></g><polygon points="'+points+'" fill="url(#'+glass+')"/><path d="M16 5 L25 27 L8 46 M48 5 L39 27 L56 46 M25 27 L39 27 L32 60" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1"/></g><polygon class="chargeGemRim" points="'+points+'"/>'+(v.gemType==='weapon'?'<path class="chargeWeaponMark" d="M25 16 L39 30 M39 16 L25 30 M23 26 L29 32 M35 32 L41 26"/>':'')+'</svg>';
}
let slotsRenderKey=null,reservoirRenderKey=null;
function renderSlots(){
 const equipped=sack.map((id,i)=>({v:itemById(id),i})).filter(entry=>entry.v),colors=[...new Set(equipped.map(entry=>entry.v.color))];
 const reservoirHtml=colors.map(color=>'<span style="--c:var(--'+color[0]+')">'+color.toUpperCase()+' <b>'+charges[color]+'/'+reservoirCap(color)+'</b></span>').join('');
 if(reservoirHtml!==reservoirRenderKey){reservoirRenderKey=reservoirHtml;$('reservoirs').innerHTML=reservoirHtml}
 const slots=$('slots');slots.style.gridTemplateColumns='repeat('+Math.max(1,equipped.length)+',minmax(0,1fr))';slots.style.maxWidth=Math.max(1,equipped.length)*160+'px';
 const html=equipped.map(({v,i})=>{
  const armed=i===armedAbilitySlot&&(!!targetMode||freeSwap),ready=charges[v.color]>=v.cap,fill=v.cap?Math.max(0,Math.min(100,charges[v.color]/v.cap*100)):0;
  return '<button class="slot compactGemCard liquidGemButton '+(v.gemType==='weapon'?'weaponGemCard ':'')+(armed?'armed ':ready?'ready ':'')+'" data-slot="'+i+'" style="--c:var(--'+v.color[0]+');--charge-fill:'+fill+'%" title="'+v.item+' · '+v.color.toUpperCase()+' · '+v.name+' — '+v.desc+'" aria-label="'+(v.gemType==='weapon'?'Weapon gem, ':'')+v.color+', '+v.name+', '+charges[v.color]+' charge, costs '+v.cap+(armed?', cancel targeting':ready?', ready to cast':'')+'">'+liquidChargeGem(v,i,fill)+'<span class="slotName">'+v.name+'</span><span class="charge"><b>'+charges[v.color]+'/'+v.cap+'</b>'+(armed?'<span class="chargeAction" title="Cancel targeting">×</span>':ready?'<span class="chargeAction">✦</span>':'')+'</span></button>';
 }).join('');
 if(html!==slotsRenderKey){slotsRenderKey=html;slots.innerHTML=html;slots.querySelectorAll?.('.slot:not(:disabled)')?.forEach(b=>b.onclick=()=>activate(Number(b.dataset.slot)))}
}
function sackGemDetails(g,charge,capacity,selected=false){
 return '<article class="inspectGem '+(selected?'selected':'')+'" style="--c:var(--'+g.color[0]+')"><span class="itemGem '+g.color+'"></span><div><small>'+g.color.toUpperCase()+' · '+(g.gemType==='weapon'?'⚔ WEAPON · '+g.attack+' DAMAGE / VALUE':'SUPPORT')+'</small><h4>'+g.item+'</h4><b>'+g.name+' · costs '+g.cap+'</b><p>'+g.desc+'</p><small>'+charge+' / '+capacity+' SHARED CHARGE</small></div></article>';
}
function openCombatSacks(selectedId=null){
 if(screen!=='fight')return;
 pauseCombatView();$('combatMenuPanel').hidden=true;
 $('playerSackDetails').innerHTML='<h3>YOUR GEMS</h3>'+sack.map(itemById).filter(Boolean).map(g=>sackGemDetails(g,charges[g.color],reservoirCap(g.color))).join('');
 $('enemySackDetails').innerHTML='<h3>'+enemyLabel()+' GEMS</h3>'+(usesEnemyGems()?enemyGems().map(g=>sackGemDetails(g,ec[g.color],enemyReservoir(g.color).cap,g.id===selectedId)).join(''):Object.entries(encounterSpec().reservoirs).filter(([,g])=>g.visible).map(([color,g])=>'<p>'+color.toUpperCase()+' · '+g.name+' · '+ec[color]+'/'+g.cap+'</p>').join(''));
 $('modal').classList.add('show');$('closeModal').focus?.();
 if(typeof selectedId==='string')document.querySelector('#enemySackDetails .selected')?.scrollIntoView?.({block:'nearest'});
}
$('enemyWeapon').onclick=()=>openCombatSacks();
$('modal').addEventListener('keydown',event=>{if(!$('modal').classList.contains('show'))return;if(event.key==='Escape'){event.preventDefault();$('closeModal').click?.()}else if(event.key==='Tab'){event.preventDefault();$('closeModal').focus?.()}});
$('sacksBtn').onclick=()=>openCombatSacks();$('closeModal').onclick=()=>{$('modal').classList.remove('show');if(combatPaused)resumeCombatView()};

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
function resetCaptcha(){captchaToken='';if(captchaConfig?.enabled&&$('captchaHint'))$('captchaHint').textContent='Verifying…';if(captchaWidgetId!==null&&window.turnstile){try{window.turnstile.reset(captchaWidgetId)}catch{}}}
async function renderCaptcha(){
 const config=await loadCaptchaConfig(),wrap=$('captchaWrap');if(!wrap)return;
 if(!config?.enabled||account){wrap.hidden=true;return}
 wrap.hidden=false;$('captchaHint').textContent=captchaToken?'Human check ready.':'Verifying…';
 const mount=()=>{
  if(account||!captchaConfig?.enabled)return;
  if(!window.turnstile){setTimeout(mount,120);return}
  if(captchaWidgetId!==null)return;
  captchaWidgetId=window.turnstile.render('#turnstileWidget',{
   sitekey:captchaConfig.siteKey,theme:'dark',appearance:'always',size:'flexible',action:'auth',
   callback:token=>{captchaToken=token;$('captchaHint').textContent='Human check ready.'},
   'expired-callback':()=>{captchaToken='';$('captchaHint').textContent='Human check expired — checking again…'},
   'error-callback':()=>{captchaToken='';$('captchaHint').textContent='Verification unavailable — retrying…'}
  });
 };
 mount();
}
function worldItemGroups(snapshot=account){
 const ids=Array.isArray(snapshot?.inventory)?snapshot.inventory:[];
 return {sack:ids.filter(id=>itemById(id)),inventory:ids.filter(id=>gearById(id)||consumableById(id))};
}
function worldSeenKey(kind,userId){return 'gemmo.seen.'+userId+'.'+kind}
function worldSeenSet(kind,snapshot=account){
 const userId=snapshot?.user?.id,ids=worldItemGroups(snapshot)[kind]||[];if(!userId)return new Set(ids);
 try{
  const key=worldSeenKey(kind,userId),raw=localStorage.getItem(key);
  if(raw===null){localStorage.setItem(key,JSON.stringify(ids));return new Set(ids)}
  const parsed=JSON.parse(raw);return new Set(Array.isArray(parsed)?parsed:ids);
 }catch{return new Set(ids)}
}
function worldHasUnread(kind){
 const ids=worldItemGroups()[kind]||[],seen=worldSeenSet(kind);return ids.some(id=>!seen.has(id))
}
function markWorldSeen(kind){
 const userId=account?.user?.id;if(!userId)return;
 try{localStorage.setItem(worldSeenKey(kind,userId),JSON.stringify(worldItemGroups()[kind]||[]))}catch{}
 refreshWorldHud();
}
function currentWorldEffects(){
 const stats=gearStats(),skills=currentSkillEffects(),effects=[];
 for(const color of ['red','blue','green','yellow','purple'])if(weaponDamage(color))effects.push({icon:'⚔',name:color.toUpperCase()+' WEAPON DAMAGE',detail:weaponDamage(color)+' damage per matched '+color+' gem'});
 if(matchPower('blue'))effects.push({icon:'◇',name:'BLUE DEFENSE',detail:matchPower('blue')+' Guard per broken Blue gem from your Sack'});
 if(stats.hp||skills.maxHP)effects.push({icon:'♥',name:'MAX HP',detail:'+'+(stats.hp+skills.maxHP)+' from gear and skills'});
 if(stats.guard||skills.startGuard)effects.push({icon:'◆',name:'STARTING GUARD',detail:'+'+(stats.guard+skills.startGuard)+' at the start of combat'});
 for(const [color,active] of Object.entries(skills.colorPerks))if(active)effects.push({icon:'✦',name:color.toUpperCase()+' · '+COLOR_BALANCE.ROLES[color],detail:SKILL_BY_ID[color+'-start'].desc.split('. ').slice(1).join('. ')});
 const labels={red:'RED',blue:'BLUE',green:'GREEN',yellow:'YELLOW',purple:'PURPLE'};
 for(const [color,value] of Object.entries(stats.caps)){const total=value+skills.allCap+skills.caps[color];if(total)effects.push({icon:'◇',name:labels[color]+' CAPACITY',detail:'+'+total+' reservoir capacity'})}
 for(const [color,value] of Object.entries(skills.startCharge))if(value)effects.push({icon:'✦',name:labels[color]+' OPENING CHARGE',detail:'Start combat with '+value});
 for(const color of Object.keys(labels)){const total=(stats.chargeGain[color]||0)+(skills.chargeGain[color]||0);if(total)effects.push({icon:'✦',name:labels[color]+' CHARGE EFFICIENCY',detail:'+'+total+' charge whenever a '+labels[color]+' match resolves'})}
 return effects;
}
function renderWorldEffects(){
 const effects=currentWorldEffects();
 $('worldEffectsList').innerHTML=effects.length?effects.map(effect=>'<div class="worldEffect"><span class="worldEffectIcon">'+effect.icon+'</span><div><b>'+effect.name+'</b><span>'+effect.detail+'</span></div></div>').join(''):'<div class="worldEffect empty">No active gear or skill effects.</div>';
}
function questRecord(id){return account?.quests?.find?.(q=>q.id===id)||null}
function questStatus(id){const row=questRecord(id);if(row)return row.status;const q=QUESTS[id];if(q?.automatic)return account?.needsStarter?'active':'completed';return q?.requires&&questStatus(q.requires)!=='completed'?'locked':'available'}
function dialogueForNpc(npc){const id=(npc.questIds||[]).find(id=>!['locked','completed'].includes(questStatus(id)));return DIALOGUES[id==='trouble-on-road'?'warden-vale':id]||DIALOGUES[npc.dialogue]}
function activeDialogue(){return DIALOGUES[activeStory?.dialogueId]||dialogueForNpc(NPCS[activeStory.npcId])}
function cutsceneSeen(id){return account?.story?.seenCutscenes?.includes?.(id)||false}
function npcAtNode(nodeId){return Object.values(NPCS).find(npc=>npc.node===nodeId)||null}
function npcQuestMarker(npc){
 const dialogue=npc&&dialogueForNpc(npc),status=dialogue?questStatus(dialogue.questId):'completed';
 return status==='available'?'!':status==='ready'?'?':'';
}
function renderWorldQuests(){
 const rows=(account?.quests||[]).map(row=>({row,quest:QUESTS[row.id]})).filter(v=>v.quest);
 $('worldQuestList').innerHTML=rows.length?rows.map(({row,quest})=>{
  const objective=row.status==='completed'?'Completed':row.status==='ready'?'Return to '+NPCS[quest.returnTo].name:quest.objective.label+(quest.objective.count?' · '+Math.min(row.progress||0,quest.objective.count)+'/'+quest.objective.count:'');
  return '<article class="worldQuest '+row.status+'"><div class="worldQuestHead"><small>'+row.status.toUpperCase()+'</small><b>'+quest.title+'</b></div><p>'+quest.summary+'</p><strong>'+objective+'</strong><span>REWARD · '+quest.reward.gold+' ◆ · '+quest.reward.xp+' XP</span></article>';
 }).join(''):'<div class="worldEffect empty">No quests yet. Talk to people you meet.</div>';
}
function storyShow(){const overlay=$('storyOverlay');overlay.hidden=false;overlay.classList.add('open')}
function storyHide(){const overlay=$('storyOverlay');overlay.classList.remove('open');overlay.classList.remove('starterOffer');overlay.hidden=true;activeStory=null;storyBusy=false;$('storyStatus').textContent=''}
function storyPortrait(npc){
 const el=$('storyPortrait');if(!npc){el.hidden=true;el.textContent='';return}
 el.hidden=false;el.textContent=npc.mark||npc.name.slice(0,1);el.setAttribute('aria-label',npc.name);
}
async function markCutsceneClient(id){
 if(!accountToken||cutsceneSeen(id))return;
 try{const data=await accountRequest('/v1/story/cutscene',{method:'POST',body:{cutsceneId:id}});applyAccount(data.account)}catch{}
}
function renderCutscene(){
 const scene=CUTSCENES[activeStory.id],slide=scene?.slides?.[activeStory.index];if(!slide){const id=activeStory.id;storyHide();void markCutsceneClient(id);return}
 const npc=slide.speaker?Object.values(NPCS).find(n=>n.name===slide.speaker):null;storyPortrait(npc);
 $('storyKicker').textContent=slide.kicker||slide.speaker||'CUTSCENE';$('storyTitle').textContent=slide.title||slide.speaker||'';$('storyText').textContent=slide.text||'';
 $('storyChoices').innerHTML='';$('storyContinue').hidden=false;$('storyContinue').textContent=activeStory.index===scene.slides.length-1?'RETURN TO WORLD':'CONTINUE';$('storySkip').hidden=false;$('storyStatus').textContent='';
 $('storyBackdrop').dataset.scene=scene.id;
}
function startCutscene(id){
 if(!CUTSCENES[id]||cutsceneSeen(id)||activeStory)return false;
 activeStory={type:'cutscene',id,index:0};storyShow();renderCutscene();return true;
}
function maybeStartWorldCutscene(){
 if(screen!=='world'||activeStory||!account)return;
 const scene=Object.values(CUTSCENES).find(c=>c.trigger?.type==='world-enter'&&c.trigger.node===worldState.currentNode&&!cutsceneSeen(c.id));
 if(scene)startCutscene(scene.id);
}
function renderDialogue(){
 const npc=NPCS[activeStory.npcId],dialogue=activeDialogue(),node=dialogue.nodes[activeStory.nodeId];if(!node){storyHide();return}
 storyPortrait(npc);$('storyKicker').textContent=npc.title.toUpperCase();$('storyTitle').textContent=node.speaker||npc.name;$('storyText').textContent=node.text;$('storyContinue').hidden=true;$('storySkip').hidden=true;$('storyStatus').textContent='';
 $('storyChoices').innerHTML=(node.choices||[]).map((choice,i)=>'<button data-story-choice="'+i+'">'+choice.text+'</button>').join('');
 document.querySelectorAll('[data-story-choice]').forEach(button=>button.onclick=()=>void chooseDialogue(Number(button.dataset.storyChoice)));
}
function openDialogue(npcId){
 const npc=NPCS[npcId];if(!npc||npc.node!==worldState.currentNode||activeStory)return false;
 if(npcId==='warden-vale'&&account?.needsStarter){activeStory={type:'starter',npcId};storyShow();renderStarterWeapons();return true}
 const dialogue=dialogueForNpc(npc),status=questStatus(dialogue.questId),entry=dialogue.entries[status]||dialogue.entries.completed;
 activeStory={type:'dialogue',npcId,dialogueId:dialogue.id,nodeId:entry};storyShow();renderDialogue();return true;
}
function renderStarterWeapons(){
 $('storyOverlay').classList.add('starterOffer');
 const npc=NPCS['warden-vale'],chosen=itemById(activeStory?.gemId);storyPortrait(npc);
 $('storyKicker').textContent='YOUR FIRST WEAPON';$('storyTitle').textContent=npc.name;
 $('storyText').textContent=chosen?'This one is yours if you want it. Choose carefully—you get one weapon before the road.':'Before you leave, take one weapon gem. Your weapon makes matches of its color deal damage. Pick your damage color; I will fit it to your Sack.';
 $('storyContinue').hidden=true;$('storySkip').hidden=true;$('storyStatus').textContent='';
 const ids=chosen?[chosen.id]:GEMMO_WEAPON_GEMS.STARTER_WEAPON_IDS;
 $('storyChoices').innerHTML=ids.map(id=>{const v=itemById(id);return '<button class="starterWeaponChoice weaponGemCard" data-starter-weapon="'+id+'" style="--c:var(--'+v.color[0]+')"><span class="itemGem '+v.color+'" aria-hidden="true"></span><span><small>⚔ '+v.color.toUpperCase()+' · '+v.cap+' CHARGE</small><b>'+v.item+' · '+v.name+'</b><span>Matching '+v.color+' deals '+Math.max(1,v.attack||0)+' damage per gem. '+v.desc+'</span></span></button>'}).join('')+(chosen?'<button data-starter-confirm>Take '+chosen.item+'</button><button data-starter-back>See all five weapons</button>':'<button data-starter-later>Choose later</button>');
 document.querySelectorAll('[data-starter-weapon]').forEach(b=>b.onclick=()=>{if(storyBusy)return;activeStory.gemId=b.dataset.starterWeapon;renderStarterWeapons()});
 document.querySelectorAll('[data-starter-confirm]').forEach(b=>b.onclick=()=>void confirmStarterWeapon());
 document.querySelectorAll('[data-starter-back]').forEach(b=>b.onclick=()=>{if(storyBusy)return;delete activeStory.gemId;renderStarterWeapons()});
 document.querySelectorAll('[data-starter-later]').forEach(b=>b.onclick=()=>{if(!storyBusy)storyHide()});
}
async function confirmStarterWeapon(){
 if(storyBusy||activeStory?.type!=='starter'||!GEMMO_WEAPON_GEMS.STARTER_WEAPON_IDS.includes(activeStory.gemId))return;
 storyBusy=true;const id=activeStory.gemId;$('storyStatus').textContent='Equipping your weapon…';document.querySelectorAll('#storyChoices button').forEach(b=>b.disabled=true);
 try{const data=await accountRequest('/v1/account/starter',{method:'POST',body:{gemId:id}});applyAccount(data.account);storyHide();drawWorld()}
 catch(error){$('storyStatus').textContent=error.message.replaceAll('_',' ');document.querySelectorAll('#storyChoices button').forEach(b=>b.disabled=false)}
 finally{storyBusy=false}
}
async function chooseDialogue(index){
 if(storyBusy||activeStory?.type!=='dialogue')return;
 const npc=NPCS[activeStory.npcId],dialogue=activeDialogue(),node=dialogue.nodes[activeStory.nodeId],choice=node?.choices?.[index];if(!choice)return;
 if(choice.close){storyHide();return}
 if(choice.action){
  storyBusy=true;$('storyStatus').textContent='Saving…';document.querySelectorAll('[data-story-choice]').forEach(b=>b.disabled=true);
  try{
   const action=choice.action.type==='quest-accept'?'accept':choice.action.type==='quest-turnin'?'turnin':null;if(!action)throw new Error('invalid_story_action');
   const data=await accountRequest('/v1/story/quest',{method:'POST',body:{action,questId:choice.action.questId}});applyAccount(data.account);
  }catch(error){$('storyStatus').textContent=error.message.replaceAll('_',' ');storyBusy=false;document.querySelectorAll('[data-story-choice]').forEach(b=>b.disabled=false);return}
  storyBusy=false;
 }
 if(choice.next){activeStory.nodeId=choice.next;renderDialogue()}else storyHide();
}
function worldObjectiveData(){
 if(account?.needsStarter)return {title:'Choose your first weapon',text:'Talk to Warden Vale before leaving camp.',target:'camp',state:'weapon'};
 const quests=account?.quests||[],row=quests.find(q=>q.status==='ready')||quests.find(q=>q.status==='active');
 if(row){
  const quest=QUESTS[row.id];if(quest){
   if(row.status==='ready'){const npc=NPCS[quest.returnTo];return {title:quest.title,text:'Return to '+(npc?.name||'the quest giver'),target:npc?.node||null,state:'ready'}}
   const target=quest.objective?.encounterId==='troll'&&!worldCleared('sentinel')?'sentinel-gate':Object.values(WORLD_NODES).find(node=>node.encounter===quest.objective?.encounterId)?.id||quest.objective?.node||null;
   return {title:quest.title,text:quest.objective?.encounterId==='troll'&&!worldCleared('sentinel')?'Defeat the Road Sentinel to reach the final boss.':quest.objective?.label||quest.summary,target,state:'active'};
  }
 }
 const availableNpc=Object.values(NPCS).find(npc=>npcQuestMarker(npc)==='!');
 if(availableNpc)return {title:'New quest available',text:'Talk to '+availableNpc.name,target:availableNpc.node,state:'available'};
 const nextEncounter=Object.values(WORLD_NODES).find(node=>node.encounter&&worldNodeVisible(node)&&!worldCleared(node.encounter));
 if(nextEncounter)return {title:'Explore Brackenreach',text:'Travel to '+nextEncounter.name,target:nextEncounter.id,state:'explore'};
 return {title:'Brackenreach',text:'Explore the road, shops, and people you meet.',target:null,state:'explore'};
}
function refreshWorldHud(){
 if(!$('worldGold'))return;
 const progress=xpProgress(account?.profile?.xp||0),skillPoints=account?.skills?.availablePoints??0,objective=worldObjectiveData(),xpPct=progress.required?Math.max(0,Math.min(100,progress.current/progress.required*100)):100;
 $('worldGold').textContent=String(account?.profile?.gold||0);
 $('worldLevel').textContent='LV '+progress.level+' · XP '+progress.current+'/'+progress.required;
 $('worldPlayerName').textContent=(account?.character?.name||account?.user?.username||'ADVENTURER').toUpperCase();
 $('worldPlayerStats').textContent='♥ '+playerMaxHP()+' · ⚔ '+(itemById(sack.find(GEMMO_WEAPON_GEMS.isWeaponGem))?.color.toUpperCase()||'—')+' · ◈ '+(gearStats().guard+currentSkillEffects().startGuard);
 $('worldXpFill').style.width=xpPct+'%';$('worldSkillPoints').textContent='✦ '+skillPoints;
 $('worldObjectiveTitle').textContent=objective.title;$('worldObjectiveText').textContent=objective.text;$('worldObjectiveBtn').dataset.target=objective.target||'';$('worldObjectiveBtn').dataset.state=objective.state;
 $('worldSackPip').hidden=!worldHasUnread('sack');$('worldInventoryPip').hidden=!worldHasUnread('inventory');$('worldSkillPip').hidden=skillPoints<1;
 $('worldQuestPip').hidden=!(account?.quests||[]).some(q=>q.status==='ready');
 if(!$('worldEffectsPanel').hidden)renderWorldEffects();if(!$('worldQuestPanel').hidden)renderWorldQuests();
}

function applyAccount(next){
 if(!next)return;worldSeenSet('sack',next);worldSeenSet('inventory',next);account=next;
 if(Array.isArray(next.sack)&&next.sack.length===5)sack=next.sack.map(id=>id&&itemById(id)?id:null);
 if(next.equipment&&typeof next.equipment==='object'){const clean={...DEFAULT_EQUIPMENT};for(const def of EQUIPMENT_SLOTS){const id=next.equipment[def.id];if(id&&gearById(id)?.slot===def.type)clean[def.id]=id}equipment=clean}
 if(Array.isArray(next.inventory))inventory=next.inventory.filter(id=>gearById(id));inventoryItems=Array.isArray(next.inventoryItems)?next.inventoryItems.map(v=>({id:v.id,kind:v.kind,qty:Number(v.qty)||0})):Array.isArray(next.inventory)?next.inventory.map(id=>({id,kind:itemById(id)?'gem':gearById(id)?'gear':'unknown',qty:1})):[];
 if(next.world&&WORLD_NODES[next.world.currentNode]){worldState={region:next.world.region||'brackenreach',currentNode:next.world.currentNode,clearedEncounters:Array.isArray(next.world.clearedEncounters)?next.world.clearedEncounters:[]};selectedWorldNode=worldState.currentNode}
 lastAccountSync=JSON.stringify({sack,equipment});
 drawAccount();refreshWorldHud();
}
function applyTextSize(){const app=document.querySelector('.app');if(!app)return;for(const cls of ['text-normal','text-large','text-xl'])app.classList.remove(cls);app.classList.add('text-'+textSize)}
function saveDeviceSettings(){try{localStorage.setItem('gemmo.motionOff',String(motionOff));localStorage.setItem('gemmo.hintDelay',String(hintDelay));localStorage.setItem('gemmo.textSize',textSize);localStorage.setItem('gemmo.apiBase',apiBase)}catch{}}
let loadoutSyncPromise=null;
function loadoutSyncStatus(message){$('sackSaveStatus').textContent=message;$('inventorySaveStatus').textContent=message}
function scheduleAccountSync(){
 if(!accountToken||!account||!sackIsValid())return;loadoutSyncStatus('Saving…');
 clearTimeout(accountSyncTimer);accountSyncTimer=setTimeout(()=>void syncAccountLoadout(),250);
}
function syncAccountLoadout(){
 if(loadoutSyncPromise)return loadoutSyncPromise;
 loadoutSyncPromise=(async()=>{
  try{
   while(accountToken&&account&&sackIsValid()){
    const desired={sack:sack.slice(),equipment:{...equipment}},signature=JSON.stringify(desired),token=accountToken;if(signature===lastAccountSync){loadoutSyncStatus('Saved');return true;}
    loadoutSyncStatus('Saving…');await accountRequest('/v1/account/sack',{method:'PUT',body:{sack:desired.sack}});
    if(accountToken!==token)return false;
    const data=await accountRequest('/v1/account/equipment',{method:'PUT',body:{equipment:desired.equipment}});if(accountToken!==token)return false;
    account=data.account||account;lastAccountSync=signature;loadoutSyncStatus('Saved');$('accountStatus').textContent='Loadout saved.';
   }
   return !accountToken;
  }catch(error){loadoutSyncStatus('Not saved · '+error.message.replaceAll('_',' '));if(error.status===401){clearAccountSession();$('accountStatus').textContent='Session expired. Log in again.'}else $('accountStatus').textContent='Sync failed: '+error.message;return false}
 })().finally(()=>{loadoutSyncPromise=null});return loadoutSyncPromise;
}

function worldIso(x,y,z,canvas){
 const tw=58*worldCamera.zoom,th=29*worldCamera.zoom,zh=15*worldCamera.zoom;
 return {x:canvas.clientWidth/2+(x-y)*tw/2+worldCamera.panX,y:92+(x+y)*th/2-z*zh+worldCamera.panY};
}
function frameTrollHill(){
 if(!['troll-hill','item-shop','troll-cave'].includes(worldState.currentNode))return;
 const canvas=$('worldCanvas'),node=WORLD_NODES[worldState.currentNode];if(!canvas?.clientWidth)return;
 const point=worldIso(node.x,node.y,WORLD_HEIGHT[node.y][node.x],canvas);
 worldCamera.panX+=canvas.clientWidth/2-point.x;worldCamera.panY+=canvas.clientHeight*.57-point.y;
}
function worldPoly(ctx,pts,fill,stroke='#0003'){ctx.beginPath();pts.forEach((p,i)=>(i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function worldColor(x,y,road){if(x>=7&&y>=2&&y<=6&&!road)return ['#777456','#6a6a4e','#817856'][(x+y)%3];if(road)return ['#9a865b','#8c774e','#aa9465'][(x+y)%3];return ['#627451','#6c7e58','#71865e','#5b6d4b'][(x*3+y*5)%4]}
function drawWorld(){
 const canvas=$('worldCanvas');if(!canvas?.getContext)return;const wrap=$('worldViewport'),rect=wrap.getBoundingClientRect(),dpr=Math.min(mobilePerformance?1:2,window.devicePixelRatio||1);
 if(canvas.width!==Math.floor(rect.width*dpr)||canvas.height!==Math.floor(rect.height*dpr)){canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px'}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
 const tw=58*worldCamera.zoom,th=29*worldCamera.zoom,zh=15*worldCamera.zoom;
 const tile=(x,y)=>{const z=WORLD_HEIGHT[y]?.[x]||0,p=worldIso(x,y,z,canvas),top=[{x:p.x,y:p.y-th/2},{x:p.x+tw/2,y:p.y},{x:p.x,y:p.y+th/2},{x:p.x-tw/2,y:p.y}],base=worldIso(x,y,0,canvas),road=WORLD_ROAD.has(x+','+y)||(worldCleared('rat')&&WORLD_ROAD_BANDIT.has(x+','+y))||(worldCleared('bandit')&&WORLD_ROAD_SENTINEL.has(x+','+y));if(z>0){worldPoly(ctx,[top[1],top[2],{x:base.x,y:base.y+th/2},{x:base.x+tw/2,y:base.y}],'#3d4936');worldPoly(ctx,[top[2],top[3],{x:base.x-tw/2,y:base.y},{x:base.x,y:base.y+th/2}],'#35402f')}worldPoly(ctx,top,worldColor(x,y,road),'#25291f55')};
 for(let s=0;s<=16;s++)for(let y=0;y<9;y++){const x=s-y;if(x>=0&&x<9)tile(x,y)}
 const objectPoint=(x,y)=>worldIso(x,y,(WORLD_HEIGHT[y]?.[x]||0)+.15,canvas);
 ctx.lineCap='round';
 for(const [x,y] of WORLD_TREES){const p=objectPoint(x,y),scale=worldCamera.zoom;ctx.strokeStyle='#4b3828';ctx.lineWidth=3*scale;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-16*scale);ctx.stroke();ctx.fillStyle='#314c32';ctx.beginPath();ctx.moveTo(p.x,p.y-34*scale);ctx.lineTo(p.x+13*scale,p.y-10*scale);ctx.lineTo(p.x-13*scale,p.y-10*scale);ctx.closePath();ctx.fill();ctx.fillStyle='#426040';ctx.beginPath();ctx.moveTo(p.x,p.y-27*scale);ctx.lineTo(p.x+10*scale,p.y-12*scale);ctx.lineTo(p.x-10*scale,p.y-12*scale);ctx.closePath();ctx.fill()}
 for(const [x,y] of WORLD_ROCKS){const p=objectPoint(x,y),s=worldCamera.zoom;worldPoly(ctx,[{x:p.x,y:p.y-8*s},{x:p.x+8*s,y:p.y-2*s},{x:p.x+5*s,y:p.y+5*s},{x:p.x-7*s,y:p.y+4*s},{x:p.x-9*s,y:p.y-2*s}],'#77766a')}
 // Roads between world nodes.
 ctx.strokeStyle='#c1a36b';ctx.lineWidth=5*worldCamera.zoom;ctx.globalAlpha=.75;
 const done=new Set();for(const node of Object.values(WORLD_NODES).filter(worldNodeVisible))for(const n of node.neighbors){if(!worldNodeVisible(WORLD_NODES[n]))continue;const key=[node.id,n].sort().join('|');if(done.has(key))continue;done.add(key);const a=objectPoint(node.x,node.y),b=objectPoint(WORLD_NODES[n].x,WORLD_NODES[n].y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;
 worldHits=[];
 for(const node of Object.values(WORLD_NODES).filter(worldNodeVisible)){const p=objectPoint(node.x,node.y),current=node.id===worldState.currentNode,selected=node.id===selectedWorldNode,s=worldCamera.zoom,npc=npcAtNode(node.id);
  if(node.id==='camp'){ctx.fillStyle='#7c4c2d';ctx.beginPath();ctx.moveTo(p.x,p.y-22*s);ctx.lineTo(p.x+15*s,p.y);ctx.lineTo(p.x-15*s,p.y);ctx.closePath();ctx.fill();ctx.fillStyle='#e69245';ctx.beginPath();ctx.arc(p.x+13*s,p.y-2*s,3*s,0,Math.PI*2);ctx.fill()}
  if(node.checkpoint){ctx.fillStyle='#8a897c';ctx.fillRect(p.x-5*s,p.y-23*s,10*s,22*s);ctx.fillStyle='#aaa899';ctx.fillRect(p.x-9*s,p.y-25*s,18*s,5*s)}
  if(node.kind==='shop'){ctx.fillStyle=node.id==='gem-shop'?'#654f83':'#725135';ctx.fillRect(p.x-14*s,p.y-17*s,28*s,17*s);ctx.fillStyle='#d7bb82';ctx.beginPath();ctx.moveTo(p.x-18*s,p.y-18*s);ctx.lineTo(p.x+18*s,p.y-18*s);ctx.lineTo(p.x+12*s,p.y-28*s);ctx.lineTo(p.x-12*s,p.y-28*s);ctx.closePath();ctx.fill()}
  if(node.id==='rat'){ctx.strokeStyle='#5a4031';ctx.lineWidth=2*s;ctx.beginPath();ctx.arc(p.x,p.y-18*s,6*s,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(p.x-4*s,p.y-24*s,2*s,0,Math.PI*2);ctx.arc(p.x+3*s,p.y-24*s,2*s,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x+6*s,p.y-18*s);ctx.quadraticCurveTo(p.x+17*s,p.y-24*s,p.x+18*s,p.y-14*s);ctx.stroke()}
  if(node.id==='bandit-pass'){ctx.strokeStyle='#4f3123';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-27*s);ctx.stroke();ctx.fillStyle='#9a3f32';ctx.beginPath();ctx.moveTo(p.x,p.y-27*s);ctx.lineTo(p.x+16*s,p.y-22*s);ctx.lineTo(p.x,p.y-15*s);ctx.closePath();ctx.fill()}
  if(node.id==='troll-cave'){ctx.fillStyle='#4b4b40';ctx.beginPath();ctx.moveTo(p.x-23*s,p.y);ctx.lineTo(p.x-15*s,p.y-32*s);ctx.lineTo(p.x+9*s,p.y-42*s);ctx.lineTo(p.x+25*s,p.y);ctx.closePath();ctx.fill();ctx.fillStyle='#090b08';ctx.beginPath();ctx.ellipse(p.x,p.y-9*s,11*s,18*s,0,Math.PI,0);ctx.fill();ctx.fillStyle='#e78044';ctx.fillRect(p.x-5*s,p.y-14*s,3*s,2*s);ctx.fillRect(p.x+3*s,p.y-14*s,3*s,2*s)}
  if(node.id==='sentinel-gate'){ctx.fillStyle='#726d61';ctx.fillRect(p.x-12*s,p.y-31*s,24*s,25*s);ctx.fillStyle='#c6a15e';ctx.fillRect(p.x-5*s,p.y-25*s,10*s,5*s);ctx.strokeStyle='#a49471';ctx.lineWidth=2*s;ctx.strokeRect(p.x-12*s,p.y-31*s,24*s,25*s)}
  if(npc){const nx=p.x-20*s,ny=p.y-8*s;ctx.strokeStyle='#292119';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(nx,ny-14*s);ctx.stroke();ctx.fillStyle='#d1a879';ctx.beginPath();ctx.arc(nx,ny-19*s,4*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5d4732';ctx.fillRect(nx-5*s,ny-15*s,10*s,12*s);const marker=npcQuestMarker(npc);if(marker){ctx.fillStyle='#f3d477';ctx.beginPath();ctx.arc(nx,ny-34*s,8*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#211b12';ctx.font='bold '+Math.max(10,12*s)+'px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(marker,nx,ny-34*s)}}
  ctx.beginPath();ctx.arc(p.x,p.y-5*s,(selected?11:8)*s,0,Math.PI*2);ctx.fillStyle=node.kind==='encounter'?'#a7493d':current?'#f2d68f':'#d3bf83';ctx.fill();ctx.strokeStyle=selected?'#fff1bc':'#4e432d';ctx.lineWidth=selected?3:2;ctx.stroke();
  ctx.font=(selected?'bold ':'')+Math.max(9,10*s)+'px Georgia';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=3;ctx.strokeStyle='#151713';ctx.strokeText(node.name,p.x,p.y-35*s);ctx.fillStyle='#f4dfab';ctx.fillText(node.name,p.x,p.y-35*s);
  worldHits.push({id:node.id,x:p.x,y:p.y-5*s,r:24*s});
 }
 const currentNode=WORLD_NODES[worldState.currentNode],travelPoint=worldTravelAnim?worldRoutePoint(worldTravelAnim.route,worldTravelAnim.progress):{x:currentNode.x,y:currentNode.y,z:WORLD_HEIGHT[currentNode.y]?.[currentNode.x]||0,travelled:0};
 const wp=worldIso(travelPoint.x,travelPoint.y,travelPoint.z+.2,canvas),walk=worldTravelAnim?Math.sin(travelPoint.travelled*Math.PI*4):0,ss=worldCamera.zoom;
 ctx.strokeStyle='#30261d';ctx.lineWidth=2.5*ss;ctx.beginPath();ctx.moveTo(wp.x-2*ss,wp.y-5*ss);ctx.lineTo(wp.x-6*ss-walk*2*ss,wp.y+5*ss);ctx.moveTo(wp.x+2*ss,wp.y-5*ss);ctx.lineTo(wp.x+6*ss+walk*2*ss,wp.y+5*ss);ctx.stroke();
 ctx.strokeStyle='#e0c58f';ctx.beginPath();ctx.moveTo(wp.x,wp.y-14*ss);ctx.lineTo(wp.x+walk*5*ss,wp.y-4*ss);ctx.stroke();
 ctx.fillStyle='#6d3e2c';ctx.fillRect(wp.x-5*ss,wp.y-16*ss,10*ss,12*ss);ctx.fillStyle='#e1b985';ctx.beginPath();ctx.arc(wp.x,wp.y-21*ss,5*ss,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7df9d';ctx.beginPath();ctx.moveTo(wp.x,wp.y-31*ss);ctx.lineTo(wp.x+5*ss,wp.y-25*ss);ctx.lineTo(wp.x,wp.y-22*ss);ctx.lineTo(wp.x-5*ss,wp.y-25*ss);ctx.closePath();ctx.fill();
 drawWorldCard();
}
function worldNodeSummary(node,current,npc){
 if(worldTravelRoute)return 'Traveling through Brackenreach…';
 if(npc)return npc.name+' · '+npc.title;
 if(node.id!==current.id){const route=worldPath(current.id,node.id),steps=Math.max(0,(route?.length||1)-1);return steps+' ROAD STEP'+(steps===1?'':'S')+' AWAY';}
 if(node.kind==='shop')return node.id==='gem-shop'?'Reusable gems, spells, and techniques.':'Equipment and one-shot supplies.';
 if(node.checkpoint)return account?.world?.checkpoint===node.id?'Your active respawn checkpoint.':'Visit this shrine to set your respawn checkpoint.';
 if(node.encounter)return worldCleared(node.encounter)?'Road cleared.':'Hostile encounter.';
 return 'Current location · select a destination on the map.';
}
function drawWorldCard(){
 const node=WORLD_NODES[selectedWorldNode]||WORLD_NODES[worldState.currentNode],current=WORLD_NODES[worldState.currentNode],npc=npcAtNode(node.id);
 $('worldKind').textContent=node.kind==='encounter'?'⚔':npc?'◆ '+npc.title.toUpperCase():node.kind==='shop'?'▣ SHOP':node.checkpoint?'✦ SHRINE':node.kind==='safe'?'⌂ SAFE':node.kind.toUpperCase();$('worldNodeName').textContent=node.name;$('worldNodeDesc').textContent=worldNodeSummary(node,current,npc);$('worldNodeDesc').hidden=false;
 const btn=$('worldAction');btn.hidden=true;btn.disabled=false;btn.dataset.action='none';delete btn.dataset.npc;
 if(worldTravelRoute){btn.hidden=false;btn.disabled=true;btn.textContent='→ …';return}
 if(node.id===current.id){
  if(node.encounter){btn.hidden=false;btn.textContent='⚔ '+node.name.toUpperCase();btn.dataset.action='fight'}
  else if(node.shop){btn.hidden=false;btn.textContent=node.shop==='gem-shop'?'▣ GEM SHOP':'▣ ITEM SHOP';btn.dataset.action='shop'}
  else if(npc){btn.hidden=false;btn.textContent='◆ '+npc.name.toUpperCase();btn.dataset.action='talk';btn.dataset.npc=npc.id}
  else if(node.checkpoint){btn.hidden=false;btn.textContent='✦ CHECKPOINT SET';btn.disabled=true;btn.dataset.action='none'}
 }
}
function worldRouteMetrics(route){
 const points=(Array.isArray(route)?route:[]).map(id=>WORLD_NODES[id]).filter(Boolean).map(node=>({id:node.id,x:node.x,y:node.y,z:WORLD_HEIGHT[node.y]?.[node.x]||0})),segments=[];let total=0;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.max(.0001,Math.hypot(b.x-a.x,b.y-a.y,(b.z-a.z)*.35));segments.push({a,b,start:total,length});total+=length}
 return {points,segments,total};
}
function worldRoutePoint(route,progress){
 const path=worldRouteMetrics(route);if(!path.points.length)return {x:0,y:0,z:0,travelled:0,total:0};if(!path.segments.length){const p=path.points[0];return {...p,travelled:0,total:0}}
 const travelled=Math.max(0,Math.min(1,Number(progress)||0))*path.total;let segment=path.segments[path.segments.length-1];
 for(const candidate of path.segments)if(travelled<=candidate.start+candidate.length){segment=candidate;break}
 const t=Math.max(0,Math.min(1,(travelled-segment.start)/segment.length));
 return {x:segment.a.x+(segment.b.x-segment.a.x)*t,y:segment.a.y+(segment.b.y-segment.a.y)*t,z:segment.a.z+(segment.b.z-segment.a.z)*t,travelled,total:path.total};
}
function animateWorldTravel(route){
 if(reducedMotion()||!Array.isArray(route)||route.length<2)return Promise.resolve();
 const legs=route.length-1,duration=Math.min(2200,480+Math.max(0,legs-1)*360);
 return new Promise(resolve=>{const start=performance.now();worldTravelAnim={route:route.slice(),progress:0};const step=now=>{const raw=Math.min(1,(now-start)/duration),smooth=raw*raw*(3-2*raw);worldTravelAnim.progress=smooth;scheduleWorldDraw();if(raw<1)requestAnimationFrame(step);else{worldTravelAnim=null;drawWorld();resolve()}};requestAnimationFrame(step)})
}
async function travelWorld(nodeId){
 if(!account||!accountToken||worldTravelRoute)return;
 if(account.needsStarter&&nodeId!==worldState.currentNode){selectedWorldNode=worldState.currentNode;drawWorld();openDialogue('warden-vale');return}
 const route=worldPath(worldState.currentNode,nodeId);if(!route||route.length<2){selectedWorldNode=nodeId;drawWorld();return}
 const destination=nodeId,authorized=[route[0]];let nextAccount=account,travelError=null;worldTravelRoute=route.slice();selectedWorldNode=destination;drawWorld();
 try{
  for(let i=1;i<route.length;i++){
   try{const data=await accountRequest('/v1/world/move',{method:'POST',body:{nodeId:route[i]}});nextAccount=data.account;authorized.push(route[i])}
   catch(error){travelError=error;break}
  }
  if(authorized.length>1)await animateWorldTravel(authorized);
  if(nextAccount!==account)applyAccount(nextAccount);
  if(travelError){$('worldNodeDesc').hidden=false;$('worldNodeDesc').textContent='Travel stopped: '+travelError.message.replaceAll('_',' ')}
 }finally{worldTravelAnim=null;worldTravelRoute=null;selectedWorldNode=worldState.currentNode;frameTrollHill();drawWorld()}
}
function enterWorld(){if(account?.needsCharacterName){showScreen('character');return}if(account?.pendingMatch){showScreen('resume');$('resumeDescription').textContent=(GEMMO_ENCOUNTERS[account.pendingMatch.encounterId]?.name||'Your fight')+' is waiting. Resume your saved fight, or surrender. Surrender counts as a loss.';return}if(accountToken&&JSON.stringify({sack,equipment})!==lastAccountSync){void syncAccountLoadout().then(ok=>{if(ok&&account)enterWorld()});return}selectedWorldNode=worldState.currentNode;refreshWorldHud();showScreen('world');requestAnimationFrame(()=>{frameTrollHill();drawWorld()})}
let selectedSkillNode='neutral-vitality',skillBuying=false;
function skillNodeGlyph(node){return node.effect.gain?'✦':node.effect.start?'↯':node.effect.maxHP?'♥':node.effect.startGuard?'◈':node.effect.allCap?'✧':'◇'}
function drawSkillDetails(){
 const node=SKILL_BY_ID[selectedSkillNode];if(!node||!account)return;
 const purchased=account.skills?.purchased||[],rank=skillRank(node.id,purchased),points=account.skills?.availablePoints??availableSkillPointCount(),prereq=requirementMet(node.requires,purchased),maxed=rank>=node.maxRank;
 $('skillDetailName').textContent=node.name;$('skillDetailEffect').textContent=node.desc;$('skillDetailRank').textContent='RANK '+rank+'/'+node.maxRank;
 $('skillDetailRequirement').textContent=!prereq?'Learn '+SKILL_BY_ID[node.requires.id].name+' to reach this node.':maxed?'Fully learned.':points<1?'Gain a level to earn another skill point.':'One point here opens the next node.';
 if(prereq&&!maxed&&points>0&&!SKILL_BRANCHES.some(branch=>branch.nodes.some(next=>next.requires?.id===node.id)))$('skillDetailRequirement').textContent='Spend a point to learn this skill.';
 const button=$('skillLearn');button.disabled=skillBuying||maxed||!prereq||points<1;button.textContent=skillBuying?'LEARNING…':maxed?'MAX RANK':(rank?'UPGRADE':'LEARN')+' · ✦ 1';
}
function availableSkillPointCount(){return Math.max(0,xpProgress(account?.profile?.xp||0).level-pointsSpent(account?.skills?.purchased||[]))}
function selectSkillNode(id){if(!SKILL_BY_ID[id])return;selectedSkillNode=id;document.querySelectorAll('.skillNode').forEach(button=>{button.classList.remove('selected');button.setAttribute('aria-pressed',String(button.dataset.skill===id));if(button.dataset.skill===id)button.classList.add('selected')});drawSkillDetails()}
function drawSkills(){
 if(!account)return;const progress=xpProgress(account.profile?.xp||0),purchased=account.skills?.purchased||[],points=account.skills?.availablePoints??availableSkillPointCount();
 $('skillPoints').textContent='✦ '+points;$('skillLevel').textContent='LV '+progress.level;$('skillXP').textContent='XP '+progress.current+'/'+progress.required;
 const positions=Object.fromEntries(SKILL_BRANCHES.flatMap((branch,b)=>branch.nodes.map(node=>[node.id,{x:90+b*180,y:122+(node.tier-1)*122}])));
 let paths='',nodes='';
 for(const [b,branch] of SKILL_BRANCHES.entries()){
  const x=90+b*180,color=branch.id==='neutral'?'#d0b983':'var(--'+branch.id[0]+')';
  paths+='<path class="skillTreeLink '+(skillRank(branch.nodes[0].id,purchased)?'lit':'')+'" style="--skill:'+color+'" d="M540 40 V58 H'+x+' V94"/>';
  nodes+='<div class="skillPathLabel" style="left:'+(x-86)+'px;--skill:'+color+'">'+branch.label+'</div>';
  for(const node of branch.nodes){
   const pos=positions[node.id],rank=skillRank(node.id,purchased),maxed=rank>=node.maxRank,prereq=requirementMet(node.requires,purchased),state=rank?'invested':prereq&&points>0?'available':'locked';
   if(node.requires){const from=positions[node.requires.id];paths+='<path class="skillTreeLink '+(prereq?'lit':'')+'" style="--skill:'+color+'" d="M'+from.x+' '+(from.y+28)+' L'+pos.x+' '+(pos.y-28)+'"/>'}
   const pips=Array.from({length:node.maxRank},(_,i)=>'<i class="'+(i<rank?'filled':'')+'"></i>').join('');
   nodes+='<button class="skillNode '+state+(maxed?' owned':'')+(selectedSkillNode===node.id?' selected':'')+'" data-skill="'+node.id+'" style="left:'+(pos.x-76)+'px;top:'+(pos.y-28)+'px;--skill:'+color+'" aria-pressed="'+(selectedSkillNode===node.id)+'" aria-label="'+node.name+', rank '+rank+' of '+node.maxRank+(prereq?'':', prerequisite not learned')+'"><span class="skillNodeOrb '+(node.kind==='notable'?'notable':'')+'"><span>'+skillNodeGlyph(node)+'</span></span><b>'+node.name+'</b><span class="skillRankPips" aria-hidden="true">'+pips+'</span></button>';
  }
 }
 const tree=$('skillTree'),scrollLeft=tree.scrollLeft;
 tree.innerHTML='<div class="skillTreeCanvas"><svg class="skillTreeEdges" viewBox="0 0 1080 580" aria-hidden="true">'+paths+'</svg><div class="skillTreeOrigin" aria-hidden="true">✦</div>'+nodes+'</div>';tree.scrollLeft=scrollLeft;
 document.querySelectorAll('.skillNode[data-skill]').forEach(button=>button.onclick=()=>selectSkillNode(button.dataset.skill));drawSkillDetails();
}
let skillsReturnScreen='world';
function openSkills(){if(!account)return;if(account.pendingMatch){enterWorld();return}skillsReturnScreen=screen==='menu'?'menu':'world';$('skillStatus').textContent='';showScreen('skills');drawSkills()}
function openWorldSkills(){openSkills()}
async function buySkillClient(skillId){if(skillBuying||!account||account.pendingMatch||!SKILL_BY_ID[skillId])return;skillBuying=true;drawSkillDetails();$('skillStatus').textContent='Attuning…';try{const before=skillRank(skillId,account.skills?.purchased||[]),data=await accountRequest('/v1/skills/buy',{method:'POST',body:{skillId}});applyAccount(data.account);const after=skillRank(skillId,account.skills?.purchased||[]),node=SKILL_BY_ID[skillId];$('skillStatus').textContent=node.name+(node.maxRank>1?' · Rank '+after+'/'+node.maxRank:' learned.');drawSkills()}catch(error){$('skillStatus').textContent=error.message.replaceAll('_',' ');drawSkills()}finally{skillBuying=false;drawSkillDetails()}}
function shopItemData(id){const gem=itemById(id);if(gem){const stat=gemMatchStatText(gem);return {id,name:gem.item,kind:'gem',gemType:gem.gemType,sub:(gem.gemType==='weapon'?'⚔ WEAPON · ':'')+(stat?stat+' · ':'')+gem.effectLabel+' · '+gem.name+(gem.turnCost===0?' · QUICK':''),desc:gem.desc,color:gem.color};}const gear=gearById(id);if(gear)return {id,name:gear.name,kind:'gear',sub:'LV '+gear.level+' · '+gear.slot.toUpperCase(),desc:gearBonusText(gear),color:null,slot:gear.slot,icon:gearSlotIcon(gear.slot)};const c=consumableById(id);if(c)return {id,name:c.name,kind:'consumable',sub:'ONE-SHOT · COMBAT ITEM',desc:c.desc,color:null,icon:c.icon};return null}
function openShop(shopId){if(!account||worldState.currentNode!==shopId)return;currentShop=shopId;showScreen('shop');drawShop()}
function shopCard(entry,owned){
 const v=shopItemData(entry.id),record=inventoryItems.find(x=>x.id===entry.id),has=owned.has(entry.id)&&v?.kind!=='consumable';if(!v)return '';
 const icon=v.color?'<span class="shopGemIcon itemGem '+v.color+'"></span>':'<span class="shopGearIcon">'+(v.icon||'▣')+'</span>';
 return '<button class="shopItem uiCard '+(v.gemType==='weapon'?'weaponGemCard ':'')+(v.color?'gemShopItem':v.kind==='consumable'?'consumableShopItem':'gearShopItem')+'" data-buy="'+entry.id+'" style="'+(v.color?'--c:var(--'+v.color[0]+')':'')+'" '+(has?'disabled':'')+'>'+icon+'<span class="shopItemCopy"><small>'+v.sub+(v.kind==='consumable'&&record?.qty?' · ×'+record.qty:'')+'</small><b>'+v.name+'</b><p>'+v.desc+'</p></span><span class="shopPrice">'+(has?'✓':entry.price+' ◆')+'</span></button>';
}
function drawShop(){
 const stock=SHOP_STOCK[currentShop]||[],owned=new Set(account?.inventory||[]),gold=account?.profile?.gold||0;
 $('shopTitle').textContent=currentShop==='gem-shop'?'Facet Cart':'Hill Outfitter';$('shopEyebrow').textContent=currentShop==='gem-shop'?'◇ GEM SHOP':'▣ ITEM SHOP';$('shopGold').textContent='◆ '+gold;
 if(currentShop==='gem-shop'){
 const labels={red:'RED',blue:'BLUE',green:'GREEN',yellow:'YELLOW',purple:'PURPLE'},order=['red','blue','green','yellow','purple'];
  $('shopGrid').innerHTML='<div class="shopColorCatalog">'+order.map(color=>{
   const entries=stock.filter(entry=>itemById(entry.id)?.color===color);if(!entries.length)return '';
   return '<section class="shopColorSection '+color+'"><div class="shopColorHead"><span class="shopColorDot"></span><b>'+labels[color]+'</b><small>'+entries.length+'</small></div><div class="shopColorGrid">'+entries.map(entry=>shopCard(entry,owned)).join('')+'</div></section>';
  }).join('')+'</div>';
 }else{
  const groups=[['head','HEAD'],['chest','CHEST'],['hands','HANDS'],['legs','LEGS'],['feet','FEET'],['necklace','NECKLACE'],['ring','RINGS']],consumables=stock.filter(entry=>consumableById(entry.id));
  $('shopGrid').innerHTML='<div class="shopGearCatalog">'+groups.map(([slot,label])=>{const entries=stock.filter(entry=>gearById(entry.id)?.slot===slot);if(!entries.length)return '';return '<section class="shopGearSection"><div class="shopGearHead"><span>'+gearSlotIcon(slot)+'</span><b>'+label+'</b><small>'+entries.length+'</small></div><div class="shopGearGrid">'+entries.map(entry=>shopCard(entry,owned)).join('')+'</div></section>'}).join('')+(consumables.length?'<section class="shopGearSection consumableSection"><div class="shopGearHead"><span>✚</span><b>CONSUMABLES</b><small>STACKABLE</small></div><div class="shopGearGrid">'+consumables.map(entry=>shopCard(entry,owned)).join('')+'</div></section>':'')+'</div>';
 }
 document.querySelectorAll('.shopItem:not(:disabled)').forEach(b=>b.onclick=()=>void buyShopItemClient(b.dataset.buy));
}
let pendingPurchase=null,purchaseBusy=false,purchaseReturnFocus=null;
function closePurchaseConfirmation(){if(purchaseBusy)return;pendingPurchase=null;const dialog=$('purchaseDialog');if(dialog.open)dialog.close?.();dialog.hidden=true;purchaseReturnFocus?.focus?.()}
function buyShopItemClient(itemId){
 const entry=(SHOP_STOCK[currentShop]||[]).find(v=>v.id===itemId),item=shopItemData(itemId);if(!account||!entry||!item||purchaseBusy||account.pendingMatch)return;
 pendingPurchase={shopId:currentShop,itemId,price:entry.price};purchaseReturnFocus=document.activeElement;$('purchaseName').textContent=item.name;$('purchaseKind').textContent=item.sub;$('purchaseEffects').textContent=item.desc;$('purchasePrice').textContent=entry.price+' GOLD';$('purchaseBalance').textContent='Your balance: '+account.profile.gold+' Gold';$('purchaseStatus').textContent='';$('purchaseConfirm').textContent='BUY · '+entry.price+' GOLD';$('purchaseConfirm').disabled=account.profile.gold<entry.price;if(account.profile.gold<entry.price)$('purchaseStatus').textContent='Not enough Gold.';const dialog=$('purchaseDialog');dialog.hidden=false;if(!dialog.open)dialog.showModal?.();$('purchaseCancel').focus?.();
}
async function confirmShopPurchase(){
 if(purchaseBusy||!pendingPurchase)return;const purchase={...pendingPurchase};if(!account||currentShop!==purchase.shopId||account.profile.gold<purchase.price)return;purchaseBusy=true;$('purchaseConfirm').disabled=$('purchaseCancel').disabled=true;$('purchaseStatus').textContent='Buying…';
 try{const data=await accountRequest('/v1/shop/buy',{method:'POST',body:{shopId:purchase.shopId,itemId:purchase.itemId}});applyAccount(data.account);$('shopStatus').textContent='Purchased '+shopItemData(purchase.itemId).name+'.';drawShop();purchaseBusy=false;closePurchaseConfirmation()}
 catch(error){$('purchaseStatus').textContent=error.message.replaceAll('_',' ');$('shopStatus').textContent='Purchase failed.'}
 finally{purchaseBusy=false;$('purchaseCancel').disabled=false;$('purchaseConfirm').disabled=!pendingPurchase||!account||account.profile.gold<purchase.price}
}
$('purchaseConfirm').onclick=()=>void confirmShopPurchase();$('purchaseCancel').onclick=closePurchaseConfirmation;$('purchaseDialog').oncancel=event=>{if(purchaseBusy)event.preventDefault();else closePurchaseConfirmation()};$('purchaseDialog').onclose=()=>{pendingPurchase=null;$('purchaseDialog').hidden=true};

function clearAccountSession(){
 account=null;accountToken=null;lastAccountSync='';sack=Array(5).fill(null);equipment={...DEFAULT_EQUIPMENT};inventory=[];inventoryItems=[];combatConsumables={};worldState={region:'brackenreach',currentNode:'camp',clearedEncounters:[]};selectedWorldNode='camp';currentShop=null;
 rememberAccountToken(null);drawAccount()
}
let accountRefreshPromise=null;
function refreshAccount(){
 if(!accountToken)return Promise.resolve(false);
 if(accountRefreshPromise)return accountRefreshPromise;
 const token=accountToken;
 accountRefreshPromise=(async()=>{
  try{const data=await accountRequest('/v1/account');if(accountToken!==token)return false;applyAccount(data.account);return true}
  catch(error){if(accountToken!==token)return false;if(error.status===401)clearAccountSession();else $('accountStatus').textContent='Could not connect. Please try again.';return false}
 })().finally(()=>{accountRefreshPromise=null});
 return accountRefreshPromise;
}
function drawAccount(){
 const logged=!!account;
 $('accountLoggedOut').hidden=logged;$('accountLoggedIn').hidden=!logged;
 if(logged){const progress=xpProgress(account.profile.xp);$('accountName').textContent=account.user.username;$('accountLevel').textContent='LV '+progress.level;$('accountXP').textContent='XP '+progress.current+'/'+progress.required;$('accountGold').textContent='◆ '+account.profile.gold}
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
  rememberAccountToken(data.token);$('accountPassword').value='';applyAccount(data.account);$('accountStatus').textContent='Signed in.';enterWorld();
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
try{motionOff=localStorage.getItem('gemmo.motionOff')==='true';const savedHint=localStorage.getItem('gemmo.hintDelay');if(savedHint!==null&&['0','15000','30000'].includes(savedHint))hintDelay=Number(savedHint);const savedTextSize=localStorage.getItem('gemmo.textSize');if(['normal','large','xl'].includes(savedTextSize))textSize=savedTextSize}catch{}applyTextSize();
function animateScreenChange(previous,next){
 if(reducedMotion()||screen!==next)return;
 const target=next==='fight'?document.querySelector('.game'):$(next+'Page'),veil=$('screenVeil'),back=next==='world'||next==='menu'||next==='splash';
 if(target)void animate(target,[{opacity:0,transform:next==='fight'?'scale(.96)':'translate3d('+(back?-18:18)+'px,8px,0) scale(.985)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:next==='fight'?440:320,easing:'cubic-bezier(.16,1,.3,1)'});
 if(veil)void animate(veil,[{opacity:.35},{opacity:0}],{duration:340,easing:'ease-out'});
}
async function fightEntrance(){}
function showScreen(next){
 clearTimeout(hintTimer);if(!account&&!['splash','account','settings'].includes(next))next='account';
 if(account?.needsCharacterName&&!['character','account','splash','settings'].includes(next))next='character';
 if(account?.pendingMatch&&['world','menu','sack','inventory','shop','skills'].includes(next))next='resume';
 if(next!=='shop'&&!purchaseBusy)closePurchaseConfirmation();if(next!=='sack'){clearSackDrag();selectedSackGem=null}
 const previous=screen;screen=next;
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==next+'Page');document.querySelector('.game').hidden=next!=='fight';$('leaveFight').hidden=next!=='fight';
 if(next==='sack'){markWorldSeen('sack');drawSack()}if(next==='inventory'){markWorldSeen('inventory');drawInventory()}if(next==='world'){refreshWorldHud();requestAnimationFrame(drawWorld);setTimeout(maybeStartWorldCutscene,0)}if(next==='shop')drawShop();if(next!=='world'){$('worldEffectsPanel').hidden=true;$('worldQuestPanel').hidden=true}
 if(next==='account'){drawAccount();void renderCaptcha();if(accountToken&&!account)void refreshAccount()}
 if(next==='menu'){const gs=gearStats();$('playBtn').disabled=!!account&&!sackIsValid();$('sackSummary').textContent=(account?account.inventory.filter(id=>itemById(id)).length+' gems owned · ':'')+sack.filter(Boolean).length+'/5 equipped';$('gearSummary').textContent='LV 1 · '+Object.values(equipment).filter(Boolean).length+'/8 gear · '+playerMaxHP()+' Max HP · '+gs.guard+' Starting Guard'}
 if(previous!==next){const raf=window.requestAnimationFrame||globalThis.requestAnimationFrame;if(raf)raf(()=>animateScreenChange(previous,next));else setTimeout(()=>animateScreenChange(previous,next),0)}save();
}
let selectedSackGem=null,sackDrag=null,sackDragScrollTimer=0,suppressSackClickUntil=0;
function selectSackGem(id){if(!itemById(id)||account&&!account.inventory.includes(id))return;selectedSackGem=selectedSackGem===id?null:id;drawSack()}
function equipSackGemToSlot(id,slot){
 if(account?.pendingMatch||!itemById(id)||!Number.isInteger(slot)||slot<0||slot>=5||account&&!account.inventory.includes(id))return false;
 sack=GEMMO_WEAPON_GEMS.equipGem(sack,slot,id,weaponGemEffects());chosenSlot=slot;selectedSackGem=null;save();drawSack();return true;
}
function clearSackDrag(){clearTimeout(sackDragScrollTimer);document.querySelectorAll('.sackDropTarget').forEach(el=>el.classList.remove('sackDropTarget'));if(sackDrag){sackDrag.ghost?.remove();(()=>{try{sackDrag.source.releasePointerCapture?.(sackDrag.pointerId)}catch{}})()}sackDrag=null}
function sackDragTarget(x,y){return document.elementFromPoint?.(x,y)?.closest?.('.sackSlot[data-index]')||null}
function scrollSackDrag(){if(!sackDrag?.dragging)return;const page=$('sackPage'),height=window.innerHeight||800;if(sackDrag.y<100)page.scrollTop-=12;else if(sackDrag.y>height-90)page.scrollTop+=12;sackDragScrollTimer=setTimeout(scrollSackDrag,16)}
function bindSackDrag(card){
 card.onpointerdown=event=>{if(event.pointerType==='mouse'&&event.button!==0||event.pointerType==='touch'&&!event.target.closest('.sackDragHandle,.itemGem'))return;clearSackDrag();sackDrag={id:card.dataset.item,pointerId:event.pointerId,source:card,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragging:false};card.setPointerCapture?.(event.pointerId)};
 card.onpointermove=event=>{if(!sackDrag||sackDrag.pointerId!==event.pointerId)return;sackDrag.x=event.clientX;sackDrag.y=event.clientY;if(!sackDrag.dragging&&Math.hypot(event.clientX-sackDrag.startX,event.clientY-sackDrag.startY)<8)return;event.preventDefault();if(!sackDrag.dragging){sackDrag.dragging=true;const gem=itemById(sackDrag.id),ghost=document.createElement('div');ghost.className='sackDragGhost';ghost.textContent=gem.item;document.body.appendChild(ghost);sackDrag.ghost=ghost;scrollSackDrag()}sackDrag.ghost.style.left=event.clientX+'px';sackDrag.ghost.style.top=event.clientY+'px';document.querySelectorAll('.sackDropTarget').forEach(el=>el.classList.remove('sackDropTarget'));sackDragTarget(event.clientX,event.clientY)?.classList.add('sackDropTarget')};
 card.onpointerup=event=>{if(!sackDrag||sackDrag.pointerId!==event.pointerId)return;const drag=sackDrag,target=drag.dragging?sackDragTarget(event.clientX,event.clientY):null;if(drag.dragging){event.preventDefault();suppressSackClickUntil=Date.now()+350}clearSackDrag();if(target&&screen==='sack')equipSackGemToSlot(drag.id,Number(target.dataset.index))};card.onpointercancel=clearSackDrag;
}
function drawSack(){
 const ownedGemIds=account?new Set(account.inventory.filter(id=>itemById(id))):null;
 const ownedGems=ITEMS.filter(v=>!ownedGemIds||ownedGemIds.has(v.id));
 $('sackEquippedCount').textContent=sack.filter(Boolean).length+'/5';
 $('sackOwnedCount').textContent='◇ '+ownedGems.length;
 $('loadout').innerHTML=sack.map((id,i)=>{
  const v=itemById(id),chosen=i===chosenSlot;
  if(!v)return '<button class="equip sackSlot empty '+(chosen?'chosen':'')+'" data-index="'+i+'"><span class="sackSlotNumber">'+(i+1)+'</span><span class="sackPlus">+</span><b>Empty</b></button>';
  return '<button class="equip sackSlot '+(v.gemType==='weapon'?'weaponGemCard ':'')+(chosen?'chosen':'')+'" data-index="'+i+'" style="--c:var(--'+v.color[0]+')"><span class="sackSlotNumber">'+(i+1)+'</span><span class="cardCost">'+v.cap+'</span><span class="sackGem itemGem '+v.color+'"></span><b>'+v.item+'</b><span>'+(v.gemType==='weapon'?'⚔ WEAPON · ':'')+v.color.toUpperCase()+(gemMatchStatText(v)?' · '+gemMatchStatText(v):'')+'</span></button>'
 }).join('');
 document.querySelectorAll('#loadout .sackSlot').forEach(b=>b.onclick=()=>{if(Date.now()<suppressSackClickUntil)return;const slot=Number(b.dataset.index);if(selectedSackGem)equipSackGemToSlot(selectedSackGem,slot);else{chosenSlot=slot;drawSack()}});
 const query=$('itemSearch').value.trim().toLowerCase(),filter=$('colorFilter').value;
 const visible=ownedGems.filter(v=>(filter==='all'||v.color===filter)&&[v.item,v.name,v.desc].join(' ').toLowerCase().includes(query));
 $('collection').innerHTML=visible.map(v=>{
  const other=sack.indexOf(v.id),locked=false,equipped=other>=0,picked=selectedSackGem===v.id;
  return '<button class="itemCard uiCard '+(v.gemType==='weapon'?'weaponGemCard ':'')+(equipped?'equipped ':'')+(picked?'picked':'')+'" aria-pressed="'+picked+'" data-item="'+v.id+'" style="--c:var(--'+v.color[0]+')" '+(locked?'disabled aria-disabled="true"':'')+'><span class="cardCost">'+v.cap+'</span><span class="itemGem '+v.color+'"></span><small>'+(v.gemType==='weapon'?'⚔ WEAPON · ':'')+v.color.toUpperCase()+(gemMatchStatText(v)?' · '+gemMatchStatText(v):'')+' · '+v.effectLabel+(v.turnCost===0?' · QUICK':'')+'</small><b>'+v.item+'</b><strong>'+v.name+'</strong><p>'+v.desc+'</p><em>'+(picked?'SELECTED':equipped?'SLOT '+(other+1):'SELECT')+'</em><span class="sackDragHandle" title="Drag to a Sack slot" aria-hidden="true">⠿</span></button>'
 }).join('');
 document.querySelectorAll('#collection .itemCard').forEach(b=>{b.onclick=()=>{if(Date.now()>=suppressSackClickUntil)selectSackGem(b.dataset.item)};bindSackDrag(b)});
 $('equipHint').textContent=selectedSackGem?'Choose a slot for '+itemById(selectedSackGem).item+'.':'Select a gem, then a slot · or drag its gem icon / ⠿ handle to a slot. One weapon by default.';

}
function inventoryEntry(record){
 const gear=gearById(record.id);if(gear)return {id:record.id,kind:'gear',name:gear.name,color:'',qty:record.qty,sub:'EQUIPMENT · '+gear.slot.toUpperCase(),desc:gearBonusText(gear),icon:gearSlotIcon(gear.slot),gear};
 const c=consumableById(record.id);if(c)return {id:record.id,kind:'consumable',name:c.name,color:'',qty:record.qty,sub:'CONSUMABLE · ONE-SHOT',desc:c.desc,icon:c.icon};return null;
}
function drawInventory(){
 const stats=gearStats(),caps=Object.entries(stats.caps).filter(([,v])=>v).map(([k,v])=>'<b><small>'+k.toUpperCase()+'</small>+'+v+' CAP</b>').join('');$('equipmentStats').innerHTML='<b><small>HP</small>'+playerMaxHP()+'</b><b><small>GUARD</small>'+stats.guard+'</b>'+caps;
 const selectedDef=gearSlotById(chosenGearSlot);$('equipmentSelection').textContent=selectedDef?'▣ '+selectedDef.label.toUpperCase():'—';
 $('equipmentGrid').innerHTML=EQUIPMENT_SLOTS.map(def=>{const g=gearById(equipment[def.id]);return '<button class="gearSlot uiCard '+(def.id===chosenGearSlot?'chosen':'')+'" data-gear-slot="'+def.id+'"><span class="gearSlotIcon">'+gearSlotIcon(def.type)+'</span><span class="gearSlotCopy"><small>'+def.label.toUpperCase()+'</small><b>'+(g?g.name:'Empty')+'</b><em>'+(g?gearBonusText(g):'Choose gear')+'</em></span></button>'}).join('');document.querySelectorAll('.gearSlot').forEach(b=>b.onclick=()=>{chosenGearSlot=b.dataset.gearSlot;drawInventory()});
 const filter=$('inventoryFilter')?.value||'all',sort=$('inventorySort')?.value||'type',def=gearSlotById(chosenGearSlot),typeOrder={gear:0,consumable:1},owned=inventoryItems.map(inventoryEntry).filter(Boolean),entries=owned.filter(v=>filter==='all'||v.kind===filter);
 entries.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='qty'?b.qty-a.qty||a.name.localeCompare(b.name):(typeOrder[a.kind]-typeOrder[b.kind]||a.name.localeCompare(b.name)));
 $('inventoryCount').textContent=owned.length+' TYPES · ×'+owned.reduce((n,v)=>n+(Number(v.qty)||0),0);
 $('inventoryGrid').innerHTML=entries.length?entries.map(v=>{if(v.kind==='gear'){const g=v.gear,elsewhere=Object.entries(equipment).find(([slot,id])=>slot!==chosenGearSlot&&id===g.id),compatible=def&&def.type===g.slot&&!elsewhere,current=equipment[chosenGearSlot]===g.id;return '<button class="gearCard inventoryItem uiCard '+(current?'equipped':'')+'" data-gear="'+g.id+'" '+(!compatible&&!current?'disabled aria-disabled="true"':'')+'><span class="gearCardIcon">'+v.icon+'</span><span class="gearCardCopy"><small>'+v.sub+'</small><b>'+v.name+'</b><strong>'+v.desc+'</strong></span><span class="gearCardAction">'+(current?'✓':elsewhere?'▣ '+gearSlotById(elsewhere[0]).label.toUpperCase():compatible?'+':'▣')+'</span></button>'}return '<article class="gearCard inventoryItem uiCard consumableInventory"><span class="gearCardIcon">'+v.icon+'</span><span class="gearCardCopy"><small>'+v.sub+'</small><b>'+v.name+'</b><strong>'+v.desc+'</strong></span><span class="inventoryQty">×'+v.qty+'</span></article>'}).join(''):'<div class="gearEmpty uiEmpty">'+(owned.length?'No items match this filter.':'No equipment or consumables yet.')+'</div>';
 document.querySelectorAll('.gearCard[data-gear]:not(:disabled)').forEach(b=>b.onclick=()=>{if(equipGear(chosenGearSlot,b.dataset.gear)){save();drawInventory()}});
}
function pauseCombatView(){combatPaused=true;clearTimeout(enemyTimer);clearTimeout(hintTimer)}
function resumeCombatView(){combatPaused=false;if(screen==='fight'&&!playerTurn&&!busy&&pHP>0&&eHP>0)enemyTimer=setTimeout(()=>void enemyMove(),300);else touchActivity()}
function combatConsumableCount(id){return Math.max(0,Number(combatConsumables[id])||0)}
function drawCombatItems(){$('combatItemsList').innerHTML=CONSUMABLES.map(item=>{const qty=combatConsumableCount(item.id),armed=armedConsumableId===item.id;return '<button class="combatConsumable uiCard" data-consume="'+item.id+'" '+(!qty&&!armed?'disabled':'')+'><span>'+item.icon+'</span><div><small>×'+qty+' · ONE-SHOT</small><b>'+item.name+'</b><p>'+item.desc+'</p></div><em>'+(armed?'×':qty?'›':'—')+'</em></button>'}).join('');document.querySelectorAll('.combatConsumable:not(:disabled)').forEach(b=>b.onclick=()=>void useCombatConsumable(b.dataset.consume))}
function openCombatItems(){if(screen!=='fight')return;pauseCombatView();$('combatMenuPanel').hidden=true;$('combatItemsStatus').textContent='';drawCombatItems();$('combatItemsPanel').hidden=false}
function closeCombatItems(){$('combatItemsPanel').hidden=true;$('combatMenuPanel').hidden=false}
async function useCombatConsumable(itemId){
 if(resumedConsumablePaid){setLog('Choose the saved Cherry Bomb target.','system');return}
 const item=consumableById(itemId);if(!item||!playerTurn||busy||freeSwap||!activeMatchId)return;
 if(armedConsumableId===itemId){armedConsumableId=null;targetMode=null;targetKeepsTurn=false;selected=null;$('combatItemsStatus').textContent='Cancelled.';drawCombatItems();render();return}
 if(targetMode||!combatConsumableCount(itemId))return;
 if(item.kind==='break'){armedConsumableId=itemId;targetMode='consumable_break';targetKeepsTurn=false;selected=null;$('combatItemsPanel').hidden=true;combatPaused=false;setLog('CHERRY BOMB: choose one board gem · reopen Consumables to cancel.','system');render();touchActivity();return}
 busy=true;$('combatItemsStatus').textContent='Using…';
 try{await flushCombatCheckpoint();const data=await accountRequest('/v1/matches/consume',{method:'POST',body:{matchId:activeMatchId,itemId}});combatConsumables[itemId]--;applyAccount(data.account);beginCombatMove('player','ITEM · '+item.name);recordCombatAction({t:'consume',itemId});if(item.kind==='heal')pHP=Math.min(playerMaxHP(),pHP+item.power);if(item.kind==='guard'){pGuard+=item.power;guardTurns=2}if(item.kind==='charge'){const color=lowestReservoir(null);if(color)charges[color]=Math.min(reservoirCap(color),charges[color]+item.power)}setLog('You used '+item.name+'.','system');$('combatItemsPanel').hidden=true;combatPaused=false;busy=false;afterAction('player',false);checkEnd();render()}
 catch(error){busy=false;$('combatItemsStatus').textContent=error.message.replaceAll('_',' ');drawCombatItems()}
}
function openCombatMenu(){if(screen!=='fight')return;pauseCombatView();$('combatMenuStatus').textContent='';$('combatMenuPanel').hidden=false}
function closeCombatMenu(){if($('combatMenuPanel').hidden)return;$('combatMenuPanel').hidden=true;resumeCombatView()}
function openCombatGemology(){
 pauseCombatView();$('combatMenuPanel').hidden=true;
 const grid=document.querySelector('#gemologyPage .gemologyGrid'),rules=document.querySelector('#gemologyPage .rulebook');
 $('combatGemologyContent').innerHTML=(grid?.outerHTML||'')+(rules?.outerHTML||'');$('combatGemologyPanel').hidden=false;
}
function closeCombatGemology(){$('combatGemologyPanel').hidden=true;resumeCombatView()}
function combatEffectRows(){
 const rows=[
  {side:'you',name:'Primed Strike',value:buffs.empower||0,turns:null,detail:'Your next weapon match deals +1 damage.'},
  {side:'you',name:'Guard',value:pGuard,turns:guardTurns,detail:'Absorbs incoming damage point for point. Gaining Guard refreshes its duration.'},
  {side:'enemy',name:'Guard',value:eGuard,turns:evadeTurns,detail:'Absorbs incoming damage point for point before enemy HP.'},
  {side:'you',name:'Veilstep',value:buffs.dodge,turns:buffs.dodge,detail:'Halves incoming damage, rounded up.'},
  {side:'enemy',name:'Venom',value:buffs.poison,turns:buffs.poison,detail:'Takes 2 damage after each enemy action.'},
  {side:'you',name:'Restoring Verse',value:buffs.regen,turns:buffs.regen,detail:'Heals 2 HP after each enemy action.'},
  {side:'you',name:'Resonance',value:buffs.focus,turns:buffs.focus,detail:'Adds 1 charge to every equipped color after each enemy action.'},
  {side:'you',name:'Redwake',value:buffs.redwake,turns:buffs.redwake,detail:COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')?'First weapon-color match per action deals +2 damage.':'Red match resolutions deal +2 bonus damage.'},
  {side:'you',name:'Holdfast',value:buffs.holdfast,turns:buffs.holdfast,detail:COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')?'First Blue match per action grants +2 Guard.':'Blue match resolutions grant +2 bonus Guard.'},
  {side:'you',name:'Aftergrowth',value:buffs.aftergrowth,turns:buffs.aftergrowth,detail:COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')?'First Green match per action heals 2 HP.':'Green match resolutions heal 2 HP.'},
  {side:'you',name:'Momentum',value:buffs.momentum,turns:buffs.momentum,detail:COLOR_BALANCE.isCurrent(activeAuthority?.mode||'replay-v7')?'First Yellow match per action sends +2 charge to your most depleted other color.':'Yellow matches send +2 charge to your most depleted other color.'},
  {side:'you',name:'Reprisal',value:buffs.reflect,turns:buffs.reflect,detail:'Reflects half of the next unblocked hit.'},
  {side:'you',name:'Overdrive',value:overdrive?1:0,turns:null,detail:'Doubles the next colored match once.'},
  {side:'you',name:'Earthbind',value:pinTurns,turns:pinTurns,detail:'The pinned column refills in place through the next enemy action.'},
  {side:'enemy',name:'Bleed',value:enemyEffects.bleed,turns:enemyEffects.bleed,detail:'Takes 2 damage after each enemy action.'},
  {side:'enemy',name:'Stun',value:enemyEffects.stun,turns:enemyEffects.stun,detail:'Loses its next action.'},
  {side:'enemy',name:'Disarm',value:enemyEffects.disarm,turns:enemyEffects.disarm,detail:usesEnemyGems()?'Its weapon matches and weapon abilities are disabled for its next action.':'Its next Red attack deals no damage.'},
  {side:'enemy',name:'Silence',value:enemyEffects.silence,turns:enemyEffects.silence,detail:'Cannot use an active ability during its next action.'},
  {side:'enemy',name:'Hunter’s Mark',value:enemyEffects.mark,turns:enemyEffects.mark,detail:'The next damage it takes is increased by 3.'},
  {side:'enemy',name:'Reload',value:enemyReload?1:0,turns:null,detail:'Its next Red match receives the encounter reload bonus.'}
 ];
 return rows.filter(row=>row.value>0);
}
function drawCombatEffects(){
 const rows=combatEffectRows(),section=side=>{
  const items=rows.filter(row=>row.side===side);
  return '<section class="combatEffectsGroup"><div class="combatEffectsGroupHead"><small>'+(side==='you'?'YOU':enemyLabel())+'</small><b>'+items.length+' ACTIVE</b></div>'+(items.length?items.map(row=>'<article class="combatEffectCard '+side+'"><div><strong>'+row.name+'</strong><p>'+row.detail+'</p></div><span>'+(row.name==='Guard'?row.value+(row.turns?' · '+row.turns+'T':''):row.turns!=null?row.turns+'T':'READY')+'</span></article>').join(''):'<div class="combatEffectsEmpty uiEmpty">No active effects.</div>')+'</section>';
 };
 $('combatEffectsContent').innerHTML=section('you')+section('enemy');
}
function openEffectsDrawer(){if(screen!=='fight')return;pauseCombatView();drawCombatEffects();$('effectsDrawer').hidden=false;void animate($('effectsDrawer'),[{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'})}
async function closeEffectsDrawer(){if($('effectsDrawer').hidden)return;await animate($('effectsDrawer'),[{transform:'translateY(0)'},{transform:'translateY(100%)'}],{duration:180,easing:'ease-in'});$('effectsDrawer').hidden=true;resumeCombatView()}
function surrenderFight(){
 if(screen!=='fight')return;if(busy||pendingHP.p||pendingHP.e){$('combatMenuStatus').textContent='Finish the current action first.';return}
 $('combatMenuPanel').hidden=true;combatPaused=false;clearTimeout(enemyTimer);pHP=0;shownHP.p=0;syncHealth('p');setLog('You surrendered.','system');checkEnd();
}
function startFight(){
 chargeGemLevels.clear();procsUsed=[];
 if(account?.needsStarter){enterWorld();openDialogue('warden-vale');return}
 resumedArmedSpec=null;resumedConsumablePaid=false;
 clearTimeout(hintTimer);actionNumber=1;renderedTurnOwner='';targetMode=null;targetKeepsTurn=false;armedAbilitySlot=-1;armedConsumableId=null;pinColumn=-1;pinTurns=guardTurns=evadeTurns=0;buffs={dodge:0,reflect:0,poison:0,regen:0,focus:0,redwake:0,holdfast:0,aftergrowth:0,momentum:0};enemyEffects={bleed:0,stun:0,disarm:0,silence:0,mark:0};
 if(!sackIsValid())return;
 if(account){const owned=new Set(account.inventory.filter(id=>itemById(id)));if(sack.filter(Boolean).some(id=>!owned.has(id)))return}
 clearTimeout(enemyTimer);board=[];boardBonus=[];selected=null;busy=false;playerTurn=true;freeSwap=false;extraTurn=false;enemyExtraTurn=false;overdrive=false;enemyReload=false;combatPaused=false;activeMatchId=null;activeRewardBudget=null;activeAuthority=null;combatRng=null;combatTranscript=[];matchStartPromise=null;rewardsSettled=false;lossSettlementStarted=false;combatConsumables=Object.fromEntries(inventoryItems.filter(v=>v.kind==='consumable'&&v.qty>0).map(v=>[v.id,v.qty]));
 const gear=gearStats(),skills=currentSkillEffects();pHP=playerMaxHP();eHP=enemyMaxHP();pGuard=gear.guard+skills.startGuard;eGuard=gold=xp=0;guardTurns=pGuard?2:0;charges={red:0,blue:0,green:0,yellow:0,purple:0};for(const color of Object.keys(charges))charges[color]=Math.min(reservoirCap(color),skills.startCharge[color]||0);ec={red:0,blue:0,green:0,yellow:0,purple:0};shownHP.p=pHP;shownHP.e=eHP;pendingHP.p=pendingHP.e=0;damageAnimations=[];effectOrigin=null;
 encounterClearSaved=activeEncounter!=='rat'||worldCleared('rat');encounterSettling=false;lastMatchError='';$('resultMenu').disabled=false;$('resultRetry').hidden=true;$('resultText').textContent='';$('fxLayer').innerHTML='';$('result').classList.remove('show');$('modal').classList.remove('show');combatHistory=[];activeCombatMove=null;logSequence=0;renderMoveHistory();$('combatMenuPanel').hidden=true;$('combatItemsPanel').hidden=true;$('combatGemologyPanel').hidden=true;$('effectsDrawer').hidden=true;showScreen('fight');
 if(accountToken){
  busy=true;setLog('SYNCING MATCH…','system');render();matchStartPromise=startMatchTicket();
  void matchStartPromise.then(async()=>{busy=false;if(!activeMatchId){combatPaused=true;setLog('MATCH SERVER UNREACHABLE — RETURN TO WORLD','system');render();return}eHP=enemyMaxHP();shownHP.e=eHP;board=[];boardBonus=[];buildBoard();setLog(enemyLabel()+' · '+eHP+' HP');render();busy=true;try{await fightEntrance()}finally{busy=false}render();touchActivity()});
 }else{buildBoard();setLog(enemyLabel()+' · '+eHP+' HP');render();touchActivity()}
}
function leaveFight(){clearTimeout(hintTimer);if(busy||encounterSettling||(eHP<=0&&!rewardsSettled)||pendingHP.p||pendingHP.e)return;clearTimeout(enemyTimer);combatPaused=false;$('combatMenuPanel').hidden=true;$('combatItemsPanel').hidden=true;$('combatGemologyPanel').hidden=true;$('effectsDrawer').hidden=true;$('result').classList.remove('show');$('modal').classList.remove('show');enterWorld()}
function restoreCombatMatch(match){
 clearTimeout(enemyTimer);clearTimeout(hintTimer);const s=match.state;activeMatchId=match.matchId;activeEncounter=match.encounterId;activeRewardBudget=match.rewardBudget;activeAuthority=match.authority;combatTranscript=match.transcript;combatRng=makeCombatRng(activeAuthority.seed);for(let i=0;i<s.rngCalls;i++)combatRng();
 sack=s.sack.slice();equipment={...s.equipment};if(account){account.skills={...account.skills,purchased:s.skills};account.pendingMatch={matchId:match.matchId,encounterId:match.encounterId}}
 procsUsed=s.procsUsed||[];board=s.board;boardBonus=s.bonus;pHP=s.pHP;eHP=s.eHP;pGuard=s.pGuard;eGuard=s.eGuard;gold=s.gold;xp=s.xp;charges=s.charges;ec=s.ec;buffs=s.buffs;enemyEffects=s.enemyEffects;playerTurn=s.playerTurn;freeSwap=s.freeSwap;extraTurn=s.extraTurn;enemyExtraTurn=!!s.enemyExtraTurn;overdrive=s.overdrive;enemyReload=s.enemyReload;targetMode=s.targetMode;targetKeepsTurn=s.targetKeepsTurn;pinColumn=s.pinColumn;pinTurns=s.pinTurns;guardTurns=s.guardTurns;evadeTurns=s.evadeTurns;combatConsumables=s.consumables;actionNumber=s.actions+1;
 armedAbilitySlot=-1;armedConsumableId=null;resumedArmedSpec=null;resumedConsumablePaid=false;const last=match.transcript[match.transcript.length-1];if((targetMode||freeSwap)&&last?.t==='ability')resumedArmedSpec=combatItemById(sack[last.slot]);if(targetMode==='consumable_break'&&last?.t==='consume'){armedConsumableId=last.itemId;resumedConsumablePaid=true}
 selected=null;busy=false;combatPaused=false;rewardsSettled=false;lossSettlementStarted=false;encounterSettling=false;matchStartPromise=null;pendingHP.p=pendingHP.e=0;shownHP.p=pHP;shownHP.e=eHP;damageAnimations=[];effectOrigin=null;renderedTurnOwner='';combatHistory=[];activeCombatMove=null;logSequence=0;renderMoveHistory();$('fxLayer').innerHTML='';$('result').classList.remove('show');$('modal').classList.remove('show');$('combatMenuPanel').hidden=true;$('combatItemsPanel').hidden=true;$('combatGemologyPanel').hidden=true;$('effectsDrawer').hidden=true;showScreen('fight');render();setLog(targetMode||freeSwap?'MATCH RESUMED · choose your pending target.':'MATCH RESUMED','system');persistCombatJournal();checkEnd();touchActivity();
}
async function loadSavedMatch(){
 const data=await accountRequest('/v1/matches/open');let match=data.match;if(!match)return null;
 let journal=null;try{journal=JSON.parse(localStorage.getItem(combatJournalKey(match.matchId))||'null')}catch{}
 if(Array.isArray(journal)&&journal.length>match.transcript.length){try{const synced=await accountRequest('/v1/matches/checkpoint',{method:'POST',body:{matchId:match.matchId,transcript:journal}});match=synced.match}catch(error){if(error.status!==409)throw error}}
 return match;
}
async function resolvePendingMatch(surrender){
 const resume=$('resumeMatchBtn'),quit=$('surrenderMatchBtn');if(resume.disabled)return;resume.disabled=quit.disabled=true;$('resumeStatus').textContent=surrender?'Surrendering…':'Restoring your match…';
 try{await combatCheckpointQueue;const match=await loadSavedMatch();if(!match){const data=await accountRequest('/v1/account');applyAccount(data.account);enterWorld();return}if(surrender){const data=await accountRequest('/v1/matches/surrender',{method:'POST',body:{matchId:match.matchId}});try{localStorage.removeItem(combatJournalKey(match.matchId))}catch{}applyAccount(data.account);enterWorld()}else restoreCombatMatch(match);$('resumeStatus').textContent=''}catch(error){$('resumeStatus').textContent='Could not restore your match. Your saved fight is safe; try again.'}finally{resume.disabled=quit.disabled=false}
}
$('resumeMatchBtn').onclick=()=>void resolvePendingMatch(false);$('surrenderMatchBtn').onclick=()=>void resolvePendingMatch(true);
$('characterForm').onsubmit=async event=>{event.preventDefault();const button=$('characterSubmit');if(button.disabled)return;button.disabled=true;$('characterStatus').textContent='Registering…';try{const data=await accountRequest('/v1/account/character',{method:'POST',body:{name:$('characterName').value}});applyAccount(data.account);$('characterStatus').textContent='';enterWorld()}catch(error){$('characterStatus').textContent=({invalid_character_name:'Use 3–20 characters, starting with a letter.',character_name_unavailable:'That name is already taken. Choose another.',character_already_registered:'Your character already has a name.'})[error.message]||'Could not register. Please try again.'}finally{button.disabled=false}};
$('characterLogout').onclick=()=>void logoutAccount().then(()=>showScreen('account'));
let leaderboardRequest=0;
function leaderboardValue(entry,metric){if(metric==='unlocked')return '◇ '+entry.unlocked+'/'+entry.totalGemTypes;if(metric==='wins')return entry.wins+' WINS';if(metric==='winrate')return entry.winrate.toFixed(1)+'% · '+entry.wins+'/'+entry.played;if(metric==='cascade')return entry.cascade+' COMBO';if(metric==='gems')return entry.gems+' GEMS';return 'LV '+entry.level+' · '+entry.xp+' XP'}
async function loadLeaderboard(){const metric=$('leaderboardMetric').value||'level',request=++leaderboardRequest;const help={unlocked:'Different gems in your collection, including weapons. Equipment and consumables do not count.',level:'Ranked by level, then total XP.',winrate:'Wins ÷ finished matches. Surrenders count as losses; pending fights are excluded.',wins:'Total matches won.',cascade:'Your longest chain of player match resolutions in one move. Tracked from this update.',gems:'Total actual gems popped by you, including abilities. +1 gems count as one. Tracked from this update.'};$('leaderboardHelp').textContent=help[metric];$('leaderboardStatus').textContent='Loading rankings…';$('leaderboardList').replaceChildren();$('leaderboardYou').textContent='';try{const data=await accountRequest('/v1/leaderboard?metric='+metric);if(request!==leaderboardRequest||screen!=='leaderboard')return;$('leaderboardStatus').textContent=data.entries.length?'':metric==='unlocked'||metric==='level'?'No adventurers ranked yet.':'No ranked matches yet.';for(const entry of data.entries){const row=document.createElement('li');row.className='leaderboardRow'+(entry.isYou?' isYou':'');const rank=document.createElement('span'),name=document.createElement('strong'),stats=document.createElement('span');rank.textContent='#'+entry.rank;name.textContent=entry.name+(entry.isYou?' · YOU':'');stats.textContent=leaderboardValue(entry,metric);row.append(rank,name,stats);$('leaderboardList').appendChild(row)}if(data.you)$('leaderboardYou').textContent='YOUR RANK #'+data.you.rank+' · '+leaderboardValue(data.you,metric)}catch{if(screen==='leaderboard')$('leaderboardStatus').textContent='Could not load rankings. Reopen to try again.'}}
$('worldLeaderboard').onclick=()=>{showScreen('leaderboard');void loadLeaderboard()};$('leaderboardMetric').onchange=()=>void loadLeaderboard();
$('leaderboardBack').onclick=()=>{leaderboardRequest++;enterWorld()};
$('enterBtn').onclick=async()=>{if(account){enterWorld();return}if(accountToken&&await refreshAccount()){enterWorld();return}showScreen('account')};$('playBtn').onclick=()=>enterWorld();$('openSack').onclick=()=>openLoadoutScreen('sack','menu');$('openInventory').onclick=()=>openLoadoutScreen('inventory','menu');$('openAccount').onclick=()=>showScreen('account');$('openGemology').onclick=()=>showScreen('gemology');$('openSettings').onclick=()=>showScreen('settings');
document.querySelectorAll('.menuBack').forEach(b=>b.onclick=leaveMenuPage);$('shopBack').onclick=()=>enterWorld();$('skillsBack').onclick=()=>showScreen(skillsReturnScreen);
$('worldCamp').onclick=()=>showScreen('menu');$('worldSackBtn').onclick=()=>openLoadoutScreen('sack','world');$('worldInventoryBtn').onclick=()=>openLoadoutScreen('inventory','world');$('worldSkillsBtn').onclick=()=>void openWorldSkills();$('worldStatusBtn').onclick=()=>{const panel=$('worldEffectsPanel');$('worldQuestPanel').hidden=true;panel.hidden=!panel.hidden;if(!panel.hidden)renderWorldEffects()};$('worldEffectsClose').onclick=()=>$('worldEffectsPanel').hidden=true;$('worldObjectiveBtn').onclick=()=>{if(account?.needsStarter){openDialogue('warden-vale');return}const target=$('worldObjectiveBtn').dataset.target;if(target&&WORLD_NODES[target]&&worldNodeVisible(WORLD_NODES[target])){selectedWorldNode=target;drawWorld()}else{$('worldQuestPanel').hidden=false;$('worldEffectsPanel').hidden=true;renderWorldQuests()}};$('worldQuestsBtn').onclick=()=>{const panel=$('worldQuestPanel');$('worldEffectsPanel').hidden=true;panel.hidden=!panel.hidden;if(!panel.hidden)renderWorldQuests()};$('worldQuestsClose').onclick=()=>$('worldQuestPanel').hidden=true;
$('worldAction').onclick=()=>{const action=$('worldAction').dataset.action;if(action==='fight'){activeEncounter=WORLD_NODES[selectedWorldNode].encounter;startFight()}if(action==='shop')openShop(WORLD_NODES[selectedWorldNode].shop);if(action==='talk')openDialogue($('worldAction').dataset.npc)};
$('storyContinue').onclick=()=>{if(activeStory?.type!=='cutscene')return;activeStory.index++;renderCutscene()};$('storySkip').onclick=()=>{if(activeStory?.type!=='cutscene')return;const id=activeStory.id;storyHide();void markCutsceneClient(id)};
function worldPair(){const p=[...worldPointers.values()];return p.length>=2?[p[0],p[1]]:null}
function worldDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function worldMid(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
$('worldViewport').addEventListener('wheel',e=>{
 if(screen!=='world')return;
 e.preventDefault();
 const rect=$('worldViewport').getBoundingClientRect(),oldZoom=worldCamera.zoom;
 const factor=Math.exp(-e.deltaY*.0015),newZoom=Math.max(.68,Math.min(1.65,oldZoom*factor));
 if(newZoom===oldZoom)return;
 const cx=rect.width/2,cy=92,px=e.clientX-rect.left,py=e.clientY-rect.top,scale=newZoom/oldZoom;
 worldCamera.zoom=newZoom;
 worldCamera.panX=px-cx-(px-cx-worldCamera.panX)*scale;
 worldCamera.panY=py-cy-(py-cy-worldCamera.panY)*scale;
 scheduleWorldDraw();
},{passive:false});
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
  worldCamera.zoom=newZoom;worldCamera.panX=(mid.x-rect.left)-cx-((worldGesture.startMid.x-rect.left)-cx-worldGesture.startPanX)*scale;worldCamera.panY=(mid.y-rect.top)-cy-((worldGesture.startMid.y-rect.top)-cy-worldGesture.startPanY)*scale;scheduleWorldDraw();return;
 }
 if(worldGesture?.type==='pan'&&worldGesture.id===e.pointerId){const dx=e.clientX-worldGesture.startX,dy=e.clientY-worldGesture.startY;if(Math.hypot(dx,dy)>5)worldGesture.moved=true;worldCamera.panX=worldGesture.startPanX+dx;worldCamera.panY=worldGesture.startPanY+dy;scheduleWorldDraw()}
});
function endWorldPointer(e,cancel=false){
 const gesture=worldGesture,p=worldPointers.get(e.pointerId);worldPointers.delete(e.pointerId);
 if(!cancel&&gesture?.type==='pan'&&!gesture.moved&&p&&worldPointers.size===0&&!worldTravelRoute){const rect=$('worldCanvas').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,hit=worldHits.filter(h=>Math.hypot(h.x-x,h.y-y)<=h.r).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(hit){selectedWorldNode=hit.id;drawWorld();if(hit.id!==worldState.currentNode)void travelWorld(hit.id)}}
 if(worldPointers.size===1){const [id,left]=worldPointers.entries().next().value;worldGesture={type:'pan',id,startX:left.x,startY:left.y,startPanX:worldCamera.panX,startPanY:worldCamera.panY,moved:true}}
 else if(worldPointers.size===0){worldGesture=null;$('worldViewport').classList.remove('dragging')}
}
$('worldViewport').addEventListener('pointerup',e=>endWorldPointer(e));$('worldViewport').addEventListener('pointercancel',e=>endWorldPointer(e,true));
window.addEventListener?.('resize',()=>{if(screen==='world')drawWorld()});
$('skillLearn').onclick=()=>void buySkillClient(selectedSkillNode);$('colorFilter').onchange=drawSack;$('itemSearch').oninput=drawSack;$('inventoryFilter').onchange=drawInventory;$('inventorySort').onchange=drawInventory;$('emptySlot').onclick=()=>{if(sack[chosenSlot]&&sack.filter(Boolean).length<=1){$('sackSaveStatus').textContent='Keep at least one gem equipped.';return}sack[chosenSlot]=null;selectedSackGem=null;drawSack();save()};$('unequipGear').onclick=()=>{unequipGear(chosenGearSlot);save();drawInventory()};
$('hintDelay').value=String(hintDelay);$('hintDelay').onchange=()=>{hintDelay=Number($('hintDelay').value);touchActivity();save()};
$('textSize').value=textSize;$('textSize').onchange=()=>{textSize=$('textSize').value;applyTextSize();saveDeviceSettings()};
$('motionToggle').checked=motionOff;$('motionToggle').onchange=()=>{motionOff=$('motionToggle').checked;save()};
$('apiBase').value=apiBase;$('apiBase').onchange=()=>{apiBase=$('apiBase').value.trim().replace(/\/+$/,'')||'https://gemmo.onrender.com';saveDeviceSettings();$('accountStatus').textContent='Account API updated.'};
$('loginBtn').onclick=()=>void submitAuth('login');$('registerBtn').onclick=()=>void submitAuth('register');$('logoutBtn').onclick=()=>void logoutAccount();$('syncAccountBtn').onclick=()=>{lastAccountSync='';void syncAccountLoadout()};
$('effectsBtn').onclick=openEffectsDrawer;$('closeEffectsDrawer').onclick=()=>void closeEffectsDrawer();$('leaveFight').onclick=openCombatMenu;$('closeCombatMenu').onclick=closeCombatMenu;$('combatSacksBtn').onclick=()=>{$('combatMenuPanel').hidden=true;openCombatSacks()};$('combatItemsBtn').onclick=openCombatItems;$('closeCombatItems').onclick=closeCombatItems;$('combatGemologyBtn').onclick=openCombatGemology;$('closeCombatGemology').onclick=closeCombatGemology;$('surrenderBtn').onclick=surrenderFight;$('resultRetry').onclick=()=>void (eHP<=0?settleVictory():settleDefeat());$('resultMenu').onclick=()=>{if(!encounterSettling)leaveFight()};

let statusRenderKey=null;
function renderStatuses(){
 updateTurnCue();
 const rows=combatEffectRows(),html=rows.slice(0,6).map(row=>'<button class="statusTag '+row.side+'" title="'+row.detail+'" data-help="'+row.detail+'">'+row.name+' '+(row.name==='Guard'?row.value+' · ':'')+(row.turns!=null?row.turns+'T':'')+'</button>').join('');
 if(html!==statusRenderKey){statusRenderKey=html;$('statusTags').innerHTML=html;document.querySelectorAll('.statusTag').forEach(b=>b.onclick=()=>setLog(b.dataset.help,'system'))}
 if(!$('effectsDrawer').hidden)drawCombatEffects();
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
 if(b.x<0||b.x>7||b.y<0||b.y>7||busy||!playerTurn)return;selected=null;const force=freeSwap;if(force&&!commitArmedAbility()){freeSwap=false;render();return}freeSwap=false;void trySwap(a,b,'player',force,progress);
});
boardEl.addEventListener('pointercancel',event=>{if(swipeStart&&event.pointerId===swipeStart.pointerId){clearSwipePreview();swipeStart=null}});
document.querySelector('.app').addEventListener('pointerdown',touchActivity);document.querySelector('.app').addEventListener('keydown',touchActivity);

showScreen('splash');
if(accountToken)void refreshAccount().then(ok=>{if(screen==='splash'){if(ok)enterWorld();else if(!accountToken)showScreen('account')}});
})();
