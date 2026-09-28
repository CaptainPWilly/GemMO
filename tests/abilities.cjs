const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
class El{constructor(){this.events={};this.classes=new Set();this.style={};this.children=[];this.dataset={};this.classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),contains:(v)=>this.classes.has(v)};this.textContent='';this.value='all'}set innerHTML(v){this.children=Array.from({length:(v.match(/<button/g)||[]).length},()=>new El());if(v.includes('<span'))this.firstElementChild=new El()}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}remove(){}getBoundingClientRect(){return {left:0,top:0,width:320,height:320}}animate(){return {finished:Promise.resolve(),cancel(){}}}}
const es=new Map(),document={getElementById(id){if(!es.has(id))es.set(id,new El());return es.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'assets','styles.css'),'utf8');
const content=fs.readFileSync(path.join(root,'assets','content.js'),'utf8');
let src=fs.readFileSync(path.join(root,'assets','app.js'),'utf8');
assert(html.includes('href="assets/styles.css"'),'production shell must load the canonical stylesheet');
assert(html.includes('src="assets/content.js"')&&html.indexOf('assets/content.js')<html.indexOf('assets/app.js'),'production shell must load static content before runtime');
assert(html.includes('src="assets/app.js"'),'production shell must load the canonical runtime');
assert(content.includes('globalThis.GEMMO_CONTENT=Object.freeze'),'static game definitions must live behind the content boundary');
assert(!src.includes('const ITEMS=[')&&!src.includes('const WORLD_NODES={'),'runtime must not re-embed expandable content');
assert(!/<style[\s>]/i.test(html),'index.html must stay free of inline styles');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html),'index.html must stay free of inline application scripts');
assert.equal((styles.match(/:root\s*\{/g)||[]).length,1,'the visual system must have one canonical palette root');
assert(styles.includes('@media (min-width:700px)'),'tablet breakpoint must exist');
assert(styles.includes('orientation:landscape'),'landscape tablet layout must exist');
assert(styles.includes('grid-template-areas:'),'landscape combat must use a two-pane grid');
assert(src.includes("localStorage.getItem('gemmo.session')"),'login token must persist across browser restarts');
assert(src.includes("localStorage.setItem('gemmo.session'"),'successful login must remember the session');
assert(src.includes("localStorage.removeItem('gemmo.session'"),'logout must clear the remembered session');
assert(src.includes("localDevHost?'http://127.0.0.1:8787':'https://gemmo.onrender.com'"),'localhost must default to the local API');
assert(src.includes("won:false,gold:0,xp:0"),'defeats must settle their match ticket with zero rewards');
assert(src.includes('activeRewardBudget=data.match?.rewardBudget||null'),'client must accept the server-issued reward budget');
assert(src.includes("activeRewardBudget?'/'+activeRewardBudget.gold:''"),'combat HUD must show the server Gold budget');
assert(src.includes("activeAuthority?.mode==='replay-v1'"),'Rat combat must recognize the server replay authority mode');
assert(src.includes("resultBody.transcript=combatTranscript"),'verified victories must submit the combat transcript');
assert(src.includes("makeCombatRng(activeAuthority.seed)"),'authoritative combat must use the server-issued deterministic seed');
assert(src.includes("recordCombatAction({t:'swap'"),'player swaps must enter the combat proof transcript');
assert(src.includes("recordCombatAction({t:'ability'"),'gem activations must enter the combat proof transcript');
assert(src.includes("const STARTER_CHOICES=[{color:'red',id:'dagger'},{color:'yellow',id:'sling'},{color:'blue',id:'crystal-wand'}]"),'only Dagger, Sling and Crystal Wand are starter choices');
assert(html.includes('class="sackHero"')&&html.includes('class="sackToolbar"'),'Sack uses the modern deck-style layout');
assert(html.includes('id="worldGold"')&&html.includes('id="worldSackBtn"')&&html.includes('id="worldInventoryBtn"')&&html.includes('id="worldEffectsBtn"'),'world map exposes Gold, Sack, Inventory, and Effects controls');
assert(!html.includes('id="worldZoomIn"')&&!html.includes('id="worldZoomOut"'),'world map does not expose zoom buttons');
assert(src.includes("addEventListener('wheel'")&&src.includes("{passive:false}"),'desktop map zoom uses a non-passive mouse wheel handler');
assert(src.includes("worldGesture={type:'pinch'"),'touch map zoom remains pinch-driven');
assert(html.includes('id="worldSackPip"')&&html.includes('id="worldInventoryPip"'),'world map includes new-item notification pips');
assert(html.includes('id="worldEffectsPanel"')&&html.includes('id="worldEffectsList"'),'world map includes the current-effects drawer');
assert(styles.includes('.worldQuickbar')&&styles.includes('.worldEffectsPanel')&&styles.includes('.worldPip'),'world HUD has responsive dock, effects, and pip styling');
assert(src.includes("function worldSeenKey(kind,userId){return 'gemmo.seen.'+userId+'.'+kind}"),'new-item seen state is account-scoped client UI state');
assert(src.includes("account?.profile?.gold||0"),'world Gold is rendered from the server-synced account profile');
assert(src.includes("function currentWorldEffects()"),'world effects are derived from the current loadout');

assert(styles.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'collection cards use compact mobile columns');
src=src.replace("showScreen('splash');",`globalThis.api={setHintDelay:v=>hintDelay=v,ITEMS,GEAR,EQUIPMENT_SLOTS,WORLD_NODES,worldCanTravel,worldPath,worldCleared,sackIsValid,gearStats,playerMaxHP,reservoirCap,canEquipGear,equipGear,unequipGear,getEquipment:()=>({...equipment}),resetEquipment:()=>{equipment={...DEFAULT_EQUIPMENT}},setInventory:v=>inventory=v.slice(),setTestAccount:v=>account=v,setWorldClears:v=>worldState.clearedEncounters=v.slice(),applyTarget,afterAction,fallColumns,reshuffleBoard,touchActivity,showHint,damagePlayer,findMatches,legalMoves,reservoirCap,enemyUseActive,setEnemyReady:color=>ec[color]=ENEMY[color].cap,startFight,applyColor,activate,trySwap,tapCell,get:()=>({charges,sack,pHP,eHP,pGuard,eGuard,freeSwap,overdrive,playerTurn,board,buffs,enemyEffects,pinColumn,pinTurns,guardTurns,evadeTurns,actionNumber,targetMode}),setHP:v=>pHP=v,setGuard:v=>eGuard=v,setBoard:v=>{board=v;render()},setTurn:v=>playerTurn=v,setSack:v=>sack=v,setReady:i=>{charges[itemById(sack[i]).color]=itemById(sack[i]).cap;playerTurn=true;pHP=10},finish:async()=>{await Promise.all(damageAnimations.splice(0))}};showScreen('splash');`);
const scheduled=new Map();let nextTimer=1;
const c={document,window:{matchMedia:()=>({matches:true}),GEMMO_API:null},location:{hostname:'captainpwilly.github.io'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>{throw new Error('fetch not expected in combat tests')},setTimeout:(fn,ms)=>{const id=nextTimer++;scheduled.set(id,{fn,ms});return id},clearTimeout:id=>scheduled.delete(id),console};vm.runInNewContext(content,c);vm.runInNewContext(src,c);const a=c.api;
a.setTestAccount({needsStarter:false,inventory:a.ITEMS.map(i=>i.id),profile:{level:1,xp:0,gold:0},user:{username:'TestHero'}});

(async()=>{
 const cases={dagger:[10,18,0],axe:[10,16,0],spear:[10,21,3],shield:[10,24,6],buckler:[10,21,3],ward:[12,24,3],salve:[15,24,0],poultice:[13,24,0],briar:[12,21,0],boots:[10,24,0],cloak:[10,24,5],knife:[10,23,0],charm:[10,24,0],seal:[10,16,0],relic:[14,24,4]};
 Object.assign(cases,{"arming-sword":[10,17,0],"warhammer":[10,14,0],"longbow":[10,19,0],"rapier":[10,21,3],"halberd":[10,15,0],"hand-crossbow":[10,21,0],"flail":[10,16,0],"tower-shield":[10,24,10],"swordbreaker":[10,24,0],"quarterstaff":[10,24,4],"pavise":[10,24,8],"war-pick":[10,22,0],"kite-shield":[12,24,3],"hook-spear":[10,24,7],"sickle":[12,21,0],"druid-staff":[18,24,0],"hunting-bow":[10,24,0],"thorn-whip":[10,20,0],"grove-spear":[12,24,3],"woodland-club":[10,24,6],"willow-wand":[12,24,0],"twin-knives":[10,17,0],"light-crossbow":[10,18,0],"sling":[10,22,0],"duelist-sabre":[10,21,3],"glaive":[10,16,0],"parrying-dagger":[10,24,3],"javelin":[10,15,0],"rune-blade":[10,17,0],"hex-staff":[10,24,0],"relic-mace":[14,24,4],"moon-scythe":[12,21,0],"crystal-wand":[10,20,0],"spell-tome":[12,24,3],"ritual-dagger":[10,21,3]});
 Object.assign(cases,{"bloodstone-whet":[10,24,0],"bastion-sigil":[10,24,0],"heartseed":[10,24,0],"gamblers-thread":[10,24,0]});
 assert.equal(a.ITEMS.length,74);assert.equal(new Set(a.ITEMS.map(i=>i.id)).size,74);const starterWand=a.ITEMS.find(i=>i.id==='crystal-wand');assert.equal(starterWand.color,'blue');assert.equal(starterWand.kind,'damage');assert.equal(starterWand.power,4);
 const effectIds=['executioners-axe','barbed-blade','mirror-shield','binding-chain','healing-potion','purifying-tonic','locksmith-pick','powder-bomb','chaos-orb','void-flask'];
 for(const id of effectIds)assert(a.ITEMS.some(i=>i.id===id),id+' exists in expanded effect catalog');
 assert(a.ITEMS.every(i=>i.effect===i.kind&&i.effectLabel&&i.role&&Number.isInteger(i.turnCost)),'every gem carries normalized effect metadata');
 assert.equal(a.ITEMS.find(i=>i.id==='knife').turnCost,0,'Throwing Knife is a quick action');
 assert.equal(a.ITEMS.find(i=>i.id==='locksmith-pick').turnCost,0,'Locksmith Pick is a quick board action');
 assert.equal(a.sackIsValid(['dagger','shield','salve','boots','charm']),true,'five unique gems are a legal Sack');
 assert.equal(a.sackIsValid(['dagger','dagger','shield','salve','boots']),false,'exact duplicate gems are illegal');
 assert.equal(a.sackIsValid(['dagger',null,null,null,null]),true,'a level-1 one-gem Sack is legal');
 assert.equal(a.sackIsValid([null,null,null,null,null]),false,'zero-gem Sack cannot fight');
 a.setSack(['dagger',null,null,null,null]);a.startFight();assert.equal(a.get().sack.filter(Boolean).length,1,'one starter gem can enter combat');
 assert.equal(a.sackIsValid(['dagger','spear','longbow','rapier','hand-crossbow']),true,'different gems of one color are legal');
 assert.equal(a.worldCanTravel('camp','crossroads'),true);assert.equal(a.worldCanTravel('camp','gem-shop'),true);assert.equal(a.worldCanTravel('camp','item-shop'),true);assert.equal(a.worldCanTravel('camp','bandit-pass'),false);assert.equal(a.worldCanTravel('crossroads','rat'),true);assert.equal(a.worldCanTravel('crossroads','bandit-pass'),false);assert.equal(a.worldCanTravel('rat','bandit-pass'),false);assert.equal(JSON.stringify(a.worldPath('item-shop','shrine')),JSON.stringify(['item-shop','camp','crossroads','shrine']));assert.equal(JSON.stringify(a.worldPath('camp','rat')),JSON.stringify(['camp','crossroads','rat']));assert.equal(a.worldPath('camp','bandit-pass'),null);assert.equal(a.WORLD_NODES.rat.encounter,'rat');assert.equal(a.WORLD_NODES['bandit-pass'].encounter,'bandit');a.setWorldClears(['rat']);assert.equal(a.worldCanTravel('rat','bandit-pass'),true);assert.equal(JSON.stringify(a.worldPath('item-shop','bandit-pass')),JSON.stringify(['item-shop','camp','crossroads','rat','bandit-pass']));a.setWorldClears([]);
 const uniqueSackFor=id=>[id,...['dagger','shield','salve','boots','charm','axe','buckler','poultice','cloak','seal'].filter(x=>x!==id).slice(0,4)];
 for(const item of a.ITEMS.filter(i=>cases[i.id])){
  a.setSack(uniqueSackFor(item.id));a.startFight();
  const initial=JSON.stringify(a.get());a.activate(0);assert.equal(JSON.stringify(a.get()),initial,item.id+' cannot activate without charge');
  a.setReady(0);a.activate(0);const state=a.get(),expected=cases[item.id];
  assert.deepEqual([state.pHP,state.eHP,state.pGuard],expected,item.id+' exact effects');
  assert.equal(state.charges[item.color],0,item.id+' spends charge');
  assert.equal(state.playerTurn,['boots','knife'].includes(item.id),item.id+' turn cost');
  assert.equal(state.freeSwap,item.id==='boots');assert.equal(state.overdrive,item.id==='charm');
  await a.finish();console.log('PASS '+item.item+' / '+item.name);
  if(['heal','shelter','leech','renew'].includes(item.kind)){a.startFight();a.setReady(0);const max=a.playerMaxHP();a.setHP(max-1);a.activate(0);assert.equal(a.get().pHP,max,item.id+' healing cap');await a.finish()}
 }
 a.setSack(['dagger','spear','longbow','rapier','hand-crossbow']);a.startFight();a.applyColor('red',5,'player');assert.equal(a.get().charges.red,5);assert.equal(a.reservoirCap('red'),31);assert.equal(a.get().eHP,19);await a.finish();
 a.setReady(2);a.activate(2);assert.equal(a.get().charges.red,0);await a.finish();
 a.setSack(['charm','seal','dagger','shield','boots']);a.startFight();a.setReady(0);a.activate(0);a.setReady(0);a.activate(0);assert.equal(a.get().charges.purple,10,'Overdrive cannot be re-activated while primed');
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,18);assert.equal(a.get().charges.red,6);assert.equal(a.get().overdrive,false);await a.finish();a.applyColor('red',3,'player');assert.equal(a.get().eHP,15);await a.finish();
 a.setSack(['boots','dagger','shield','salve','charm']);a.startFight();const b=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));a.setBoard(b);a.setReady(0);a.activate(0);a.tapCell(0,0);a.tapCell(1,0);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().freeSwap,false);assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().board[0][1],'red');assert.equal(a.get().playerTurn,false);
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();a.setReady(0);a.setGuard(4);a.activate(0);assert.equal(a.get().eHP,22);assert.equal(a.get().eGuard,0);await a.finish();
 a.startFight();assert(Object.values(a.get().charges).every(n=>n===0));assert.equal(a.get().pHP,18);assert.equal(a.get().eHP,24);

 // Expanded effect vocabulary.
 a.setSack(['knife','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().eHP,23);assert.equal(a.get().playerTurn,true,'quick hit keeps the turn');
 a.setSack(['executioners-axe','dagger','shield','salve','charm']);a.startFight();a.setHP(10);a.setReady(0);a.activate(0);assert.equal(a.get().eHP,20,'execute uses base damage above threshold');
 a.startFight();a.setReady(0);a.get().eHP=8;a.activate(0);assert.equal(a.get().eHP,-2,'execute spikes at low HP');
 a.setSack(['barbed-blade','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.bleed,2);a.afterAction('enemy');assert.equal(a.get().eHP,22);
 a.setSack(['mirror-shield','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);a.damagePlayer(6);assert.equal(a.get().eHP,21,'reflect returns half of unblocked damage');
 a.setSack(['swordbreaker','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.disarm,1);
 a.setSack(['hunting-bow','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);a.damagePlayer(0);assert.equal(a.get().enemyEffects.mark,1);a.applyColor('red',3,'player');assert.equal(a.get().eHP,18,'mark adds 3 to next damage');
 a.setSack(['hex-staff','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.silence,1);
 a.setSack(['locksmith-pick','dagger','shield','salve','charm']);a.startFight();a.setBoard(grid());a.setReady(0);a.activate(0);assert.equal(a.get().targetMode,'break');await a.applyTarget({x:3,y:3});assert.equal(a.get().playerTurn,true,'quick tile break keeps the turn');

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
 a.setInventory(a.GEAR.map(g=>g.id));
 assert.equal(a.EQUIPMENT_SLOTS.length,8);assert.equal(a.GEAR.length,16);assert.equal(new Set(a.GEAR.map(g=>g.id)).size,16);
 a.resetEquipment();assert.equal(a.playerMaxHP(),18);{const s=a.gearStats();assert.deepEqual([s.hp,s.guard],[0,0]);assert.equal(s.caps.yellow,0)};
 assert.equal(a.canEquipGear('chest','padded-tunic'),true);assert.equal(a.canEquipGear('head','padded-tunic'),false);
 assert.equal(a.equipGear('chest','padded-tunic'),true);assert.equal(a.playerMaxHP(),20);
 assert.equal(a.equipGear('ring1','tin-ring'),true);assert.equal(a.playerMaxHP(),20);assert.equal(a.equipGear('ring2','tin-ring'),false,'one physical item cannot occupy both rings');
 assert.equal(a.equipGear('ring2','iron-band'),true);{const s=a.gearStats();assert.deepEqual([s.hp,s.guard],[2,2]);assert.equal(s.caps.red,1);assert.equal(s.caps.yellow,1)};
 a.setSack(['dagger','shield','salve','boots','charm']);const baseYellow=a.ITEMS.find(v=>v.id==='boots').cap;assert.equal(a.reservoirCap('yellow'),baseYellow+1);
 assert.equal(a.equipGear('feet','scuffed-boots'),true);assert.equal(a.reservoirCap('yellow'),baseYellow+3,'boots and all-cap ring increase yellow capacity');
 a.startFight();assert.equal(a.get().pHP,20);assert.equal(a.get().pGuard,2);assert.equal(a.get().guardTurns,2);
 a.resetEquipment();
 console.log('PASS: 64 gems plus level-1 inventory/equipment, core color rules, Attunement cascade procs and expiry, timed effects, pinning, row rotation, Wild creation, recoloring, haste, siphon, Guard/Evade durations, hints, reshuffle preservation and swipe input.');
})().catch(e=>{console.error(e);process.exitCode=1});
