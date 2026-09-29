'use strict';
const {GEAR,CONSUMABLES,ENCOUNTERS}=require('./catalog.cjs');
const {comboChargeTypes,comboChargeBonus}=require('../shared/combat-rules.js');
const {skillEffects}=require('../shared/progression.js');

const W=8,H=8,TYPES=['red','blue','green','yellow','purple','gold','xp'],WEIGHTS=[15,15,15,15,15,10,8];
const GEM=Object.freeze({
  "hand-crossbow": [
    "red",
    4,
    "damage",
    3,
    1,
    1,
    0
  ],
  "barbed-blade": [
    "red",
    6,
    "bleed",
    0,
    1,
    1,
    0
  ],
  "longbow": [
    "red",
    6,
    "damage",
    5,
    1,
    1,
    0
  ],
  "spear": [
    "red",
    7,
    "hybrid",
    3,
    1,
    1,
    0
  ],
  "bloodstone-whet": [
    "red",
    7,
    "red_attune",
    0,
    1,
    1,
    0
  ],
  "dagger": [
    "red",
    7,
    "damage",
    6,
    1,
    1,
    0
  ],
  "rapier": [
    "red",
    7,
    "hybrid",
    3,
    1,
    1,
    0
  ],
  "arming-sword": [
    "red",
    8,
    "damage",
    7,
    1,
    1,
    0
  ],
  "executioners-axe": [
    "red",
    8,
    "execute",
    4,
    1,
    1,
    0
  ],
  "axe": [
    "red",
    9,
    "damage",
    8,
    1,
    2,
    0
  ],
  "flail": [
    "red",
    9,
    "damage",
    8,
    1,
    2,
    0
  ],
  "halberd": [
    "red",
    10,
    "damage",
    9,
    1,
    2,
    0
  ],
  "warhammer": [
    "red",
    11,
    "damage",
    10,
    1,
    2,
    0
  ],
  "ember-rod": [
    "red",
    7,
    "paint",
    0,
    1,
    1,
    0
  ],
  "crystal-wand": [
    "blue",
    5,
    "damage",
    4,
    1,
    0,
    1
  ],
  "war-pick": [
    "blue",
    6,
    "breach",
    2,
    1,
    0,
    1
  ],
  "buckler": [
    "blue",
    7,
    "hybrid",
    3,
    1,
    0,
    2
  ],
  "quarterstaff": [
    "blue",
    5,
    "guard",
    4,
    1,
    0,
    1
  ],
  "bastion-sigil": [
    "blue",
    7,
    "blue_attune",
    0,
    1,
    0,
    1
  ],
  "kite-shield": [
    "blue",
    7,
    "shelter",
    0,
    1,
    0,
    2
  ],
  "mirror-shield": [
    "blue",
    7,
    "reflect",
    0,
    1,
    0,
    2
  ],
  "shield": [
    "blue",
    7,
    "guard",
    6,
    1,
    0,
    2
  ],
  "ward": [
    "blue",
    7,
    "shelter",
    0,
    1,
    0,
    2
  ],
  "hook-spear": [
    "blue",
    8,
    "guard",
    7,
    1,
    0,
    2
  ],
  "pavise": [
    "blue",
    9,
    "guard",
    8,
    1,
    0,
    2
  ],
  "tower-shield": [
    "blue",
    11,
    "guard",
    10,
    1,
    0,
    3
  ],
  "swordbreaker": [
    "blue",
    6,
    "disarm",
    0,
    1,
    0,
    1
  ],
  "anchor-maul": [
    "blue",
    7,
    "pin",
    0,
    1,
    0,
    1
  ],
  "tide-chain": [
    "blue",
    8,
    "rotate",
    0,
    1,
    0,
    1
  ],
  "binding-chain": [
    "blue",
    9,
    "stun",
    0,
    1,
    0,
    1
  ],
  "thorn-whip": [
    "green",
    5,
    "damage",
    4,
    1,
    0,
    0
  ],
  "grove-spear": [
    "green",
    7,
    "shelter",
    0,
    1,
    0,
    0
  ],
  "woodland-club": [
    "green",
    7,
    "guard",
    6,
    1,
    0,
    0
  ],
  "willow-wand": [
    "green",
    3,
    "heal",
    2,
    1,
    0,
    0
  ],
  "poultice": [
    "green",
    4,
    "heal",
    3,
    1,
    0,
    0
  ],
  "purifying-tonic": [
    "green",
    4,
    "cleanse",
    2,
    1,
    0,
    0
  ],
  "healing-potion": [
    "green",
    5,
    "heal",
    4,
    1,
    0,
    0
  ],
  "briar": [
    "green",
    6,
    "leech",
    0,
    1,
    0,
    0
  ],
  "sickle": [
    "green",
    6,
    "leech",
    0,
    1,
    0,
    0
  ],
  "salve": [
    "green",
    6,
    "heal",
    5,
    1,
    0,
    0
  ],
  "heartseed": [
    "green",
    7,
    "green_attune",
    0,
    1,
    0,
    0
  ],
  "venom-needle": [
    "green",
    7,
    "poison",
    0,
    1,
    0,
    0
  ],
  "wayfarer-lyre": [
    "green",
    7,
    "regen",
    0,
    1,
    0,
    0
  ],
  "druid-staff": [
    "green",
    9,
    "heal",
    8,
    1,
    0,
    0
  ],
  "hunting-bow": [
    "green",
    5,
    "mark",
    0,
    1,
    0,
    0
  ],
  "sling": [
    "yellow",
    3,
    "damage",
    2,
    1,
    0,
    0
  ],
  "duelist-sabre": [
    "yellow",
    7,
    "hybrid",
    3,
    1,
    0,
    0
  ],
  "light-crossbow": [
    "yellow",
    7,
    "damage",
    6,
    1,
    0,
    0
  ],
  "twin-knives": [
    "yellow",
    8,
    "damage",
    7,
    1,
    0,
    0
  ],
  "glaive": [
    "yellow",
    9,
    "damage",
    8,
    1,
    0,
    0
  ],
  "javelin": [
    "yellow",
    10,
    "damage",
    9,
    1,
    0,
    0
  ],
  "parrying-dagger": [
    "yellow",
    4,
    "guard",
    3,
    1,
    0,
    0
  ],
  "cloak": [
    "yellow",
    6,
    "guard",
    5,
    1,
    0,
    0
  ],
  "knife": [
    "yellow",
    3,
    "quick_damage",
    1,
    0,
    0,
    0
  ],
  "locksmith-pick": [
    "yellow",
    4,
    "break",
    0,
    0,
    0,
    0
  ],
  "boots": [
    "yellow",
    6,
    "swap",
    0,
    1,
    0,
    0
  ],
  "gamblers-thread": [
    "yellow",
    7,
    "yellow_attune",
    0,
    1,
    0,
    0
  ],
  "mist-mantle": [
    "yellow",
    7,
    "dodge",
    0,
    1,
    0,
    0
  ],
  "powder-bomb": [
    "yellow",
    7,
    "blast",
    0,
    1,
    0,
    0
  ],
  "clockwork-spur": [
    "yellow",
    8,
    "haste",
    0,
    1,
    0,
    0
  ],
  "ritual-dagger": [
    "purple",
    7,
    "hybrid",
    3,
    1,
    0,
    0
  ],
  "rune-blade": [
    "purple",
    8,
    "damage",
    7,
    1,
    0,
    0
  ],
  "seal": [
    "purple",
    10,
    "damage",
    8,
    1,
    0,
    0
  ],
  "spell-tome": [
    "purple",
    7,
    "shelter",
    0,
    1,
    0,
    0
  ],
  "moon-scythe": [
    "purple",
    6,
    "leech",
    0,
    1,
    0,
    0
  ],
  "relic": [
    "purple",
    10,
    "renew",
    0,
    1,
    0,
    0
  ],
  "relic-mace": [
    "purple",
    10,
    "renew",
    0,
    1,
    0,
    0
  ],
  "chaos-orb": [
    "purple",
    6,
    "reroll",
    0,
    1,
    0,
    0
  ],
  "echo-knife": [
    "purple",
    7,
    "siphon",
    0,
    1,
    0,
    0
  ],
  "hex-staff": [
    "purple",
    7,
    "silence",
    0,
    1,
    0,
    0
  ],
  "prism-orb": [
    "purple",
    9,
    "focus",
    0,
    1,
    0,
    0
  ],
  "charm": [
    "purple",
    10,
    "boost",
    0,
    1,
    0,
    0
  ],
  "void-flask": [
    "purple",
    10,
    "purge",
    0,
    1,
    0,
    0
  ],
  "star-lens": [
    "purple",
    11,
    "wildcraft",
    0,
    1,
    0,
    0
  ]
});
function spec(id){const v=GEM[id];return v?{id,color:v[0],cap:v[1],kind:v[2],power:v[3],turnCost:v[4]??1,attack:v[5]||0,defense:v[6]||0}:null}
function makeRng(seed){let a=Number(seed)>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}
function gearStats(equipment={}){
 const out={hp:0,guard:0,caps:{red:0,blue:0,green:0,yellow:0,purple:0}};
 for(const id of Object.values(equipment||{})){const g=GEAR[id];if(!g)continue;out.hp+=g.hp||0;out.guard+=g.guard||0;for(const c of Object.keys(out.caps))out.caps[c]+=(g.caps?.[c]||0)+(g.allCap||0)}
 return out;
}
function createCombat({encounterId='rat',seed,sack,equipment={},skills=[],consumables={},rewardBudget={gold:0,xp:0}}){
 const encounter=ENCOUNTERS[encounterId];
 if(!encounter||!Number.isInteger(seed)||seed<0||!Array.isArray(sack)||sack.length!==5)throw new Error('invalid_combat_seed');
 const gems=sack.map(id=>id?spec(id):null);if(gems.some((v,i)=>sack[i]&&!v))throw new Error('invalid_combat_sack');
 const gear=gearStats(equipment),skill=skillEffects(skills),charges={red:0,blue:0,green:0,yellow:0,purple:0},s={
  encounterId,rng:makeRng(seed),seed,sack:sack.slice(),equipment:{...equipment},skills:Array.isArray(skills)?skills.slice():[],skill,consumables:Object.fromEntries(Object.keys(CONSUMABLES).map(id=>[id,Math.max(0,Math.floor(Number(consumables?.[id])||0))])),usedConsumables:{},rewardBudget:{gold:Number(rewardBudget.gold)||0,xp:Number(rewardBudget.xp)||0},
  board:[],pHP:18+gear.hp+skill.maxHP,eHP:encounter.maxHP,pGuard:gear.guard+skill.startGuard,eGuard:0,gold:0,xp:0,
  charges,ec:{red:0,blue:0,green:0,yellow:0,purple:0},
  playerTurn:true,freeSwap:false,extraTurn:false,overdrive:false,enemyReload:false,targetMode:null,targetKeepsTurn:false,pinColumn:-1,pinTurns:0,guardTurns:(gear.guard+skill.startGuard)?2:0,evadeTurns:0,
  buffs:{dodge:0,reflect:0,poison:0,regen:0,focus:0,redwake:0,holdfast:0,aftergrowth:0,momentum:0,laststand:0,ironbark:0},enemyEffects:{bleed:0,stun:0,disarm:0,silence:0,mark:0},actions:0
 };
 for(const color of Object.keys(charges))charges[color]=Math.min(reservoirCap(s,color),skill.startCharge[color]||0);
 buildBoard(s);return s;
}
function createRatCombat(args){return createCombat({...args,encounterId:'rat'})}
function createBanditCombat(args){return createCombat({...args,encounterId:'bandit'})}
function playerMaxHP(s){return 18+gearStats(s.equipment).hp+(s.skill?.maxHP||0)}
function matchPower(s,color){const key=color==='red'?'attack':color==='blue'?'defense':null;if(!key)return 0;return s.sack.reduce((sum,id)=>{const gem=spec(id);return sum+(gem?.color===color?(gem[key]||0):0)},0)}
function reservoirCap(s,color){const skill=s.skill||skillEffects(s.skills);return s.sack.reduce((n,id)=>n+(spec(id)?.color===color?spec(id).cap:0),0)+gearStats(s.equipment).caps[color]+skill.allCap+skill.caps[color]}
function roll(s){const total=WEIGHTS.reduce((a,b)=>a+b,0),r=1+Math.floor(s.rng()*total);let a=0;for(let i=0;i<TYPES.length;i++){a+=WEIGHTS[i];if(r<=a)return TYPES[i]}return'red'}
function swap(s,a,b){[s.board[a.y][a.x],s.board[b.y][b.x]]=[s.board[b.y][b.x],s.board[a.y][a.x]]}
function key(x,y){return x+','+y}
function findMatches(s){
 const cells=new Map(),runs=[];
 function scan(line){
  for(const type of TYPES){
   let run=[];
   const flush=()=>{if(run.length>=3&&run.some(p=>s.board[p.y][p.x]===type)){runs.push({type,len:run.length,cells:run.slice()});for(const p of run){const k=key(p.x,p.y);if(!cells.has(k))cells.set(k,{...p,type:s.board[p.y][p.x]==='wild'?type:s.board[p.y][p.x]})}}run=[]};
   for(const p of line){const t=s.board[p.y][p.x];if(t===type||t==='wild')run.push(p);else flush()}flush();
  }
 }
 for(let y=0;y<H;y++)scan(Array.from({length:W},(_,x)=>({x,y})));
 for(let x=0;x<W;x++)scan(Array.from({length:H},(_,y)=>({x,y})));
 return cells.size?{cells:[...cells.values()],runs}:null;
}
function legalMoves(s){const out=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a={x,y};for(const [dx,dy] of [[1,0],[0,1]]){const b={x:x+dx,y:y+dy};if(b.x>=W||b.y>=H)continue;swap(s,a,b);if(findMatches(s))out.push([a,b]);swap(s,a,b)}}return out}
function buildBoard(s){for(let attempt=0;attempt<100;attempt++){s.board=[];for(let y=0;y<H;y++){const row=[];for(let x=0;x<W;x++){let t=roll(s),tries=0;while(tries++<30&&((x>=2&&row[x-1]===t&&row[x-2]===t)||(y>=2&&s.board[y-1][x]===t&&s.board[y-2][x]===t)))t=roll(s);row.push(t)}s.board.push(row)}if(legalMoves(s).length)return}throw new Error('rat_board_generation_failed')}
function damageEnemy(s,n){if(s.enemyEffects.mark&&n>0){n+=3;s.enemyEffects.mark=0}const blocked=Math.min(s.eGuard,n);s.eGuard-=blocked;s.eHP-=n-blocked}
function damagePlayer(s,n){if(s.buffs.dodge)n=Math.ceil(n/2);if(s.buffs.ironbark&&n>0){n=Math.max(0,n-s.buffs.ironbark);s.buffs.ironbark=0}const blocked=Math.min(s.pGuard,n),dealt=n-blocked;s.pGuard-=blocked;s.pHP-=dealt;if(s.pHP<=0&&dealt>0&&s.buffs.laststand){s.buffs.laststand=0;s.pHP=1}if(s.buffs.reflect&&dealt>0){s.buffs.reflect=0;damageEnemy(s,Math.max(1,Math.ceil(dealt/2)))}}
function encounterSpec(s){return ENCOUNTERS[s.encounterId]}
function enemyReservoir(s,type){return encounterSpec(s).reservoirs[type]}
function scaledEnemyValue(value,scale,min=0){return Math.max(min,Math.ceil(value*scale))}
function enemyMoveScore(s,type){const ai=encounterSpec(s).ai;if(type==='green')return s.eHP<ai.woundedBelow?ai.greenWounded:ai.greenHealthy;return ai[type]||0}
function lowestReservoir(s,exclude){let best=null,ratio=Infinity;for(const c of ['red','blue','green','yellow','purple']){if(c===exclude)continue;const cap=reservoirCap(s,c);if(!cap||s.charges[c]>=cap)continue;const r=s.charges[c]/cap;if(r<ratio){best=c;ratio=r}}return best}
function applyColor(s,type,n,actor,comboBonus=false){
 if(actor==='player'){
  const colored=['red','blue','green','yellow','purple'].includes(type),mult=!comboBonus&&s.overdrive&&colored?2:1;
  if(colored){const cap=reservoirCap(s,type);s.charges[type]=Math.min(cap,s.charges[type]+n*mult)}
  if(type==='red'){damageEnemy(s,n*mult*matchPower(s,'red'));if(!comboBonus&&s.buffs.redwake)damageEnemy(s,2)}
  if(type==='blue'){s.pGuard+=n*mult*matchPower(s,'blue');s.guardTurns=2;if(!comboBonus&&s.buffs.holdfast){s.pGuard+=2;s.guardTurns=2}}
  if(type==='green'&&!comboBonus&&s.buffs.aftergrowth)s.pHP=Math.min(playerMaxHP(s),s.pHP+2);
  if(type==='yellow'&&!comboBonus&&s.buffs.momentum){const c=lowestReservoir(s,'yellow');if(c)s.charges[c]=Math.min(reservoirCap(s,c),s.charges[c]+2)}
  if(!comboBonus&&mult===2)s.overdrive=false;
  if(type==='gold')s.gold=Math.min(s.rewardBudget.gold,s.gold+n);
  if(type==='xp')s.xp=Math.min(s.rewardBudget.xp,s.xp+n);
 }else{
  const reservoir=enemyReservoir(s,type);if(reservoir)s.ec[type]=Math.min(reservoir.cap,s.ec[type]+n);
  if(type==='red'){const rules=encounterSpec(s).match,raw=n+(!comboBonus&&s.enemyReload?(rules.reloadBonus||0):0);if(!comboBonus)s.enemyReload=false;if(!s.enemyEffects.disarm)damagePlayer(s,scaledEnemyValue(raw,rules.redScale,rules.redMin))}
  if(type==='blue'){const rules=encounterSpec(s).match;s.eGuard+=scaledEnemyValue(n,rules.blueScale,rules.blueMin);s.evadeTurns=2}
 }
}
function applyCascadeCharge(s,roots,cascadeDepth,actor){
 const bonus=comboChargeBonus(cascadeDepth);if(!bonus)return 0;
 for(const type of roots)applyColor(s,type,bonus,actor,true);
 return bonus;
}
function fallColumns(s){
 for(let x=0;x<W;x++){
  if(x===s.pinColumn&&s.pinTurns>0){for(let y=0;y<H;y++)if(!s.board[y][x])s.board[y][x]=roll(s);continue}
  const kept=[];for(let y=H-1;y>=0;y--)if(s.board[y][x])kept.push(s.board[y][x]);
  let i=0;for(let y=H-1;y>=0;y--)s.board[y][x]=i<kept.length?kept[i++]:roll(s);
 }
 if(!findMatches(s)&&!legalMoves(s).length)buildBoard(s);
}
function resolve(s,matches,actor,target,cascade=0,keepTurn=false,comboRoots=null){
 let current=matches,currentTarget=target;
 while(current){
  const counts={};for(const p of current.cells){const t=p.type||s.board[p.y][p.x];counts[t]=(counts[t]||0)+1}
  if(!comboRoots)comboRoots=comboChargeTypes(counts);
  let makeWild=null,match4=false;for(const run of current.runs){if(run.len>=4)match4=true;if(run.len>=5&&!makeWild)makeWild=run.cells.find(p=>currentTarget&&p.x===currentTarget.x&&p.y===currentTarget.y)||run.cells[Math.floor(run.cells.length/2)]}
  for(const [type,n] of Object.entries(counts))applyColor(s,type,n,actor);
  if(cascade>0)applyCascadeCharge(s,comboRoots,cascade,actor);
  for(const p of current.cells)s.board[p.y][p.x]='';
  if(makeWild)s.board[makeWild.y][makeWild.x]='wild';
  if(match4&&actor==='player')s.extraTurn=true;
  fallColumns(s);
  if(s.pHP<=0||s.eHP<=0)return;
  current=findMatches(s);currentTarget=null;cascade++;
 }
 afterAction(s,actor,keepTurn);
}
function reshuffleBoard(s){buildBoard(s)}
function trySwap(s,a,b,actor,force=false){
 swap(s,a,b);const m=findMatches(s);
 if(!m&&!force){swap(s,a,b);return false}
 if(m)resolve(s,m,actor,b,0);else afterAction(s,actor);
 return true;
}
function afterAction(s,actor,keepTurn=false){
 s.actions++;
 if(s.pHP<=0||s.eHP<=0){s.playerTurn=true;return}
 if(actor==='enemy'){
  if(s.buffs.poison){damageEnemy(s,2);s.buffs.poison--}
  if(s.enemyEffects.bleed){damageEnemy(s,2);s.enemyEffects.bleed--}
  if(s.buffs.regen){s.pHP=Math.min(playerMaxHP(s),s.pHP+2);s.buffs.regen--}
  if(s.buffs.focus){for(const color of Object.keys(s.charges))s.charges[color]=Math.min(reservoirCap(s,color),s.charges[color]+1);s.buffs.focus--}
  if(s.buffs.dodge)s.buffs.dodge--;
  if(s.enemyEffects.silence)s.enemyEffects.silence--;
  if(s.enemyEffects.disarm)s.enemyEffects.disarm--;
  if(s.pinTurns&&!--s.pinTurns)s.pinColumn=-1;
  if(s.guardTurns&&!--s.guardTurns)s.pGuard=0;
 }else if(s.evadeTurns&&!--s.evadeTurns)s.eGuard=0;
 if(s.pHP<=0||s.eHP<=0){s.playerTurn=true;return}
 if(actor==='player'){
  for(const k of ['redwake','holdfast','aftergrowth','momentum'])if(s.buffs[k])s.buffs[k]--;
  if(keepTurn)s.playerTurn=true;
  else if(s.extraTurn){s.extraTurn=false;s.playerTurn=true}
  else{s.playerTurn=false;enemyMove(s)}
 }else s.playerTurn=true;
}

