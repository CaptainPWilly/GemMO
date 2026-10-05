'use strict';
const assert=require('node:assert/strict'),engine=require('../server/combat.cjs'),loadouts=require('../shared/enemy-loadouts.js'),encounters=require('../shared/encounters.js'),balance=require('../shared/color-balance.js'),weapons=require('../shared/weapon-gems.js');
const lookup=id=>{const g=engine.GEM[id];return g&&balance.gemSpec({id,color:g[0],cap:g[1],kind:g[2],power:g[3],turnCost:g[4],attack:g[5]||0,defense:g[6]||0},'replay-v5')};
const make=(id='sentinel',version='replay-v5')=>engine.createCombat({encounterId:id,version,seed:81,sack:['dagger','shield',null,null,null]});
for(const e of Object.values(encounters)){
 assert(e.sack.length>=1&&e.sack.length<=5);assert.equal(new Set(e.sack).size,e.sack.length);assert.equal(e.sack.filter(weapons.isWeaponGem).length,1);
 for(const id of e.sack){const g=lookup(id);assert(g,id+' exists in catalog');assert(loadouts.supports(g.kind),id+' has shared NPC/player execution');assert.equal(g.turnCost,1,'current loadouts have standard action cost')}
}
assert.equal(loadouts.cap(encounters.forVersion('sentinel','replay-v5'),'blue',lookup),14,'two Blue gems pool both costs');
assert.equal(loadouts.cap(encounters.rat,'blue',lookup),0,'unequipped colors have no free reservoir');
const rat=make('rat');engine.applyColor(rat,'red',3,'enemy');assert.equal(rat.pHP,18);assert.equal(rat.ec.red,0);engine.applyColor(rat,'yellow',4,'enemy');assert.equal(rat.pHP,14);assert.equal(rat.ec.yellow,4);engine.applyCascadeCharge(rat,['yellow'],2,'enemy');assert.equal(rat.pHP,12);assert.equal(rat.ec.yellow,5,'charge saturates at the real gem capacity');
const oldRat=make('rat','replay-v4');engine.applyColor(oldRat,'red',3,'enemy');assert.equal(oldRat.pHP,16,'unfinished v4 fights keep original enemy damage');engine.applyColor(oldRat,'yellow',3,'enemy');assert.equal(oldRat.pHP,16);
const sentinel=make();engine.applyColor(sentinel,'blue',3,'enemy');assert.equal(sentinel.pHP,15);assert.equal(sentinel.eGuard,0,'Blue matching never grants free NPC Guard');sentinel.ec.blue=14;sentinel.playerTurn=false;engine.enemyMove(sentinel);assert.equal(sentinel.ec.blue,7,'cast spends 7 rather than emptying 14');assert.equal(sentinel.pHP,11);assert.equal(sentinel.eGuard,3,'Crystal Wand uses the same 4 damage + 3 Guard');assert.equal(sentinel.evadeTurns,2);
const partlyCharged=make();partlyCharged.ec.blue=7;partlyCharged.playerTurn=false;engine.enemyMove(partlyCharged);assert.equal(partlyCharged.pHP,14,'gem ready at own cost, not pooled capacity');assert.equal(partlyCharged.ec.blue,0);
const siphon=make();siphon.charges.red=5;siphon.ec.purple=7;siphon.playerTurn=false;engine.enemyMove(siphon);assert.equal(siphon.charges.red,2);assert.equal(siphon.ec.blue,3);assert.equal(siphon.ec.purple,0);assert.equal(siphon.pHP,16);
const healing=make();healing.eHP=10;healing.ec.green=6;healing.playerTurn=false;engine.enemyMove(healing);assert.equal(healing.eHP,15);assert.equal(healing.ec.green,0);
const guard=make('bandit');guard.eHP=10;guard.ec.blue=7;guard.playerTurn=false;engine.enemyMove(guard);assert.equal(guard.eGuard,6);assert.equal(guard.ec.blue,0);assert.equal(guard.evadeTurns,2);
const reflecting=make();reflecting.buffs.reflect=1;reflecting.ec.blue=7;reflecting.playerTurn=false;engine.enemyMove(reflecting);assert.equal(reflecting.eHP,28,'shared cast must preserve reflected damage to its caster');assert.equal(reflecting.eGuard,3);
const silence=make();silence.enemyEffects.silence=99;silence.ec.blue=14;silence.playerTurn=false;engine.enemyMove(silence);assert.equal(silence.eGuard,0,'silence prevents charged Guard and weapon casts');
const extra=make('rat');const types=['red','blue','green','yellow','purple','gold','xp'];extra.board=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>types[(x+2*y)%7]));extra.board[0]=['yellow','yellow','red','yellow','purple','gold','xp','blue'];extra.board[1][2]='yellow';extra.bonus=extra.board.map(r=>r.map(()=>0));extra.pHP=100;extra.playerTurn=false;engine.enemyMove(extra);assert(extra.actions>=2,'enemy four-match earns and spends an extra action');assert(extra.playerTurn,'enemy chain returns to a stable player input');
console.log('PASS: NPC catalog validity, shared capacities/costs/effects, weapon colors, no passive exceptions, siphon, reflection and legacy rules.');

