'use strict';
const assert=require('assert/strict'),engine=require('../server/combat.cjs'),balance=require('../shared/color-balance.js'),weapons=require('../shared/weapon-gems.js'),progression=require('../shared/progression.js');
const make=(sack,skills=[])=>engine.createCombat({version:'replay-v4',seed:123,sack,skills});
const spec=id=>{const g=engine.GEM[id];return balance.gemSpec({id,color:g[0],cap:g[1],kind:g[2],power:g[3],turnCost:g[4]??1,attack:g[5]||0,defense:g[6]||0})};
for(const id of weapons.STARTER_WEAPON_IDS){const g=spec(id),s=make([id,null,null,null,null]);assert.equal(g.cap,7);assert.equal(g.attack,1);assert.equal(g.defense,0);s.eHP=100;for(const color of progression.COLORS){const before=s.eHP;engine.applyColor(s,color,3,'player');assert.equal(before-s.eHP,color===g.color?3:0);assert.equal(s.pGuard,0)}}
for(const id of Object.keys(engine.GEM)){const g=spec(id);if(!weapons.isWeaponGem(id)){assert.equal(g.attack,0,id+' support cannot multiply match damage');assert.equal(g.defense,0,id+' support cannot stack free Guard')}}
const s=make(['crystal-wand','bloodstone-whet','healing-potion','locksmith-pick','chaos-orb']);s.eHP=100;s.buffs.redwake=4;
engine.applyColor(s,'red',3,'player');assert.equal(s.eHP,100,'Red support alone does not create a second damage color');
engine.applyColor(s,'blue',3,'player');assert.equal(s.eHP,95,'Redwake supports a Blue weapon');
engine.applyColor(s,'blue',3,'player');assert.equal(s.eHP,92,'Redwake cannot multiply across cascades in the same action');
engine.applyColor(s,'blue',2,'player',true);assert.equal(s.eHP,90,'cascade anchor charge does not retrigger amplification');
const skillIds=progression.COLORS.flatMap(c=>[c+'-cap-1',c+'-start']);
const h=make(['crystal-wand','bloodstone-whet','healing-potion','locksmith-pick','chaos-orb'],skillIds);h.pHP=10;h.eHP=100;h.ec.red=2;
engine.applyColor(h,'red',3,'player');assert.equal(h.buffs.empower,1);engine.applyColor(h,'red',3,'player');assert.equal(h.buffs.empower,1,'Red priming is bounded');
engine.applyColor(h,'blue',3,'player');assert.equal(h.eHP,96,'Red skill primes a different weapon color');assert.equal(h.pGuard,1);
engine.applyColor(h,'blue',3,'player');assert.equal(h.pGuard,1,'Blue skill is bounded');
engine.applyColor(h,'green',3,'player');engine.applyColor(h,'green',3,'player');assert.equal(h.pHP,11,'Green skill is bounded');
h.charges.blue=0;engine.applyColor(h,'yellow',3,'player');assert.equal(h.charges.blue,1,'Yellow feeds the weapon color');engine.applyColor(h,'yellow',3,'player');assert.equal(h.charges.blue,1);
engine.applyColor(h,'purple',3,'player');assert.equal(h.ec.red,1);assert.equal(h.charges.blue,2,'Purple steals enemy charge into a different weapon color');engine.applyColor(h,'purple',3,'player');assert.equal(h.ec.red,1);
const noGem=make(['dagger',null,null,null,null],['green-cap-1','green-start']);noGem.pHP=10;engine.applyColor(noGem,'green',3,'player');assert.equal(noGem.pHP,10,'skill perk requires a gem of its color');
const legacy=engine.createCombat({version:'replay-v3',seed:123,sack:['crystal-wand','bloodstone-whet',null,null,null],skills:skillIds});legacy.eHP=100;engine.applyColor(legacy,'blue',3,'player');assert.equal(legacy.pGuard,3,'saved Blue passive Guard remains');assert.equal(legacy.eHP,97);assert.equal(legacy.skill.colorPerks.green,0,'saved fights do not acquire new skill perks');
const pierce=make(['ritual-dagger',null,null,null,null]);pierce.eGuard=8;pierce.charges.purple=7;pierce.ec.blue=4;pierce.extraTurn=true;const before=pierce.eHP;assert(engine.applyCombatAction(pierce,{t:'ability',slot:0}));assert.equal(before-pierce.eHP,5,'Purple active penetrates Guard');assert.equal(pierce.eGuard,8,'piercing does not destroy Guard');assert.equal(pierce.charges.purple,2,'Rift Cut restores stolen charge');assert.equal(pierce.ec.blue,2,'Rift Cut removes enemy charge');
const noWeapon=make(['chaos-orb',null,null,null,null]);noWeapon.charges.purple=6;assert.equal(engine.applyCombatAction(noWeapon,{t:'ability',slot:0}),false);assert.equal(noWeapon.charges.purple,6,'Flux cannot waste charge without a weapon');
const original=engine.GEM['chaos-orb'];assert.equal(original[2],'reroll','legacy catalog stays immutable');assert.equal(spec('chaos-orb').kind,'weapon_paint');
console.log('PASS: five distinct starter effects, bounded color skill perks, cross-color amplification/control, equal basic damage and preserved legacy combat.');
