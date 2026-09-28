(function(root,factory){
'use strict';
const progression=factory();
if(typeof module==='object'&&module.exports)module.exports=progression;
else root.GEMMO_PROGRESSION=progression;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS=Object.freeze(['red','blue','green','yellow','purple']);
const branch=(id,label,nodes)=>Object.freeze({id,label,nodes:Object.freeze(nodes.map(Object.freeze))});
const BRANCHES=Object.freeze([
 branch('neutral','FOUNDATION',[
  {id:'neutral-vitality',name:'Vitality',tier:1,desc:'+2 Max HP.',effect:{maxHP:2}},
  {id:'neutral-bulwark',name:'Bulwark',tier:2,requires:'neutral-vitality',desc:'+1 Starting Guard.',effect:{startGuard:1}},
  {id:'neutral-reservoir',name:'Deep Reservoirs',tier:3,requires:'neutral-bulwark',desc:'+1 maximum charge to every color.',effect:{allCap:1}}
 ]),
 branch('red','RED · ASSAULT',[
  {id:'red-cap-1',name:'Ember Vessel',tier:1,desc:'+1 Red maximum charge.',effect:{cap:{red:1}}},
  {id:'red-start',name:'First Blood',tier:2,requires:'red-cap-1',desc:'Start combat with 1 Red charge.',effect:{start:{red:1}}},
  {id:'red-cap-2',name:'Deep Ember',tier:3,requires:'red-start',desc:'+1 additional Red maximum charge.',effect:{cap:{red:1}}}
 ]),
 branch('blue','BLUE · DEFENSE',[
  {id:'blue-cap-1',name:'Ward Vessel',tier:1,desc:'+1 Blue maximum charge.',effect:{cap:{blue:1}}},
  {id:'blue-start',name:'Ready Ward',tier:2,requires:'blue-cap-1',desc:'Start combat with 1 Blue charge.',effect:{start:{blue:1}}},
  {id:'blue-cap-2',name:'Deep Ward',tier:3,requires:'blue-start',desc:'+1 additional Blue maximum charge.',effect:{cap:{blue:1}}}
 ]),
 branch('green','GREEN · SUSTAIN',[
  {id:'green-cap-1',name:'Root Vessel',tier:1,desc:'+1 Green maximum charge.',effect:{cap:{green:1}}},
  {id:'green-start',name:'Seeded Growth',tier:2,requires:'green-cap-1',desc:'Start combat with 1 Green charge.',effect:{start:{green:1}}},
  {id:'green-cap-2',name:'Deep Root',tier:3,requires:'green-start',desc:'+1 additional Green maximum charge.',effect:{cap:{green:1}}}
 ]),
 branch('yellow','YELLOW · TEMPO',[
  {id:'yellow-cap-1',name:'Tempo Vessel',tier:1,desc:'+1 Yellow maximum charge.',effect:{cap:{yellow:1}}},
  {id:'yellow-start',name:'Head Start',tier:2,requires:'yellow-cap-1',desc:'Start combat with 1 Yellow charge.',effect:{start:{yellow:1}}},
  {id:'yellow-cap-2',name:'Deep Tempo',tier:3,requires:'yellow-start',desc:'+1 additional Yellow maximum charge.',effect:{cap:{yellow:1}}}
 ]),
 branch('purple','PURPLE · ARCANE',[
  {id:'purple-cap-1',name:'Arcane Vessel',tier:1,desc:'+1 Purple maximum charge.',effect:{cap:{purple:1}}},
  {id:'purple-start',name:'Residual Spark',tier:2,requires:'purple-cap-1',desc:'Start combat with 1 Purple charge.',effect:{start:{purple:1}}},
  {id:'purple-cap-2',name:'Deep Arcana',tier:3,requires:'purple-start',desc:'+1 additional Purple maximum charge.',effect:{cap:{purple:1}}}
 ])
]);
const SKILLS=Object.freeze(BRANCHES.flatMap(b=>b.nodes.map(n=>Object.freeze({...n,branch:b.id}))));
const SKILL_BY_ID=Object.freeze(Object.fromEntries(SKILLS.map(s=>[s.id,s])));
function xpForLevel(level){const lv=Math.max(1,Math.floor(Number(level)||1)),n=lv-1;return 20*n+5*n*(n-1)/2}
function xpToNext(level){const lv=Math.max(1,Math.floor(Number(level)||1));return xpForLevel(lv+1)-xpForLevel(lv)}
function levelForXp(xp){const total=Math.max(0,Math.floor(Number(xp)||0));let level=1;while(level<999&&total>=xpForLevel(level+1))level++;return level}
function xpProgress(xp){const total=Math.max(0,Math.floor(Number(xp)||0)),level=levelForXp(total),floor=xpForLevel(level),next=xpForLevel(level+1);return {level,total,current:total-floor,required:next-floor,floor,next}}
function normalizePurchased(ids){return [...new Set((Array.isArray(ids)?ids:[]).filter(id=>SKILL_BY_ID[id]))]}
function availableSkillPoints(level,purchased){return Math.max(0,Math.floor(Number(level)||1)-normalizePurchased(purchased).length)}
function canPurchase(skillId,purchased,level){const node=SKILL_BY_ID[skillId],owned=new Set(normalizePurchased(purchased));if(!node)return {ok:false,reason:'invalid_skill'};if(owned.has(skillId))return {ok:false,reason:'skill_already_owned'};if(availableSkillPoints(level,[...owned])<1)return {ok:false,reason:'no_skill_points'};if(node.requires&&!owned.has(node.requires))return {ok:false,reason:'skill_prerequisite'};return {ok:true,node}}
function skillEffects(ids){const out={maxHP:0,startGuard:0,allCap:0,caps:{red:0,blue:0,green:0,yellow:0,purple:0},startCharge:{red:0,blue:0,green:0,yellow:0,purple:0}};for(const id of normalizePurchased(ids)){const e=SKILL_BY_ID[id].effect||{};out.maxHP+=Number(e.maxHP)||0;out.startGuard+=Number(e.startGuard)||0;out.allCap+=Number(e.allCap)||0;for(const c of COLORS){out.caps[c]+=Number(e.cap?.[c])||0;out.startCharge[c]+=Number(e.start?.[c])||0}}return out}
return Object.freeze({COLORS,BRANCHES,SKILLS,SKILL_BY_ID,xpForLevel,xpToNext,levelForXp,xpProgress,normalizePurchased,availableSkillPoints,canPurchase,skillEffects});
});
