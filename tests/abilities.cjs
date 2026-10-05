const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
class El{constructor(){this.events={};this.classes=new Set();this.style={setProperty(k,v){this[k]=v}};this.children=[];this.dataset={};this.classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),contains:(v)=>this.classes.has(v)};this.textContent='';this.value='all'}set innerHTML(v){this.html=v;this.children=Array.from({length:(v.match(/<button/g)||[]).length},()=>new El());if(v.includes('<span'))this.firstElementChild=new El()}get innerHTML(){return this.html||''}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(name,fn){this.events[name]=fn}remove(){}getBoundingClientRect(){return {left:0,top:0,width:320,height:320}}animate(){return {finished:Promise.resolve(),cancel(){}}}}
const es=new Map(),document={getElementById(id){if(!es.has(id))es.set(id,new El());return es.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
const root=path.join(__dirname,'..');
const serverCombat=require(path.join(root,'server','combat.cjs'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'assets','styles.css'),'utf8');
const weaponRules=fs.readFileSync(path.join(root,'shared','weapon-gems.js'),'utf8');
const colorBalance=fs.readFileSync(path.join(root,'shared','color-balance.js'),'utf8');
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
assert(/<div class="worldEffectsPanel uiSheet" id="worldEffectsPanel" hidden>/.test(html)&&/<div class="worldQuestPanel uiSheet" id="worldQuestPanel" hidden>/.test(html),'world drawers have real DOM IDs so map setup can open');
assert(content.includes('globalThis.GEMMO_CONTENT=Object.freeze'),'static game definitions must live behind the content boundary');
assert(!content.includes("'env'")&&!html.includes('ENVIRONMENT · RIFT')&&!src.includes("type==='env'"),'standalone Environment gem rules stay removed');
assert(encounterDefs.includes("else root.GEMMO_ENCOUNTERS=encounters"),'encounter definitions must be shared between browser and server');
assert(combatRules.includes("else root.GEMMO_COMBAT_RULES=rules"),'cascade rules must be shared between browser and server');assert(progressionDefs.includes("else root.GEMMO_PROGRESSION=progression"),'XP and skill rules must be shared between browser and server');
assert(progressionDefs.includes('red-resonance')&&progressionDefs.includes('chargeGain:{red:0,blue:0,green:0,yellow:0,purple:0}'),'skill progression exposes per-color charge-efficiency specialization');
assert(content.includes("chargeGain:{red:1}")&&content.includes("chargeGain:{blue:1}")&&content.includes("chargeGain:{green:1}")&&content.includes("chargeGain:{yellow:1}")&&content.includes("chargeGain:{purple:1}"),'gear catalog includes one throughput item for every color');
assert(src.includes("matchGain=!comboBonus&&n>=3?gearGain+skillGain:0")&&src.includes("CHARGE EFFICIENCY"),'client charge efficiency applies once per real 3+ match and is surfaced in build effects');assert(html.includes('id="skillsPage"')&&html.includes('id="skillTree"')&&styles.includes('.skillBranch'),'Shrine skill tree has a dedicated responsive page');assert(src.includes("function drawSkills()")&&src.includes("accountRequest('/v1/skills/buy'")&&src.includes("skillRank(node.id,purchased)"),'client renders ranked Shrine skill choices and persists investments');assert(src.includes("LEVEL '+newLevel+'!"),'victory feedback surfaces earned levels and skill points');
assert(storyDefs.includes("else root.GEMMO_STORY=story"),'story definitions must be shared between browser and server');
assert(html.includes('id="storyOverlay"')&&html.includes('id="storyChoices"')&&html.includes('id="worldQuestsBtn"')&&html.includes('id="worldQuestPanel"'),'production shell exposes cutscene, dialogue, and quest surfaces');
assert(src.includes("accountRequest('/v1/story/quest'")&&src.includes("accountRequest('/v1/story/cutscene'"),'story progression is persisted through authenticated server APIs');
assert(src.includes("function openDialogue(npcId)")&&src.includes("function startCutscene(id)")&&src.includes("function renderWorldQuests()"),'runtime contains reusable NPC, cutscene, and quest runners');
assert(styles.includes('.storyOverlay')&&styles.includes('.storyChoices')&&styles.includes('.worldQuestPanel'),'story and quest surfaces have responsive styling');
assert(styles.includes('.app.text-xl .storyCard{max-height:82%;overflow-y:auto')&&styles.includes('grid-template-columns:1fr'),'XL story layout reflows to a full-width readable column instead of squeezing copy beside the portrait');
assert(styles.includes('.app.text-xl .storyCopy p{font-size:18px!important')&&styles.includes('.app.text-xl .storyChoices button,.app.text-xl .storyContinue{font-size:15px'),'XL cutscene/dialogue body and controls remain legible');
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
assert(html.includes('class="pageHero compact uiHero"')&&html.includes('class="settingsStack"')&&html.includes('class="shopHero uiHero"'),'utility and catalogue screens use the universal page hierarchy');
assert(html.includes('id="textSize"')&&html.includes('value="normal"')&&html.includes('value="large"')&&html.includes('value="xl"'),'settings expose normal, large and extra-large text sizes');
assert(styles.includes('--text-bump:1.5px')&&styles.includes('.app.text-normal{--text-bump:0px}')&&styles.includes('.app.text-xl{--text-bump:5px}'),'large typography is the default and XL has a materially stronger text scale');
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
assert(src.includes("['replay-v1','replay-v2','replay-v3','replay-v4','replay-v5','replay-v6','replay-v7'].includes(activeAuthority?.mode)"),'client records proof transcripts for current and active legacy combats');
assert(src.includes("resultBody.transcript=combatTranscript"),'verified victories must submit the combat transcript');
assert(src.includes("makeCombatRng(activeAuthority.seed)"),'authoritative combat must use the server-issued deterministic seed');
assert(src.includes("recordCombatAction({t:'swap'"),'player swaps must enter the combat proof transcript');
assert(src.includes("recordCombatAction({t:'ability'"),'gem activations must enter the combat proof transcript');
assert(!src.includes('STARTER_CHOICES')&&!html.includes('id="starterPage"'),'starter selection UI is removed');
assert(src.includes("const DEFAULT_SACK=[null,null,null,null,null]"),'client default Sack is empty until the Warden grants a weapon');
assert(html.includes('class="sackHero uiHero"')&&html.includes('class="sackToolbar uiToolbar"'),'Sack uses the modern deck layout on universal hero/toolbar prefabs');
assert(html.includes('id="worldGold"')&&html.includes('id="worldSackBtn"')&&html.includes('id="worldInventoryBtn"')&&html.includes('id="worldSkillsBtn"')&&html.includes('id="worldQuestsBtn"'),'world map exposes Gold plus Sack, Inventory, Skills, and Journal hub controls');assert(!html.includes('id="worldEffectsBtn"')&&html.includes('id="worldStatusBtn"'),'current effects moved from the dock into the persistent player-status strip');
assert(!html.includes('id="worldZoomIn"')&&!html.includes('id="worldZoomOut"'),'world map does not expose zoom buttons');
assert(src.includes("addEventListener('wheel'")&&src.includes("{passive:false}"),'desktop map zoom uses a non-passive mouse wheel handler');
assert(src.includes("worldGesture={type:'pinch'"),'touch map zoom remains pinch-driven');
assert(html.includes('id="worldSackPip"')&&html.includes('id="worldInventoryPip"'),'world map includes new-item notification pips');
assert(html.includes('id="worldEffectsPanel"')&&html.includes('id="worldEffectsList"'),'world map includes the current-effects drawer');
assert(html.includes('id="worldStatusBtn"')&&html.includes('id="worldObjectiveBtn"')&&html.includes('id="worldSkillsBtn"'),'world map exposes persistent status, objective, and progression controls');
assert(html.includes('id="combatSacksBtn"')&&src.includes('function openCombatSacks('),'combat Sack inspection is available from the combat menu when the mobile header is compacted');
assert(styles.includes('Mobile combat composition: board-first')&&styles.includes('.game .reservoirs{display:none}')&&styles.includes('.game .moveHistoryItem.latest'),'phone combat layout removes duplicate live rows and preserves only essential live history');
assert(src.includes('moveHistoryPlaceholder latest')&&html.includes('moveHistoryPlaceholder latest')&&!src.includes('moveHistoryEmpty">COMBAT HISTORY'),'combat history reserves a real first-card footprint before the opening move');
assert(styles.includes('.moveHistoryPlaceholder{')&&styles.includes('visibility:hidden'),'empty history placeholder uses the same card geometry without visible filler text');
assert(src.includes('compactGemCard')&&src.includes('liquidChargeGem')&&src.includes('equipped.length'),'the adaptive dock keeps all equipped gems visible on phone');
assert(html.includes('class="chromeIconButton"')&&html.includes('aria-label="Menu"')&&html.includes('worldQuickLabel'),'symbol-first controls keep explicit accessible labels');
assert(src.includes("'♥ '+pHP+' · ◈ '+pGuard")&&src.includes("'◆ '+gold")&&src.includes("'✦ '+points"),'combat, currency, and progression HUDs use compact symbolic notation');
assert(src.includes("compatible?'+':'▣'")&&src.includes("current?'✓'"),'equipment states use compact symbols instead of repeated words');
assert(styles.includes('Professional UI language pass')&&styles.includes('.chromeIconButton')&&styles.includes('.worldQuickButton .worldQuickLabel'),'professional chrome and symbol-first mobile dock styling are present');
assert(['sackPage','shopPage','skillsPage','accountPage','inventoryPage','gemologyPage','settingsPage'].every(id=>html.includes('id="'+id+'"')&&html.slice(Math.max(0,html.indexOf('id="'+id+'"')-80),html.indexOf('id="'+id+'"')+30).includes('uiScreen')),'all standard management screens use the universal uiScreen shell');
assert((html.match(/uiTopbar/g)||[]).length>=7&&(html.match(/uiHero/g)||[]).length>=7,'standard screens share universal topbar and hero prefabs');
assert(styles.includes('UI PREFABS — canonical geometry')&&styles.includes('.uiScreen{')&&styles.includes('.uiTopbar{')&&styles.includes('.uiHero{')&&styles.includes('.uiCard,.uiPanel{')&&styles.includes('.uiSheet,.uiOverlay,.uiModal{'),'canonical screen/card/sheet prefab CSS exists');
assert(src.includes('uiCard')&&html.includes('uiPanel')&&html.includes('uiToolbar'),'dynamic cards and static panels/toolbars consume the prefab system');
assert(!styles.includes('.shopItem p,.gearCardCopy strong{display:none}')&&styles.includes('.shopItem .shopItemCopy p,.gearCardCopy strong,.gearSlotCopy em{display:block'),'shop and inventory effects remain visible on phones');
assert(styles.includes('Five-up mobile gem dock')&&styles.includes('-webkit-line-clamp:2')&&styles.includes('--charge-fill'),'mobile gem cards use a compact name, charge meter, and simple state treatment');
assert(styles.includes('.app.text-xl .game .slot.compactGemCard')&&styles.includes('.app.text-xl .game .boardShell'),'Largest Text keeps the five-up gem dock while using dedicated phone sizing');
assert(src.includes('function worldObjectiveData()')&&src.includes("$('worldPlayerStats').textContent")&&src.includes("weaponDamage(color)"),'world hub derives live objective and combat-build summary');
assert(src.includes('function openWorldSkills(){openSkills()}')&&!src.includes("await travelWorld('shrine')"),'Skills opens directly without traveling to a Shrine');
assert(styles.includes('.worldHubOverlay')&&styles.includes('.worldPlayerStrip')&&styles.includes('.worldObjectiveBar'),'world hub has responsive overlay styling');
assert(html.includes('id="enemyChargeGauges"')&&src.includes('function renderEnemyChargeGauges()'),'enemy combat header exposes live enemy gem-charge gauges');
assert(src.includes("renderEnemyChargeGauges();renderEnemyIntent();for(const [side,hp]")&&src.includes("value+'/'+cap"),'enemy charge gauges and intent update from live enemy state');
assert(html.includes('id="enemyIntent"')&&styles.includes('.enemyIntent[data-state="ready"]'),'enemy intent is accessible and visually warns when an ability is ready');
assert(styles.includes('.enemyChargeGauges')&&styles.includes('.enemyChargeTrack i'),'enemy charge gauges have compact fill-bar styling');
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
assert(html.includes('class="equipmentHero uiHero"')&&html.includes('id="equipmentSelection"'),'Equipment screen uses the universal hero plus polished loadout structure');
assert(html.includes('id="inventoryFilter"')&&html.includes('id="inventorySort"')&&src.includes('function inventoryEntry(record)'),'Inventory is a unified sortable collection');
assert(!html.includes('<option value="gem">Gems</option>')&&!html.includes('<option value="color">Sort: Color</option>'),'Inventory filters cover physical items only');
assert(content.includes("const CONSUMABLES=[")&&html.includes('id="combatItemsPanel"')&&src.includes("accountRequest('/v1/matches/consume'"),'one-shot combat consumables are exposed end-to-end');
assert(content.includes("name:'Minor Healing Draught'")&&content.includes("kind:'heal'")&&content.includes("kind:'guard'"),'potions and tonics keep simple immediate effects');
assert(content.includes("name:'Cherry Bomb'")&&content.includes("kind:'break'")&&src.includes("targetMode='consumable_break'"),'Cherry Bomb is a targeted one-shot single-gem breaker');
assert(src.includes("mode==='consumable_break'")&&src.includes("recordCombatAction({t:'consume',itemId:item.id})")&&src.includes("recordCombatAction({t:'target'"),'Cherry Bomb is consumed only when its chosen target is committed to replay');
assert(content.includes('"item":"Lifebloom Sigil"')&&content.includes('"item":"Mender\'s Rune"')&&html.includes('A healing spell and a healing potion can coexist'),'healing gems are named as reusable magic while consumables remain physical items');
assert(src.includes("const GEAR_SLOT_ICON=")&&src.includes("shopGearCatalog")&&src.includes("shopGearGrid"),'Equipment and Outfitter use slot-aware compact UI');
assert(styles.includes('.equipmentHero')&&styles.includes('.gearCardAction')&&styles.includes('.shopGearGrid'),'Equipment and Outfitter compact styling is present');
assert(html.includes('class="combatant playerSide"')&&html.includes('class="right combatant enemySide"'),'combat header names explicit player and enemy sides');
assert(html.includes('id="turnBadge" class="turnBadge turn-player" role="status" aria-live="polite"'),'turn banner is an accessible live status');
assert(src.includes("game.classList.remove('turn-player','turn-enemy')")&&src.includes("badge.textContent=owner==='player'?'✦ YOUR TURN"),'runtime derives turn ownership classes and explicit banner copy');
assert(styles.includes('.game.turn-player .playerSide')&&styles.includes('.game.turn-enemy .enemySide')&&styles.includes('.game.turn-enemy .board{filter:'),'turn styling highlights the active combatant and subdues the board during enemy actions');
assert(styles.includes('@keyframes turnCuePulse')&&styles.includes('@media(prefers-reduced-motion:reduce)'),'turn change pulse respects reduced-motion preferences');
assert(src.includes("const reducedMotion=()=>motionOff||window.matchMedia('(prefers-reduced-motion: reduce)').matches"),'old board still respects reduced-motion preferences');
assert(src.includes('const MOTION={swap:170,pop:190,flight:340,settle:440};'),'combat uses the exact pre-visual-overhaul motion budget');
assert(!src.includes('function ensureBoardCells(){')&&!src.includes('function renderBoard(){'),'old board renderer rebuilds the board directly instead of using the later persistent renderer');
assert(src.includes("function render(){renderStatuses();boardEl.innerHTML='';"),'actual old board render path is restored');
assert(src.includes('async function fightEntrance(){}'),'later 64-gem fight entrance is removed');
assert(!styles.includes('PRESTIGE PUZZLE BOARD')&&!styles.includes('MOBILE ORIGINAL-FIDELITY BOARD'),'all later board override layers stay removed');
assert(styles.includes('.boardShell{border-radius:6px;border:2px solid #8e7447;background:#15140f'),'old board frame styling is restored exactly');
assert(styles.includes('.board{gap:4px}.cell{border-radius:4px;background:linear-gradient(145deg,#2c2b23,#1b1c17)'),'old board sockets are restored exactly');
assert(styles.includes('.gem{border-radius:14%;box-shadow:inset 3px 3px 0 #ffffff55'),'old gem material treatment is restored exactly');
assert(src.includes("boardEl.addEventListener('pointermove',event=>{if(swipeStart)updateSwipePreview(event)});"),'old direct swipe input path is restored');
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
src=src.replace("showScreen('splash');",`globalThis.api={drawShop,openWorldSkills,drawSkills,selectSkillNode,liquidChargeGem,renderSlots,openDialogue,storyHide,renderStarterWeapons,confirmStarterWeapon,chooseTestWeapon:id=>{activeStory.gemId=id;renderStarterWeapons()},getStory:()=>activeStory,getAccount:()=>account,syncAccountLoadout,setToken:v=>accountToken=v,selectSackGem,equipSackGemToSlot,bindSackDrag,drawSack,buyShopItemClient,confirmShopPurchase,closePurchaseConfirmation,setShop:v=>currentShop=v,getPurchase:()=>pendingPurchase,getPickedGem:()=>selectedSackGem,nextRng:()=>combatRng(),enemyMove,restoreCombatMatch,showScreen,enterWorld,getScreen:()=>screen,setHintDelay:v=>hintDelay=v,CONSUMABLES,ITEMS,GEAR,EQUIPMENT_SLOTS,WORLD_NODES,worldCanTravel,worldPath,worldRoutePoint,worldCleared,sackIsValid,gearStats,playerMaxHP,matchPower,reservoirCap,canEquipGear,equipGear,unequipGear,getEquipment:()=>({...equipment}),resetEquipment:()=>{equipment={...DEFAULT_EQUIPMENT}},setInventory:v=>inventory=v.slice(),setTestAccount:v=>account=v,setWorldClears:v=>worldState.clearedEncounters=v.slice(),applyTarget,afterAction,fallColumns,reshuffleBoard,touchActivity,showHint,damagePlayer,findMatches,legalMoves,reservoirCap,enemyUseActive,setEnemyReady:color=>ec[color]=enemyReservoir(color).cap,startFight:()=>{startFight();activeAuthority={mode:'replay-v3'};eHP=enemyMaxHP();shownHP.e=eHP;render()},applyColor,activate,trySwap,tapCell,beginCombatMove,recordBrokenGems,recordComboCharge,getCombatHistory:()=>combatHistory.map(v=>({...v,breaks:{...v.breaks}})),combatEffectRows,get:()=>({charges,ec,sack,pHP,eHP,pGuard,eGuard,freeSwap,overdrive,playerTurn,board,buffs,enemyEffects,pinColumn,pinTurns,guardTurns,evadeTurns,actionNumber,targetMode,armedAbilitySlot}),setHP:v=>pHP=v,setEnemyCharge:(color,n)=>ec[color]=n,setEnemyHP:v=>eHP=v,setGuard:v=>eGuard=v,setBoard:v=>{board=v;boardBonus=v.map(row=>row.map(()=>0));render()},setBonus:(x,y,n)=>{boardBonus[y][x]=n;render()},setExtraTurn:()=>{extraTurn=true},setSeed:(seed,mode='replay-v2')=>{activeAuthority={mode,seed};combatRng=makeCombatRng(seed)},buildBoard,getBonus:()=>boardBonus.map(row=>row.slice()),setTurn:v=>playerTurn=v,setSack:v=>sack=v,setReady:i=>{charges[itemById(sack[i]).color]=itemById(sack[i]).cap;playerTurn=true;pHP=10},finish:async()=>{await Promise.all(damageAnimations.splice(0))}};showScreen('splash');`);
src=src.replace('setEnemyReady:color=>','setEncounter:id=>activeEncounter=id,enemyIntent,setEnemyReady:color=>');
src=src.replace('setEnemyReady:color=>','drawInventory,worldItemGroups,setInventoryItems:v=>inventoryItems=v.slice(),setEnemyReady:color=>');
const scheduled=new Map();let nextTimer=1;
const c={document,window:{matchMedia:()=>({matches:true}),GEMMO_API:null},location:{hostname:'captainpwilly.github.io'},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>{throw new Error('fetch not expected in combat tests')},setTimeout:(fn,ms)=>{const id=nextTimer++;scheduled.set(id,{fn,ms});return id},clearTimeout:id=>scheduled.delete(id),console};vm.runInNewContext(weaponRules,c);vm.runInNewContext(colorBalance,c);vm.runInNewContext(content,c);vm.runInNewContext(encounterDefs,c);vm.runInNewContext(fs.readFileSync(path.join(root,"shared/enemy-loadouts.js"),"utf8"),c);vm.runInNewContext(combatRules,c);vm.runInNewContext(progressionDefs,c);vm.runInNewContext(storyDefs,c);vm.runInNewContext(combatCore,c);
assert.deepEqual(Array.from(c.GEMMO_CONTENT.TYPES),['red','blue','green','yellow','purple','gold','xp'],'generated board has five colors, Gold and XP only; Wild remains forged');
const progressionCatalog=c.GEMMO_PROGRESSION;assert.deepEqual([progressionCatalog.xpForLevel(2),progressionCatalog.xpForLevel(3),progressionCatalog.xpForLevel(4),progressionCatalog.xpForLevel(5)],[20,45,75,110]);assert.equal(progressionCatalog.BRANCHES.length,6);assert.equal(progressionCatalog.SKILLS.length,23);assert.equal(progressionCatalog.BRANCHES.flatMap(b=>b.nodes).reduce((n,s)=>n+s.maxRank,0),42,'visible tree supports 42 total point investments including charge Resonance');assert.equal(progressionCatalog.skillRank('red-cap-1',['red-cap-1','red-cap-1@2']),2);assert.equal(progressionCatalog.canPurchase('red-start',[],3).reason,'skill_prerequisite');assert.equal(progressionCatalog.canPurchase('red-start',['red-cap-1'],3).ok,true);const progressionEffects=progressionCatalog.skillEffects(['neutral-vitality','neutral-vitality@2','red-cap-1','red-cap-1@2','red-start']);assert.equal(progressionEffects.maxHP,4);assert.equal(progressionEffects.caps.red,2);assert.equal(progressionEffects.startCharge.red,1);
const storyCatalog=c.GEMMO_STORY;assert.equal(storyCatalog.NPCS['warden-vale'].node,'camp');assert.equal(storyCatalog.QUESTS['trouble-on-road'].objective.encounterId,'rat');assert.equal(storyCatalog.CUTSCENES['brackenreach-arrival'].slides.length,3);
const encounterCatalog=c.GEMMO_ENCOUNTERS;assert.deepEqual(Object.keys(encounterCatalog),['rat','bandit','sentinel','troll']);assert.equal(encounterCatalog.rat.maxHP,10);assert.equal(encounterCatalog.bandit.maxHP,32);assert.equal(encounterCatalog.bandit.actives.length,5);assert.equal(encounterCatalog.bandit.reward.gold.join(','),'18,24');assert.equal(encounterCatalog.sentinel.actives[0].kind,'drain');
const core=c.GEMMO_COMBAT_CORE,rngA=core.makeRng(1337),rngB=core.makeRng(1337);
assert.deepEqual([rngA(),rngA(),rngA()],[rngB(),rngB(),rngB()],'combat-core RNG is deterministic');
const coreBoard=Array.from({length:8},()=>Array(8).fill('blue'));for(let y=0;y<8;y++)for(let x=0;x<8;x++)coreBoard[y][x]=(x+y)%2?'blue':'red';coreBoard[0][0]='red';coreBoard[0][1]='wild';coreBoard[0][2]='red';
assert(core.findMatches(coreBoard,['red','blue']),'combat-core Wild participates in a colored match');
vm.runInNewContext(src,c);const a=c.api;
a.setTestAccount({profile:{xp:45},skills:{purchased:['red-cap-1'],availablePoints:2}});a.drawSkills();assert(es.get('skillTree').innerHTML.includes('skillTreeEdges')&&es.get('skillTree').innerHTML.includes('skillTreeLink lit'));assert.equal((es.get('skillTree').innerHTML.match(/data-skill=/g)||[]).length,23);a.selectSkillNode('red-start');assert.equal(es.get('skillLearn').disabled,false,'one parent rank opens the next node');assert(es.get('skillDetailEffect').textContent.includes('1 Red charge'));a.selectSkillNode('red-resonance');assert.equal(es.get('skillLearn').disabled,true);assert(es.get('skillDetailRequirement').textContent.includes('Deep Ember'));a.selectSkillNode('red-cap-1');assert.equal(es.get('skillLearn').textContent,'UPGRADE · ✦ 1','extra ranks remain optional');
a.openWorldSkills();assert.equal(a.getScreen(),'skills','Skills button opens the tree immediately');
a.setTestAccount({needsStarter:false,inventory:a.ITEMS.map(i=>i.id),profile:{level:1,xp:0,gold:0},user:{username:'TestHero'}});
a.setTestAccount({needsCharacterName:true,inventory:['dagger'],profile:{level:1,xp:0,gold:0},user:{username:'Unnamed'}});a.enterWorld();assert.equal(a.getScreen(),'character','unnamed accounts must name their character before the map');a.showScreen('menu');assert.equal(a.getScreen(),'character','menu cannot bypass character registration');a.setTestAccount({needsCharacterName:false,character:{name:'Perevan'},inventory:a.ITEMS.map(i=>i.id),profile:{level:1,xp:0,gold:0},user:{username:'TestHero'}});

// Selection and drag-drop share exactly the same destination-aware equip operation.
a.setSack(['dagger','shield',null,null,null]);a.selectSackGem('knife');assert.equal(a.getPickedGem(),'knife');assert.equal(a.get().sack[0],'dagger','selecting a gem waits for a destination');assert.equal(a.equipSackGemToSlot('knife',1),true);assert.equal(a.get().sack[1],'knife');assert.equal(a.get().sack[0],'shield','regular gem is preserved in the old weapon slot');assert.equal(a.getPickedGem(),null);
assert.equal(a.equipSackGemToSlot('shield',4),true);assert.equal(a.get().sack[4],'shield');assert.equal(a.get().sack.filter(id=>id==='shield').length,1,'moving an equipped gem cannot duplicate it');
a.showScreen('sack');c.document.body=new El();const dropSlot=new El();dropSlot.dataset.index='3';c.document.elementFromPoint=()=>({closest:()=>dropSlot});const dragCard=new El();dragCard.dataset.item='dagger';a.bindSackDrag(dragCard);dragCard.onpointerdown({pointerType:'touch',pointerId:7,clientX:0,clientY:0,target:{closest:()=>({})}});dragCard.onpointermove({pointerId:7,clientX:30,clientY:40,preventDefault(){}});dragCard.onpointerup({pointerId:7,clientX:30,clientY:40,preventDefault(){}});assert.equal(a.get().sack[3],'dagger','touch drag drops into the exact requested slot');assert.equal(a.get().sack.filter(c.GEMMO_WEAPON_GEMS.isWeaponGem).length,1,'drag preserves the one-weapon limit');
a.setSack(['dagger',null,null,null,null]);
const bonusRules=c.GEMMO_COMBAT_RULES;
assert.equal(bonusRules.BONUS_SPAWN_DENOMINATOR,20,'a single shared rate controls rare enhanced gem spawns');
assert.equal(bonusRules.rollGemBonus(()=>0),1);assert.equal(bonusRules.rollGemBonus(()=>.99),0);
const seeded=serverCombat.createRatCombat({seed:101,sack:['dagger',null,null,null,null],rewardBudget:{gold:12,xp:12}});
a.setSeed(101);a.buildBoard();assert.equal(JSON.stringify(a.get().board),JSON.stringify(seeded.board),'browser and replay draw the same gem colors');assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(seeded.bonus),'browser and replay draw the same enhanced gems');
const legacy=serverCombat.createRatCombat({seed:101,version:'replay-v1',sack:['dagger',null,null,null,null]});assert(legacy.bonus.flat().every(v=>v===0),'existing proofs use their original unenhanced board');
const bonusGrid=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));a.setBoard(bonusGrid);a.setBonus(1,1,1);assert(es.get('board').children[9].innerHTML.includes('chargedGem'),'enhanced gems keep the old charged-gem class');assert(es.get('board').children[9].events.click,'enhanced gems remain playable');
const comboRules=c.GEMMO_COMBAT_RULES;assert.equal(comboRules.comboChargeTypes({red:3,gold:3,blue:4}).join(','),'red,blue','only opening colored gems anchor cascade charge');assert.equal(comboRules.comboChargeBonus(1),1);assert.equal(comboRules.comboChargeBonus(2),2);assert.equal(comboRules.comboChargeBonus(0),0);
a.beginCombatMove('player','MATCH');a.recordBrokenGems({red:3,gold:4,wild:1});let visualHistory=a.getCombatHistory();assert.equal(visualHistory.length,1);assert.equal(visualHistory[0].label,'MATCH');assert.equal(visualHistory[0].breaks.red,3);assert.equal(visualHistory[0].breaks.gold,4);assert.equal(visualHistory[0].breaks.wild,1);
a.recordComboCharge(['red'],1,2);visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,4,'combo 2 charges the opening red value by +1');assert.equal(visualHistory[0].comboDepth,2);
a.recordComboCharge(['red'],2,3);visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,6,'combo 3 charges the opening red value by +2');assert.equal(visualHistory[0].comboDepth,3);
a.recordBrokenGems({red:4,blue:3});visualHistory=a.getCombatHistory();assert.equal(visualHistory[0].breaks.red,10,'actual cascade breaks still add their own value');assert.equal(visualHistory[0].anchorGrowth.red,3,'cascade anchors retain cumulative growth across history redraws');assert.equal(visualHistory[0].breaks.blue,3);
assert(Array.isArray(a.combatEffectRows()),'current combat effects are derived as structured rows');

