'use strict';

const GEM_IDS=Object.freeze([
  'dagger','axe','spear','arming-sword','warhammer','longbow','rapier','halberd','hand-crossbow','flail','ember-rod','bloodstone-whet',
  'shield','buckler','ward','tower-shield','swordbreaker','quarterstaff','pavise','war-pick','kite-shield','hook-spear','anchor-maul','tide-chain','bastion-sigil',
  'salve','poultice','briar','sickle','druid-staff','hunting-bow','thorn-whip','grove-spear','woodland-club','willow-wand','venom-needle','wayfarer-lyre','heartseed',
  'boots','cloak','knife','twin-knives','light-crossbow','sling','duelist-sabre','glaive','parrying-dagger','javelin','mist-mantle','clockwork-spur','gamblers-thread',
  'charm','seal','relic','rune-blade','hex-staff','relic-mace','moon-scythe','crystal-wand','spell-tome','ritual-dagger','prism-orb','star-lens','echo-knife'
]);
const EQUIPMENT_SLOTS=Object.freeze({head:'head',chest:'chest',hands:'hands',legs:'legs',feet:'feet',necklace:'necklace',ring1:'ring',ring2:'ring'});
const GEAR=Object.freeze({
  'frayed-hood':{slot:'head',hp:1,guard:0},'leather-cap':{slot:'head',hp:0,guard:1},
  'padded-tunic':{slot:'chest',hp:2,guard:0},'hide-vest':{slot:'chest',hp:0,guard:2},
  'cloth-wraps':{slot:'hands',hp:1,guard:0},'leather-gloves':{slot:'hands',hp:0,guard:1},
  'linen-trousers':{slot:'legs',hp:1,guard:0},'hide-leggings':{slot:'legs',hp:0,guard:1},
  'scuffed-boots':{slot:'feet',hp:1,guard:0},'leather-boots':{slot:'feet',hp:0,guard:1},
  'copper-pendant':{slot:'necklace',hp:1,guard:0},'bone-talisman':{slot:'necklace',hp:0,guard:1},
  'tin-ring':{slot:'ring',hp:1,guard:0},'iron-band':{slot:'ring',hp:0,guard:1},
  'twine-ring':{slot:'ring',hp:1,guard:0},'copper-band':{slot:'ring',hp:0,guard:1}
});
const DEFAULT_SACK=Object.freeze(['dagger','shield','salve','boots','charm']);
const STARTER_GEMS=Object.freeze({red:'dagger',blue:'shield',green:'salve',yellow:'boots',purple:'charm'});
const STARTER_GEM_SET=new Set(Object.values(STARTER_GEMS));
const WORLD_NODES=Object.freeze({
  camp:{id:'camp',name:'Ember Camp',kind:'safe',neighbors:['crossroads']},
  crossroads:{id:'crossroads',name:'Old Crossroads',kind:'road',neighbors:['camp','shrine','bandit-pass']},
  shrine:{id:'shrine',name:'Broken Shrine',kind:'landmark',neighbors:['crossroads']},
  'bandit-pass':{id:'bandit-pass',name:'Bandit Toll',kind:'encounter',encounter:'bandit',neighbors:['crossroads']}
});
module.exports={GEM_IDS,GEM_SET:new Set(GEM_IDS),GEAR,EQUIPMENT_SLOTS,DEFAULT_SACK,STARTER_GEMS,STARTER_GEM_SET,WORLD_NODES};
