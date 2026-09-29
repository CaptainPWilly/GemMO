(function(root,factory){
'use strict';
const rules=factory();
if(typeof module==='object'&&module.exports)module.exports=rules;
else root.GEMMO_COMBAT_RULES=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BONUS_SPAWN_DENOMINATOR=20; // 1 in 20 natural gems, including Gold and XP.
function rollGemBonus(random){return random()<1/BONUS_SPAWN_DENOMINATOR?1:0}
const COMBO_CHARGE_TYPES=Object.freeze(['red','blue','green','yellow','purple']);
function comboChargeTypes(counts){
 return COMBO_CHARGE_TYPES.filter(type=>Number(counts?.[type])>0);
}
function comboChargeBonus(cascadeDepth){
 const depth=Number(cascadeDepth);
 return Number.isInteger(depth)&&depth>0?depth:0;
}
function fullestChargeColor(charges){
 let best=null,value=0;
 for(const color of COMBO_CHARGE_TYPES){const next=Number(charges?.[color])||0;if(next>value){best=color;value=next}}
 return best;
}
return Object.freeze({BONUS_SPAWN_DENOMINATOR,rollGemBonus,COMBO_CHARGE_TYPES,comboChargeTypes,comboChargeBonus,fullestChargeColor});
});
