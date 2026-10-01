'use strict';
// Reproducible difficulty probe: weapon-aware greedy play, no consumables or retries.
const fs=require('node:fs'),path=require('node:path');
const engine=require('../server/combat.cjs'),{action}=require('./balance-colors.cjs');
const {STARTER_WEAPON_IDS}=require('../shared/weapon-gems.js'),{BRANCHES}=require('../shared/progression.js');
const samples=Number(process.env.GEMMO_BALANCE_SAMPLES)||10;
const supports=['bloodstone-whet','shield','healing-potion','locksmith-pick','powder-bomb','chaos-orb'];
const combos=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++)for(let d=c+1;d<6;d++)combos.push([supports[a],supports[b],supports[c],supports[d]]);
const allSkills=BRANCHES.flatMap(b=>b.nodes.flatMap(n=>Array.from({length:n.maxRank},(_,i)=>n.id+(i?'@'+(i+1):''))));
const equipment={head:'leather-cap',chest:'padded-tunic',hands:'leather-gloves',legs:'hide-leggings',feet:'leather-boots',necklace:'bone-talisman',ring1:'iron-band',ring2:'tin-ring'};
function run(version,encounterId,sack,skills,gear={}){let wins=0,losses=0,unfinished=0,actions=0;for(let seed=1;seed<=samples;seed++){const s=engine.createCombat({version,encounterId,seed,sack,skills,equipment:gear});s.probeMaxHP=s.pHP;let count=0;while(s.pHP>0&&s.eHP>0&&count++<200){const next=action(s);if(!next||!engine.applyCombatAction(s,next))break}wins+=s.eHP<=0?1:0;losses+=s.pHP<=0?1:0;unfinished+=s.pHP>0&&s.eHP>0?1:0;actions+=count}return {version,encounter:encounterId,sack,skillPoints:skills.length,samples,wins,losses,unfinished,meanActions:Math.round(actions/samples*10)/10}}
const comparison=[];for(const version of ['replay-v5','replay-v6'])for(const encounter of ['bandit','sentinel'])for(const weapon of STARTER_WEAPON_IDS)comparison.push(run(version,encounter,[weapon,'bloodstone-whet','shield','healing-potion','chaos-orb'],[],{}));
const boss=[];for(const weapon of STARTER_WEAPON_IDS)for(const support of combos)boss.push(run('replay-v6','troll',[weapon,...support],allSkills,equipment));
const report={method:'Greedy weapon-aware policy, fixed seeds 1..N, 200 player action limit; not optimal play or a guarantee for every build. Boss sweep covers all 75 full sacks available from one starter and four of six shop supports, with all 42 skills and eight shop equipment pieces. No consumables.',samples,comparison,boss};
fs.writeFileSync(path.join(__dirname,'../docs/troll-balance-results.json'),JSON.stringify(report,null,2)+'\n');
for(const version of ['replay-v5','replay-v6'])for(const encounter of ['bandit','sentinel']){const rows=comparison.filter(r=>r.version===version&&r.encounter===encounter);console.log(version,encounter,rows.reduce((n,r)=>n+r.wins,0)+'/'+(rows.length*samples)+' wins')}
for(const weapon of STARTER_WEAPON_IDS){const rows=boss.filter(r=>r.sack[0]===weapon);console.log('Troll vs',weapon,rows.reduce((n,r)=>n+r.wins,0)+'/'+(rows.length*samples)+' wins; build range',Math.min(...rows.map(r=>r.wins))+'–'+Math.max(...rows.map(r=>r.wins))+'/'+samples)}
console.log('Unfinished',boss.reduce((n,r)=>n+r.unfinished,0));