function enemyAbilityReady(s,ability){
 const reservoir=enemyReservoir(s,ability.color);if(!reservoir||s.ec[ability.color]<reservoir.cap)return false;
 if(ability.when?.hpAtMost!==undefined&&s.eHP>ability.when.hpAtMost)return false;
 if(ability.when?.guardAtMost!==undefined&&s.eGuard>ability.when.guardAtMost)return false;
 return true;
}
function enemyUseActive(s){
 if(s.enemyEffects.silence)return false;
 const ability=encounterSpec(s).actives.find(a=>enemyAbilityReady(s,a));if(!ability)return false;
 s.ec[ability.color]=0;
 if(ability.kind==='damage'){if(!(ability.disarmable&&s.enemyEffects.disarm))damagePlayer(s,ability.power)}
 else if(ability.kind==='heal')s.eHP=Math.min(encounterSpec(s).maxHP,s.eHP+ability.power);
 else if(ability.kind==='guard'){s.eGuard+=ability.power;s.evadeTurns=2}
 else if(ability.kind==='reload')s.enemyReload=true;
 else return false;
 afterAction(s,'enemy');return true;
}

function enemyMove(s){
 if(s.playerTurn||s.pHP<=0||s.eHP<=0)return;
 if(s.enemyEffects.stun){s.enemyEffects.stun=0;afterAction(s,'enemy');return}
 if(enemyUseActive(s))return;
 let moves=legalMoves(s);if(!moves.length){reshuffleBoard(s);moves=legalMoves(s);if(!moves.length){afterAction(s,'enemy');return}}
 let best=moves[0],bestScore=-Infinity;
 for(const mv of moves){swap(s,mv[0],mv[1]);const m=findMatches(s);let score=0;if(m)for(const p of m.cells){const t=p.type||s.board[p.y][p.x];score+=enemyMoveScore(s,t)}swap(s,mv[0],mv[1]);if(score>bestScore){bestScore=score;best=mv}}
 trySwap(s,best[0],best[1],'enemy');
}
function activate(s,index){
 if(!s.playerTurn||s.freeSwap||s.targetMode||s.pHP<=0||s.eHP<=0||!Number.isInteger(index)||index<0||index>4)return false;
 const v=spec(s.sack[index]);if(!v||s.charges[v.color]<v.cap||(v.kind==='boost'&&s.overdrive))return false;
 s.charges[v.color]-=v.cap;const guardBefore=s.pGuard;
 if(v.kind==='damage')damageEnemy(s,v.power);
 if(v.kind==='guard')s.pGuard+=v.power;
 if(v.kind==='heal')s.pHP=Math.min(playerMaxHP(s),s.pHP+v.power);
 if(v.kind==='hybrid'){damageEnemy(s,3);s.pGuard+=3}
 if(v.kind==='shelter'){s.pGuard+=3;s.pHP=Math.min(playerMaxHP(s),s.pHP+2)}
 if(v.kind==='leech'){s.pHP=Math.min(playerMaxHP(s),s.pHP+2);damageEnemy(s,3)}
 if(v.kind==='renew'){s.pHP=Math.min(playerMaxHP(s),s.pHP+4);s.pGuard+=4}
 if(v.kind==='boost')s.overdrive=true;
 if(v.kind==='dodge')s.buffs.dodge=2;
 if(v.kind==='poison')s.buffs.poison=2;
 if(v.kind==='regen')s.buffs.regen=3;
 if(v.kind==='focus')s.buffs.focus=2;
 if(v.kind==='red_attune')s.buffs.redwake=4;
 if(v.kind==='blue_attune')s.buffs.holdfast=4;
 if(v.kind==='green_attune')s.buffs.aftergrowth=4;
 if(v.kind==='yellow_attune')s.buffs.momentum=4;
 if(v.kind==='haste')s.extraTurn=true;
 if(v.kind==='siphon'){damageEnemy(s,2);const c=Object.keys(s.ec).sort((a,b)=>s.ec[b]-s.ec[a])[0],amount=Math.min(3,s.ec[c]);s.ec[c]-=amount;s.charges.purple=Math.min(reservoirCap(s,'purple'),s.charges.purple+amount)}
 if(v.kind==='quick_damage')damageEnemy(s,v.power);
 if(v.kind==='execute')damageEnemy(s,s.eHP<=8?10:v.power);
 if(v.kind==='breach'){s.eGuard=0;damageEnemy(s,v.power)}
 if(v.kind==='bleed')s.enemyEffects.bleed=2;
 if(v.kind==='reflect')s.buffs.reflect=1;
 if(v.kind==='stun')s.enemyEffects.stun=1;
 if(v.kind==='disarm')s.enemyEffects.disarm=1;
 if(v.kind==='cleanse')s.pHP=Math.min(playerMaxHP(s),s.pHP+v.power);
 if(v.kind==='mark')s.enemyEffects.mark=1;
 if(v.kind==='silence')s.enemyEffects.silence=1;
 if(s.pGuard>guardBefore)s.guardTurns=2;
 if(['pin','paint','wildcraft','rotate','break','blast','reroll','purge'].includes(v.kind)){s.targetMode=v.kind;s.targetKeepsTurn=v.turnCost===0}
 if(s.targetMode)return true;
 if(v.kind==='swap'){s.freeSwap=true;return true}
 afterAction(s,'player',v.turnCost===0);return true;
}
function target(s,x,y){
 if(!s.targetMode||!s.playerTurn||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=W||y<0||y>=H)return false;
 const mode=s.targetMode,keepTurn=s.targetKeepsTurn;s.targetMode=null;s.targetKeepsTurn=false;let comboRoots=null;
 if(mode==='pin'){s.pinColumn=x;s.pinTurns=1;afterAction(s,'player',keepTurn);return true}
 if(mode==='paint')s.board[y][x]='red';
 if(mode==='wildcraft')s.board[y][x]='wild';
 if(mode==='rotate')s.board[y].unshift(s.board[y].pop());
 if(mode==='reroll')s.board[y][x]=roll(s);
 if(['break','blast','purge'].includes(mode)){
  let cells=[];
  if(mode==='break')cells=[{x,y}];
  if(mode==='blast')cells=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy})).filter(q=>q.x>=0&&q.x<W&&q.y>=0&&q.y<H);
  if(mode==='purge'){const chosen=s.board[y][x];for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(s.board[yy][xx]===chosen)cells.push({x:xx,y:yy})}
  const broken={};for(const q of cells){const type=s.board[q.y][q.x];if(type)broken[type]=(broken[type]||0)+1}comboRoots=comboChargeTypes(broken);
  if(mode==='break'){const type=s.board[y][x];if(type)applyColor(s,type,1,'player')}
  for(const q of cells)s.board[q.y][q.x]='';
  fallColumns(s);
 }
 const m=findMatches(s);if(m)resolve(s,m,'player',{x,y},comboRoots!==null?1:0,keepTurn,comboRoots);else afterAction(s,'player',keepTurn);return true;
}

