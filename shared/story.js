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
 'first-weapon':{id:'first-weapon',title:'A First Gem',giver:'warden-vale',returnTo:'warden-vale',summary:'Choose your first weapon gem from Warden Vale.',objective:{type:'starter-choice',label:'Receive your first gem'},reward:{gold:0,xp:0},automatic:true},
 'trouble-on-road':{
  id:'trouble-on-road',
  title:'Trouble on the Road',requires:'first-weapon',
  giver:'warden-vale',
  returnTo:'warden-vale',
  summary:'Clear the creature blocking the eastern road, then report back to Warden Vale.',
  objective:{type:'encounter-clear',encounterId:'rat',label:'Defeat the Rat on the eastern road'},
  reward:{gold:12,xp:4}
 }
};

Object.assign(QUESTS,{
 'break-the-bandit':{id:'break-the-bandit',title:'Break the Bandit',giver:'warden-vale',returnTo:'warden-vale',requires:'trouble-on-road',summary:'Defeat the Bandit on the northern road, then report to Vale.',objective:{type:'encounter-clear',encounterId:'bandit',label:'Defeat the Bandit'},reward:{gold:20,xp:10}},
 'five-gems':{id:'five-gems',title:'A Sack of Possibilities',giver:'warden-vale',returnTo:'warden-vale',requires:'break-the-bandit',summary:'Unlock five different gems, including your first weapon. Vale will open the route to Troll Hill.',objective:{type:'gem-collection',count:5,label:'Own 5 different gems',node:'gem-shop'},reward:{gold:20,xp:10}},
 'ready-for-cave':{id:'ready-for-cave',title:'Ready for the Cave',giver:'rhea',returnTo:'rhea',requires:'five-gems',summary:'Buy equipment at the Hill Outfitter and equip at least one piece. Return to Rhea to open the cave route.',objective:{type:'equipment-equipped',count:1,label:'Equip a piece of equipment',node:'item-shop'},reward:{gold:10,xp:8}},
 'gravemaw':{id:'gravemaw',title:'The Thing Beneath the Hill',giver:'rhea',returnTo:'rhea',requires:'ready-for-cave',summary:'Clear the Road Sentinel, then enter the cave and defeat Gravemaw. Prepare a full build: this is the final challenge.',objective:{type:'encounter-clear',encounterId:'troll',label:'Defeat Gravemaw'},reward:{gold:100,xp:60}}
});

const NPCS={
 rhea:{id:'rhea',name:'Rhea',title:'Hill Scout',node:'troll-hill',mark:'R',dialogue:'ready-for-cave',questIds:['ready-for-cave','gravemaw']},
 'warden-vale':{
  id:'warden-vale',
  name:'Warden Vale',
  title:'Road Warden',
  node:'camp',
  mark:'V',
  dialogue:'warden-vale',questIds:['trouble-on-road','break-the-bandit','five-gems']
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

for(const id of ['break-the-bandit','five-gems','ready-for-cave','gravemaw']){
 const q=QUESTS[id],speaker=NPCS[q.giver].name;
 DIALOGUES[id]={id,questId:id,entries:{available:'intro',active:'active',ready:'ready',completed:'completed'},nodes:{
 intro:{speaker,text:q.summary,choices:[{text:'I am on it.',action:{type:'quest-accept',questId:id},next:'active'},{text:'Not yet.',close:true}]},
 active:{speaker,text:q.objective.label+'. Come back when it is done.',choices:[{text:'Understood.',close:true}]},
 ready:{speaker,text:id==='five-gems'?'Five gems. You are ready for the hills. Rhea and the outfitter are waiting up there.':id==='ready-for-cave'?'That will help. The cave route is open. Make sure the Road Sentinel is defeated before entering.':id==='gravemaw'?'Gravemaw is dead. The hill is ours again. You earned this.':'The Bandit is down. Good work.',choices:[{text:'Complete quest.',action:{type:'quest-turnin',questId:id},next:'completed'}]},
 completed:{speaker,text:id==='gravemaw'?'You cleared every threat on the road. Gravemaw can be challenged again.':'Done. Talk to me again for the next step.',choices:[{text:'Continue.',close:true}]}
 }};
}

return deepFreeze({CUTSCENES,QUESTS,NPCS,DIALOGUES});
});
