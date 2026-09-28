'use strict';
// geMMO server regression suite.
const assert=require('node:assert/strict');
const {createGemmoServer,defaultDbPath}=require('./server.cjs');
const {normalizeTursoConfig,remoteAdapter,applyDataMigrations,DATA_RESET_KEY,startMatch}=require('./db.cjs');
const {STARTER_GEMS,ENCOUNTERS}=require('./catalog.cjs');
const {createRatCombat,createBanditCombat,applyRatAction,suggestRatAction,applyCombatAction,suggestCombatAction,verifyBanditTranscript}=require('./combat.cjs');

(async()=>{
  assert.equal(defaultDbPath({dbPath:':memory:'}),':memory:');
  assert.deepEqual(STARTER_GEMS,{red:'dagger',yellow:'sling',blue:'crystal-wand'},'fresh accounts have exactly three starter choices');
  assert.deepEqual(Object.keys(ENCOUNTERS),['rat','bandit'],'shared encounter catalog owns the current encounter set');
  assert.equal(ENCOUNTERS.rat.maxHP,10);assert.equal(ENCOUNTERS.bandit.maxHP,24);assert.deepEqual(ENCOUNTERS.bandit.reward,{gold:[18,24],xp:[12,18]});assert.equal(ENCOUNTERS.bandit.actives.length,5);
  {
    const matchDb={
      storage:{location:'test.db'},
      transaction:async fn=>fn(matchDb),
      prepare(sql){return {
        async get(){return sql.includes('SELECT current_node FROM world_state')?{current_node:'bandit-pass'}:null},
        async all(){
          if(sql.includes('FROM sack_slots'))return [{slot:0,gem_id:'dagger'}];
          if(sql.includes('FROM equipment_slots'))return [{slot:'head',item_id:null},{slot:'chest',item_id:null},{slot:'hands',item_id:null},{slot:'legs',item_id:null},{slot:'feet',item_id:null},{slot:'necklace',item_id:null},{slot:'ring1',item_id:null},{slot:'ring2',item_id:null}];
          return [];
        },
        async run(){return {changes:1,lastInsertRowid:1}}
      }}
    };
    const match=await startMatch(matchDb,1,'bandit');
    assert.equal(match.authority?.mode,'replay-v1','Bandit matches require replay authority in every storage mode');
    assert(Number.isInteger(match.authority.seed));
  }
  {
    const equipment={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    const state=createBanditCombat({seed:1,sack:['dagger',null,null,null,null],equipment,rewardBudget:{gold:24,xp:18}});
    assert.equal(state.encounterId,'bandit');assert.equal(state.eHP,24);
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
    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);
    assert.equal(r.data.account.inventory.length,0);assert.deepEqual(r.data.account.sack,[null,null,null,null,null]);assert.equal(r.data.account.needsStarter,true);
    r=await call('/v1/account',{token});assert.equal(r.status,200);assert.equal(r.data.account.user.username,'LevelOneHero');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger',null,null,null,null]}});assert.equal(r.status,403,'cannot equip unowned starter before choice');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'axe'}});assert.equal(r.status,400,'only three starter gems are legal');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'dagger'}});assert.equal(r.status,200);
    assert.deepEqual(r.data.account.inventory,['dagger']);assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null]);assert.equal(r.data.account.needsStarter,false);
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'sling'}});assert.equal(r.status,409,'starter choice is one-time even when the second choice is valid');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger',null,null,null,null]}});assert.equal(r.status,200);
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger','shield',null,null,null]}});assert.equal(r.status,403,'cannot equip gems not owned');
    const equipment={head:'frayed-hood',chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    r=await call('/v1/account/equipment',{method:'PUT',token,body:{equipment}});assert.equal(r.status,403,'blank new inventory owns no armor');

    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,409,'cannot skip the road graph');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'crossroads');
    r=await call('/v1/world/complete-encounter',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,403,'encounter clears only through a settled victory');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'rat'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'rat');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,409,'bandit path stays locked until rat is cleared');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'bandit'}});assert.equal(r.status,409,'cannot start a different encounter');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,201);const lostRatMatchId=r.data.match.matchId,lostRatBudget=r.data.match.rewardBudget;assert(lostRatMatchId);assert(lostRatBudget.gold>=8&&lostRatBudget.gold<=12);assert(lostRatBudget.xp>=6&&lostRatBudget.xp<=10);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:7,xp:5}});assert.equal(r.status,400,'loss cannot claim rewards');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:0,xp:0}});assert.equal(r.status,200);assert.equal(r.data.settlement.won,false);assert.equal(r.data.account.profile.gold,0);assert.equal(r.data.account.profile.xp,0);assert(!r.data.account.world.clearedEncounters.includes('rat'),'loss does not unlock encounter');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:lostRatMatchId,won:false,gold:0,xp:0}});assert.equal(r.status,200);assert.equal(r.data.settlement.alreadySettled,true,'loss settlement is idempotent');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'rat'}});assert.equal(r.status,201);const ratMatchId=r.data.match.matchId,ratBudget=r.data.match.rewardBudget;assert(ratMatchId);assert.equal(r.data.match.authority?.mode,'replay-v1');assert(Number.isInteger(r.data.match.authority.seed));
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:999999,xp:999999,transcript:[]}});assert.equal(r.status,409,'empty fake Rat victory proof is rejected');assert.equal(r.data.error,'combat_proof_failed');
    const blankEquipment={head:null,chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    let ratProof=null;
    for(let seed=1;seed<=200&&!ratProof;seed++){
      const state=createRatCombat({seed,sack:['dagger',null,null,null,null],equipment:blankEquipment,rewardBudget:ratBudget}),transcript=[];
      for(let turn=0;turn<180&&state.eHP>0&&state.pHP>0;turn++){const action=suggestRatAction(state);if(!action)break;transcript.push(action);if(!applyRatAction(state,action))break}
      if(state.eHP<=0&&transcript.length<=256)ratProof={seed,state,transcript};
    }
    assert(ratProof,'test bot must find a legal deterministic Rat victory');
    await db.prepare('UPDATE match_combat_proofs SET seed=? WHERE match_id=?').run(ratProof.seed,ratMatchId);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:999999,xp:999999,transcript:ratProof.transcript}});assert.equal(r.status,200);assert.equal(r.data.settlement.authority,'replay-v1');assert.equal(r.data.settlement.gold,ratProof.state.gold,'Rat Gold comes from server replay');assert.equal(r.data.settlement.xp,ratProof.state.xp,'Rat XP comes from server replay');assert.equal(r.data.account.profile.gold,ratProof.state.gold);assert.equal(r.data.account.profile.xp,ratProof.state.xp);assert(r.data.account.world.clearedEncounters.includes('rat'),'verified Rat victory saves rewards and unlock');
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:ratMatchId,won:true,gold:0,xp:0,transcript:[]}});assert.equal(r.status,200);assert.equal(r.data.settlement.alreadySettled,true);assert.equal(r.data.account.profile.gold,ratProof.state.gold,'retry cannot double-award verified Rat gold');assert.equal(r.data.account.profile.xp,ratProof.state.xp,'retry cannot double-award verified Rat XP');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'bandit-pass');
    r=await call('/v1/matches/start',{method:'POST',token,body:{encounterId:'bandit'}});assert.equal(r.status,201);const banditMatchId=r.data.match.matchId,banditBudget=r.data.match.rewardBudget;assert(banditBudget.gold>=18&&banditBudget.gold<=24);assert(banditBudget.xp>=12&&banditBudget.xp<=18);assert.equal(r.data.match.authority?.mode,'replay-v1');assert(Number.isInteger(r.data.match.authority.seed));
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:banditMatchId,won:true,gold:999999,xp:999999,transcript:[]}});assert.equal(r.status,409,'empty fake Bandit victory proof is rejected');assert.equal(r.data.error,'combat_proof_failed');
    let banditProof=null;
    for(let seed=1;seed<=500&&!banditProof;seed++){
      const state=createBanditCombat({seed,sack:['dagger',null,null,null,null],equipment:blankEquipment,rewardBudget:banditBudget}),transcript=[];
      for(let turn=0;turn<240&&state.eHP>0&&state.pHP>0;turn++){const action=suggestCombatAction(state);if(!action)break;transcript.push(action);if(!applyCombatAction(state,action))break}
      if(state.eHP<=0&&transcript.length<=256)banditProof={seed,state,transcript};
    }
    assert(banditProof,'test bot must find a legal deterministic Bandit victory');
    await db.prepare('UPDATE match_combat_proofs SET seed=? WHERE match_id=?').run(banditProof.seed,banditMatchId);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:banditMatchId,won:true,gold:999999,xp:999999,transcript:banditProof.transcript}});assert.equal(r.status,200);assert.equal(r.data.settlement.authority,'replay-v1');assert.equal(r.data.settlement.gold,banditProof.state.gold,'Bandit Gold comes from server replay');assert.equal(r.data.settlement.xp,banditProof.state.xp,'Bandit XP comes from server replay');assert.equal(r.data.account.profile.gold,ratProof.state.gold+banditProof.state.gold);assert.equal(r.data.account.profile.xp,ratProof.state.xp+banditProof.state.xp);assert(r.data.account.world.clearedEncounters.includes('bandit'),'every verified encounter victory records a generic clear flag');
    assert(await db.prepare("SELECT 1 ok FROM audit_events WHERE type='match_result_mismatch' AND user_id=?").get(r.data.account.user.id),'replay result mismatches are audited');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,409,'bandit does not teleport to camp');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'rat'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'must physically travel to the shop');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'gem-shop'}});assert.equal(r.status,200);
    const userId=(await db.prepare("SELECT id FROM users WHERE username_norm='levelonehero'").get()).id;
    await db.prepare('UPDATE profiles SET gold=0 WHERE user_id=?').run(userId);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'zero-gold player cannot buy');
    await db.prepare('UPDATE profiles SET gold=100 WHERE user_id=?').run(userId);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,200);assert(r.data.account.inventory.includes('hand-crossbow'));assert.equal(r.data.account.profile.gold,82);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'cannot buy an owned unique item');
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'frayed-hood'}});assert.equal(r.status,400,'shop stock is server-defined');

    r=await call('/v1/account/profile',{method:'PUT',token,body:{gold:999999,xp:999999,level:99}});assert.equal(r.status,403);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{matchId:'fake-match-id-123456',won:true,gold:999999,xp:999999}});assert.equal(r.status,404,'invented match ids cannot award rewards');
    r=await call('/v1/account',{token,origin:'https://evil.example'});assert.equal(r.status,403);

    r=await call('/v1/auth/logout',{method:'POST',token});assert.equal(r.status,200);
    r=await call('/v1/account',{token});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'wrong-password'}});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'abc123'}});assert.equal(r.status,200);
    assert(r.data.account.inventory.includes('hand-crossbow'),'inventory survives logout/login');
    assert.equal(r.data.account.profile.gold,82,'gold survives logout/login');assert.equal(r.data.account.profile.xp,ratProof.state.xp+banditProof.state.xp,'battle XP survives logout/login');
    assert.equal(r.data.account.world.currentNode,'gem-shop','world position survives logout/login');assert(r.data.account.world.clearedEncounters.includes('rat'),'rat clear survives logout/login');
    assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null],'Sack survives logout/login');

    const reloginToken=r.data.token;
    await db.prepare('DELETE FROM app_migrations WHERE key=?').run(DATA_RESET_KEY);
    assert.equal(await applyDataMigrations(db),true,'fresh-sacks reset applies once');
    r=await call('/v1/account',{token:reloginToken});assert.equal(r.status,200,'reset preserves login sessions and account credentials');
    assert.deepEqual(r.data.account.inventory,[],'reset wipes collected inventory');
    assert.deepEqual(r.data.account.sack,[null,null,null,null,null],'reset empties every Sack');
    assert.equal(r.data.account.needsStarter,true,'reset returns existing accounts to starter choice');
    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);
    assert.equal(r.data.account.world.currentNode,'camp');assert.deepEqual(r.data.account.world.clearedEncounters,[]);
    assert(Object.values(r.data.account.equipment).every(v=>v===null),'reset unequips physical gear');
    assert.equal(await applyDataMigrations(db),false,'fresh-sacks reset cannot run twice');

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