function useConsumable(s,itemId){
 const item=CONSUMABLES[itemId];if(!item||!s.consumables?.[itemId])return false;
 s.consumables[itemId]--;s.usedConsumables[itemId]=(s.usedConsumables[itemId]||0)+1;
 if(item.kind==='last_stand')s.buffs.laststand=1;
 if(item.kind==='ironbark')s.buffs.ironbark=item.power
 if(item.kind==='charge'){const color=lowestReservoir(s,null);if(color)s.charges[color]=Math.min(reservoirCap(s,color),s.charges[color]+item.power)}
 afterAction(s,'player',false);return true;
}
function applyCombatAction(s,action){
 if(!action||typeof action!=='object'||s.pHP<=0||s.eHP<=0||!s.playerTurn)return false;
 if(action.t==='consume')return useConsumable(s,action.itemId);
 if(action.t==='ability')return activate(s,action.slot);
 if(action.t==='target')return target(s,action.x,action.y);
 if(action.t==='swap'){
  const a={x:action.ax,y:action.ay},b={x:action.bx,y:action.by};
  if(![a.x,a.y,b.x,b.y].every(Number.isInteger)||a.x<0||a.x>=W||a.y<0||a.y>=H||b.x<0||b.x>=W||b.y<0||b.y>=H||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
  const force=s.freeSwap;if(force)s.freeSwap=false;trySwap(s,a,b,'player',force);return true;
 }
 return false;
}
function verifyCombatTranscript({encounterId='rat',seed,sack,equipment,skills=[],consumables={},rewardBudget,transcript}){
 if(!ENCOUNTERS[encounterId]||!Array.isArray(transcript)||transcript.length>256)throw Object.assign(new Error('invalid_combat_proof'),{status:400});
 const s=createCombat({encounterId,seed,sack,equipment,skills,consumables,rewardBudget});
 for(let i=0;i<transcript.length;i++){if(s.eHP<=0||s.pHP<=0)throw Object.assign(new Error('invalid_combat_proof'),{status:400});if(!applyCombatAction(s,transcript[i]))throw Object.assign(new Error('invalid_combat_proof'),{status:400})}
 return {won:s.eHP<=0,gold:s.gold,xp:s.xp,actions:s.actions,pHP:s.pHP,eHP:s.eHP,usedConsumables:{...s.usedConsumables}};
}
function applyRatAction(s,action){return applyCombatAction(s,action)}
function verifyRatTranscript(args){return verifyCombatTranscript({...args,encounterId:'rat'})}
function verifyBanditTranscript(args){return verifyCombatTranscript({...args,encounterId:'bandit'})}
function suggestCombatAction(s){
 if(!s.playerTurn||s.pHP<=0||s.eHP<=0)return null;
 if(s.targetMode)return {t:'target',x:0,y:0};
 if(s.freeSwap)return {t:'swap',ax:0,ay:0,bx:1,by:0};
 for(let i=0;i<s.sack.length;i++){const v=spec(s.sack[i]);if(v&&s.charges[v.color]>=v.cap&&!['boost'].includes(v.kind))return {t:'ability',slot:i}}
 let best=null,bestScore=-Infinity;
 for(const [a,b] of legalMoves(s)){swap(s,a,b);const m=findMatches(s);let score=0;if(m)for(const p of m.cells){const t=p.type||s.board[p.y][p.x];score+=t==='red'?20:t==='blue'?5:t==='green'?2:t==='gold'||t==='xp'?1:0}swap(s,a,b);if(score>bestScore){bestScore=score;best={t:'swap',ax:a.x,ay:a.y,bx:b.x,by:b.y}}}
 return best;
}
function suggestRatAction(s){return suggestCombatAction(s)}
module.exports={GEM,createCombat,createRatCombat,createBanditCombat,applyCombatAction,applyRatAction,verifyCombatTranscript,verifyRatTranscript,verifyBanditTranscript,suggestCombatAction,suggestRatAction,findMatches,legalMoves,reservoirCap,matchPower,applyCascadeCharge};
