(function(root,factory){
'use strict';
const story=factory();
if(typeof module==='object'&&module.exports)module.exports=story;
else root.GEMMO_STORY=story;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
 for(const child of Object.values(value))deepFreeze(child);
 return Object.freeze(value);
}

const CUTSCENES={
 'brackenreach-arrival':{
  id:'brackenreach-arrival',
  trigger:{type:'world-enter',node:'camp'},
  slides:[
   {kicker:'BRACKENREACH',title:'EMBER CAMP',text:'A small fire burns beside the old road. Beyond it, the wilds have begun to swallow the paths between settlements.'},
   {kicker:'THE ROAD',title:'Something is wrong.',text:'Tracks cross the mud in every direction. Traders have stopped coming through. Even the camp keeps its fire low.'},
   {speaker:'Warden Vale',title:'Road Warden',text:'You have a Sack and two working legs. That already makes you more useful than most of what wandered in this week.'}
  ]
 }
};

const QUESTS={
 'trouble-on-road':{
  id:'trouble-on-road',
  title:'Trouble on the Road',
  giver:'warden-vale',
  returnTo:'warden-vale',
  summary:'Clear the creature blocking the eastern road, then report back to Warden Vale.',
  objective:{type:'encounter-clear',encounterId:'rat',label:'Defeat the Rat on the eastern road'},
  reward:{gold:12,xp:4}
 }
};

const NPCS={
 'warden-vale':{
  id:'warden-vale',
  name:'Warden Vale',
  title:'Road Warden',
  node:'camp',
  mark:'V',
  dialogue:'warden-vale'
 }
};

const DIALOGUES={
 'warden-vale':{
  id:'warden-vale',
  questId:'trouble-on-road',
  entries:{available:'intro',active:'active',ready:'ready',completed:'completed'},
  nodes:{
   intro:{
    speaker:'Warden Vale',
    text:'Fresh face. Fresh Sack. Bad timing. Something has nested on the eastern road and the caravans are refusing to pass.',
    choices:[
     {text:'What is out there?',next:'details'},
     {text:'I am just passing through.',close:true}
    ]
   },
   details:{
    speaker:'Warden Vale',
    text:'A rat. Bigger than it has any right to be, mean enough to stop a cart horse. Clear it out and come back. I will make it worth the trouble.',
    choices:[
     {text:'I will clear the road.',action:{type:'quest-accept',questId:'trouble-on-road'},next:'accepted'},
     {text:'Not yet.',close:true}
    ]
   },
   accepted:{
    speaker:'Warden Vale',
    text:'Good. Follow the road through the crossroads. Do not let the size of the thing embarrass you.',
    choices:[{text:'I will be back.',close:true}]
   },
   active:{
    speaker:'Warden Vale',
    text:'The eastern road is still blocked. Crossroads, then east. You will know the rat when you see it.',
    choices:[{text:'On it.',close:true}]
   },
   ready:{
    speaker:'Warden Vale',
    text:'I heard the road go quiet. That was you, then. Good work. A promise is a promise.',
    choices:[
     {text:'Collect reward.',action:{type:'quest-turnin',questId:'trouble-on-road'},next:'completed'}
    ]
   },
   completed:{
    speaker:'Warden Vale',
    text:'The road is breathing again. Enjoy the quiet while it lasts. Brackenreach has a habit of finding new problems.',
    choices:[{text:'See you around.',close:true}]
   }
  }
 }
};

return deepFreeze({CUTSCENES,QUESTS,NPCS,DIALOGUES});
});
