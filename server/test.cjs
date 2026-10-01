'use strict';
// geMMO server regression suite.
const assert=require('node:assert/strict');
const {createGemmoServer,defaultDbPath}=require('./server.cjs');
const {normalizeTursoConfig,remoteAdapter,applyDataMigrations,DATA_RESET_KEY,startMatch,moveWorld,buyShopItem,chooseStarterWeapon,seedAccount,accountSnapshot,registerCharacter}=require('./db.cjs');
const {DEFAULT_STARTER_GEM,CONSUMABLES,ENCOUNTERS}=require('./catalog.cjs');
const {QUESTS,NPCS,CUTSCENES}=require('../shared/story.js');
const {comboChargeTypes,comboChargeBonus,fullestChargeColor}=require('../shared/combat-rules.js');
const {xpForLevel,levelForXp,availableSkillPoints,skillEffects,skillRank,canPurchase,BRANCHES}=require('../shared/progression.js');
const {createRatCombat,createBanditCombat,createCombat,applyRatAction,suggestRatAction,applyCombatAction,suggestCombatAction,verifyBanditTranscript,verifyCombatTranscript,enemyMove,matchPower,applyCascadeCharge,applyColor}=require('./combat.cjs');

(async()=>{
  assert.equal(defaultDbPath({dbPath:':memory:'}),':memory:');
  assert.equal(DEFAULT_STARTER_GEM,'dagger','every account has the same Iron Dagger starter');assert.equal(Object.keys(CONSUMABLES).length,4,'four one-shot consumables exist');
  assert.deepEqual(Object.keys(ENCOUNTERS),['rat','bandit','sentinel'],'shared encounter catalog owns the current encounter set');
  assert.equal(ENCOUNTERS.rat.maxHP,10);assert.equal(ENCOUNTERS.bandit.maxHP,24);assert.deepEqual(ENCOUNTERS.bandit.reward,{gold:[18,24],xp:[12,18]});assert.equal(ENCOUNTERS.bandit.actives.length,5);
  assert.equal(NPCS['warden-vale'].node,'camp');assert.equal(QUESTS['trouble-on-road'].objective.encounterId,'rat');assert.equal(CUTSCENES['brackenreach-arrival'].slides.length,3);
  assert.deepEqual(comboChargeTypes({red:3,gold:4,blue:3}),['red','blue']);assert.equal(comboChargeBonus(1),1);assert.equal(comboChargeBonus(2),2);assert.equal(fullestChargeColor({red:4,blue:4,purple:2}),'red');assert.equal(fullestChargeColor({red:0,blue:0}),null);
  {
    const s=createCombat({encounterId:'sentinel',seed:12,sack:['dagger','shield',null,null,null],rewardBudget:{gold:32,xp:25}});
    assert.equal(s.eHP,30);s.charges.red=5;s.charges.blue=4;s.ec.purple=6;s.playerTurn=false;enemyMove(s);
    assert.equal(s.charges.red,2,'Siphon drains the fullest reservoir');assert.equal(s.charges.blue,4,'Siphon preserves other charge');assert.equal(s.ec.purple,0);
    assert.equal(verifyCombatTranscript({encounterId:'sentinel',seed:12,sack:['dagger','shield',null,null,null],rewardBudget:{gold:32,xp:25},transcript:[]}).won,false,'empty Sentinel proof cannot win');
    let victory=null;
    for(let seed=1;seed<=20&&!victory;seed++){
      const fight=createCombat({encounterId:'sentinel',seed,sack:['dagger','shield',null,null,null],rewardBudget:{gold:32,xp:25}}),transcript=[];
      for(let turn=0;turn<200&&fight.eHP>0&&fight.pHP>0;turn++){const action=suggestCombatAction(fight);if(!action)break;transcript.push(action);if(!applyCombatAction(fight,action))break}
      if(fight.eHP<=0&&transcript.length<=256)victory={seed,fight,transcript};
    }
    assert(victory,'Sentinel is winnable with a modest two-gem Sack');
    const replay=verifyCombatTranscript({encounterId:'sentinel',seed:victory.seed,sack:['dagger','shield',null,null,null],rewardBudget:{gold:32,xp:25},transcript:victory.transcript});
    assert.equal(replay.won,true);assert.equal(replay.gold,victory.fight.gold);assert.equal(replay.xp,victory.fight.xp);
  }
  const oldProof=createRatCombat({seed:101,version:'replay-v1',sack:['dagger',null,null,null,null]});
  const enhanced=createRatCombat({seed:101,sack:['dagger',null,null,null,null]});
  assert(oldProof.bonus.flat().every(v=>v===0),'old match proofs keep the original scoring rule');
  assert.notDeepEqual(enhanced.board,oldProof.board,'new bonus rolls advance the deterministic board stream');
  for(const [type,property] of [['red','eHP'],['blue','pGuard'],['gold','gold'],['xp','xp']]){
    const g=createRatCombat({seed:23,sack:['dagger','shield',null,null,null],rewardBudget:{gold:20,xp:20}});
    g.board=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple','gold','xp'][(x+y)%7]));
    g.bonus=g.board.map(row=>row.map(()=>0));
    g.board[0][0]=type;g.board[0][1]=type;g.board[0][2]='purple';g.board[1][2]=type;g.bonus[1][2]=1;
    const before=g[property];assert.equal(applyCombatAction(g,{t:'swap',ax:2,ay:1,bx:2,by:0}),true);
    assert(Math.abs(g[property]-before)>=4,'matching a '+type+' +1 tile scores at least four value');
    if(type==='red')assert(g.charges.red>=4,'enhanced Red also increases charge');
  }
  const rareTypes=new Set();for(let seed=1;seed<=80&&rareTypes.size<7;seed++){
    const g=createRatCombat({seed,sack:['dagger',null,null,null,null]});
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(g.bonus[y][x])rareTypes.add(g.board[y][x]);
  }
  assert.deepEqual([...rareTypes].sort(),['blue','gold','green','purple','red','xp','yellow'],'every naturally spawned gem type can carry +1');
  const moving=createRatCombat({seed:75,sack:['dagger',null,null,null,null]});
  moving.bonus=moving.board.map(row=>row.map(()=>0));moving.bonus[0][4]=1;moving.freeSwap=true;
  assert.equal(applyCombatAction(moving,{t:'swap',ax:4,ay:0,bx:5,by:0}),true);
  assert.equal(moving.bonus[0][5],1,'the bonus travels with a swapped tile');
  assert.deepEqual([xpForLevel(1),xpForLevel(2),xpForLevel(3),xpForLevel(4),xpForLevel(5)],[0,20,45,75,110]);assert.equal(levelForXp(44),2);assert.equal(levelForXp(45),3);assert.equal(availableSkillPoints(3,['red-cap-1']),2);assert.equal(availableSkillPoints(3,['red-cap-1','red-cap-1@2']),1);assert.equal(BRANCHES.length,6);assert.equal(BRANCHES.flatMap(b=>b.nodes).reduce((n,s)=>n+s.maxRank,0),42);assert.equal(skillRank('red-cap-1',['red-cap-1','red-cap-1@2']),2);assert.equal(canPurchase('red-start',[],3).reason,'skill_prerequisite');assert.equal(canPurchase('red-start',['red-cap-1'],3).ok,true);const skillTest=skillEffects(['neutral-vitality','neutral-vitality@2','neutral-bulwark','red-cap-1','red-cap-1@2','red-start']);assert.equal(skillTest.maxHP,4);assert.equal(skillTest.startGuard,1);assert.equal(skillTest.caps.red,2);assert.equal(skillTest.startCharge.red,1);const resonanceTest=skillEffects(['red-cap-1','red-cap-1@2','red-cap-1@3','red-start','red-cap-2','red-cap-2@2','red-resonance']);assert.equal(resonanceTest.chargeGain.red,1,'deep Red specialization grants +1 match charge');
  {
    const blank={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    const throughputGear={...blank,necklace:'bone-talisman'};const efficient=createRatCombat({seed:6,sack:['dagger',null,null,null,null],equipment:throughputGear,rewardBudget:{gold:0,xp:0}});applyColor(efficient,'red',3,'player',false);assert.equal(efficient.charges.red,4,'+1 Red charge gear turns a 3-match into 4 reservoir charge');const efficientDamage=10-efficient.eHP;assert.equal(efficientDamage,3,'charge efficiency does not increase Red match damage');
    const doubleEfficient=createRatCombat({seed:61,sack:['dagger',null,null,null,null],equipment:throughputGear,skills:['red-cap-1','red-cap-1@2','red-cap-1@3','red-start','red-cap-2','red-cap-2@2','red-resonance'],rewardBudget:{gold:0,xp:0}});doubleEfficient.charges.red=0;applyColor(doubleEfficient,'red',3,'player',false);assert.equal(doubleEfficient.charges.red,5,'gear and skill charge efficiency stack additively');
    const anchorEfficient=createRatCombat({seed:62,sack:['dagger',null,null,null,null],equipment:throughputGear,rewardBudget:{gold:0,xp:0}});applyCascadeCharge(anchorEfficient,['red'],1,'player');assert.equal(anchorEfficient.charges.red,1,'combo-anchor bonus charge does not trigger match efficiency');
    const charged=createRatCombat({seed:7,sack:['dagger',null,null,null,null],equipment:blank,rewardBudget:{gold:0,xp:0}});
    charged.buffs.redwake=4;const startHp=charged.eHP;applyCascadeCharge(charged,['red'],1,'player');assert.equal(charged.eHP,startHp-1,'combo 2 adds exactly +1 core Red damage');assert.equal(charged.charges.red,1,'combo 2 adds +1 Red reservoir value');assert.equal(charged.buffs.redwake,4,'cascade charge does not consume or retrigger Redwake');
    applyCascadeCharge(charged,['red'],2,'player');assert.equal(charged.eHP,startHp-3,'combo 3 adds +2 more core Red damage');assert.equal(charged.charges.red,3,'combo 3 adds +2 more Red reservoir value');
    const specialized=createBanditCombat({seed:8,sack:['warhammer','dagger','shield',null,null],equipment:blank,rewardBudget:{gold:0,xp:0}});assert.equal(matchPower(specialized,'red'),3);assert.equal(matchPower(specialized,'blue'),2);const specializedEnemyHp=specialized.eHP;applyCascadeCharge(specialized,['red','blue'],1,'player');assert.equal(specialized.eHP,specializedEnemyHp-3,'server replay scales Red core value by Sack ATK');assert.equal(specialized.pGuard,2,'server replay scales Blue core value by Sack DEF');
    const enemyCharged=createBanditCombat({seed:9,sack:['dagger',null,null,null,null],equipment:blank,rewardBudget:{gold:0,xp:0}}),startPlayerHp=enemyCharged.pHP;
    applyCascadeCharge(enemyCharged,['red'],1,'enemy');applyCascadeCharge(enemyCharged,['red'],2,'enemy');assert.equal(enemyCharged.pHP,startPlayerHp-3,'cascade anchor charge is symmetric for enemy moves');assert.equal(enemyCharged.ec.red,3);
  }
  for(const branch of BRANCHES){const path=[];for(const node of branch.nodes){assert.equal(canPurchase(node.id,path,10).ok,true,'a single rank per previous node reaches '+node.id);path.push(node.id)}if(branch.nodes[0].maxRank>1)assert.equal(canPurchase(branch.nodes[0].id,path,10).ok,true,'earlier ranks can still be upgraded')}
  {
    const matchDb={
      storage:{location:'test.db'},
      transaction:async fn=>fn(matchDb),
      prepare(sql){return {
        async get(){if(sql.includes('FROM starter_choices'))return {ok:1};return sql.includes('SELECT current_node FROM world_state')?{current_node:'bandit-pass'}:null},
        async all(){
          if(sql.includes('FROM sack_slots'))return [{slot:0,gem_id:'dagger'}];
          if(sql.includes('FROM equipment_slots'))return [{slot:'head',item_id:null},{slot:'chest',item_id:null},{slot:'hands',item_id:null},{slot:'legs',item_id:null},{slot:'feet',item_id:null},{slot:'necklace',item_id:null},{slot:'ring1',item_id:null},{slot:'ring2',item_id:null}];
          return [];
        },
        async run(){return {changes:1,lastInsertRowid:1}}
      }}
    };
    const match=await startMatch(matchDb,1,'bandit');
    assert.equal(match.authority?.mode,'replay-v4','Bandit matches require replay authority in every storage mode');
    assert(Number.isInteger(match.authority.seed));
  }
  {
    const equipment={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    const state=createBanditCombat({seed:1,sack:['dagger',null,null,null,null],equipment,consumables:{'minor-healing-draught':1,'ironbark-tonic':1,'cherry-bomb':1},rewardBudget:{gold:24,xp:18}});
    assert.equal(state.encounterId,'bandit');assert.equal(state.eHP,24);state.pHP=10;state.extraTurn=true;assert.equal(applyCombatAction(state,{t:'consume',itemId:'minor-healing-draught'}),true);assert.equal(state.pHP,15,'healing potion restores HP immediately');state.playerTurn=true;state.extraTurn=true;assert.equal(applyCombatAction(state,{t:'consume',itemId:'ironbark-tonic'}),true);assert.equal(state.pGuard,5,'guard tonic grants immediate Guard');assert.equal(state.usedConsumables['minor-healing-draught'],1);assert.equal(state.usedConsumables['ironbark-tonic'],1);state.playerTurn=true;state.extraTurn=true;assert.equal(applyCombatAction(state,{t:'consume',itemId:'cherry-bomb'}),true);assert.equal(state.targetMode,'consumable_break','Cherry Bomb arms a single board target without ending the action');assert.equal(state.actions,2,'arming the bomb does not spend an action yet');assert.equal(applyCombatAction(state,{t:'target',x:0,y:0}),true);assert.equal(state.targetMode,null);assert.equal(state.actions,3,'committing the Cherry Bomb target spends the action');assert.equal(state.usedConsumables['cherry-bomb'],1);assert(state.board.flat().every(Boolean),'Cherry Bomb collapse refills the board');
    const replay=verifyBanditTranscript({seed:1,sack:['dagger',null,null,null,null],equipment,rewardBudget:{gold:24,xp:18},transcript:[]});
    assert.equal(replay.won,false,'empty Bandit transcript cannot claim victory');
  }
  const jwt='aaa.bbb.ccc';
  let cfg=normalizeTursoConfig('libsql://gemmo-example.turso.io',jwt);
  assert.equal(cfg.url,'https://gemmo-example.turso.io');assert.equal(cfg.authToken,jwt);assert.equal(cfg.swapped,false);
  cfg=normalizeTursoConfig(jwt,'libsql://gemmo-example.turso.io');
  assert.equal(cfg.url,'https://gemmo-example.turso.io');assert.equal(cfg.authToken,jwt);assert.equal(cfg.swapped,true);
  assert.throws(()=>normalizeTursoConfig(jwt,'also-not-a-url'),/invalid_turso_database_url/);
  {
    const calls=[];
    const fakeStmt={get:async args=>({value:args[0]}),all:async args=>args.map(value=>({value})),run:async args=>({changes:1,info:{lastInsertRowid:42},args})};
    const fakeTx={
      prepare:async sql=>{calls.push(['tx.prepare',sql]);return fakeStmt},
      exec:async sql=>{calls.push(['tx.exec',sql])},
      batch:async()=>({rowsAffected:0})
    };
    const fakeConn={
      prepare:async sql=>{calls.push(['prepare',sql]);return fakeStmt},
      exec:async sql=>{calls.push(['exec',sql])},
      batch:async()=>({rowsAffected:0}),
      transactionAsync(fn){
        const runner=async()=>fn(fakeTx);
        runner.immediate=runner;runner.deferred=runner;runner.exclusive=runner;runner.concurrent=runner;
        return runner;
      }
    };
    const remote=remoteAdapter(fakeConn,'https://example.turso.io');
    assert.deepEqual(await remote.prepare('SELECT ?').get(7),{value:7});
    assert.deepEqual(await remote.prepare('SELECT ?,?').all(1,2),[{value:1},{value:2}]);
    const info=await remote.prepare('INSERT').run('x');assert.equal(info.changes,1);assert.equal(info.lastInsertRowid,42);
    await remote.transaction(async tx=>{assert.deepEqual(await tx.prepare('SELECT ?').get(9),{value:9})});
    assert(calls.some(([kind])=>kind==='tx.prepare'),'remote transactions must use the transaction handle');
  }
  const {server,db}=await createGemmoServer({dbPath:':memory:',allowedOrigins:['http://test'],forceLocal:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,{method='GET',token,body,origin='http://test'}={}){
    const headers={Origin:origin};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
    const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data={};try{data=await res.json()}catch{}
    return {status:res.status,data};
  }
  try{
    let r=await call('/health');assert.equal(r.status,200);assert.equal(r.data.ok,true);assert.equal(r.data.captcha,false);assert.equal(typeof r.data.release,'string');assert.equal(r.data.storage.provider,'sqlite');assert.equal(r.data.storage.location,':memory:');assert.equal(r.data.storage.persistent,false);
    r=await call('/v1/auth/register',{method:'POST',body:{username:'FiveChar',password:'12345'}});assert.equal(r.status,400,'five-character passwords stay invalid');
    r=await call('/v1/auth/register',{method:'POST',body:{username:'LevelOneHero',password:'abc123'}});
    assert.equal(r.status,201);const token=r.data.token;assert(token&&token.length>32);
    assert.equal(r.data.account.needsCharacterName,true);
    const gated=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(gated.status,403);assert.equal(gated.data.error,'character_name_required');
    assert.equal((await call('/v1/account/character',{method:'POST',token,body:{name:'<script>'}})).status,400);
    const named=await call('/v1/account/character',{method:'POST',token,body:{name:'  Perevan  Wrenault  '}});assert.equal(named.status,200);assert.equal(named.data.account.character.name,'Perevan Wrenault');assert.equal(named.data.account.needsCharacterName,false);
    assert.equal((await call('/v1/account/character',{method:'POST',token,body:{name:'Perevan Wrenault'}})).status,200,'retry is idempotent');
    assert.equal((await call('/v1/account/character',{method:'POST',token,body:{name:'Different Name'}})).status,409,'registered identity is permanent');
    const rival=await call('/v1/auth/register',{method:'POST',body:{username:'RivalHero',password:'abc123'}});assert.equal(rival.status,201);
    assert.equal((await call('/v1/account/character',{method:'POST',token:rival.data.token,body:{name:'perevan wrenault'}})).status,409,'names are case-insensitively unique');
    assert.equal((await call('/v1/account/character',{method:'POST',token:rival.data.token,body:{name:'Rival Hero'}})).status,200);
    const rivalId=rival.data.account.user.id;await db.prepare('UPDATE profiles SET xp=45 WHERE user_id=?').run(rivalId);
    const leaders=await call('/v1/leaderboard',{token});assert.equal(leaders.status,200);assert.equal(leaders.data.entries[0].name,'Rival Hero');assert.equal(leaders.data.entries[0].level,3);assert.equal(leaders.data.you.rank,2);assert.equal(leaders.data.entries[1].isYou,true);assert(!JSON.stringify(leaders.data).includes('LevelOneHero'),'login identity is private');
    await db.prepare('UPDATE profiles SET xp=0 WHERE user_id=?').run(rivalId);assert.equal((await call('/v1/leaderboard',{token})).data.you.rank,1,'equal XP uses stable account order');
    assert.equal((await call('/v1/leaderboard')).status,401);
    assert.equal((await call('/v1/account',{token})).data.account.character.name,'Perevan Wrenault','character name persists in account snapshots');

    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);assert.equal(r.data.account.skills.availablePoints,1);assert.deepEqual(r.data.account.skills.purchased,[]);
    assert.deepEqual(r.data.account.inventory,[]);assert.deepEqual(r.data.account.sack,[null,null,null,null,null]);assert.equal(r.data.account.needsStarter,true,'new accounts must choose a weapon with the Warden');
    r=await call('/v1/account',{token});assert.equal(r.status,200);assert.equal(r.data.account.user.username,'LevelOneHero');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,409,'cannot depart without a weapon choice');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'longbow'}});assert.equal(r.status,400,'only the five starter weapons are allowed');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'dagger'}});assert.equal(r.status,200);assert.equal(r.data.account.needsStarter,false);assert.equal(r.data.account.starter,'dagger');assert.deepEqual(r.data.account.inventory,['dagger']);assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null]);
    assert.equal((await call('/v1/account/starter',{method:'POST',token,body:{gemId:'dagger'}})).status,200,'retry is idempotent');
    assert.equal((await call('/v1/account/starter',{method:'POST',token,body:{gemId:'sling'}})).status,409,'cannot claim a second weapon');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger',null,null,null,null]}});assert.equal(r.status,200);
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger','knife',null,null,null]}});assert.equal(r.status,400);assert.equal(r.data.error,'weapon_gem_limit');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger','shield',null,null,null]}});assert.equal(r.status,403,'cannot equip gems not owned');
    r=await call('/v1/story/cutscene',{method:'POST',token,body:{cutsceneId:'not-real'}});assert.equal(r.status,400,'unknown cutscenes are rejected');
    r=await call('/v1/story/cutscene',{method:'POST',token,body:{cutsceneId:'brackenreach-arrival'}});assert.equal(r.status,200);assert(r.data.account.story.seenCutscenes.includes('brackenreach-arrival'),'seen cutscenes persist on the account');
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'turnin',questId:'trouble-on-road'}});assert.equal(r.status,409,'quest cannot be turned in before acceptance');
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'accept',questId:'trouble-on-road'}});assert.equal(r.status,200);assert.equal(r.data.account.quests.find(q=>q.id==='trouble-on-road')?.status,'active','quest acceptance persists');
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'accept',questId:'trouble-on-road'}});assert.equal(r.status,409,'quest cannot be accepted twice');
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'turnin',questId:'trouble-on-road'}});assert.equal(r.status,409,'quest objective is server-checked');
    const equipment={head:'frayed-hood',chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    r=await call('/v1/account/equipment',{method:'PUT',token,body:{equipment}});assert.equal(r.status,403,'blank new inventory owns no armor');

    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,409,'cannot skip the road graph');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'crossroads');
    r=await call('/v1/world/complete-encounter',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,403,'encounter clears only through a settled victory');
    r=await call('/v1/skills/buy',{method:'POST',token,body:{skillId:'not-a-skill'}});assert.equal(r.status,400,'unknown skills are validated anywhere');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'shrine'}});assert.equal(r.status,200);
    r=await call('/v1/skills/buy',{method:'POST',token,body:{skillId:'red-start'}});assert.equal(r.status,409);
    r=await call('/v1/skills/buy',{method:'POST',token,body:{skillId:'red-cap-1'}});assert.equal(r.status,200);assert(r.data.account.skills.purchased.includes('red-cap-1'));assert.equal(r.data.account.skills.availablePoints,0);
    r=await call('/v1/skills/buy',{method:'POST',token,body:{skillId:'blue-cap-1'}});assert.equal(r.status,409);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'rat'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'rat');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,409,'bandit path stays locked until rat is cleared');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'bandit'}});assert.equal(r.status,409,'cannot start a different encounter');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,201);const lostRatMatchId=r.data.match.matchId,lostRatBudget=r.data.match.rewardBudget;assert(lostRatMatchId);assert(lostRatBudget.gold>=8&&lostRatBudget.gold<=12);assert(lostRatBudget.xp>=6&&lostRatBudget.xp<=10);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:7,xp:5}});assert.equal(r.status,400,'loss cannot claim rewards');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:0,xp:0}});assert.equal(r.status,200);assert.equal(r.data.settlement.won,false);assert.equal(r.data.account.profile.gold,0);assert.equal(r.data.account.profile.xp,0);assert(!r.data.account.world.clearedEncounters.includes('rat'),'loss does not unlock encounter');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:0,xp:0}});assert.equal(r.status,200);assert.equal(r.data.settlement.alreadySettled,true,'loss settlement is idempotent');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,201);const ratMatchId=r.data.match.matchId,ratBudget=r.data.match.rewardBudget;assert(ratMatchId);assert.equal(r.data.match.authority?.mode,'replay-v4');assert(Number.isInteger(r.data.match.authority.seed));
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:999999,xp:999999,transcript:[]}});assert.equal(r.status,409,'empty fake Rat victory proof is rejected');assert.equal(r.data.error,'combat_proof_failed');
    const blankEquipment={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    let ratProof=null;
    for(let seed=1;seed<=200&&!ratProof;seed++){
      const state=createRatCombat({version:'replay-v4',seed,sack:['dagger',null,null,null,null],equipment:blankEquipment,skills:['red-cap-1'],rewardBudget:ratBudget}),transcript=[];
      for(let turn=0;turn<180&&state.eHP>0&&state.pHP>0;turn++){const action=suggestRatAction(state);if(!action)break;transcript.push(action);if(!applyRatAction(state,action))break}
      if(state.eHP<=0&&transcript.length<=256)ratProof={seed,state,transcript};
    }
    assert(ratProof,'test bot must find a legal deterministic Rat victory');
    await db.prepare('UPDATE match_combat_proofs SET seed=? WHERE match_id=?').run(ratProof.seed,ratMatchId);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:999999,xp:999999,transcript:ratProof.transcript}});assert.equal(r.status,200);assert.equal(r.data.settlement.authority,'replay-v4');assert.equal(r.data.settlement.gold,ratProof.state.gold,'Rat Gold comes from server replay');assert.equal(r.data.settlement.xp,ratProof.state.xp,'Rat XP comes from server replay');assert.equal(r.data.account.profile.gold,ratProof.state.gold);assert.equal(r.data.account.profile.xp,ratProof.state.xp);assert(r.data.account.world.clearedEncounters.includes('rat'),'verified Rat victory saves rewards and unlock');assert.equal(r.data.account.quests.find(q=>q.id==='trouble-on-road')?.status,'ready','authoritative encounter clear advances quest readiness');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:0,xp:0,transcript:[]}});assert.equal(r.status,200);assert.equal(r.data.settlement.alreadySettled,true);assert.equal(r.data.account.profile.gold,ratProof.state.gold,'retry cannot double-award verified Rat gold');assert.equal(r.data.account.profile.xp,ratProof.state.xp,'retry cannot double-award verified Rat XP');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'bandit-pass');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'bandit'}});assert.equal(r.status,201);const banditMatchId=r.data.match.matchId,banditBudget=r.data.match.rewardBudget;assert(banditBudget.gold>=18&&banditBudget.gold<=24);assert(banditBudget.xp>=12&&banditBudget.xp<=18);assert.equal(r.data.match.authority?.mode,'replay-v4');assert(Number.isInteger(r.data.match.authority.seed));
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:banditMatchId,won:true,gold:999999,xp:999999,transcript:[]}});assert.equal(r.status,409,'empty fake Bandit victory proof is rejected');assert.equal(r.data.error,'combat_proof_failed');
    let banditProof=null;
    for(let seed=1;seed<=500&&!banditProof;seed++){
      const state=createBanditCombat({version:'replay-v4',seed,sack:['dagger',null,null,null,null],equipment:blankEquipment,skills:['red-cap-1'],rewardBudget:banditBudget}),transcript=[];
      for(let turn=0;turn<240&&state.eHP>0&&state.pHP>0;turn++){const action=suggestCombatAction(state);if(!action)break;transcript.push(action);if(!applyCombatAction(state,action))break}
      if(state.eHP<=0&&transcript.length<=256)banditProof={seed,state,transcript};
    }
    assert(banditProof,'test bot must find a legal deterministic Bandit victory');
    await db.prepare('UPDATE match_combat_proofs SET seed=? WHERE match_id=?').run(banditProof.seed,banditMatchId);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:banditMatchId,won:true,gold:999999,xp:999999,transcript:banditProof.transcript}});assert.equal(r.status,200);assert.equal(r.data.settlement.authority,'replay-v4');assert.equal(r.data.settlement.gold,banditProof.state.gold,'Bandit Gold comes from server replay');assert.equal(r.data.settlement.xp,banditProof.state.xp,'Bandit XP comes from server replay');assert.equal(r.data.account.profile.gold,ratProof.state.gold+banditProof.state.gold);assert.equal(r.data.account.profile.xp,ratProof.state.xp+banditProof.state.xp);assert(r.data.account.world.clearedEncounters.includes('bandit'),'every verified encounter victory records a generic clear flag');
    assert(await db.prepare("SELECT 1 ok FROM audit_events WHERE type='match_result_mismatch' AND user_id=?").get(r.data.account.user.id),'replay result mismatches are audited');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'sentinel-gate'}});assert.equal(r.status,200,'verified Bandit clear unlocks the Sentinel');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'sentinel'}});assert.equal(r.status,201);assert.equal(r.data.match.authority.mode,'replay-v4');const sentinelMatchId=r.data.match.matchId;
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:sentinelMatchId,won:true,gold:999,xp:999,transcript:[]}});assert.equal(r.status,409,'unproved Sentinel win cannot award progression');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:sentinelMatchId,won:false,gold:0,xp:0,transcript:[]}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,409,'bandit does not teleport to camp');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'rat'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'turnin',questId:'trouble-on-road'}});assert.equal(r.status,200);assert.equal(r.data.account.quests.find(q=>q.id==='trouble-on-road')?.status,'completed','ready quest can be turned in at its NPC');assert.equal(r.data.account.profile.gold,ratProof.state.gold+banditProof.state.gold+12,'quest Gold reward is server-issued');assert.equal(r.data.account.profile.xp,ratProof.state.xp+banditProof.state.xp+4,'quest XP reward is server-issued');assert.equal(r.data.account.profile.level,levelForXp(r.data.account.profile.xp));
    r=await call('/v1/story/quest',{method:'POST',token,body:{action:'turnin',questId:'trouble-on-road'}});assert.equal(r.status,409,'completed quest cannot pay twice');
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'shield'}});assert.equal(r.status,409,'must physically travel to the shop');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'gem-shop'}});assert.equal(r.status,200);
    const userId=(await db.prepare("SELECT id FROM users WHERE username_norm='levelonehero'").get()).id;
    await db.prepare('UPDATE profiles SET gold=0 WHERE user_id=?').run(userId);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'shield'}});assert.equal(r.status,409,'zero-gold player cannot buy');
    await db.prepare('UPDATE profiles SET gold=100 WHERE user_id=?').run(userId);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'shield'}});assert.equal(r.status,200);assert(r.data.account.inventory.includes('shield'));assert.equal(r.data.account.profile.gold,82);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'shield'}});assert.equal(r.status,409,'cannot buy an owned unique item');
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'frayed-hood'}});assert.equal(r.status,400,'shop stock is server-defined');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'item-shop'}});assert.equal(r.status,200);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'item-shop',itemId:'minor-healing-draught'}});assert.equal(r.status,200);assert.equal(r.data.account.inventoryItems.find(v=>v.id==='minor-healing-draught')?.qty,1);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'item-shop',itemId:'minor-healing-draught'}});assert.equal(r.status,200);assert.equal(r.data.account.inventoryItems.find(v=>v.id==='minor-healing-draught')?.qty,2,'consumables stack on repeat purchase');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'rat'}});assert.equal(r.status,200);
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,201);const consumableMatchId=r.data.match.matchId;
    r=await call('/v1/matches/consume',{method:'POST',token,body:{matchId:consumableMatchId,itemId:'minor-healing-draught'}});assert.equal(r.status,200);assert.equal(r.data.account.inventoryItems.find(v=>v.id==='minor-healing-draught')?.qty,1,'using a one-shot immediately decrements its stack');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:consumableMatchId,won:false,gold:0,xp:0,transcript:[{t:'consume',itemId:'minor-healing-draught'}]}});assert.equal(r.status,200);assert.equal(r.data.settlement.won,false,'consumable use verifies during loss settlement');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'gem-shop'}});assert.equal(r.status,200);

    r=await call('/v1/account/profile',{method:'PUT',token,body:{gold:999999,xp:999999,level:99}});assert.equal(r.status,403);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:'fake-match-id-123456',won:true,gold:999999,xp:999999}});assert.equal(r.status,404,'invented match ids cannot award rewards');
    r=await call('/v1/account',{token,origin:'https://evil.example'});assert.equal(r.status,403);

    r=await call('/v1/auth/logout',{method:'POST',token});assert.equal(r.status,200);
    r=await call('/v1/account',{token});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'wrong-password'}});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'abc123'}});assert.equal(r.status,200);
    assert(r.data.account.inventory.includes('shield'),'inventory survives logout/login');
    assert.equal(r.data.account.profile.gold,66,'gold survives logout/login after consumable purchases');assert.equal(r.data.account.inventoryItems.find(v=>v.id==='minor-healing-draught')?.qty,1,'remaining consumable stack survives logout/login');assert.equal(r.data.account.profile.xp,ratProof.state.xp+banditProof.state.xp+4,'battle and quest XP survive logout/login');
    assert.equal(r.data.account.quests.find(q=>q.id==='trouble-on-road')?.status,'completed','quest state survives logout/login');assert(r.data.account.story.seenCutscenes.includes('brackenreach-arrival'),'cutscene state survives logout/login');
    assert.equal(r.data.account.world.currentNode,'gem-shop','world position survives logout/login');assert(r.data.account.world.clearedEncounters.includes('rat'),'rat clear survives logout/login');
    assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null],'Sack survives logout/login');

    const reloginToken=r.data.token;
    // New weapon rule removes only excess equipment, preserving ownership and regular gems.
    const weaponUser=await db.prepare("SELECT id FROM users WHERE username_norm='levelonehero'").get();
    await db.prepare("INSERT OR IGNORE INTO inventory(user_id,item_id,kind,qty) VALUES(?,'knife','gem',1)").run(weaponUser.id);
    await db.prepare("INSERT OR IGNORE INTO inventory(user_id,item_id,kind,qty) VALUES(?,'shield','gem',1)").run(weaponUser.id);
    await db.prepare("INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,1,'knife')").run(weaponUser.id);
    await db.prepare("INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,2,'shield')").run(weaponUser.id);
    await db.prepare("DELETE FROM app_migrations WHERE key='2026-09-29-one-weapon-gem-v1'").run();
    // Run the weapon migration independently before the reset test.
    assert.equal(await applyDataMigrations(db),true);
    r=await call('/v1/account',{token:reloginToken});assert.deepEqual(r.data.account.sack,['dagger',null,'shield',null,null]);assert(r.data.account.inventory.includes('knife'));
    assert.equal(await applyDataMigrations(db),false,'weapon migration cannot run twice');
    // The requested test reset affects only PWilly and runs exactly once.
    const resetUser=await seedAccount(db,{usernameNorm:'pwilly',usernameDisplay:'PWilly',passwordHash:'preserved-hash'});
    await registerCharacter(db,resetUser,'Test Captain');
    await db.prepare('UPDATE profiles SET xp=900,gold=777 WHERE user_id=?').run(resetUser);
    await db.prepare("UPDATE world_state SET current_node='shrine' WHERE user_id=?").run(resetUser);
    await db.prepare("INSERT INTO matches(id,user_id,encounter_id,started_at,settled_at,won) VALUES('reset-test',?,'rat',1,2,1)").run(resetUser);
    await db.prepare("INSERT INTO match_stats(match_id,gems_popped,longest_cascade) VALUES('reset-test',100,5)").run();
    const untouchedBefore=await accountSnapshot(db,weaponUser.id);
    await db.prepare("DELETE FROM app_migrations WHERE key='2026-09-30-pwilly-test-reset-v1'").run();
    assert.equal(await applyDataMigrations(db),true);
    const fresh=await accountSnapshot(db,resetUser);
    assert.equal(fresh.profile.xp,0);assert.equal(fresh.profile.gold,0);assert.equal(fresh.world.currentNode,'camp');
    assert.deepEqual(fresh.sack,['dagger',null,null,null,null]);assert.deepEqual(fresh.inventory,['dagger']);
    assert.equal(fresh.character.name,'Test Captain');assert.equal(fresh.user.username,'PWilly');
    assert.equal((await db.prepare('SELECT password_hash FROM users WHERE id=?').get(resetUser)).password_hash,'preserved-hash');
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM matches WHERE user_id=?').get(resetUser)).n,0);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM match_stats WHERE match_id='reset-test'").get()).n,0);
    assert.deepEqual(await accountSnapshot(db,weaponUser.id),untouchedBefore);
    await db.prepare('UPDATE profiles SET gold=12 WHERE user_id=?').run(resetUser);
    assert.equal(await applyDataMigrations(db),false);assert.equal((await accountSnapshot(db,resetUser)).profile.gold,12);
    await db.prepare('DELETE FROM app_migrations WHERE key=?').run(DATA_RESET_KEY);
    assert.equal(await applyDataMigrations(db),true,'fresh-sacks reset applies once');
    r=await call('/v1/account',{token:reloginToken});assert.equal(r.status,200,'reset preserves login sessions and account credentials');
    assert.deepEqual(r.data.account.inventory,['dagger'],'reset wipes collected inventory and reseeds only the Iron Dagger');
    assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null],'reset equips the Iron Dagger in Sack slot 1');
    assert.equal(r.data.account.needsStarter,true,'historical reset clears starter choice');
    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);
    assert.equal(r.data.account.world.currentNode,'camp');assert.deepEqual(r.data.account.world.clearedEncounters,[]);
    assert.deepEqual(r.data.account.quests,[],'reset clears quest progression');assert.deepEqual(r.data.account.skills.purchased,[],'reset clears skill progression');assert.equal(r.data.account.skills.availablePoints,1);assert.deepEqual(r.data.account.story.seenCutscenes,[],'reset clears story flags');
    assert(Object.values(r.data.account.equipment).every(v=>v===null),'reset unequips physical gear');
    assert.equal(await applyDataMigrations(db),false,'fresh-sacks reset cannot run twice');

    for(const gemId of require('../shared/weapon-gems.js').STARTER_WEAPON_IDS){
      const id=await seedAccount(db,{usernameNorm:'starter-'+gemId,usernameDisplay:'Starter '+gemId,passwordHash:'test'});await registerCharacter(db,id,'Test '+gemId.replaceAll('-',' '));
      await assert.rejects(startMatch(db,id,'rat'),/choose_weapon_with_warden/);
      await chooseStarterWeapon(db,id,gemId);await chooseStarterWeapon(db,id,gemId);
      const chosen=await accountSnapshot(db,id);assert.deepEqual(chosen.inventory,[gemId]);assert.deepEqual(chosen.sack,[gemId,null,null,null,null]);assert.equal(chosen.needsStarter,false);
      await assert.rejects(chooseStarterWeapon(db,id,gemId==='dagger'?'sling':'dagger'),/starter_already_chosen/);
      await moveWorld(db,id,'crossroads');
    }
    const freshId=await seedAccount(db,{usernameNorm:'legacyfresh',usernameDisplay:'Legacy Fresh',passwordHash:'test'});
    await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'dagger','gem',1)").run(freshId);await db.prepare("INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,'dagger')").run(freshId);
    const establishedId=await seedAccount(db,{usernameNorm:'legacyplayed',usernameDisplay:'Legacy Played',passwordHash:'test'});
    await db.prepare('UPDATE profiles SET xp=20 WHERE user_id=?').run(establishedId);await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'dagger','gem',1)").run(establishedId);await db.prepare("INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,'dagger')").run(establishedId);
    await db.prepare("DELETE FROM app_migrations WHERE key='2026-10-01-warden-weapon-choice-v1'").run();assert.equal(await applyDataMigrations(db),true);
    const freshMigrated=await accountSnapshot(db,freshId),established=await accountSnapshot(db,establishedId);assert.equal(freshMigrated.needsStarter,true);assert.deepEqual(freshMigrated.inventory,[]);assert.deepEqual(freshMigrated.sack,[null,null,null,null,null]);assert.equal(established.needsStarter,false);assert.equal(established.profile.xp,20);assert.deepEqual(established.inventory,['dagger']);
    assert.equal(await applyDataMigrations(db),false,'starter migration never repeats');
    const shopWeapons=Object.keys(require('./catalog.cjs').SHOP_CATALOG['gem-shop']).filter(require('../shared/weapon-gems.js').isWeaponGem);assert.deepEqual(shopWeapons,require('../shared/weapon-gems.js').STARTER_WEAPON_IDS,'shop sells each starting weapon');
    const shopper=await seedAccount(db,{usernameNorm:'weaponshopper',usernameDisplay:'Weapon Shopper',passwordHash:'test'});await registerCharacter(db,shopper,'Weapon Shopper');await chooseStarterWeapon(db,shopper,'dagger');
    await db.prepare('UPDATE profiles SET gold=100 WHERE user_id=?').run(shopper);
    await assert.rejects(buyShopItem(db,shopper,'gem-shop','crystal-wand'),/not_at_shop/);
    await moveWorld(db,shopper,'gem-shop');
    for(const weapon of shopWeapons.filter(id=>id!=='dagger'))await buyShopItem(db,shopper,'gem-shop',weapon);
    const bought=await accountSnapshot(db,shopper);assert.equal(bought.profile.gold,28);assert.deepEqual(new Set(bought.inventory),new Set(shopWeapons));assert.deepEqual(bought.sack,['dagger',null,null,null,null],'buying leaves the equipped weapon in place');
    await assert.rejects(buyShopItem(db,shopper,'gem-shop','crystal-wand'),/already_owned/);
    assert.equal((await accountSnapshot(db,shopper)).profile.gold,28,'duplicate purchase spends nothing');
    const poor=await seedAccount(db,{usernameNorm:'poorshopper',usernameDisplay:'Poor Shopper',passwordHash:'test'});await registerCharacter(db,poor,'Poor Shopper');await chooseStarterWeapon(db,poor,'sling');await moveWorld(db,poor,'gem-shop');
    await assert.rejects(buyShopItem(db,poor,'gem-shop','dagger'),/insufficient_gold/);
    console.log('PASS: account registration/login, persistent profile, secure sessions, loadout validation, one-time fresh reset, CORS and client-write anti-cheat boundaries.');
  }finally{await new Promise(resolve=>server.close(resolve))}

  const captcha=await createGemmoServer({dbPath:':memory:',allowedOrigins:['http://test'],forceLocal:true,turnstileSiteKey:'site-test',turnstileSecretKey:'secret-test',turnstileExpectedHostname:'test.example',turnstileVerifier:async({token})=>token==='captcha-ok'?{success:true,hostname:'test.example',action:'auth'}:{success:false}});
  await new Promise(resolve=>captcha.server.listen(0,'127.0.0.1',resolve));
  const captchaBase='http://127.0.0.1:'+captcha.server.address().port;
  async function captchaCall(path,{method='GET',body}={}){const headers={Origin:'http://test'};if(body!==undefined)headers['Content-Type']='application/json';const res=await fetch(captchaBase+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let data={};try{data=await res.json()}catch{}return {status:res.status,data}}
  try{
    let r=await captchaCall('/v1/config');assert.equal(r.status,200);assert.equal(r.data.captcha.enabled,true);assert.equal(r.data.captcha.siteKey,'site-test');
    r=await captchaCall('/v1/auth/register',{method:'POST',body:{username:'CaptchaHero',password:'abc123'}});assert.equal(r.status,403,'captcha is required when configured');
    r=await captchaCall('/v1/auth/register',{method:'POST',body:{username:'CaptchaHero',password:'abc123',captchaToken:'bad'}});assert.equal(r.status,403,'invalid captcha is rejected');
    r=await captchaCall('/v1/auth/register',{method:'POST',body:{username:'CaptchaHero',password:'abc123',captchaToken:'captcha-ok'}});assert.equal(r.status,201,'valid captcha permits registration');
    console.log('PASS: six-character password minimum and Turnstile auth gate.');
  }finally{await new Promise(resolve=>captcha.server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