for(const id of ['bandit','sentinel'])assert(make(id,'replay-v6').eHP>make(id,'replay-v5').eHP,'v6 increases '+id+' HP without changing saved v5 fights');
assert.equal(loadouts.cap(encounters.sentinel,'blue',lookup),18);
const troll=make('troll','replay-v6');assert.equal(troll.eHP,68);troll.pGuard=99;troll.ec.red=9;troll.playerTurn=false;engine.enemyMove(troll);assert.equal(troll.pHP,10,'Bonebreaker pierces Guard through shared damage rules');assert.equal(troll.pGuard,99);assert.equal(troll.ec.red,0);
const playerMaul=engine.createCombat({encounterId:'troll',version:'replay-v6',seed:1,sack:['troll-maul',null,null,null,null]});playerMaul.eGuard=99;playerMaul.charges.red=9;engine.applyCombatAction(playerMaul,{t:'ability',slot:0});assert(playerMaul.eHP<=72,'the same maul pierces enemy Guard when equipped by a player');
// A real full-build victory must replay, including late healing/Guard and chained turns.
const {BRANCHES}=require('../shared/progression.js'),{action}=require('../scripts/balance-colors.cjs');
const skills=BRANCHES.flatMap(b=>b.nodes.flatMap(n=>Array.from({length:n.maxRank},(_,i)=>n.id+(i?'@'+(i+1):''))));
const bossArgs={version:'replay-v6',encounterId:'troll',sack:['dagger','bloodstone-whet','healing-potion','locksmith-pick','chaos-orb'],skills,equipment:{head:'leather-cap',chest:'padded-tunic',hands:'leather-gloves',legs:'hide-leggings',feet:'leather-boots',necklace:'bone-talisman',ring1:'iron-band',ring2:'tin-ring'},rewardBudget:{gold:80,xp:60}};
let victory;for(let seed=1;seed<=10&&!victory;seed++){const state=engine.createCombat({...bossArgs,seed}),transcript=[];state.probeMaxHP=state.pHP;while(state.pHP>0&&state.eHP>0&&transcript.length<200){const next=action(state);assert(next);assert(engine.applyCombatAction(state,next));transcript.push(next)}if(state.eHP<=0)victory={seed,transcript,state}}
assert(victory,'Gravemaw is hard but legally beatable');const verified=engine.verifyCombatTranscript({...bossArgs,seed:victory.seed,transcript:victory.transcript});assert.equal(verified.won,true);assert.equal(verified.gold,victory.state.gold);assert.equal(verified.xp,victory.state.xp);
console.log('PASS: v6 encounter difficulty, symmetric Bonebreaker, and a complete replay-verified Gravemaw victory.');
