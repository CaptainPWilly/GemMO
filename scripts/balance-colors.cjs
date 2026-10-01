'use strict';
// Deterministic PvE balance probe. One transparent heuristic, not an optimal player.
const fs=require('fs'),path=require('path');
const engine=require('../server/combat.cjs'),balance=require('../shared/color-balance.js'),weapons=require('../shared/weapon-gems.js');
const samples=Number(process.env.GEMMO_BALANCE_SAMPLES)||100;
const gemCache=new Map();
function gem(id,version){const key=version+id;if(gemCache.has(key))return gemCache.get(key);const a=engine.GEM[id];const value=a?balance.gemSpec({id,color:a[0],cap:a[1],kind:a[2],power:a[3],turnCost:a[4]??1,attack:a[5]||0,defense:a[6]||0},version):null;gemCache.set(key,value);return value}
function scoreMatches(s){const match=engine.findMatches(s);if(!match)return 0;const weapon=weapons.STARTER_WEAPON_IDS.includes(s.sack[0])?gem(s.sack[0],s.version):null;let score=0;for(const p of match.cells){const c=p.type||s.board[p.y][p.x],g=s.sack.map(id=>gem(id,s.version)).filter(g=>g?.color===c),bonus=s.bonus[p.y][p.x]||0;let value=c===weapon?.color?6:0;value+=g.length?2:0;if(c==='red')value+=1; if(s.version!=='replay-v4'&&c==='blue')value+=g.reduce((n,v)=>n+v.defense,0);score+=value*(1+bonus)}return score+(match.runs.some(r=>r.cells.length>=4)?8:0)}
function action(s){
 if(s.targetMode){let best={t:'target',x:0,y:0},high=-Infinity;for(let y=0;y<8;y++)for(let x=0;x<8;x++){let score=0;const old=s.board[y][x];if(s.targetMode==='weapon_paint'||s.targetMode==='paint'||s.targetMode==='wildcraft'){s.board[y][x]=s.targetMode==='weapon_paint'?gem(s.sack[0],s.version).color:s.targetMode==='paint'?'red':'wild';score=scoreMatches(s);s.board[y][x]=old;}else score=old===gem(s.sack[0],s.version).color?3:old==='red'?2:1;if(score>high){high=score;best={t:'target',x,y}}}return best}
 if(s.freeSwap)return {t:'swap',ax:0,ay:0,bx:1,by:0};
 for(let i=0;i<5;i++){const g=gem(s.sack[i],s.version);if(!g||s.charges[g.color]<g.cap)continue;
  if(g.kind==='heal'&&(s.probeMaxHP||18)-s.pHP<g.power)continue;
  if(g.kind==='guard'&&s.pGuard>=g.power/2)continue;
  if(g.kind==='red_attune'&&s.buffs.redwake)continue;
  if(g.kind==='boost'&&s.overdrive)continue;
  return {t:'ability',slot:i};
 }
 let best=null,high=-Infinity;for(const [a,b] of engine.legalMoves(s)){[s.board[a.y][a.x],s.board[b.y][b.x]]=[s.board[b.y][b.x],s.board[a.y][a.x]];[s.bonus[a.y][a.x],s.bonus[b.y][b.x]]=[s.bonus[b.y][b.x],s.bonus[a.y][a.x]];const score=scoreMatches(s);[s.board[a.y][a.x],s.board[b.y][b.x]]=[s.board[b.y][b.x],s.board[a.y][a.x]];[s.bonus[a.y][a.x],s.bonus[b.y][b.x]]=[s.bonus[b.y][b.x],s.bonus[a.y][a.x]];if(score>high){high=score;best={t:'swap',ax:a.x,ay:a.y,bx:b.x,by:b.y}}}return best;
}
module.exports={action};
if(require.main===module){
const rows=[];
for(const version of (process.env.GEMMO_BALANCE_VERSIONS||'replay-v3,replay-v4').split(','))for(const profile of ['starter','mixed'])for(const id of (process.env.GEMMO_BALANCE_WEAPONS?process.env.GEMMO_BALANCE_WEAPONS.split(','):weapons.STARTER_WEAPON_IDS)){
 const color=gem(id,version).color,sack=profile==='starter'?[id,null,null,null,null]:[id,'bloodstone-whet','shield','healing-potion','chaos-orb'];
 for(const encounterId of ['rat','bandit','sentinel']){
  let wins=0,losses=0,unfinished=0,actions=0,hp=0;
  for(let seed=1;seed<=samples;seed++){
   const s=engine.createCombat({seed,version,encounterId,sack,skills:profile==='mixed'?[color+'-cap-1',color+'-start']:[],rewardBudget:{gold:30,xp:30}});
   let count=0;while(s.pHP>0&&s.eHP>0&&count++<200){const a=action(s);if(!a||!engine.applyCombatAction(s,a))break}
   if(s.eHP<=0){wins++;hp+=Math.max(0,s.pHP)}else if(s.pHP<=0)losses++;else unfinished++;
   actions+=count;
  }
  const row={version,profile,weapon:id,color,encounter:encounterId,samples,wins,losses,unfinished,winrate:Math.round(wins/samples*1000)/10,meanPlayerActions:Math.round(actions/samples*10)/10,meanWinningHP:wins?Math.round(hp/wins*10)/10:0};rows.push(row);process.stdout.write(JSON.stringify(row)+'\n');
 }
}
const output=path.join(__dirname,'../docs/color-balance-results.json');
if(process.env.GEMMO_BALANCE_MERGE&&fs.existsSync(output)){const previous=JSON.parse(fs.readFileSync(output,'utf8'));if(previous.samples!==samples)throw new Error('Cannot merge probes with different sample counts');const key=r=>[r.version,r.profile,r.weapon,r.encounter].join(':');const replaced=new Set(rows.map(key));rows.unshift(...previous.rows.filter(r=>!replaced.has(key(r))));}
fs.writeFileSync(output,JSON.stringify({method:'Same seeds and weapon-aware greedy policy; PvE probe, not competitive proof. Mixed profile uses four shop support gems and two weapon-color skill points.',samples,rows},null,2)+'\n');

}
