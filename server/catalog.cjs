'use strict';

const GEM_IDS=Object.freeze([
  "dagger",
  "hand-crossbow",
  "longbow",
  "arming-sword",
  "flail",
  "axe",
  "rapier",
  "spear",
  "halberd",
  "warhammer",
  "bloodstone-whet",
  "ember-rod",
  "barbed-blade",
  "executioners-axe",
  "quarterstaff",
  "shield",
  "pavise",
  "tower-shield",
  "hook-spear",
  "kite-shield",
  "ward",
  "buckler",
  "parrying-dagger",
  "war-pick",
  "swordbreaker",
  "anchor-maul",
  "tide-chain",
  "bastion-sigil",
  "mirror-shield",
  "binding-chain",
  "willow-wand",
  "poultice",
  "healing-potion",
  "salve",
  "druid-staff",
  "briar",
  "sickle",
  "moon-scythe",
  "grove-spear",
  "woodland-club",
  "venom-needle",
  "wayfarer-lyre",
  "heartseed",
  "hunting-bow",
  "thorn-whip",
  "purifying-tonic",
  "sling",
  "knife",
  "cloak",
  "boots",
  "mist-mantle",
  "clockwork-spur",
  "gamblers-thread",
  "twin-knives",
  "light-crossbow",
  "duelist-sabre",
  "glaive",
  "javelin",
  "locksmith-pick",
  "powder-bomb",
  "crystal-wand",
  "ritual-dagger",
  "spell-tome",
  "seal",
  "rune-blade",
  "relic",
  "relic-mace",
  "charm",
  "prism-orb",
  "star-lens",
  "echo-knife",
  "hex-staff",
  "chaos-orb",
  "void-flask"
]);
const EQUIPMENT_SLOTS=Object.freeze({head:'head',chest:'chest',hands:'hands',legs:'legs',feet:'feet',necklace:'necklace',ring1:'ring',ring2:'ring'});
const GEAR=Object.freeze({
  'frayed-hood':{slot:'head',caps:{purple:2}},'leather-cap':{slot:'head',caps:{blue:2}},
  'padded-tunic':{slot:'chest',hp:2},'hide-vest':{slot:'chest',guard:3},
  'cloth-wraps':{slot:'hands',caps:{red:2}},'leather-gloves':{slot:'hands',caps:{yellow:2}},
  'linen-trousers':{slot:'legs',caps:{green:2}},'hide-leggings':{slot:'legs',caps:{purple:2}},
  'scuffed-boots':{slot:'feet',caps:{yellow:2}},'leather-boots':{slot:'feet',caps:{green:2}},
  'copper-pendant':{slot:'necklace',caps:{blue:2}},'bone-talisman':{slot:'necklace',caps:{red:2}},
  'tin-ring':{slot:'ring',allCap:1},'iron-band':{slot:'ring',guard:2},
  'twine-ring':{slot:'ring',hp:1,caps:{yellow:1}},'copper-band':{slot:'ring',caps:{red:1,blue:1}}
});
const DEFAULT_SACK=Object.freeze(['dagger','shield','salve','boots','charm']);
const STARTER_GEMS=Object.freeze({red:'dagger',yellow:'sling',blue:'crystal-wand'});
const STARTER_GEM_SET=new Set(Object.values(STARTER_GEMS));
const WORLD_NODES=Object.freeze({
  camp:{id:'camp',name:'Ember Camp',kind:'safe',neighbors:['gem-shop','item-shop','crossroads']},
  'gem-shop':{id:'gem-shop',name:'Facet Cart',kind:'shop',shop:'gem',neighbors:['camp']},
  'item-shop':{id:'item-shop',name:'Roadside Outfitter',kind:'shop',shop:'item',neighbors:['camp']},
  crossroads:{id:'crossroads',name:'Crossroads',kind:'road',neighbors:['camp','shrine','rat']},
  shrine:{id:'shrine',name:'Shrine',kind:'landmark',neighbors:['crossroads']},
  rat:{id:'rat',name:'Rat',kind:'encounter',encounter:'rat',neighbors:['crossroads','bandit-pass']},
  'bandit-pass':{id:'bandit-pass',name:'Bandit',kind:'encounter',encounter:'bandit',requires:'rat',neighbors:['rat']}
});
const SHOP_CATALOG=Object.freeze({
  'gem-shop':Object.freeze({
    'hand-crossbow':18,'quarterstaff':18,'healing-potion':16,'knife':14,
    'locksmith-pick':16,'powder-bomb':22,'swordbreaker':20,'hunting-bow':20,
    'hex-staff':22,'chaos-orb':22,'crystal-wand':18,'sling':18
  }),
  'item-shop':Object.freeze({
    'frayed-hood':12,'padded-tunic':20,'cloth-wraps':12,'linen-trousers':12,'scuffed-boots':12,'copper-pendant':15,'tin-ring':15,'iron-band':15
  })
});
module.exports={GEM_IDS,GEM_SET:new Set(GEM_IDS),GEAR,EQUIPMENT_SLOTS,DEFAULT_SACK,STARTER_GEMS,STARTER_GEM_SET,WORLD_NODES,SHOP_CATALOG};
