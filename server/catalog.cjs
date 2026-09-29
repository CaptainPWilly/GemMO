'use strict';
const ENCOUNTERS=require('../shared/encounters.js');

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
const CONSUMABLES=Object.freeze({
  'minor-healing-draught':Object.freeze({name:'Minor Healing Draught',kind:'heal',power:5}),
  'ironbark-tonic':Object.freeze({name:'Ironbark Tonic',kind:'guard',power:5}),
  'prism-dust':Object.freeze({name:'Prism Dust',kind:'charge',power:3}),
  'cherry-bomb':Object.freeze({name:'Cherry Bomb',kind:'break',power:0})
});
const CONSUMABLE_SET=new Set(Object.keys(CONSUMABLES));
const EQUIPMENT_SLOTS=Object.freeze({head:'head',chest:'chest',hands:'hands',legs:'legs',feet:'feet',necklace:'necklace',ring1:'ring',ring2:'ring'});
const GEAR=Object.freeze({
  'frayed-hood':{slot:'head',caps:{purple:2}},'leather-cap':{slot:'head',chargeGain:{blue:1}},
  'padded-tunic':{slot:'chest',hp:2},'hide-vest':{slot:'chest',guard:3},
  'cloth-wraps':{slot:'hands',caps:{red:2}},'leather-gloves':{slot:'hands',chargeGain:{yellow:1}},
  'linen-trousers':{slot:'legs',caps:{green:2}},'hide-leggings':{slot:'legs',chargeGain:{purple:1}},
  'scuffed-boots':{slot:'feet',caps:{yellow:2}},'leather-boots':{slot:'feet',chargeGain:{green:1}},
  'copper-pendant':{slot:'necklace',caps:{blue:2}},'bone-talisman':{slot:'necklace',chargeGain:{red:1}},
  'tin-ring':{slot:'ring',allCap:1},'iron-band':{slot:'ring',guard:2},
  'twine-ring':{slot:'ring',hp:1,caps:{yellow:1}},'copper-band':{slot:'ring',caps:{red:1,blue:1}}
});
const DEFAULT_SACK=Object.freeze(['dagger','shield','salve','boots','charm']);
const DEFAULT_STARTER_GEM='dagger';
const WORLD_NODES=Object.freeze({
  camp:{id:'camp',name:'Ember Camp',kind:'safe',neighbors:['gem-shop','item-shop','crossroads']},
  'gem-shop':{id:'gem-shop',name:'Facet Cart',kind:'shop',shop:'gem',neighbors:['camp']},
  'item-shop':{id:'item-shop',name:'Roadside Outfitter',kind:'shop',shop:'item',neighbors:['camp']},
  crossroads:{id:'crossroads',name:'Crossroads',kind:'road',neighbors:['camp','shrine','rat']},
  shrine:{id:'shrine',name:'Shrine',kind:'landmark',neighbors:['crossroads']},
  rat:{id:'rat',name:'Rat',kind:'encounter',encounter:'rat',neighbors:['crossroads','bandit-pass']},
  'bandit-pass':{id:'bandit-pass',name:'Bandit',kind:'encounter',encounter:'bandit',requires:'rat',neighbors:['rat','sentinel-gate']},
  'sentinel-gate':{id:'sentinel-gate',name:'Sentinel',kind:'encounter',encounter:'sentinel',requires:'bandit',neighbors:['bandit-pass']}
});
const SHOP_CATALOG=Object.freeze({
  'gem-shop':Object.freeze({
    'hand-crossbow':18,'quarterstaff':18,'healing-potion':16,'knife':14,
    'locksmith-pick':16,'powder-bomb':22,'swordbreaker':20,'hunting-bow':20,
    'hex-staff':22,'chaos-orb':22,'crystal-wand':18,'sling':18
  }),
  'item-shop':Object.freeze({
    'frayed-hood':12,'leather-cap':18,'padded-tunic':20,'cloth-wraps':12,'leather-gloves':18,'linen-trousers':12,'hide-leggings':18,'scuffed-boots':12,'leather-boots':18,'copper-pendant':15,'bone-talisman':18,'tin-ring':15,'iron-band':15,
    'minor-healing-draught':8,'ironbark-tonic':8,'prism-dust':10,'cherry-bomb':8
  })
});
module.exports={GEM_IDS,GEM_SET:new Set(GEM_IDS),GEAR,CONSUMABLES,CONSUMABLE_SET,EQUIPMENT_SLOTS,DEFAULT_SACK,DEFAULT_STARTER_GEM,WORLD_NODES,SHOP_CATALOG,ENCOUNTERS};
