(function(root){
'use strict';
// Weapon identity is explicit; effect kind and color do not determine it.
const WEAPON_GEM_IDS=Object.freeze(['dagger','hand-crossbow','barbed-blade','longbow','spear','rapier','arming-sword','executioners-axe','axe','flail','halberd','warhammer','ember-rod','crystal-wand','war-pick','quarterstaff','hook-spear','swordbreaker','anchor-maul','tide-chain','binding-chain','parrying-dagger','willow-wand','druid-staff','sickle','grove-spear','woodland-club','venom-needle','hunting-bow','thorn-whip','sling','knife','twin-knives','light-crossbow','duelist-sabre','glaive','javelin','ritual-dagger','rune-blade','moon-scythe','relic-mace','echo-knife','hex-staff']);
const weapons=new Set(WEAPON_GEM_IDS);
const isWeaponGem=id=>weapons.has(id);
// Effects grant additional slots explicitly. Never accept a client-supplied limit.
function weaponGemLimit(effects=[]){return Math.min(5,1+effects.reduce((n,e)=>n+(Number.isSafeInteger(e?.weaponGemSlots)&&e.weaponGemSlots>0?e.weaponGemSlots:0),0))}
function validWeaponGems(sack,effects=[]){return sack.filter(isWeaponGem).length<=weaponGemLimit(effects)}
function equipGem(sack,slot,id,effects=[]){
 const next=sack.slice();
 if(isWeaponGem(id)&&!isWeaponGem(next[slot])&&next.filter(isWeaponGem).length>=weaponGemLimit(effects))slot=next.findIndex(isWeaponGem);
 next[slot]=id;
 if(isWeaponGem(id)){let excess=next.filter(isWeaponGem).length-weaponGemLimit(effects);for(let i=0;i<next.length&&excess>0;i++)if(i!==slot&&isWeaponGem(next[i])){next[i]=null;excess--}}
 return next;
}
const rules=Object.freeze({WEAPON_GEM_IDS,isWeaponGem,weaponGemLimit,validWeaponGems,equipGem});
if(typeof module==='object'&&module.exports)module.exports=rules;else root.GEMMO_WEAPON_GEMS=rules;
})(globalThis);
