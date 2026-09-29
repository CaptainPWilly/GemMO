(function(root,factory){
'use strict';
const encounters=factory();
if(typeof module==='object'&&module.exports)module.exports=encounters;
else root.GEMMO_ENCOUNTERS=encounters;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
 for(const child of Object.values(value))deepFreeze(child);
 return Object.freeze(value);
}
return deepFreeze({
 rat:{
  id:'rat',
  name:'RAT',
  maxHP:10,
  reward:{gold:[8,12],xp:[6,10]},
  match:{redScale:.5,redMin:1,blueScale:.35,blueMin:1,reloadBonus:0},
  reservoirs:{
   red:{name:'BITE',cap:7,visible:true},
   blue:{name:'EVADE',cap:7,visible:true},
   green:{name:'BANDAGE',cap:6,visible:false},
   yellow:{name:'RELOAD',cap:6,visible:false},
   purple:{name:'DEADEYE',cap:10,visible:false}
  },
  actives:[],
  ai:{red:4,purple:3,greenHealthy:1,greenWounded:3,woundedBelow:18,yellow:2,blue:2,gold:0,xp:0},
  unlockText:'BANDIT PATH UNLOCKED'
 },
 bandit:{
  id:'bandit',
  name:'BANDIT',
  maxHP:24,
  reward:{gold:[18,24],xp:[12,18]},
  match:{redScale:1,redMin:0,blueScale:.75,blueMin:0,reloadBonus:2},
  reservoirs:{
   red:{name:'BOLT',cap:7,visible:true},
   blue:{name:'EVADE',cap:7,visible:true},
   green:{name:'BANDAGE',cap:6,visible:true},
   yellow:{name:'RELOAD',cap:6,visible:true},
   purple:{name:'DEADEYE',cap:10,visible:true}
  },
  actives:[
   {color:'purple',name:'DEADEYE',kind:'damage',power:6,detail:'6 damage.'},
   {color:'green',name:'BANDAGE',kind:'heal',power:5,when:{hpAtMost:18},detail:'+5 HP.'},
   {color:'red',name:'QUICK SHOT',kind:'damage',power:5,disarmable:true,detail:'5 damage.',blockedDetail:'Disarmed — no damage.'},
   {color:'blue',name:'SIDESTEP',kind:'guard',power:6,when:{guardAtMost:2},detail:'+6 Evade.'},
   {color:'yellow',name:'RELOAD',kind:'reload',power:2,detail:'next Bolt +2.'}
  ],
  ai:{red:4,purple:3,greenHealthy:1,greenWounded:3,woundedBelow:18,yellow:2,blue:2,gold:0,xp:0},
  unlockText:''
 },
 sentinel:{
  id:'sentinel',name:'ROAD SENTINEL',maxHP:30,
  reward:{gold:[25,32],xp:[19,25]},
  match:{redScale:.8,redMin:1,blueScale:1,blueMin:1,reloadBonus:3},
  reservoirs:{
   red:{name:'STRIKE',cap:8,visible:true},blue:{name:'BARRIER',cap:6,visible:true},
   green:{name:'REPAIR',cap:8,visible:true},yellow:{name:'WINDUP',cap:6,visible:true},
   purple:{name:'SIPHON',cap:6,visible:true}
  },
  actives:[
   {color:'purple',name:'SIPHON',kind:'drain',power:3,detail:'Drains up to 3 charge from your fullest reservoir.',intent:'−3 fullest charge'},
   {color:'red',name:'HEAVY STRIKE',kind:'damage',power:7,disarmable:true,detail:'7 damage.',blockedDetail:'Disarmed — no damage.'},
   {color:'blue',name:'BARRIER',kind:'guard',power:7,when:{guardAtMost:3},detail:'+7 Evade.'},
   {color:'yellow',name:'WINDUP',kind:'reload',power:3,detail:'Next Red match gains +3 power.'},
   {color:'green',name:'REPAIR',kind:'heal',power:4,when:{hpAtMost:20},detail:'+4 HP.'}
  ],
  ai:{red:3,purple:5,greenHealthy:1,greenWounded:3,woundedBelow:20,yellow:2,blue:3,gold:0,xp:0},
  unlockText:''
 }
});
});
