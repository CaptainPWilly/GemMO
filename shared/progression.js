(function(root,factory){
'use strict';
const progression=factory();
if(typeof module==='object'&&module.exports)module.exports=progression;
else root.GEMMO_PROGRESSION=progression;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS=Object.freeze(['red','blue','green','yellow','purple']);
const ranked=(id,name,tier,maxRank,desc,effect,requires=null)=>({id,name,tier,maxRank,kind:'ranked',desc,effect,...(requires?{requires}:{})});
const notable=(id,name,tier,desc,effect,requires=null)=>({id,name,tier,maxRank:1,kind:'notable',desc,effect,...(requires?{requires}:{})});
const branch=(id,label,nodes)=>Object.freeze({id,label,nodes:Object.freeze(nodes.map(Object.freeze))});
const BRANCHES=Object.freeze([
 branch('neutral','FOUNDATION',[
  ranked('neutral-vitality','Vitality',1,3,'+2 Max HP per rank.',{maxHP:2}),
  ranked('neutral-bulwark','Bulwark',2,3,'+1 Starting Guard per rank.',{startGuard:1},{id:'neutral-vitality',rank:1}),
  notable('neutral-reservoir','Deep Reservoirs',3,'+1 maximum charge to every color.',{allCap:1},{id:'neutral-bulwark',rank:1})
 ]),
 branch('red','RED · ASSAULT',[
  ranked('red-cap-1','Ember Vessel',1,3,'+1 Red maximum charge per rank.',{cap:{red:1}}),
  notable('red-start','First Blood',2,'Start combat with 1 Red charge. Red matches prime +1 damage for your next weapon match. Once per action; requires an equipped Red gem.',{start:{red:1}},{id:'red-cap-1',rank:1}),
  ranked('red-cap-2','Deep Ember',3,2,'+1 additional Red maximum charge per rank.',{cap:{red:1}},{id:'red-start',rank:1}),
  notable('red-resonance','Ember Resonance',4,'Red matches generate +1 additional Red charge.',{gain:{red:1}},{id:'red-cap-2',rank:1})
 ]),
 branch('blue','BLUE · DEFENSE',[
  ranked('blue-cap-1','Ward Vessel',1,3,'+1 Blue maximum charge per rank.',{cap:{blue:1}}),
  notable('blue-start','Ready Ward',2,'Start combat with 1 Blue charge. Blue matches grant +1 Guard. Once per action; requires an equipped Blue gem.',{start:{blue:1}},{id:'blue-cap-1',rank:1}),
  ranked('blue-cap-2','Deep Ward',3,2,'+1 additional Blue maximum charge per rank.',{cap:{blue:1}},{id:'blue-start',rank:1}),
  notable('blue-resonance','Ward Resonance',4,'Blue matches generate +1 additional Blue charge.',{gain:{blue:1}},{id:'blue-cap-2',rank:1})
 ]),
 branch('green','GREEN · SUSTAIN',[
  ranked('green-cap-1','Root Vessel',1,3,'+1 Green maximum charge per rank.',{cap:{green:1}}),
  notable('green-start','Seeded Growth',2,'Start combat with 1 Green charge. Green matches heal 1 HP. Once per action; requires an equipped Green gem.',{start:{green:1}},{id:'green-cap-1',rank:1}),
  ranked('green-cap-2','Deep Root',3,2,'+1 additional Green maximum charge per rank.',{cap:{green:1}},{id:'green-start',rank:1}),
  notable('green-resonance','Root Resonance',4,'Green matches generate +1 additional Green charge.',{gain:{green:1}},{id:'green-cap-2',rank:1})
 ]),
 branch('yellow','YELLOW · TEMPO',[
  ranked('yellow-cap-1','Tempo Vessel',1,3,'+1 Yellow maximum charge per rank.',{cap:{yellow:1}}),
  notable('yellow-start','Head Start',2,'Start combat with 1 Yellow charge. Yellow matches add +1 charge to your equipped weapon color. Once per action; requires an equipped Yellow gem.',{start:{yellow:1}},{id:'yellow-cap-1',rank:1}),
  ranked('yellow-cap-2','Deep Tempo',3,2,'+1 additional Yellow maximum charge per rank.',{cap:{yellow:1}},{id:'yellow-start',rank:1}),
  notable('yellow-resonance','Tempo Resonance',4,'Yellow matches generate +1 additional Yellow charge.',{gain:{yellow:1}},{id:'yellow-cap-2',rank:1})
 ]),
 branch('purple','PURPLE · ARCANE',[
  ranked('purple-cap-1','Arcane Vessel',1,3,'+1 Purple maximum charge per rank.',{cap:{purple:1}}),
  notable('purple-start','Residual Spark',2,'Start combat with 1 Purple charge. Purple matches steal 1 enemy charge into your weapon color, when available. Once per action; requires an equipped Purple gem.',{start:{purple:1}},{id:'purple-cap-1',rank:1}),
  ranked('purple-cap-2','Deep Arcana',3,2,'+1 additional Purple maximum charge per rank.',{cap:{purple:1}},{id:'purple-start',rank:1}),
  notable('purple-resonance','Arcane Resonance',4,'Purple matches generate +1 additional Purple charge.',{gain:{purple:1}},{id:'purple-cap-2',rank:1})
 ])
]);
const SKILLS=Object.freeze(BRANCHES.flatMap(b=>b.nodes.map(n=>Object.freeze({...n,branch:b.id}))));
const SKILL_BY_ID=Object.freeze(Object.fromEntries(SKILLS.map(s=>[s.id,s])));
function xpForLevel(level){const lv=Math.max(1,Math.floor(Number(level)||1)),n=lv-1;return 20*n+5*n*(n-1)/2}
function xpToNext(level){const lv=Math.max(1,Math.floor(Number(level)||1));return xpForLevel(lv+1)-xpForLevel(lv)}
function levelForXp(xp){const total=Math.max(0,Math.floor(Number(xp)||0));let level=1;while(level<999&&total>=xpForLevel(level+1))level++;return level}
function xpProgress(xp){const total=Math.max(0,Math.floor(Number(xp)||0)),level=levelForXp(total),floor=xpForLevel(level),next=xpForLevel(level+1);return {level,total,current:total-floor,required:next-floor,floor,next}}
function rankToken(skillId,rank){return rank<=1?skillId:skillId+'@'+rank}
function tokenInfo(token){
 if(typeof token!=='string')return null;
 if(SKILL_BY_ID[token])return {id:token,rank:1};
 const match=/^(.+)@(\d+)$/.exec(token);if(!match)return null;
 const node=SKILL_BY_ID[match[1]],rank=Number(match[2]);return node&&rank>=2&&rank<=node.maxRank?{id:node.id,rank}:null;
}
function rankMap(ids){
 const present=new Map();
 for(const token of Array.isArray(ids)?ids:[]){const info=tokenInfo(token);if(!info)continue;if(!present.has(info.id))present.set(info.id,new Set());present.get(info.id).add(info.rank)}
 const ranks={};
 for(const node of SKILLS){const set=present.get(node.id)||new Set();let rank=0;for(let next=1;next<=node.maxRank&&set.has(next);next++)rank=next;ranks[node.id]=rank}
 return ranks;
}
function skillRank(skillId,ids){return rankMap(ids)[skillId]||0}
function normalizePurchased(ids){
 const ranks=rankMap(ids),out=[];
 for(const node of SKILLS)for(let rank=1;rank<=ranks[node.id];rank++)out.push(rankToken(node.id,rank));
 return out;
}
function pointsSpent(ids){return normalizePurchased(ids).length}
function availableSkillPoints(level,purchased){return Math.max(0,Math.floor(Number(level)||1)-pointsSpent(purchased))}
function requirementMet(requirement,purchased){
 if(!requirement)return true;
 const req=typeof requirement==='string'?{id:requirement,rank:1}:requirement;
 return !!SKILL_BY_ID[req.id]&&skillRank(req.id,purchased)>=Math.max(1,Number(req.rank)||1);
}
function canPurchase(skillId,purchased,level){
 const node=SKILL_BY_ID[skillId],clean=normalizePurchased(purchased);if(!node)return {ok:false,reason:'invalid_skill'};
 const rank=skillRank(skillId,clean);if(rank>=node.maxRank)return {ok:false,reason:'skill_max_rank'};
 if(availableSkillPoints(level,clean)<1)return {ok:false,reason:'no_skill_points'};
 if(!requirementMet(node.requires,clean))return {ok:false,reason:'skill_prerequisite'};
 const nextRank=rank+1;return {ok:true,node,rank,nextRank,token:rankToken(skillId,nextRank)};
}
function skillEffects(ids,version='replay-v4'){
 const ranks=rankMap(ids),out={maxHP:0,startGuard:0,allCap:0,caps:{red:0,blue:0,green:0,yellow:0,purple:0},startCharge:{red:0,blue:0,green:0,yellow:0,purple:0},chargeGain:{red:0,blue:0,green:0,yellow:0,purple:0}};
 out.colorPerks=Object.fromEntries(COLORS.map(c=>[c,version==='replay-v4'&&(ranks[c+'-start']||0)>0?1:0]));
 for(const node of SKILLS){const rank=ranks[node.id]||0;if(!rank)continue;const e=node.effect||{};out.maxHP+=(Number(e.maxHP)||0)*rank;out.startGuard+=(Number(e.startGuard)||0)*rank;out.allCap+=(Number(e.allCap)||0)*rank;for(const c of COLORS){out.caps[c]+=(Number(e.cap?.[c])||0)*rank;out.startCharge[c]+=(Number(e.start?.[c])||0)*rank;out.chargeGain[c]+=(Number(e.gain?.[c])||0)*rank}}
 return out;
}
return Object.freeze({COLORS,BRANCHES,SKILLS,SKILL_BY_ID,xpForLevel,xpToNext,levelForXp,xpProgress,rankToken,tokenInfo,rankMap,skillRank,normalizePurchased,pointsSpent,availableSkillPoints,requirementMet,canPurchase,skillEffects});
});
