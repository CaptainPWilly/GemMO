const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
class El{constructor(){this.events={};this.classes=new Set();this.style={};this.children=[];this.dataset={};this.classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),contains:(v)=>this.classes.has(v)};this.textContent='';this.value='all'}set innerHTML(v){this.children=Array.from({length:(v.match(/<button/g)||[]).length},()=>new El());if(v.includes('<span'))this.firstElementChild=new El()}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}remove(){}getBoundingClientRect(){return {left:0,top:0,width:320,height:320}}animate(){return {finished:Promise.resolve(),cancel(){}}}}
const es=new Map(),document={getElementById(id){if(!es.has(id))es.set(id,new El());return es.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
const root=path.join(__dirname,'..');
const serverCombat=require(path.join(root,'server','combat.cjs'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'assets','styles.css'),'utf8');
const content=fs.readFileSync(path.join(root,'assets','content.js'),'utf8');
const encounterDefs=fs.readFileSync(path.join(root,'shared','encounters.js'),'utf8');
const combatRules=fs.readFileSync(path.join(root,'shared','combat-rules.js'),'utf8');
const progressionDefs=fs.readFileSync(path.join(root,'shared','progression.js'),'utf8');
const storyDefs=fs.readFileSync(path.join(root,'shared','story.js'),'utf8');
const combatCore=fs.readFileSync(path.join(root,'assets','combat-core.js'),'utf8');
let src=fs.readFileSync(path.join(root,'assets','app.js'),'utf8');
assert(html.includes('href="assets/styles.css"'),'production shell must load the canonical stylesheet');
assert(html.includes('src="assets/content.js"')&&html.includes('src="shared/encounters.js"')&&html.includes('src="shared/combat-rules.js"')&&html.includes('src="shared/progression.js"')&&html.includes('src="shared/story.js"')&&html.includes('src="assets/combat-core.js"')&&html.indexOf('assets/content.js')<html.indexOf('shared/encounters.js')&&html.indexOf('shared/encounters.js')<html.indexOf('shared/combat-rules.js')&&html.indexOf('shared/combat-rules.js')<html.indexOf('shared/progression.js')&&html.indexOf('shared/progression.js')<html.indexOf('shared/story.js')&&html.indexOf('shared/story.js')<html.indexOf('assets/combat-core.js')&&html.indexOf('assets/combat-core.js')<html.indexOf('assets/app.js'),'production shell must load content, shared encounter/combat/story rules, combat core, then runtime');
assert(html.includes('src="assets/app.js"'),'production shell must load the canonical runtime');
assert(content.includes('globalThis.GEMMO_CONTENT=Object.freeze'),'static game definitions must live behind the content boundary');
assert(!content.includes("'env'")&&!html.includes('ENVIRONMENT · RIFT')&&!src.includes("type==='env'"),'standalone Environment gem rules stay removed');
assert(encounterDefs.includes("else root.GEMMO_ENCOUNTERS=encounters"),'encounter definitions must be shared between browser and server');
assert(combatRules.includes("else root.GEMMO_COMBAT_RULES=rules"),'cascade rules must be shared between browser and server');assert(progressionDefs.includes("else root.GEMMO_PROGRESSION=progression"),'XP and skill rules must be shared between browser and server');assert(html.includes('id="skillsPage"')&&html.includes('id="skillTree"')&&styles.includes('.skillBranch'),'Shrine skill tree has a dedicated responsive page');assert(src.includes("function drawSkills()")&&src.includes("accountRequest('/v1/skills/buy'")&&src.includes("skillRank(node.id,purchased)"),'client renders ranked Shrine skill choices and persists investments');assert(src.includes("LEVEL '+newLevel+'!"),'victory feedback surfaces earned levels and skill points');
assert(storyDefs.includes("else root.GEMMO_STORY=story"),'story definitions must be shared between browser and server');
assert(html.includes('id="storyOverlay"')&&html.includes('id="storyChoices"')&&html.includes('id="worldQuestsBtn"')&&html.includes('id="worldQuestPanel"'),'production shell exposes cutscene, dialogue, and quest surfaces');
assert(src.includes("accountRequest('/v1/story/quest'")&&src.includes("accountRequest('/v1/story/cutscene'"),'story progression is persisted through authenticated server APIs');
assert(src.includes("function openDialogue(npcId)")&&src.includes("function startCutscene(id)")&&src.includes("function renderWorldQuests()"),'runtime contains reusable NPC, cutscene, and quest runners');
assert(styles.includes('.storyOverlay')&&styles.includes('.storyChoices')&&styles.includes('.worldQuestPanel'),'story and quest surfaces have responsive styling');
assert(combatCore.includes('globalThis.GEMMO_COMBAT_CORE=Object.freeze'),'deterministic board primitives must live behind the combat-core boundary');
assert(!src.includes("activeEncounter==='rat'")&&!src.includes("const ENCOUNTERS={rat:"),'runtime combat must not special-case encounter IDs');
assert(src.includes('COMBAT_CORE.findMatches(board,TYPES)')&&src.includes('COMBAT_CORE.legalMoves(board,TYPES)'),'runtime must consume extracted combat primitives');
assert(!src.includes('const ITEMS=[')&&!src.includes('const WORLD_NODES={'),'runtime must not re-embed expandable content');
assert(!/<style[\s>]/i.test(html),'index.html must stay free of inline styles');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html),'index.html must stay free of inline application scripts');
assert.equal((styles.match(/:root\s*\{/g)||[]).length,1,'the visual system must have one canonical palette root');
assert(styles.includes('@media (min-width:700px)'),'tablet breakpoint must exist');
assert(styles.includes('orientation:landscape'),'landscape tablet layout must exist');
assert(styles.includes('grid-template-areas:'),'landscape combat must use a two-pane grid');
assert(html.includes('class="splashSigil"')&&html.includes('class="menuNav"')&&html.includes('class="menuSnapshot"'),'splash and menu use the unified game-shell hierarchy');
assert(html.includes('class="pageHero compact"')&&html.includes('class="settingsStack"')&&html.includes('class="shopHero"'),'utility and catalogue screens use shared page hierarchy');
assert(html.includes('id="textSize"')&&html.includes('value="normal"')&&html.includes('value="large"')&&html.includes('value="xl"'),'settings expose normal, large and extra-large text sizes');
assert(styles.includes('--text-bump:1.5px')&&styles.includes('.app.text-normal{--text-bump:0px}')&&styles.includes('.app.text-xl{--text-bump:3px}'),'large typography is the default with reversible text-size tokens');
assert((styles.match(/font-size:calc\(/g)||[]).length>25,'fixed-size interface typography participates in the global text-size system');
assert(styles.includes('/* Unified responsive layout system.')&&styles.includes('--content-max:900px')&&styles.includes('.pageHero{'),'canonical responsive layout system is present');
assert(styles.includes('@media(hover:hover) and (pointer:fine)')&&styles.includes('button:focus-visible'),'layout system includes pointer polish and keyboard focus states');
assert((styles.match(/\/\* Adaptive tablet layout \*\//g)||[]).length===0,'legacy generic tablet layout block stays removed');
assert(src.includes("localStorage.getItem('gemmo.session')"),'login token must persist across browser restarts');
assert(src.includes("localStorage.setItem('gemmo.session'"),'successful login must remember the session');
assert(src.includes("localStorage.removeItem('gemmo.session'"),'logout must clear the remembered session');
assert(src.includes("localStorage.getItem('gemmo.textSize')")&&src.includes("localStorage.setItem('gemmo.textSize',textSize)")&&src.includes("function applyTextSize()"),'text-size preference persists locally and applies globally');
assert(src.includes("localDevHost?'http://127.0.0.1:8787':'https://gemmo.onrender.com'"),'localhost must default to the local API');
assert(src.includes("won:false,gold:0,xp:0"),'defeats must settle their match ticket with zero rewards');
assert(src.includes('activeRewardBudget=data.match?.rewardBudget||null'),'client must accept the server-issued reward budget');
assert(src.includes("activeRewardBudget?'/'+activeRewardBudget.gold:''"),'combat HUD must show the server Gold budget');
assert(src.includes("activeAuthority?.mode==='replay-v1'"),'authoritative combat must recognize the server replay authority mode');
assert(src.includes("resultBody.transcript=combatTranscript"),'verified victories must submit the combat transcript');
assert(src.includes("makeCombatRng(activeAuthority.seed)"),'authoritative combat must use the server-issued deterministic seed');
assert(src.includes("recordCombatAction({t:'swap'"),'player swaps must enter the combat proof transcript');
assert(src.includes("recordCombatAction({t:'ability'"),'gem activations must enter the combat proof transcript');
assert(!src.includes('STARTER_CHOICES')&&!html.includes('id="starterPage"'),'starter selection UI is removed');
assert(src.includes("const DEFAULT_SACK=['dagger',null,null,null,null]"),'client default Sack begins with the Iron Dagger');
assert(html.includes('class="sackHero"')&&html.includes('class="sackToolbar"'),'Sack uses the modern deck-style layout');
assert(html.includes('id="worldGold"')&&html.includes('id="worldSackBtn"')&&html.includes('id="worldInventoryBtn"')&&html.includes('id="worldEffectsBtn"'),'world map exposes Gold, Sack, Inventory, and Effects controls');
assert(!html.includes('id="worldZoomIn"')&&!html.includes('id="worldZoomOut"'),'world map does not expose zoom buttons');
assert(src.includes("addEventListener('wheel'")&&src.includes("{passive:false}"),'desktop map zoom uses a non-passive mouse wheel handler');
assert(src.includes("worldGesture={type:'pinch'"),'touch map zoom remains pinch-driven');
assert(html.includes('id="worldSackPip"')&&html.includes('id="worldInventoryPip"'),'world map includes new-item notification pips');
assert(html.includes('id="worldEffectsPanel"')&&html.includes('id="worldEffectsList"'),'world map includes the current-effects drawer');
assert(styles.includes('.worldQuickbar')&&styles.includes('.worldEffectsPanel')&&styles.includes('.worldPip'),'world HUD has responsive dock, effects, and pip styling');
assert(src.includes("function worldSeenKey(kind,userId){return 'gemmo.seen.'+userId+'.'+kind}"),'new-item seen state is account-scoped client UI state');
assert(src.includes("function animateWorldTravel(route)")&&src.includes("smooth=raw*raw*(3-2*raw)")&&src.includes("await animateWorldTravel(authorized)"),'world travel uses one eased animation across the full authorized route');
assert(!src.includes("await animateWorldTravel(from,to)"),'world travel no longer stops and restarts animation at every node');
assert(src.includes("account?.profile?.gold||0"),'world Gold is rendered from the server-synced account profile');
assert(src.includes("function currentWorldEffects()"),'world effects are derived from the current loadout');
assert(src.includes("const labels={red:'RED',blue:'BLUE',green:'GREEN',yellow:'YELLOW',purple:'PURPLE'}"),'Gem Shop groups stock by canonical color order');
assert(src.includes('shopColorSection')&&src.includes('shopColorGrid'),'Gem Shop renders explicit color sections');
assert(src.includes('shopGemIcon itemGem')&&src.includes("v.color"),'Gem Shop uses compact gem markers');
assert(styles.includes('.shopColorGrid')&&styles.includes('.shopPrice')&&styles.includes('.shopGemIcon'),'compact color-shop styling is present');
assert(src.includes("function openLoadoutScreen(next,origin=screen)")&&src.includes("loadoutReturnScreen=origin==='world'?'world':'menu'"),'Sack and Equipment remember whether they were opened from the map');
assert(src.includes("if(['sack','inventory'].includes(screen)&&loadoutReturnScreen==='world'){enterWorld();return}"),'Back returns map-origin loadout screens to the map');
assert(src.includes("openLoadoutScreen('sack','world')")&&src.includes("openLoadoutScreen('inventory','world')"),'map loadout buttons register world as their return target');
assert(html.includes('class="equipmentHero"')&&html.includes('id="equipmentSelection"'),'Equipment screen uses the polished loadout structure');
assert(src.includes("const GEAR_SLOT_ICON=")&&src.includes("shopGearCatalog")&&src.includes("shopGearGrid"),'Equipment and Outfitter use slot-aware compact UI');
assert(styles.includes('.equipmentHero')&&styles.includes('.gearCardAction')&&styles.includes('.shopGearGrid'),'Equipment and Outfitter compact styling is present');
assert(html.includes('class="combatant playerSide"')&&html.includes('class="right combatant enemySide"'),'combat header names explicit player and enemy sides');
assert(html.includes('id="turnBadge" class="turnBadge turn-player" role="status" aria-live="polite"'),'turn banner is an accessible live status');
assert(src.includes("game.classList.remove('turn-player','turn-enemy')")&&src.includes("badge.textContent=owner==='player'?'✦ YOUR TURN"),'runtime derives turn ownership classes and explicit banner copy');
assert(styles.includes('.game.turn-player .playerSide')&&styles.includes('.game.turn-enemy .enemySide')&&styles.includes('.game.turn-enemy .board{filter:'),'turn styling highlights the active combatant and subdues the board during enemy actions');
assert(styles.includes('@keyframes turnCuePulse')&&styles.includes('@media(prefers-reduced-motion:reduce)'),'turn change pulse respects reduced-motion preferences');
assert(html.includes('id="moveHistory" class="moveHistory"')&&html.includes('id="effectsBtn"')&&html.includes('id="effectsDrawer"'),'combat shell exposes visual move history and current effects');
assert(!html.includes('id="abilityBanner"')&&src.includes('activeCombatMove.ability={name,description,color}'),'abilities share the compact combat-history cards instead of a separate banner');
assert(!html.includes('id="historyEntries"')&&!html.includes('id="equipDrawer"'),'legacy text history and combat equipment drawer are removed');
assert(src.includes('function beginCombatMove(actor,label)')&&src.includes('function recordBrokenGems(counts)')&&src.includes("let actual=board[p.y][p.x]"),'match history records the actual board gems destroyed');
assert(src.includes('function combatEffectRows()')&&src.includes('function drawCombatEffects()'),'combat status and effects drawer share structured live effect data');
assert(styles.includes('.moveBreak')&&styles.includes('.historyGemVisual')&&styles.includes('.combatEffectCard'),'modern move-history gems and effect cards are styled');
assert(styles.includes('.moveBreak.comboCharging')&&styles.includes('@keyframes comboChargeFloat'),'cascade anchors visibly charge in the move rail');
assert(src.includes('if(cascade>0){const bonus=comboChargeBonus(cascade)')&&src.includes('recordComboCharge(comboRoots,bonus,cascade+1)'),'client cascade resolution boosts and animates opening colored gems');
assert(src.includes('comboRoots=comboChargeTypes(broken)')&&src.includes("resolve(m,'player',p,comboRoots!==null?1:0,keepTurn,comboRoots)"),'gem-breaking abilities seed Combo 1 anchors before refill cascades');

assert(styles.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'collection cards use compact mobile columns');
src=src.replace("showScreen('splash');",`globalThis.api={setHintDelay:v=>hintDelay=v,ITEMS,GEAR,EQUIPMENT_SLOTS,WORLD_NODES,worldCanTravel,worldPath,worldRoutePoint,worldCleared,sackIsValid,gearStats,playerMaxHP,matchPower,reservoirCap,canEquipGear,equipGear,unequipGear,getEquipment:()=>({...equipment}),resetEquipment:()=>{equipment={...DEFAULT_EQUIPMENT}},setInventory:v=>inventory=v.slice(),setTestAccount:v=>account=v,setWorldClears:v=>worldState.clearedEncounters=v.slice(),applyTarget,afterAction,fallColumns,reshuffleBoard,touchActivity,showHint,damagePlayer,findMatches,legalMoves,reservoirCap,enemyUseActive,setEnemyReady:color=>ec[color]=enemyReservoir(color).cap,startFight,applyColor,activate,trySwap,tapCell,beginCombatMove,recordBrokenGems,recordComboCharge,getCombatHistory:()=>combatHistory.map(v=>({...v,breaks:{...v.breaks}})),combatEffectRows,get:()=>({charges,sack,pHP,eHP,pGuard,eGuard,freeSwap,overdrive,playerTurn,board,buffs,enemyEffects,pinColumn,pinTurns,guardTurns,evadeTurns,actionNumber,targetMode,armedAbilitySlot}),setHP:v=>pHP=v,setEnemyHP:v=>eHP=v,setGuard:v=>eGuard=v,setBoard:v=>{board=v;render()},setTurn:v=>playerTurn=v,setSack:v=>sack=v,setReady:i=>{charges[itemById(sack[i]).color]=itemById(sack[i]).cap;playerTurn=true;pHP=10},finish:async()=>{await Promise.all(damageAnimations.splice(0))}};showScreen('splash');`);
const scheduled=new Map();let nextTimer=1;
const c={document,window:{matchMedia:()=>({matches:true}),GEMMO_API:null},location:{hostname:'captainpwilly.github.io'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>{throw new Error('fetch not expected in combat tests')},setTimeout:(fn,ms)=>{const id=nextTimer++;scheduled.set(id,{fn,ms});return id},clearTimeout:id=>scheduled.delete(id),console};vm.runInNewContext(content,c);vm.runInNewContext(encounterDefs,c);vm.runInNewContext(combatRules,c);vm.runInNewContext(progressionDefs,c);vm.runInNewContext(storyDefs,c);vm.runInNewContext(combatCore,c);
assert.deepEqual(Array.from(c.GEMMO_CONTENT.TYPES),['red','blue','green','yellow','purple','gold','xp'],'generated board has five colors, Gold and XP only; Wild remains forged');
const progressionCatalog=c.GEMMO_PROGRESSION;assert.deepEqual([progressionCatalog.xpForLevel(2),progressionCatalog.xpForLevel(3),progressionCatalog.xpForLevel(4),progressionCatalog.xpForLevel(5)],[20,45,75,110]);assert.equal(progressionCatalog.BRANCHES.length,6);assert.equal(progressionCatalog.SKILLS.length,18);assert.equal(progressionCatalog.BRANCHES.flatMap(b=>b.nodes).reduce((n,s)=>n+s.maxRank,0),37,'visible tree supports 37 total point investments');assert.equal(progressionCatalog.skillRank('red-cap-1',['red-cap-1','red-cap-1@2']),2);assert.equal(progressionCatalog.canPurchase('red-start',['red-cap-1'],3).reason,'skill_prerequisite');assert.equal(progressionCatalog.canPurchase('red-start',['red-cap-1','red-cap-1@2'],3).ok,true);const progressionEffects=progressionCatalog.skillEffects(['neutral-vitality','neutral-vitality@2','red-cap-1','red-cap-1@2','red-start']);assert.equal(progressionEffects.maxHP,4);assert.equal(progressionEffects.caps.red,2);assert.equal(progressionEffects.startCharge.red,1);
const storyCatalog=c.GEMMO_STORY;assert.equal(storyCatalog.NPCS['warden-vale'].node,'camp');assert.equal(storyCatalog.QUESTS['trouble-on-road'].objective.encounterId,'rat');assert.equal(storyCatalog.CUTSCENES['brackenreach-arrival'].slides.length,3);
const encounterCatalog=c.GEMMO_ENCOUNTERS;assert.deepEqual(Object.keys(encounterCatalog),['rat','bandit']);assert.equal(encounterCatalog.rat.maxHP,10);assert.equal(encounterCatalog.bandit.maxHP,24);assert.equal(encounterCatalog.bandit.actives.length,5);assert.equal(encounterCatalog.bandit.reward.gold.join(','),'18,24');
const core=c.GEMMO_COMBAT_CORE,rngA=core.makeRng(1337),rngB=core.makeRng(1337);
assert.deepEqual([rngA(),rngA(),rngA()],[rngB(),rngB(),rngB()],'combat-core RNG is deterministic');
const coreBoard=Array.from({length:8},()=>Array(8).fill('blue'));for(let y=0;y<8;y++)for(let x=0;x<8;x++)coreBoard[y][x]=(x+y)%2?'blue':'red';coreBoard[0][0]='red';coreBoard[0][1]='wild';coreBoard[0][2]='red';
assert(core.findMatches(coreBoard,['red','blue']),'combat-core Wild participates in a colored match');
vm.runInNewContext(src,c);const a=c.api;
a.setTestAccount({needsStarter:false,inventory:a.ITEMS.map(i=>i.id),profile:{level:1,xp:0,gold:0},user:{username:'TestHero'}});
const comboRules=c.GEMMO_COMBAT_RULES;assert.equal(comboRules.comboChargeTypes({red:3,gold:3,blue:4}).join(','),'red,blue','only opening colored gems anchor cascade charge');assert.equal(comboRules.comboChargeBonus(1),1);assert.equal(comboRules.comboChargeBonus(2),2);assert.equal(comboRules.comboChargeBonus(0),0);
a.beginCombatMove('player','MATCH');a.recordBrokenGems({red:3,gold:4,wild:1});let visualHistory=a.getCombatHistory();assert.equal(visualHistory.length,1);assert.equal(visualHistory[0].label,'MATCH');assert.equal(visualHistory[0].breaks.red,3);assert.equal(visualHistory[0].breaks.gold,4);assert.equal(visualHistory[0].breaks.wild,1);
a.recordComboCharge(['red'],1,2);visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,4,'combo 2 charges the opening red value by +1');assert.equal(visualHistory[0].comboDepth,2);
a.recordComboCharge(['red'],2,3);visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,6,'combo 3 charges the opening red value by +2');assert.equal(visualHistory[0].comboDepth,3);
a.recordBrokenGems({red:4,blue:3});visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,10,'actual cascade breaks still add their own value');assert.equal(visualHistory[0].breaks.blue,3);
assert(Array.isArray(a.combatEffectRows()),'current combat effects are derived as structured rows');

(async()=>{
 const cases={dagger:[10,18,0],axe:[10,16,0],spear:[10,21,3],shield:[10,24,6],buckler:[10,21,3],ward:[12,24,3],salve:[15,24,0],poultice:[13,24,0],briar:[12,21,0],boots:[10,24,0],cloak:[10,24,5],knife:[10,23,0],charm:[10,24,0],seal:[10,16,0],relic:[14,24,4]};
 Object.assign(cases,{"arming-sword":[10,17,0],"warhammer":[10,14,0],"longbow":[10,19,0],"rapier":[10,21,3],"halberd":[10,15,0],"hand-crossbow":[10,21,0],"flail":[10,16,0],"tower-shield":[10,24,10],"swordbreaker":[10,24,0],"quarterstaff":[10,24,4],"pavise":[10,24,8],"war-pick":[10,22,0],"kite-shield":[12,24,3],"hook-spear":[10,24,7],"sickle":[12,21,0],"druid-staff":[18,24,0],"hunting-bow":[10,24,0],"thorn-whip":[10,20,0],"grove-spear":[12,24,3],"woodland-club":[10,24,6],"willow-wand":[12,24,0],"twin-knives":[10,17,0],"light-crossbow":[10,18,0],"sling":[10,22,0],"duelist-sabre":[10,21,3],"glaive":[10,16,0],"parrying-dagger":[10,24,3],"javelin":[10,15,0],"rune-blade":[10,17,0],"hex-staff":[10,24,0],"relic-mace":[14,24,4],"moon-scythe":[12,21,0],"crystal-wand":[10,20,0],"spell-tome":[12,24,3],"ritual-dagger":[10,21,3]});
 Object.assign(cases,{"bloodstone-whet":[10,24,0],"bastion-sigil":[10,24,0],"heartseed":[10,24,0],"gamblers-thread":[10,24,0]});
 assert.equal(a.ITEMS.length,74);assert.equal(new Set(a.ITEMS.map(i=>i.id)).size,74);const starterWand=a.ITEMS.find(i=>i.id==='crystal-wand');assert.equal(starterWand.color,'blue');assert.equal(starterWand.kind,'damage');assert.equal(starterWand.power,4);
 const effectIds=['executioners-axe','barbed-blade','mirror-shield','binding-chain','healing-potion','purifying-tonic','locksmith-pick','powder-bomb','chaos-orb','void-flask'];
 for(const id of effectIds)assert(a.ITEMS.some(i=>i.id===id),id+' exists in expanded effect catalog');
 assert(a.ITEMS.every(i=>i.effect===i.kind&&i.effectLabel&&i.role&&Number.isInteger(i.turnCost)),'every gem carries normalized effect metadata');
 assert(a.ITEMS.filter(i=>i.color==='red').every(i=>Number.isInteger(i.attack)&&i.attack>=1),'every Red gem carries an Attack value');
 assert(a.ITEMS.filter(i=>i.color==='blue').every(i=>Number.isInteger(i.defense)&&i.defense>=1),'every Blue gem carries a Defense value');
 assert.equal(a.ITEMS.find(i=>i.id==='dagger').attack,1);assert.equal(a.ITEMS.find(i=>i.id==='warhammer').attack,2);assert.equal(a.ITEMS.find(i=>i.id==='shield').defense,2);assert.equal(a.ITEMS.find(i=>i.id==='tower-shield').defense,3);
 assert.equal(a.ITEMS.find(i=>i.id==='knife').turnCost,0,'Throwing Knife is a quick action');
 assert.equal(a.ITEMS.find(i=>i.id==='locksmith-pick').turnCost,0,'Locksmith Pick is a quick board action');
 assert.equal(a.sackIsValid(['dagger','shield','salve','boots','charm']),true,'five unique gems are a legal Sack');
 assert.equal(a.sackIsValid(['dagger','dagger','shield','salve','boots']),false,'exact duplicate gems are illegal');
 assert.equal(a.sackIsValid(['dagger',null,null,null,null]),true,'a level-1 one-gem Sack is legal');
 assert.equal(a.sackIsValid([null,null,null,null,null]),false,'zero-gem Sack cannot fight');
 a.setSack(['dagger',null,null,null,null]);a.startFight();assert.equal(a.get().sack.filter(Boolean).length,1,'one starter gem can enter combat');
 assert.equal(a.sackIsValid(['dagger','spear','longbow','rapier','hand-crossbow']),true,'different gems of one color are legal');
 const smoothRoute=a.worldPath('item-shop','shrine'),smoothStart=a.worldRoutePoint(smoothRoute,0),smoothMid=a.worldRoutePoint(smoothRoute,.5),smoothEnd=a.worldRoutePoint(smoothRoute,1);
 assert(Math.abs(smoothStart.x-a.WORLD_NODES['item-shop'].x)<1e-9&&Math.abs(smoothStart.y-a.WORLD_NODES['item-shop'].y)<1e-9,'route starts exactly at origin');assert(Math.abs(smoothEnd.x-a.WORLD_NODES.shrine.x)<1e-9&&Math.abs(smoothEnd.y-a.WORLD_NODES.shrine.y)<1e-9,'route ends exactly at destination');assert(smoothMid.travelled>0&&smoothMid.travelled<smoothMid.total,'full-route interpolation advances continuously between endpoints');
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
 a.setSack(['dagger','spear','longbow','rapier','hand-crossbow']);a.startFight();a.setEnemyHP(50);assert.equal(a.matchPower('red'),5);a.applyColor('red',5,'player');assert.equal(a.get().charges.red,5);assert.equal(a.reservoirCap('red'),31);assert.equal(a.get().eHP,25,'five ATK 1 Red gems deal 25 damage from five broken Red gems');await a.finish();
 a.setReady(2);a.activate(2);assert.equal(a.get().charges.red,0);await a.finish();
 a.setSack(['warhammer','dagger','shield',null,null]);a.startFight();assert.equal(a.matchPower('red'),3);assert.equal(a.matchPower('blue'),2);a.applyColor('red',2,'player');assert.equal(a.get().eHP,18,'Red damage multiplies broken gems by total equipped ATK');a.applyColor('blue',2,'player');assert.equal(a.get().pGuard,4,'Blue Guard multiplies broken gems by total equipped DEF');await a.finish();
 a.setSack(['charm','seal','dagger','shield','boots']);a.startFight();a.setReady(0);a.activate(0);a.setReady(0);a.activate(0);assert.equal(a.get().charges.purple,10,'Overdrive cannot be re-activated while primed');
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,18);assert.equal(a.get().charges.red,6);assert.equal(a.get().overdrive,false);await a.finish();a.applyColor('red',3,'player');assert.equal(a.get().eHP,15);await a.finish();
 a.setSack(['boots','dagger','shield','salve','charm']);a.startFight();const b=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));a.setBoard(b);a.setReady(0);a.activate(0);a.tapCell(0,0);a.tapCell(1,0);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().freeSwap,false);assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().board[0][1],'red');assert.equal(a.get().playerTurn,false);
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();a.setReady(0);a.setGuard(4);a.activate(0);assert.equal(a.get().eHP,22);assert.equal(a.get().eGuard,0);await a.finish();
 a.startFight();assert(Object.values(a.get().charges).every(n=>n===0));assert.equal(a.get().pHP,18);assert.equal(a.get().eHP,24);

 // Expanded effect vocabulary.
 a.setSack(['knife','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().eHP,23);assert.equal(a.get().playerTurn,true,'quick hit keeps the turn');
 a.setSack(['executioners-axe','dagger','shield','salve','charm']);a.startFight();a.setHP(10);a.setReady(0);a.activate(0);assert.equal(a.get().eHP,20,'execute uses base damage above threshold');
 a.startFight();a.setEnemyHP(8);a.setReady(0);a.activate(0);assert.equal(a.get().eHP,0,'execute spikes at low HP');
 a.setSack(['barbed-blade','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.bleed,2);a.afterAction('enemy');assert.equal(a.get().eHP,22);
 a.setSack(['mirror-shield','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);a.damagePlayer(6);assert.equal(a.get().eHP,21,'reflect returns half of unblocked damage');
 a.setSack(['swordbreaker','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.disarm,1);
 a.setSack(['hunting-bow','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);a.damagePlayer(0);assert.equal(a.get().enemyEffects.mark,1);a.applyColor('red',3,'player');assert.equal(a.get().eHP,18,'mark adds 3 to next damage');
 a.setSack(['hex-staff','dagger','shield','salve','charm']);a.startFight();a.setReady(0);a.activate(0);assert.equal(a.get().enemyEffects.silence,1);
 const pickBoard=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));pickBoard[4][2]='green';pickBoard[4][3]='blue';pickBoard[4][4]='green';pickBoard[3][3]='green';a.setSack(['locksmith-pick','dagger','shield','salve','charm']);a.startFight();a.setBoard(pickBoard);assert.equal(a.findMatches(),null,'ability combo fixture starts stable');a.setReady(0);a.activate(0);assert.equal(a.get().targetMode,'break');const pickChargeAfterArm=a.get().charges.yellow;a.activate(0);assert.equal(a.get().targetMode,null,'tapping an armed ability again cancels targeting');assert.equal(a.get().armedAbilitySlot,-1);assert.equal(a.get().charges.yellow,pickChargeAfterArm+4,'cancel restores ability charge');a.setReady(0);a.activate(0);const guardBeforePick=a.get().pGuard,blueBeforePick=a.get().charges.blue;await a.applyTarget({x:3,y:4});assert.equal(a.get().playerTurn,true,'quick tile break keeps the turn');assert(a.get().pGuard>=guardBeforePick+2,'Pick gets Blue value 1, then Combo 2 boosts the broken Blue anchor +1');assert(a.get().charges.blue>=blueBeforePick+2,'Pick and its first cascade both charge the broken Blue anchor');const pickHistory=a.getCombatHistory().at(-1);assert(pickHistory?.ability,'committed targeted abilities appear in compact combat history');assert(pickHistory.comboDepth>=2&&pickHistory.breaks.blue>=2,'ability-broken Blue is shown charging as a Combo 1 anchor');

 // Server replay executes the new action-economy and control vocabulary too.
 const serverGear={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
 let ss=serverCombat.createBanditCombat({seed:1337,sack:['knife','dagger','shield','salve','charm'],equipment:serverGear,rewardBudget:{gold:0,xp:0}});
 ss.charges.yellow=3;assert.equal(serverCombat.applyCombatAction(ss,{t:'ability',slot:0}),true);assert.equal(ss.eHP,23);assert.equal(ss.playerTurn,true,'server quick hit keeps the turn');
 ss=serverCombat.createBanditCombat({seed:1337,sack:['executioners-axe','dagger','shield','salve','charm'],equipment:serverGear,rewardBudget:{gold:0,xp:0}});
 ss.eHP=8;ss.charges.red=8;assert.equal(serverCombat.applyCombatAction(ss,{t:'ability',slot:0}),true);assert.equal(ss.eHP,-2,'server execute honors low-health threshold');
 ss=serverCombat.createBanditCombat({seed:1337,sack:['locksmith-pick','dagger','shield','salve','charm'],equipment:serverGear,rewardBudget:{gold:0,xp:0}});
 const serverPickBoard=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));serverPickBoard[4][2]='green';serverPickBoard[4][3]='blue';serverPickBoard[4][4]='green';serverPickBoard[3][3]='green';ss.board=serverPickBoard;ss.charges.yellow=4;assert.equal(serverCombat.applyCombatAction(ss,{t:'ability',slot:0}),true);assert.equal(ss.targetMode,'break');assert.equal(serverCombat.applyCombatAction(ss,{t:'target',x:3,y:4}),true);assert.equal(ss.playerTurn,true,'server quick break keeps the turn');assert(ss.pGuard>=2,'server replay gives Blue value 1 plus Combo 2 anchor value');assert(ss.charges.blue>=2,'server replay charges the ability-broken Blue anchor through Combo 2');

 // Shared pool keeps unspent charge; either item can spend it.
 a.setSack(['dagger','axe','shield','salve','boots']);a.startFight();a.applyColor('red',99,'player');assert.equal(a.get().charges.red,16);assert.equal(a.reservoirCap('red'),16);await a.finish();
 a.setHP(24);a.startFight();a.setEnemyHP(100);a.applyColor('red',12,'player');await a.finish();a.activate(1);assert.equal(a.get().charges.red,3);
 a.startFight();a.applyColor('purple',3,'player');assert.equal(a.get().charges.purple,0);
 const grid=()=>Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));
 for(const type of ['red','blue','green','yellow','purple','gold','xp']){
  const g=grid();g[0][0]=type;g[0][1]='wild';g[0][2]=type;a.setBoard(g);const m=a.findMatches();assert(m&&m.runs.some(r=>r.type===type&&r.len>=3),type+' accepts Wild');assert.equal(new Set(m.cells.map(p=>p.x+','+p.y)).size,m.cells.length,'Wild counted once');
 }
 const all=grid();all[0][0]=all[0][1]=all[0][2]='wild';all[0][3]='';a.setBoard(all);assert(!a.findMatches()?.runs.some(r=>r.cells.every(p=>p.y===0)&&r.cells.length===3),'all-Wild trio needs a real type');
 a.startFight();const g=grid();g[0][0]='wild';a.setBoard(g);const before=JSON.stringify(a.get().board);const valid=await a.trySwap({x:0,y:0},{x:1,y:0},'player');assert.equal(valid,false);assert.equal(JSON.stringify(a.get().board),before,'invalid Wild swap reverts, never clears board');
 for(const color of ['red','blue','green','yellow','purple']){a.startFight();a.setEnemyReady(color);assert.equal(a.enemyUseActive(),color!=='green');if(color!=='green')assert(a.getCombatHistory().at(-1)?.ability,'enemy ability enters compact combat history')}

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
 equip('boots');const bootsChargeAfterArm=a.get().charges.yellow;a.activate(0);assert.equal(a.get().freeSwap,false,'tapping Quickstep again cancels it');assert.equal(a.get().charges.yellow,bootsChargeAfterArm+6,'Quickstep cancel restores charge');a.setReady(0);a.activate(0);a.setBoard(grid());es.get('board').events.pointerdown({clientX:20,clientY:20,pointerId:1});es.get('board').events.pointerup({clientX:65,clientY:20,pointerId:1});await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().freeSwap,false);
 equip('wayfarer-lyre');a.setHP(0);a.afterAction('enemy');assert.equal(a.get().pHP,0,'regeneration cannot revive a defeated fighter');

 // Core board contract: Red uses Sack ATK, Blue uses Sack DEF; Green/Yellow/Purple are charge-only without equipped effects.
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();assert.equal(a.findMatches(),null,'fresh board starts without free matches');assert(a.legalMoves().length>0,'fresh board always has a legal move');a.setHP(20);
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,21);assert.equal(a.get().charges.red,3);await a.finish();
 a.applyColor('blue',3,'player');assert.equal(a.get().pGuard,6);assert.equal(a.get().charges.blue,3);
 a.applyColor('green',3,'player');assert.equal(a.get().pHP,20);assert.equal(a.get().charges.green,3);
 const hpBeforeUtility=a.get().pHP,enemyBeforeUtility=a.get().eHP,guardBeforeUtility=a.get().pGuard;
 a.applyColor('yellow',3,'player');a.applyColor('purple',3,'player');assert.equal(a.get().pHP,hpBeforeUtility);assert.equal(a.get().eHP,enemyBeforeUtility);assert.equal(a.get().pGuard,guardBeforeUtility);assert.equal(a.get().charges.yellow,3);assert.equal(a.get().charges.purple,3);

 // Attunements proc on every qualifying match resolution, including cascades, and expire after 3 future player actions.
 equip('bloodstone-whet');assert.equal(a.get().buffs.redwake,3);a.applyColor('red',3,'player',0);assert.equal(a.get().eHP,16);a.applyColor('red',3,'player',1);assert.equal(a.get().eHP,8);await a.finish();a.afterAction('player');assert.equal(a.get().buffs.redwake,2);a.afterAction('player');assert.equal(a.get().buffs.redwake,1);a.afterAction('player');assert.equal(a.get().buffs.redwake,0);
 equip('bastion-sigil');assert.equal(a.get().buffs.holdfast,3);a.applyColor('blue',3,'player',0);assert.equal(a.get().pGuard,11);a.applyColor('blue',3,'player',1);assert.equal(a.get().pGuard,22);
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
 console.log('PASS: 74 organized gems plus level-1 inventory/equipment, core color rules, Attunement cascade procs and expiry, timed effects, pinning, row rotation, Wild creation, recoloring, haste, siphon, Guard/Evade durations, hints, reshuffle preservation and swipe input.');
})().catch(e=>{console.error(e);process.exitCode=1});
