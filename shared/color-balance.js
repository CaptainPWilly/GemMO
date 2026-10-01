(function(root){
'use strict';
const VERSION='replay-v4';
const isCurrent=version=>['replay-v4','replay-v5','replay-v6'].includes(version);
const isWeaponGem=typeof module==='object'?require('./weapon-gems.js').isWeaponGem:root.GEMMO_WEAPON_GEMS.isWeaponGem;
const ROLES=Object.freeze({red:'AMPLIFY',blue:'PROTECT',green:'RESTORE',yellow:'TEMPO',purple:'CONTROL'});
const STARTERS=Object.freeze({
 dagger:{cap:7,power:7,desc:'Deal 7 damage. Red specializes in decisive strikes.'},
 'crystal-wand':{cap:7,power:4,onHitGuard:3,desc:'Deal 4 damage and gain 3 Guard.'},
 'thorn-whip':{cap:7,power:4,onHitHeal:3,desc:'Deal 4 damage and heal 3 HP.'},
 sling:{cap:7,kind:'quick_damage',power:4,turnCost:0,desc:'Deal 4 damage without ending your turn.'},
 'ritual-dagger':{name:'Rift Cut',cap:7,kind:'damage',power:5,pierceGuard:true,onHitSteal:2,desc:'Deal 5 damage through enemy Guard and steal up to 2 enemy charge into your weapon color.'}
});
function gemSpec(base,version=VERSION){
 if(!base||!isCurrent(version))return base;
 const weapon=isWeaponGem(base.id);
 if(base.id==='troll-maul')return {...base,attack:2,defense:0,pierceGuard:true};
 const gem={...base,attack:weapon?Math.max(1,base.attack||0,base.cap>=9?2:1):0,defense:0};
 if(STARTERS[base.id])Object.assign(gem,STARTERS[base.id]);
 if(['replay-v5','replay-v6'].includes(version)&&base.id==='swordbreaker')gem.desc='Disarm the enemy: weapon matches and weapon abilities deal no damage during its next action.';
 if(base.id==='bloodstone-whet')gem.desc='For your next 3 actions, the first match of your weapon color deals +2 damage. Works with every weapon color.';
 if(base.id==='bastion-sigil')gem.desc='For your next 3 actions, the first Blue match grants +2 Guard.';
 if(base.id==='heartseed')gem.desc='For your next 3 actions, the first Green match heals 2 HP.';
 if(base.id==='gamblers-thread')gem.desc='For your next 3 actions, the first Yellow match sends +2 charge to your most depleted other equipped color.';
 if(base.id==='cloak'){gem.power=3;gem.turnCost=0;gem.desc='Gain 3 Guard without ending your turn.'}
 if(base.id==='seal'){gem.kind='mark';gem.cap=5;gem.name='Vulnerability';gem.desc='Curse the enemy. The next damage it takes is increased by 3.'}
 if(base.id==='spell-tome'){gem.kind='silence';gem.cap=5;gem.name='Sealing Word';gem.desc='Silence the enemy. It cannot use an active ability during its next action.'}
 if(base.id==='relic'){gem.kind='siphon';gem.cap=7;gem.name='Lunar Drain';gem.desc='Deal 2 damage and steal up to 3 enemy charge into your weapon color.'}
 if(base.id==='echo-knife')gem.desc='Deal 2 damage and steal up to 3 enemy charge into your weapon color.';
 if(base.id==='powder-bomb'){gem.desc='Destroy a gem and its four orthogonal neighbors without match rewards. Add 2 charge to your weapon color.'}
 if(base.id==='chaos-orb'){gem.kind='weapon_paint';gem.desc='Choose a board gem and convert it to your weapon color. Resulting matches resolve for you.'}
 return gem;
}
function once(s,key){s.procsUsed=s.procsUsed||[];if(s.procsUsed.includes(key))return false;s.procsUsed.push(key);return true}
function weaponColor(s,lookup){return s.sack.map(lookup).find(g=>g&&g.attack>0)?.color||null}
function stealCharge(s,amount,{lookup,cap}){
 const target=weaponColor(s,lookup);if(!target)return 0;
 const source=Object.keys(s.ec).sort((a,b)=>s.ec[b]-s.ec[a])[0],stolen=Math.min(amount,s.ec[source]||0);
 s.ec[source]-=stolen;s.charges[target]=Math.min(cap(target),s.charges[target]+stolen);return stolen;
}
function applyColorPerk(s,color,n,{lookup,maxHP,cap}){
 if(!isCurrent(s.version)||n<3||!s.skill?.colorPerks?.[color]||!s.sack.some(id=>lookup(id)?.color===color)||!once(s,'skill:'+color))return;
 const weapon=weaponColor(s,lookup);
 if(color==='red')s.buffs.empower=1;
 if(color==='blue'){s.pGuard++;s.guardTurns=2}
 if(color==='green')s.pHP=Math.min(maxHP,s.pHP+1);
 if(color==='yellow'&&weapon)s.charges[weapon]=Math.min(cap(weapon),s.charges[weapon]+1);
 if(color==='purple'&&weapon)stealCharge(s,1,{lookup,cap});
}
function attuneProc(s,key,comboBonus){return !comboBonus&&s.buffs[key]>0&&(!isCurrent(s.version)||once(s,'attune:'+key))}
function strikeBonus(s,attack,comboBonus){
 if(!isCurrent(s.version)||!attack||comboBonus)return 0;
 const empowered=s.buffs.empower||0;s.buffs.empower=0;
 return empowered+(attuneProc(s,'redwake',false)?2:0);
}
const rules=Object.freeze({VERSION,isCurrent,ROLES,STARTERS,gemSpec,weaponColor,stealCharge,applyColorPerk,attuneProc,strikeBonus});
if(typeof module==='object'&&module.exports)module.exports=rules;else root.GEMMO_COLOR_BALANCE=rules;
})(globalThis);