(async()=>{
a.setSack(['dagger','shield',null,null,null]);a.startFight();a.setSeed(101);a.buildBoard();
const replayPair=serverCombat.createRatCombat({seed:101,sack:['dagger','shield',null,null,null],rewardBudget:{gold:20,xp:20}});
assert.equal(JSON.stringify(a.get().board),JSON.stringify(replayPair.board),'same starting board for full replay');assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(replayPair.bonus),'same starting bonus for full replay');const firstMove=a.legalMoves()[0];assert(firstMove);a.setExtraTurn();replayPair.extraTurn=true;await a.trySwap(firstMove[0],firstMove[1],'player');
assert.equal(serverCombat.applyCombatAction(replayPair,{t:'swap',ax:firstMove[0].x,ay:firstMove[0].y,bx:firstMove[1].x,by:firstMove[1].y}),true);
assert.equal(JSON.stringify(a.get().board),JSON.stringify(replayPair.board),'browser and replay retain identical colors after a full move and cascade');
assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(replayPair.bonus),'enhancements move and refill identically after a full move');
assert.equal(JSON.stringify(a.get().charges),JSON.stringify(replayPair.charges),'enhanced move yields matching reservoir charge');
 const cases={dagger:[10,18,0],axe:[10,16,0],spear:[10,21,3],shield:[10,24,6],buckler:[10,21,3],ward:[12,24,3],salve:[15,24,0],poultice:[13,24,0],briar:[12,21,0],boots:[10,24,0],cloak:[10,24,5],knife:[10,23,0],charm:[10,24,0],seal:[10,16,0],relic:[14,24,4]};
 Object.assign(cases,{"arming-sword":[10,17,0],"warhammer":[10,14,0],"longbow":[10,19,0],"rapier":[10,21,3],"halberd":[10,15,0],"hand-crossbow":[10,21,0],"flail":[10,16,0],"tower-shield":[10,24,10],"swordbreaker":[10,24,0],"quarterstaff":[10,24,4],"pavise":[10,24,8],"war-pick":[10,22,0],"kite-shield":[12,24,3],"hook-spear":[10,24,7],"sickle":[12,21,0],"druid-staff":[18,24,0],"hunting-bow":[10,24,0],"thorn-whip":[10,20,0],"grove-spear":[12,24,3],"woodland-club":[10,24,6],"willow-wand":[12,24,0],"twin-knives":[10,17,0],"light-crossbow":[10,18,0],"sling":[10,22,0],"duelist-sabre":[10,21,3],"glaive":[10,16,0],"parrying-dagger":[10,24,3],"javelin":[10,15,0],"rune-blade":[10,17,0],"hex-staff":[10,24,0],"relic-mace":[14,24,4],"moon-scythe":[12,21,0],"crystal-wand":[10,20,0],"spell-tome":[12,24,3],"ritual-dagger":[10,21,3]});
 Object.assign(cases,{"bloodstone-whet":[10,24,0],"bastion-sigil":[10,24,0],"heartseed":[10,24,0],"gamblers-thread":[10,24,0]});
 assert.equal(a.ITEMS.length,77);assert.equal(new Set(a.ITEMS.map(i=>i.id)).size,77);const starterWand=a.ITEMS.find(i=>i.id==='crystal-wand');assert.equal(starterWand.color,'blue');assert.equal(starterWand.kind,'damage');assert.equal(starterWand.power,4);
 const effectIds=['executioners-axe','barbed-blade','mirror-shield','binding-chain','healing-potion','purifying-tonic','locksmith-pick','powder-bomb','chaos-orb','void-flask'];
 for(const id of effectIds)assert(a.ITEMS.some(i=>i.id===id),id+' exists in expanded effect catalog');
 assert(a.ITEMS.every(i=>i.effect===i.kind&&i.effectLabel&&i.role&&Number.isInteger(i.turnCost)),'every gem carries normalized effect metadata');
 assert(a.ITEMS.filter(i=>i.gemType==='weapon').every(i=>Number.isInteger(i.attack)&&i.attack>=1),'every weapon carries an Attack value');
 assert(a.ITEMS.filter(i=>i.gemType==='regular').every(i=>i.attack===0&&i.defense===0),'support gems have no hidden attack or Guard scaling');
 assert.equal(a.ITEMS.find(i=>i.id==='dagger').attack,1);assert.equal(a.ITEMS.find(i=>i.id==='warhammer').attack,2);assert.equal(a.ITEMS.find(i=>i.id==='shield').legacy.defense,2);assert.equal(a.ITEMS.find(i=>i.id==='tower-shield').legacy.defense,3);
 assert.equal(a.ITEMS.find(i=>i.id==='knife').turnCost,0,'Throwing Knife is a quick action');
 assert.equal(a.ITEMS.find(i=>i.id==='locksmith-pick').turnCost,0,'Locksmith Pick is a quick board action');
 assert.equal(a.sackIsValid(['dagger','shield','salve','boots','charm']),true,'five unique gems are a legal Sack');
 assert.equal(a.sackIsValid(['dagger','dagger','shield','salve','boots']),false,'exact duplicate gems are illegal');
 assert.equal(a.sackIsValid(['dagger',null,null,null,null]),true,'a level-1 one-gem Sack is legal');
 assert.equal(a.sackIsValid([null,null,null,null,null]),false,'zero-gem Sack cannot fight');
 a.setSack(['dagger',null,null,null,null]);a.startFight();assert.equal(a.get().sack.filter(Boolean).length,1,'one starter gem can enter combat');
 a.setSack([null,'crystal-wand',null,'salve',null]);a.renderSlots();let dock=es.get('slots').innerHTML;assert.equal((dock.match(/<button/g)||[]).length,2);assert(dock.includes('data-slot="1"')&&dock.includes('data-slot="3"'));assert(!dock.includes('Empty'));assert(dock.includes('blue, Arc Bolt')&&dock.includes('liquidChargeGem'));assert.equal(es.get('slots').style.gridTemplateColumns,'repeat(2,minmax(0,1fr))');
 const visualGem=a.ITEMS.find(v=>v.id==='crystal-wand');assert(a.liquidChargeGem(visualGem,1,0).includes('--liquid-to:64px'));assert(a.liquidChargeGem(visualGem,1,50).includes('--liquid-to:32px'));assert(a.liquidChargeGem(visualGem,1,100).includes('--liquid-to:0px'));assert(!dock.includes('slotChargeMeter'),'charge appears inside the gem rather than a separate bar');
 a.setReady(1);a.renderSlots();dock=es.get('slots').innerHTML;assert(dock.includes('<b>5/5</b>')&&dock.includes('ready to cast'),'full liquid gems retain accessible cast state and numerical charge');assert(dock.includes('--charge-fill:100%'));a.setSack(['dagger',null,null,null,null]);a.renderSlots();assert.equal((es.get('slots').innerHTML.match(/<button/g)||[]).length,1);
 assert.equal(a.sackIsValid(['dagger','spear','longbow','rapier','hand-crossbow']),false,'multiple weapons require an explicit slot effect');
 const wr=c.GEMMO_WEAPON_GEMS;
 for(const color of ['red','blue','green','yellow','purple'])assert(a.ITEMS.some(v=>v.color===color&&v.gemType==='weapon'),'each color has weapons');
 assert.equal(wr.weaponGemLimit(),1);assert.equal(wr.weaponGemLimit([{weaponGemSlots:1}]),2);
 assert.equal(wr.validWeaponGems(['dagger','knife'],[{weaponGemSlots:1}]),true);
 assert.equal(wr.validWeaponGems(['dagger','knife']),false);
 assert.equal(a.sackIsValid(['dagger','bloodstone-whet','shield','salve','charm']),true,'regular gems remain independent of weapon limit');
 assert.deepEqual(Array.from(wr.equipGem(['dagger','shield','salve',null,null],1,'knife')),['shield','knife','salve',null,null],'weapon switch honors the target slot and preserves displaced regular gems');
 assert.deepEqual(Array.from(wr.equipGem(['dagger','shield',null,null,null],2,'knife',[{weaponGemSlots:1}])),['dagger','shield','knife',null,null],'explicit effect allows second weapon');
 const smoothRoute=a.worldPath('gem-shop','shrine'),smoothStart=a.worldRoutePoint(smoothRoute,0),smoothMid=a.worldRoutePoint(smoothRoute,.5),smoothEnd=a.worldRoutePoint(smoothRoute,1);
 assert(Math.abs(smoothStart.x-a.WORLD_NODES['gem-shop'].x)<1e-9&&Math.abs(smoothStart.y-a.WORLD_NODES['gem-shop'].y)<1e-9,'route starts exactly at origin');assert(Math.abs(smoothEnd.x-a.WORLD_NODES.shrine.x)<1e-9&&Math.abs(smoothEnd.y-a.WORLD_NODES.shrine.y)<1e-9,'route ends exactly at destination');assert(smoothMid.travelled>0&&smoothMid.travelled<smoothMid.total,'full-route interpolation advances continuously between endpoints');
 assert.equal(a.worldCanTravel('camp','crossroads'),true);assert.equal(a.worldCanTravel('camp','gem-shop'),true);assert.equal(a.worldCanTravel('camp','item-shop'),false);assert.equal(a.worldCanTravel('camp','bandit-pass'),false);assert.equal(a.worldCanTravel('crossroads','rat'),true);assert.equal(a.worldCanTravel('crossroads','bandit-pass'),false);assert.equal(a.worldCanTravel('rat','bandit-pass'),false);assert.equal(JSON.stringify(a.worldPath('gem-shop','shrine')),JSON.stringify(['gem-shop','camp','crossroads','shrine']));assert.equal(JSON.stringify(a.worldPath('camp','rat')),JSON.stringify(['camp','crossroads','rat']));assert.equal(a.worldPath('camp','bandit-pass'),null);assert.equal(a.WORLD_NODES.rat.encounter,'rat');assert.equal(a.WORLD_NODES['bandit-pass'].encounter,'bandit');a.setWorldClears(['rat']);assert.equal(a.worldCanTravel('rat','bandit-pass'),true);assert.equal(JSON.stringify(a.worldPath('gem-shop','bandit-pass')),JSON.stringify(['gem-shop','camp','crossroads','rat','bandit-pass']));a.setWorldClears([]);
 // Every starter's color attacks in both the browser and authoritative replay.
 for(const id of wr.STARTER_WEAPON_IDS){
  const item=a.ITEMS.find(g=>g.id===id),loadout=[id,null,null,null,null];
  a.setSack(loadout);a.startFight();a.setSeed(123,'replay-v3');a.buildBoard();a.setEnemyHP(100);
  const state=serverCombat.createCombat({seed:123,sack:loadout,version:'replay-v3'});state.eHP=100;
  assert.equal(JSON.stringify(a.get().board),JSON.stringify(state.board),'v3 keeps deterministic board generation');
  for(const color of ['red','blue','green','yellow','purple']){
   const before=a.get().eHP; a.applyColor(color,3,'player');serverCombat.applyColor(state,color,3,'player');
   assert.equal(before-a.get().eHP,color===item.color?3:0,id+' only its color deals match damage');
   assert.equal(a.get().eHP,state.eHP,id+' browser/server damage agrees');
   assert.equal(a.get().pGuard,state.pGuard,id+' browser/server Guard agrees');
  }
  assert.equal(a.get().charges[item.color],3,id+' matching weapon color charges its ability');await a.finish();
 }
 a.setSack(['crystal-wand',null,null,null,null]);a.startFight();a.setSeed(123,'replay-v2');a.setEnemyHP(100);a.applyColor('blue',3,'player');assert.equal(a.get().eHP,100,'saved v2 fights retain old damage rules');await a.finish();
 a.setSeed(123,'replay-v3');a.setSack(['bloodstone-whet',null,null,null,null]);a.startFight();a.setEnemyHP(100);a.applyColor('red',3,'player');assert.equal(a.get().eHP,100,'support gem alone cannot select a damage color');await a.finish();
 a.setSack(['dagger','bloodstone-whet',null,null,null]);a.startFight();a.setEnemyHP(100);a.applyColor('red',3,'player');assert.equal(a.get().eHP,94,'same-color support boosts the weapon');await a.finish();
 // Latest color roles: equal starter charge budgets and distinct active effects.
 a.setEncounter('rat');
 for(const id of wr.STARTER_WEAPON_IDS){
  const loadout=[id,null,null,null,null];a.setTestAccount({skills:{purchased:[]},inventory:a.ITEMS.map(g=>g.id),profile:{level:1,xp:0,gold:0}});
  a.setSack(loadout);a.startFight();a.setSeed(123,'replay-v4');a.buildBoard();
  const state=serverCombat.createCombat({seed:123,sack:loadout,version:'replay-v4'});
  const color=a.ITEMS.find(g=>g.id===id).color;assert.equal(a.reservoirCap(color),7,id+' has the same starter charge budget');
  a.applyColor(color,3,'player');serverCombat.applyColor(state,color,3,'player');assert.equal(a.get().eHP,state.eHP);assert.equal(a.get().pGuard,0,'weapon matches do not grant hidden Guard');
  a.setHP(10);state.pHP=10;a.setGuard(4);state.eGuard=4;a.setEnemyCharge('blue',4);state.ec.blue=4;a.setReady(0);state.charges[color]=7;a.setExtraTurn();state.extraTurn=true;
  a.activate(0);assert(serverCombat.applyCombatAction(state,{t:'ability',slot:0}));await a.finish();
  for(const key of ['pHP','eHP','pGuard','playerTurn'])assert.equal(a.get()[key],state[key],id+' distinct ability parity '+key);
  assert.equal(JSON.stringify(a.get().enemyEffects),JSON.stringify(state.enemyEffects));assert.equal(JSON.stringify(a.get().charges),JSON.stringify(state.charges));
 }
 for(const id of ['cloak','seal','spell-tome','relic','powder-bomb']){
  const loadout=['dagger',id,null,null,null];a.setTestAccount({skills:{purchased:[]},inventory:a.ITEMS.map(g=>g.id),profile:{level:1,xp:0,gold:0}});a.setSack(loadout);a.startFight();a.setSeed(123,'replay-v4');a.buildBoard();a.setHP(10);a.setEnemyHP(100);a.setEnemyCharge('blue',4);a.setGuard(8);
  const state=serverCombat.createCombat({seed:123,sack:loadout,version:'replay-v4'});state.pHP=10;state.eHP=100;state.ec.blue=4;state.eGuard=8;
  const gem=a.ITEMS.find(g=>g.id===id);a.setReady(1);state.charges[gem.color]=gem.cap;a.setExtraTurn();state.extraTurn=true;a.activate(1);assert(serverCombat.applyCombatAction(state,{t:'ability',slot:1}));
  if(id==='powder-bomb'){await a.applyTarget({x:2,y:2});assert(serverCombat.applyCombatAction(state,{t:'target',x:2,y:2}));}
  await a.finish();for(const key of ['pHP','eHP','pGuard','eGuard','playerTurn'])assert.equal(a.get()[key],state[key],id+' latest support parity '+key);assert.equal(JSON.stringify(a.get().charges),JSON.stringify(state.charges));assert.equal(JSON.stringify(a.get().enemyEffects),JSON.stringify(state.enemyEffects));
 }
 const roleSkills=['red','blue','green','yellow','purple'].flatMap(c=>[c+'-cap-1',c+'-start']);
 const roleSack=['dagger','shield','healing-potion','locksmith-pick','chaos-orb'];
 a.setTestAccount({skills:{purchased:roleSkills},inventory:a.ITEMS.map(g=>g.id),profile:{level:10,xp:200,gold:0}});a.setSack(roleSack);a.startFight();a.setSeed(123,'replay-v4');a.buildBoard();a.setHP(10);a.setEnemyHP(100);a.setEnemyCharge('blue',2);
 const roleState=serverCombat.createCombat({seed:123,sack:roleSack,skills:roleSkills,version:'replay-v4'});roleState.pHP=10;roleState.eHP=100;roleState.ec.blue=2;
 for(let round=0;round<2;round++)for(const color of ['red','blue','green','yellow','purple']){a.applyColor(color,3,'player',round);serverCombat.applyColor(roleState,color,3,'player');for(const key of ['pHP','eHP','pGuard'])assert.equal(a.get()[key],roleState[key],color+' support skill parity');assert.equal(JSON.stringify(a.get().charges),JSON.stringify(roleState.charges));}
 assert.equal(a.get().pHP,11,'Green perk heals only once per action');assert.equal(a.get().pGuard,1,'Blue perk grants only once per action');await a.finish();
 a.setReady(4);roleState.charges.purple=6;roleState.pHP=10;a.setExtraTurn();roleState.extraTurn=true;a.activate(4);assert(serverCombat.applyCombatAction(roleState,{t:'ability',slot:4}));
 await a.applyTarget({x:2,y:2});assert(serverCombat.applyCombatAction(roleState,{t:'target',x:2,y:2}));await a.finish();
 assert.equal(JSON.stringify(a.get().board),JSON.stringify(roleState.board),'Chaos Orb converts to the weapon color with replay parity');assert.equal(a.get().eHP,roleState.eHP);assert.equal(a.get().pHP,roleState.pHP);
 a.setTestAccount({inventory:a.ITEMS.map(g=>g.id),profile:{level:1,xp:0,gold:0},skills:{purchased:[]}});
 a.setEncounter('bandit');
 // Legacy ability fixtures intentionally combine weapons; grant their explicit test effect.
 a.GEAR.push({id:'test-dual-ring',slot:'ring',weaponGemSlots:4});a.setInventory(['test-dual-ring']);a.equipGear('ring1','test-dual-ring');
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
 const pinned=grid();pinned[7][0]='';pinned[3][4]='red';pinned[3][5]='blue';pinned[3][6]='red';pinned[2][5]='red';const survivor=pinned[6][0];a.setBoard(pinned);await a.fallColumns();assert.equal(a.get().board[6][0],survivor);assert(a.get().board[7][0]);a.afterAction('enemy');assert.equal(a.get().pinTurns,0);const dropping=grid();dropping[7][1]='';dropping[0][1]='red';dropping[1][2]='red';a.setBoard(dropping);a.setBonus(1,6,1);await a.fallColumns();assert.equal(a.getBonus()[7][1],1,'enhanced gem falls with its value');
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
 a.GEAR.splice(a.GEAR.findIndex(g=>g.id==='test-dual-ring'),1);a.resetEquipment();
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
 a.setEncounter('sentinel');a.startFight();assert.equal(a.get().eHP,30);assert(a.enemyIntent().text.includes('BUILDING'));
 a.get().charges.red=5;a.get().charges.blue=4;a.setEnemyReady('purple');assert(a.enemyIntent().text.includes('READY · SIPHON'));
 assert.equal(a.enemyUseActive(),true);assert.equal(a.get().charges.red,2,'browser Siphon drains the same fullest reservoir as replay');assert.equal(a.get().charges.blue,4);

 a.setTestAccount({user:{id:17,username:'Collector'},inventory:['dagger','padded-tunic','minor-healing-draught'],profile:{level:1,xp:0,gold:0}});
 a.setInventory(['padded-tunic']);a.setInventoryItems([{id:'dagger',kind:'gem',qty:1},{id:'padded-tunic',kind:'gear',qty:1},{id:'minor-healing-draught',kind:'consumable',qty:2}]);
 a.drawInventory();assert(es.get('inventoryGrid').innerHTML.includes('Padded Tunic'));assert(es.get('inventoryGrid').innerHTML.includes('Minor Healing Draught'));assert(!es.get('inventoryGrid').innerHTML.includes('Iron Dagger'),'owned gems do not render as Inventory cards');assert.equal(es.get('inventoryCount').textContent,'2 TYPES · ×3','Inventory count excludes gems');
 assert.equal(a.worldItemGroups().sack.join(','),'dagger');assert.equal(a.worldItemGroups().inventory.join(','),'padded-tunic,minor-healing-draught','gem purchase cannot light the Inventory new-item indicator');

 // A saved session restores once and lands on the world map without a menu tap.
 const restoredElements=new Map(),restoredDocument={getElementById(id){if(!restoredElements.has(id))restoredElements.set(id,new El());return restoredElements.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
 const savedAccount={user:{id:7,username:'Returning'},profile:{level:1,xp:0,gold:0},skills:{purchased:[],availablePoints:1},sack:['dagger',null,null,null,null],equipment:{},inventory:['dagger'],inventoryItems:[{id:'dagger',kind:'gem',qty:1}],world:{region:'brackenreach',currentNode:'camp',clearedEncounters:[]},quests:[],story:{seenCutscenes:[]}};
 const restored={document:restoredDocument,window:{matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>fn()},requestAnimationFrame:fn=>fn(),location:{hostname:'captainpwilly.github.io'},localStorage:{getItem:key=>key==='gemmo.session'?'saved-session':null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,removeItem(){}},fetch:async(url)=>{assert(url.endsWith('/v1/account'));return {ok:true,json:async()=>({account:savedAccount})}},setTimeout:()=>1,clearTimeout(){},console};
 for(const file of [weaponRules,colorBalance,content,encounterDefs,combatRules,progressionDefs,storyDefs,combatCore])vm.runInNewContext(file,restored);
 vm.runInNewContext(src.replace('setHintDelay:v=>hintDelay=v,','getScreen:()=>screen,setHintDelay:v=>hintDelay=v,'),restored);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(restored.api.getScreen(),'world','remembered login enters the map after account refresh');
 savedAccount.pendingMatch={matchId:'remembered-fight',encounterId:'rat'};const pendingLogin={...restored};for(const file of [weaponRules,colorBalance,content,encounterDefs,combatRules,progressionDefs,storyDefs,combatCore])vm.runInNewContext(file,pendingLogin);vm.runInNewContext(src,pendingLogin);await new Promise(resolve=>setImmediate(resolve));assert.equal(pendingLogin.api.getScreen(),'resume','remembered login offers Resume or Surrender for a saved fight');


 // A saved server state restores both the board and the exact RNG position.
 for(const {version,sack:resumeSack} of [{version:'replay-v2',sack:['dagger','shield',null,null,null]},...['replay-v3','replay-v4','replay-v5','replay-v6'].flatMap(version=>wr.STARTER_WEAPON_IDS.map(id=>({version,sack:[id,null,null,null,null]})))]){
 const resumeSeed=143,resumeServer=serverCombat.createRatCombat({version,seed:resumeSeed,sack:resumeSack,rewardBudget:{gold:12,xp:12}}),resumeTranscript=[];
 const rm=serverCombat.suggestCombatAction(resumeServer);resumeTranscript.push(rm);serverCombat.applyCombatAction(resumeServer,rm);
 const recovered=serverCombat.replayCombatTranscript({version,seed:resumeSeed,sack:resumeSack,rewardBudget:{gold:12,xp:12},transcript:resumeTranscript});
 a.restoreCombatMatch({matchId:'resume-test-match',encounterId:'rat',authority:{mode:version,seed:resumeSeed},rewardBudget:{gold:12,xp:12},transcript:resumeTranscript,state:JSON.parse(JSON.stringify(recovered))});
 assert.equal(JSON.stringify(a.get().board),JSON.stringify(resumeServer.board),'resume restores the exact board');assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(resumeServer.bonus),'resume restores charged gems');assert.equal(a.get().pHP,resumeServer.pHP);assert.equal(a.get().eHP,resumeServer.eHP);
 if(resumeServer.pHP>0&&resumeServer.eHP>0){const mv=serverCombat.legalMoves(resumeServer)[0];await a.trySwap(mv[0],mv[1],'player');if(!a.get().playerTurn)await a.enemyMove();serverCombat.applyCombatAction(resumeServer,{t:'swap',ax:mv[0].x,ay:mv[0].y,bx:mv[1].x,by:mv[1].y});assert.equal(JSON.stringify(a.get().board),JSON.stringify(resumeServer.board),'next resumed move keeps RNG parity');assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(resumeServer.bonus));assert.equal(a.get().pHP,resumeServer.pHP);assert.equal(a.get().eHP,resumeServer.eHP)}

 }

 // Current NPC loadouts: run real client actions against server replay for every starter and encounter.
 for(const version of ['replay-v5','replay-v6','replay-v7'])for(const encounterId of (version!=='replay-v5'?['rat','bandit','sentinel','troll']:['rat','bandit','sentinel']))for(const weaponId of wr.STARTER_WEAPON_IDS)for(const seed of [7,23,81]){
  const loadout=[weaponId,'shield','healing-potion',null,null],state=serverCombat.createCombat({encounterId,seed,version,sack:loadout,rewardBudget:{gold:30,xp:30}});
  a.restoreCombatMatch({matchId:'npc-parity',encounterId,authority:{mode:version,seed},rewardBudget:state.rewardBudget,transcript:[],state:JSON.parse(JSON.stringify({...state,rngCalls:state.rng.calls()}))});
  for(let step=0;step<15&&state.pHP>0&&state.eHP>0;step++){
   const action=serverCombat.suggestCombatAction(state);if(!action)break;
   if(action.t==='swap')await a.trySwap({x:action.ax,y:action.ay},{x:action.bx,y:action.by},'player');
   else if(action.t==='ability')a.activate(action.slot);
   else if(action.t==='target')await a.applyTarget({x:action.x,y:action.y});
   let turns=0;while(!a.get().playerTurn&&a.get().pHP>0&&a.get().eHP>0){assert(turns++<100,'enemy extra turns settle');await a.enemyMove()}
   assert(serverCombat.applyCombatAction(state,action));await a.finish();
   const actual=a.get();for(const key of ['board','charges','ec','pHP','eHP','pGuard','eGuard','guardTurns','evadeTurns','playerTurn','buffs','enemyEffects'])assert.equal(JSON.stringify(['pHP','eHP'].includes(key)?Math.max(0,actual[key]):actual[key]),JSON.stringify(['pHP','eHP'].includes(key)?Math.max(0,state[key]):state[key]),encounterId+' '+weaponId+' seed '+seed+' step '+step+' '+key);
   assert.equal(JSON.stringify(a.getBonus()),JSON.stringify(state.bonus));
  }
 }
 console.log('PASS: current NPC loadouts, all starter colors, charge spending, extra turns and replay parity across 165 seeded fights.');

 const paidBomb=serverCombat.createRatCombat({seed:88,sack:['dagger',null,null,null,null],consumables:{'cherry-bomb':1},rewardBudget:{gold:12,xp:12}});serverCombat.applyCombatAction(paidBomb,{t:'consume',itemId:'cherry-bomb'});
 a.restoreCombatMatch({matchId:'paid-bomb-resume',encounterId:'rat',authority:{mode:'replay-v2',seed:88},rewardBudget:{gold:12,xp:12},transcript:[{t:'consume',itemId:'cherry-bomb'}],state:JSON.parse(JSON.stringify({...paidBomb,rngCalls:paidBomb.rng.calls()}))});
 await a.applyTarget({x:0,y:0});if(!a.get().playerTurn)await a.enemyMove();serverCombat.applyCombatAction(paidBomb,{t:'target',x:0,y:0});assert.equal(JSON.stringify(a.get().board),JSON.stringify(paidBomb.board),'saved paid bomb targets without a second purchase');assert.equal(a.get().pHP,paidBomb.pHP);assert.equal(a.get().eHP,paidBomb.eHP);

 const recruit={needsStarter:true,needsCharacterName:false,character:{name:'Recruit'},user:{id:30,username:'Recruit'},profile:{level:1,xp:0,gold:0},skills:{purchased:[],availablePoints:1},inventory:[],inventoryItems:[],sack:[null,null,null,null,null],equipment:{},world:{currentNode:'camp',clearedEncounters:[]}};
 a.setTestAccount(recruit);assert.equal(a.worldCanTravel('camp','crossroads'),false);assert.equal(a.openDialogue('warden-vale'),true);
 assert.equal((es.get('storyChoices').innerHTML.match(/data-starter-weapon=/g)||[]).length,5);assert(es.get('storyChoices').innerHTML.includes('CHARGE'));
 let claims=0;c.fetch=async(url,options)=>{claims++;assert(url.endsWith('/v1/account/starter'));assert.equal(JSON.parse(options.body).gemId,'crystal-wand');return {ok:true,json:async()=>({account:{...recruit,needsStarter:false,starter:'crystal-wand',inventory:['crystal-wand'],inventoryItems:[{id:'crystal-wand',kind:'gem',qty:1}],sack:['crystal-wand',null,null,null,null]}})}};
 a.chooseTestWeapon('crystal-wand');assert.equal(claims,0,'preview never claims a weapon');assert(es.get('storyChoices').innerHTML.includes('Take Crystal Wand'));
 await Promise.all([a.confirmStarterWeapon(),a.confirmStarterWeapon()]);assert.equal(claims,1);assert.equal(a.getAccount().needsStarter,false);assert.equal(a.get().sack[0],'crystal-wand');assert.equal(a.getStory(),null);assert.equal(a.worldCanTravel('camp','crossroads'),true);
 const gemStock=c.GEMMO_CONTENT.SHOP_STOCK['gem-shop'],serverStock=require('../server/catalog.cjs').SHOP_CATALOG['gem-shop'];
 assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(gemStock.map(entry=>[entry.id,entry.price])))),serverStock,'client/server gem stock and prices agree');
 assert(gemStock.every(entry=>!c.GEMMO_WEAPON_GEMS.isWeaponGem(entry.id)),'shop sells only non-weapon gems');
 a.setShop('gem-shop');a.drawShop();
 const shopMarkup=es.get('shopGrid').innerHTML;
 for(const entry of gemStock)assert(shopMarkup.includes('data-buy="'+entry.id+'"'),'shop renders '+entry.id);
 for(const id of c.GEMMO_WEAPON_GEMS.WEAPON_GEM_IDS)assert(!shopMarkup.includes('data-buy="'+id+'"'),'shop excludes '+id);
 assert.equal((shopMarkup.match(/shopColorSection /g)||[]).length,5,'shop renders every color without throwing');
 a.buyShopItemClient('bloodstone-whet');assert.equal(a.getPurchase().itemId,'bloodstone-whet');assert.equal(a.getPurchase().price,18);a.closePurchaseConfirmation();
 a.buyShopItemClient('ritual-dagger');assert.equal(a.getPurchase(),null,'weapons cannot open a purchase');

 const buyer={user:{id:9,username:'Buyer'},profile:{level:1,xp:0,gold:100},skills:{purchased:[],availablePoints:1},inventory:['dagger'],inventoryItems:[{id:'dagger',kind:'gem',qty:1}],sack:['dagger',null,null,null,null],equipment:{},world:{currentNode:'item-shop',clearedEncounters:[]}};a.setTestAccount(buyer);a.setShop('item-shop');
 let purchases=0;c.fetch=async(url,options)=>{assert(url.endsWith('/v1/shop/buy'));purchases++;const body=JSON.parse(options.body);assert.equal(body.itemId,'minor-healing-draught');return {ok:true,json:async()=>({account:{...buyer,profile:{...buyer.profile,gold:90}}})}};
 a.buyShopItemClient('minor-healing-draught');assert.equal(purchases,0,'opening confirmation never purchases');assert(es.get('purchaseEffects').textContent.length>0,'confirmation explains the item effect');assert(es.get('purchasePrice').textContent.includes('GOLD'),'confirmation shows the price');a.closePurchaseConfirmation();assert.equal(a.getPurchase(),null);assert.equal(purchases,0,'cancel spends nothing');a.buyShopItemClient('minor-healing-draught');await Promise.all([a.confirmShopPurchase(),a.confirmShopPurchase()]);assert.equal(purchases,1,'double confirm sends exactly one purchase');

 // Rapid edits are serialized; an old save response cannot overwrite the latest Sack.
 a.setTestAccount({...buyer,inventory:a.ITEMS.map(i=>i.id)});a.setToken('test-session');a.setSack(['dagger','shield',null,null,null]);let releaseSave,storedSack=null,sackWrites=[];
 c.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/v1/account/sack')){storedSack=body.sack;sackWrites.push(body.sack);if(sackWrites.length===1)await new Promise(resolve=>releaseSave=resolve);return {ok:true,json:async()=>({account:buyer})}}assert(url.endsWith('/v1/account/equipment'));return {ok:true,json:async()=>({account:{...buyer,sack:storedSack,equipment:body.equipment}})}};
 const firstSave=a.syncAccountLoadout();a.setSack(['dagger','salve',null,null,null]);const secondSave=a.syncAccountLoadout();assert.equal(firstSave,secondSave,'edits share one serialized save');releaseSave();assert.equal(await firstSave,true);assert.equal(sackWrites.length,2);assert.equal(storedSack[1],'salve','latest edit is persisted after an older response');assert.equal(a.get().sack[1],'salve','latest edit remains visible');a.setToken(null);
 console.log('PASS: 77 organized gems plus level-1 inventory/equipment, core color rules, Attunement cascade procs and expiry, timed effects, pinning, row rotation, Wild creation, recoloring, haste, siphon, Guard durations, hints, reshuffle preservation and swipe input.');
})().catch(e=>{console.error(e);process.exitCode=1});
