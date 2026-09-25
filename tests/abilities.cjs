const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class El{constructor(){this.events={};this.classes=new Set();this.style={};this.children=[];this.dataset={};this.classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v)};this.textContent='';this.value='all'}set innerHTML(v){this.children=Array.from({length:(v.match(/<button/g)||[]).length},()=>new El());if(v.includes('<span'))this.firstElementChild=new El()}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}remove(){}getBoundingClientRect(){return {left:0,top:0,width:320,height:320}}animate(){return {finished:Promise.resolve(),cancel(){}}}}
const es=new Map(),document={getElementById(id){if(!es.has(id))es.set(id,new El());return es.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
let src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];src=src.replace("showScreen('splash');",`globalThis.api={setHintDelay:v=>hintDelay=v,ITEMS,GEAR,EQUIPMENT_SLOTS,sackIsValid,gearStats,playerMaxHP,canEquipGear,equipGear,unequipGear,getEquipment:()=>({...equipment}),resetEquipment:()=>{equipment={...DEFAULT_EQUIPMENT}},applyTarget,afterAction,fallColumns,reshuffleBoard,touchActivity,showHint,damagePlayer,findMatches,legalMoves,reservoirCap,enemyUseActive,setEnemyReady:color=>ec[color]=ENEMY[color].cap,startFight,applyColor,activate,trySwap,tapCell,get:()=>({charges,sack,pHP,eHP,pGuard,eGuard,freeSwap,overdrive,playerTurn,board,buffs,pinColumn,pinTurns,guardTurns,evadeTurns,actionNumber,targetMode}),setHP:v=>pHP=v,setGuard:v=>eGuard=v,setBoard:v=>{board=v;render()},setTurn:v=>playerTurn=v,setSack:v=>sack=v,setReady:i=>{charges[itemById(sack[i]).color]=itemById(sack[i]).cap;playerTurn=true;pHP=10},finish:async()=>{await Promise.all(damageAnimations.splice(0))}};showScreen('splash');`);
const scheduled=new Map();let nextTimer=1;
const c={document,window:{matchMedia:()=>({matches:true}),GEMMO_API:null},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>{throw new Error('fetch not expected in combat tests')},setTimeout:(fn,ms)=>{const id=nextTimer++;scheduled.set(id,{fn,ms});return id},clearTimeout:id=>scheduled.delete(id),console};vm.runInNewContext(src,c);const a=c.api;

(async()=>{
 const cases={dagger:[10,18,0],axe:[10,16,0],spear:[10,21,3],shield:[10,24,6],buckler:[10,21,3],ward:[12,24,3],salve:[15,24,0],poultice:[13,24,0],briar:[12,21,0],boots:[10,24,0],cloak:[10,24,5],knife:[10,19,0],charm:[10,24,0],seal:[10,16,0],relic:[14,24,4]};
 Object.assign(cases,{"arming-sword":[10,17,0],"warhammer":[10,14,0],"longbow":[10,19,0],"rapier":[10,21,3],"halberd":[10,15,0],"hand-crossbow":[10,21,0],"flail":[10,16,0],"tower-shield":[10,24,10],"swordbreaker":[10,21,3],"quarterstaff":[10,24,4],"pavise":[10,24,8],"war-pick":[10,17,0],"kite-shield":[12,24,3],"hook-spear":[10,24,7],"sickle":[12,21,0],"druid-staff":[18,24,0],"hunting-bow":[10,18,0],"thorn-whip":[10,20,0],"grove-spear":[12,24,3],"woodland-club":[10,24,6],"willow-wand":[12,24,0],"twin-knives":[10,17,0],"light-crossbow":[10,18,0],"sling":[10,22,0],"duelist-sabre":[10,21,3],"glaive":[10,16,0],"parrying-dagger":[10,24,3],"javelin":[10,15,0],"rune-blade":[10,17,0],"hex-staff":[10,19,0],"relic-mace":[14,24,4],"moon-scythe":[12,21,0],"crystal-wand":[10,24,4],"spell-tome":[12,24,3],"ritual-dagger":[10,21,3]});
 Object.assign(cases,{"bloodstone-whet":[10,24,0],"bastion-sigil":[10,24,0],"heartseed":[10,24,0],"gamblers-thread":[10,24,0]});
 assert.equal(a.ITEMS.length,64);assert.equal(new Set(a.ITEMS.map(i=>i.id)).size,64);
 assert.equal(a.sackIsValid(['dagger','shield','salve','boots','charm']),true,'five unique gems are a legal Sack');
 assert.equal(a.sackIsValid(['dagger','dagger','shield','salve','boots']),false,'exact duplicate gems are illegal');
 assert.equal(a.sackIsValid(['dagger','spear','longbow','rapier','hand-crossbow']),true,'different gems of one color are legal');
 const uniqueSackFor=id=>[id,...['dagger','shield','salve','boots','charm','axe','buckler','poultice','cloak','seal'].filter(x=>x!==id).slice(0,4)];
 for(const item of a.ITEMS.filter(i=>cases[i.id])){
  a.setSack(uniqueSackFor(item.id));a.startFight();
  const initial=JSON.stringify(a.get());a.activate(0);assert.equal(JSON.stringify(a.get()),initial,item.id+' cannot activate without charge');
  a.setReady(0);a.activate(0);const state=a.get(),expected=cases[item.id];
  assert.deepEqual([state.pHP,state.eHP,state.pGuard],expected,item.id+' exact effects');
  assert.equal(state.charges[item.color],0,item.id+' spends charge');
  assert.equal(state.playerTurn,item.id==='boots',item.id+' turn cost');
  assert.equal(state.freeSwap,item.id==='boots');assert.equal(state.overdrive,item.id==='charm');
  await a.finish();console.log('PASS '+item.item+' / '+item.name);
  if(['heal','shelter','leech','renew'].includes(item.kind)){a.startFight();a.setReady(0);a.setHP(23);a.activate(0);assert.equal(a.get().pHP,24,item.id+' healing cap');await a.finish()}
 }
 a.setSack(['dagger','spear','longbow','rapier','hand-crossbow']);a.startFight();a.applyColor('red',5,'player');assert.equal(a.get().charges.red,5);assert.equal(a.reservoirCap('red'),31);assert.equal(a.get().eHP,19);await a.finish();
 a.setReady(2);a.activate(2);assert.equal(a.get().charges.red,0);await a.finish();
 a.setSack(['charm','seal','dagger','shield','boots']);a.startFight();a.setReady(0);a.activate(0);a.setReady(0);a.activate(0);assert.equal(a.get().charges.purple,10,'Overdrive cannot be re-activated while primed');
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,18);assert.equal(a.get().charges.red,6);assert.equal(a.get().overdrive,false);await a.finish();a.applyColor('red',3,'player');assert.equal(a.get().eHP,15);await a.finish();
 a.setSack(['boots','dagger','shield','salve','charm']);a.startFight();const b=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));a.setBoard(b);a.setReady(0);a.activate(0);a.tapCell(0,0);a.tapCell(1,0);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().freeSwap,false);assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().board[0][1],'red');assert.equal(a.get().playerTurn,false);
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();a.setReady(0);a.setGuard(4);a.activate(0);assert.equal(a.get().eHP,22);assert.equal(a.get().eGuard,0);await a.finish();
 a.startFight();assert(Object.values(a.get().charges).every(n=>n===0));assert.equal(a.get().pHP,24);assert.equal(a.get().eHP,24);

 // Shared pool keeps unspent charge; either item can spend it.
 a.setSack(['dagger','axe','shield','salve','boots']);a.startFight();a.applyColor('red',99,'player');assert.equal(a.get().charges.red,16);assert.equal(a.reservoirCap('red'),16);await a.finish();
 a.setHP(24);a.startFight();a.applyColor('red',12,'player');await a.finish();a.activate(1);assert.equal(a.get().charges.red,3);
 a.startFight();a.applyColor('purple',3,'player');assert.equal(a.get().charges.purple,0);
 const grid=()=>Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));
 for(const type of ['red','blue','green','yellow','purple','gold','xp','env']){
  const g=grid();g[0][0]=type;g[0][1]='wild';g[0][2]=type;a.setBoard(g);const m=a.findMatches();assert(m&&m.runs.some(r=>r.type===type&&r.len>=3),type+' accepts Wild');assert.equal(new Set(m.cells.map(p=>p.x+','+p.y)).size,m.cells.length,'Wild counted once');
 }
 const all=grid();all[0][0]=all[0][1]=all[0][2]='wild';all[0][3]='';a.setBoard(all);assert(!a.findMatches()?.runs.some(r=>r.cells.every(p=>p.y===0)&&r.cells.length===3),'all-Wild trio needs a real type');
 a.startFight();const g=grid();g[0][0]='wild';a.setBoard(g);const before=JSON.stringify(a.get().board);const valid=await a.trySwap({x:0,y:0},{x:1,y:0},'player');assert.equal(valid,false);assert.equal(JSON.stringify(a.get().board),before,'invalid Wild swap reverts, never clears board');
 for(const color of ['red','blue','green','yellow','purple']){a.startFight();a.setEnemyReady(color);assert.equal(a.enemyUseActive(),color!=='green');if(color!=='green')assert(es.get('abilityName').textContent.length>0)}

 // Timed defenses, damage, healing and charge generation.
 const equip=id=>{a.setSack(uniqueSackFor(id));a.startFight();a.setReady(0);a.activate(0)};
 equip('mist-mantle');a.damagePlayer(5);assert.equal(a.get().pHP,7);await a.finish();a.afterAction('enemy');assert.equal(a.get().buffs.dodge,1);a.afterAction('enemy');assert.equal(a.get().buffs.dodge,0);a.damagePlayer(5);assert.equal(a.get().pHP,2);await a.finish();
 equip('venom-needle');a.afterAction('enemy');assert.equal(a.get().eHP,22);a.afterAction('enemy');assert.equal(a.get().eHP,20);assert.equal(a.get().buffs.poison,0);await a.finish();
 equip('wayfarer-lyre');for(let i=0;i<3;i++)a.afterAction('enemy');assert.equal(a.get().pHP,16);assert.equal(a.get().buffs.regen,0);
 equip('prism-orb');a.afterAction('enemy');assert.equal(a.get().charges.red,1);a.afterAction('enemy');assert.equal(a.get().charges.red,2);assert.equal(a.get().buffs.focus,0);
 equip('clockwork-spur');assert.equal(a.get().playerTurn,true);assert.equal(a.get().actionNumber,2);
 equip('anchor-maul');assert.equal(a.get().targetMode,'pin');assert.equal(a.get().actionNumber,1);await a.applyTarget({x:0,y:3});assert.equal(a.get().pinColumn,0);assert.equal(a.get().pinTurns,1);
 const pinned=grid();pinned[7][0]='';pinned[3][4]='red';pinned[3][5]='blue';pinned[3][6]='red';pinned[2][5]='red';const survivor=pinned[6][0];a.setBoard(pinned);await a.fallColumns();assert.equal(a.get().board[6][0],survivor);assert(a.get().board[7][0]);a.afterAction('enemy');assert.equal(a.get().pinTurns,0);
 for(const [id,kind] of [['ember-rod','paint'],['star-lens','wildcraft'],['tide-chain','rotate']]){equip(id);assert.equal(a.get().targetMode,kind);const board=grid();a.setBoard(board);await a.applyTarget({x:0,y:0});assert.equal(a.get().targetMode,null);assert.equal(a.get().playerTurn,false);if(kind==='wildcraft')assert.equal(a.get().board[0][0],'wild');if(kind==='rotate')assert.equal(a.get().board[0][0],'green')}
 a.setSack(['echo-knife','dagger','shield','salve','charm']);a.startFight();a.setEnemyReady('purple');a.setReady(0);a.activate(0);assert.equal(a.get().eHP,22);assert.equal(a.get().charges.purple,3);await a.finish();
 equip('shield');assert.equal(a.get().guardTurns,2);a.afterAction('enemy');assert.equal(a.get().pGuard,6);a.afterAction('enemy');assert.equal(a.get().pGuard,0);
 a.startFight();a.setEnemyReady('blue');a.enemyUseActive();assert.equal(a.get().evadeTurns,2);a.afterAction('player');assert.equal(a.get().eGuard,6);a.afterAction('player');assert.equal(a.get().eGuard,0);
 a.startFight();a.touchActivity();assert.equal([...scheduled.values()].filter(t=>t.ms===30000).length,1,'one 30-second idle hint');[...scheduled.values()].find(t=>t.ms===30000).fn();assert.equal(es.get('board').children.filter(el=>el.classes.has('hintCell')).length,2);
 a.setHintDelay(15000);a.touchActivity();assert.equal([...scheduled.values()].filter(t=>t.ms===15000).length,1);assert.equal([...scheduled.values()].filter(t=>t.ms===30000).length,0);a.setHintDelay(0);a.touchActivity();assert.equal([...scheduled.values()].filter(t=>t.ms===15000||t.ms===30000).length,0);a.setHintDelay(30000);
 const hp=a.get().pHP,pool=JSON.stringify(a.get().charges);await a.reshuffleBoard();assert.equal(a.get().pHP,hp);assert.equal(JSON.stringify(a.get().charges),pool);assert(a.legalMoves().length>0);
 // Simulate a swipe from the first cell to its neighbor under Quickstep.
 equip('boots');a.setBoard(grid());es.get('board').events.pointerdown({clientX:20,clientY:20,pointerId:1});es.get('board').events.pointerup({clientX:65,clientY:20,pointerId:1});await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().freeSwap,false);
 equip('wayfarer-lyre');a.setHP(0);a.afterAction('enemy');assert.equal(a.get().pHP,0,'regeneration cannot revive a defeated fighter');

 // Core board contract: Red always attacks, Blue always Guards; Green/Yellow/Purple are charge-only without equipped effects.
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();assert.equal(a.findMatches(),null,'fresh board starts without free matches');assert(a.legalMoves().length>0,'fresh board always has a legal move');a.setHP(20);
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,21);assert.equal(a.get().charges.red,3);await a.finish();
 a.applyColor('blue',3,'player');assert.equal(a.get().pGuard,3);assert.equal(a.get().charges.blue,3);
 a.applyColor('green',3,'player');assert.equal(a.get().pHP,20);assert.equal(a.get().charges.green,3);
 const hpBeforeUtility=a.get().pHP,enemyBeforeUtility=a.get().eHP,guardBeforeUtility=a.get().pGuard;
 a.applyColor('yellow',3,'player');a.applyColor('purple',3,'player');assert.equal(a.get().pHP,hpBeforeUtility);assert.equal(a.get().eHP,enemyBeforeUtility);assert.equal(a.get().pGuard,guardBeforeUtility);assert.equal(a.get().charges.yellow,3);assert.equal(a.get().charges.purple,3);

 // Attunements proc on every qualifying match resolution, including cascades, and expire after 3 future player actions.
 equip('bloodstone-whet');assert.equal(a.get().buffs.redwake,3);a.applyColor('red',3,'player',0);assert.equal(a.get().eHP,19);a.applyColor('red',3,'player',1);assert.equal(a.get().eHP,14);await a.finish();a.afterAction('player');assert.equal(a.get().buffs.redwake,2);a.afterAction('player');assert.equal(a.get().buffs.redwake,1);a.afterAction('player');assert.equal(a.get().buffs.redwake,0);
 equip('bastion-sigil');assert.equal(a.get().buffs.holdfast,3);a.applyColor('blue',3,'player',0);assert.equal(a.get().pGuard,5);a.applyColor('blue',3,'player',1);assert.equal(a.get().pGuard,10);
 equip('heartseed');assert.equal(a.get().buffs.aftergrowth,3);a.applyColor('green',3,'player',0);assert.equal(a.get().pHP,12);a.applyColor('green',3,'player',1);assert.equal(a.get().pHP,14);
 equip('gamblers-thread');assert.equal(a.get().buffs.momentum,3);a.applyColor('yellow',3,'player',0);assert.equal(a.get().charges.red,2);a.applyColor('yellow',3,'player',1);assert.equal(a.get().charges.blue,2);

 // Level-1 inventory and physical equipment stay separate from the Sack.
 assert.equal(a.EQUIPMENT_SLOTS.length,8);assert.equal(a.GEAR.length,16);assert.equal(new Set(a.GEAR.map(g=>g.id)).size,16);
 a.resetEquipment();assert.equal(a.playerMaxHP(),24);{const s=a.gearStats();assert.deepEqual([s.hp,s.guard],[0,0])};
 assert.equal(a.canEquipGear('chest','padded-tunic'),true);assert.equal(a.canEquipGear('head','padded-tunic'),false);
 assert.equal(a.equipGear('chest','padded-tunic'),true);assert.equal(a.playerMaxHP(),26);
 assert.equal(a.equipGear('ring1','tin-ring'),true);assert.equal(a.playerMaxHP(),27);assert.equal(a.equipGear('ring2','tin-ring'),false,'one physical item cannot occupy both rings');
 assert.equal(a.equipGear('ring2','iron-band'),true);{const s=a.gearStats();assert.deepEqual([s.hp,s.guard],[3,1])};
 a.startFight();assert.equal(a.get().pHP,27);assert.equal(a.get().pGuard,1);assert.equal(a.get().guardTurns,2);
 a.resetEquipment();
 console.log('PASS: 64 gems plus level-1 inventory/equipment, core color rules, Attunement cascade procs and expiry, timed effects, pinning, row rotation, Wild creation, recoloring, haste, siphon, Guard/Evade durations, hints, reshuffle preservation and swipe input.');
})().catch(e=>{console.error(e);process.exitCode=1});
