(function(root,factory){
'use strict';
const rules=factory();
if(typeof module==='object'&&module.exports)module.exports=rules;else root.GEMMO_ENEMY_LOADOUTS=rules;
})(globalThis,function(){
'use strict';
// This policy is shared by replay-v5/v6. Encounter HP and Sacks are versioned separately.
const VERSION='replay-v7',COLORS=['red','blue','green','yellow','purple'];
const supported=new Set(['damage','heal','guard','siphon']);
function gems(encounter,lookup){return (encounter.sack||[]).map(lookup).filter(Boolean)}
function cap(encounter,color,lookup){return gems(encounter,lookup).reduce((sum,g)=>sum+(g.color===color?g.cap:0),0)}
function weapon(encounter,lookup){return gems(encounter,lookup).find(g=>g.attack>0)||null}
function ready(g,s){
 if(!supported.has(g.kind)||s.silenced||s.charge[g.color]<g.cap)return false;
 if(g.kind==='heal'&&s.maxHP-s.hp<g.power)return false;
 if(g.kind==='guard'&&s.guard>=g.power)return false;
 if(g.attack>0&&s.disarmed)return false;
 return true;
}
function choose(encounter,lookup,s){
 const list=gems(encounter,lookup).filter(g=>ready(g,s));
 // Healing when it fits, then protection when low, then offense. Ties use Sack order.
 return list.find(g=>g.kind==='heal')||list.find(g=>g.kind==='guard'&&s.hp<=s.maxHP/2)||list.find(g=>g.attack>0)||list[0]||null;
}
function score(encounter,color,lookup,s){
 const w=weapon(encounter,lookup),capacity=cap(encounter,color,lookup);
 if(!capacity)return 0;
 const charging=s.charge[color]<capacity?2:0;
 const heal=gems(encounter,lookup).some(g=>g.color===color&&g.kind==='heal');
 return charging+(w?.color===color&&!s.disarmed?5:0)+(heal&&s.hp<s.maxHP/2?3:0);
}
// The selected gems use the same immediate effects and costs as their player versions.
// Damage is delegated so Guard, Veilstep, reflection and death obey each host engine.
function cast(g,s,{encounter,lookup,damage,capacity=color=>cap(encounter,color,lookup),paid=false}){
 if(!supported.has(g.kind)||(!paid&&s.charge[g.color]<g.cap))return false;
 if(!paid)s.charge[g.color]-=g.cap;
 const steal=amount=>{
  const color=Object.keys(s.opponentCharge).sort((a,b)=>s.opponentCharge[b]-s.opponentCharge[a])[0],taken=Math.min(amount,s.opponentCharge[color]||0),target=weapon(encounter,lookup)?.color;
  if(color)s.opponentCharge[color]-=taken;
  if(target)s.charge[target]=Math.min(capacity(target),s.charge[target]+taken);
 };
 if(g.kind==='damage')damage(g.power,!!g.pierceGuard);
 if(g.onHitGuard)s.guard+=g.onHitGuard;
 if(g.onHitHeal)s.hp=Math.min(s.maxHP,s.hp+g.onHitHeal);
 if(g.onHitSteal)steal(g.onHitSteal);
 if(g.kind==='heal')s.hp=Math.min(s.maxHP,s.hp+g.power);
 if(g.kind==='guard')s.guard+=g.power;
 if(g.kind==='siphon'){damage(2,false);steal(3)}
 return true;
}

return Object.freeze({VERSION,isCurrent:version=>['replay-v5','replay-v6','replay-v7'].includes(version),supports:kind=>supported.has(kind),gems,cap,weapon,ready,choose,score,cast});
});
