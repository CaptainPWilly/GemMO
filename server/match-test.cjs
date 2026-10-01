'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDb,accountSnapshot,buySkill,chooseStarterWeapon,seedAccount,registerCharacter,moveWorld,startMatch,checkpointMatch,openMatch,surrenderMatch,consumeMatchItem,settleMatch,levelLeaderboard,cleanupMatches}=require('./db.cjs');
const {legalMoves,createRatCombat,applyCombatAction,suggestCombatAction,replayCombatTranscript}=require('./combat.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gemmo-resume-')),dbPath=path.join(dir,'game.db');let db;
 try{
  db=await createDb({dbPath,forceLocal:true});
  const user=await seedAccount(db,{usernameNorm:'resumehero',usernameDisplay:'ResumeHero',passwordHash:'test'}),other=await seedAccount(db,{usernameNorm:'otherhero',usernameDisplay:'OtherHero',passwordHash:'test'});
  await registerCharacter(db,user,'Resume Hero');await registerCharacter(db,other,'Other Hero');await chooseStarterWeapon(db,user,'dagger');await chooseStarterWeapon(db,other,'dagger');await moveWorld(db,user,'crossroads');await moveWorld(db,user,'rat');
  const match=await startMatch(db,user,'rat');
  await assert.rejects(startMatch(db,user,'rat'),e=>e.message==='unfinished_match');
  let seed=1,transcript,state;
  for(;seed<200;seed++){
   state=createRatCombat({version:'replay-v3',seed,sack:['dagger',null,null,null,null],rewardBudget:match.rewardBudget});transcript=[];
   while(state.pHP>0&&state.eHP>0&&transcript.length<100){const action=suggestCombatAction(state);if(!action)break;transcript.push(action);applyCombatAction(state,action)}
   if(state.eHP<=0&&state.longestCascade>=2)break;
  }
  assert(seed<200,'find a verified victory with a cascade');
  await db.prepare('UPDATE match_combat_proofs SET seed=? WHERE match_id=?').run(seed,match.matchId);
  const first=transcript.slice(0,1),checkpoint=await checkpointMatch(db,user,match.matchId,first);
  assert.equal(checkpoint.transcript.length,1);assert(checkpoint.state.rngCalls>0);
  assert.equal((await levelLeaderboard(db,user,'winrate')).you,null,'pending fights do not affect win rate');
  await assert.rejects(checkpointMatch(db,other,match.matchId,first),e=>e.message==='match_not_found');
  await assert.rejects(checkpointMatch(db,user,match.matchId,[{t:'swap',ax:99,ay:0,bx:98,by:0}]),e=>e.message==='checkpoint_conflict');
  await db.prepare('UPDATE matches SET started_at=0 WHERE id=?').run(match.matchId);await cleanupMatches(db);assert(await openMatch(db,user),'saved matches never expire as abandoned losses');
  db.close();db=await createDb({dbPath,forceLocal:true});
  const restored=await openMatch(db,user);assert.equal(restored.matchId,match.matchId);assert.deepEqual(restored.state,checkpoint.state,'restart restores exact verified board, charges, effects and RNG count');
  await checkpointMatch(db,user,match.matchId,transcript);
  await assert.rejects(settleMatch(db,user,{matchId:match.matchId,won:true,gold:0,xp:0,transcript:first}),e=>e.message==='checkpoint_conflict','settlement cannot rewind saved actions');
  const result=await settleMatch(db,user,{matchId:match.matchId,won:true,gold:9999,xp:9999,transcript});assert.equal(result.won,true);
  assert.equal(await openMatch(db,user),null);
  await settleMatch(db,user,{matchId:match.matchId,won:true,gold:0,xp:0,transcript});
  let leaders=await levelLeaderboard(db,user,'wins');assert.equal(leaders.you.wins,1,'settlement retries never duplicate stats');
  leaders=await levelLeaderboard(db,user,'gems');assert.equal(leaders.you.gems,state.gemsPopped,'gems derive from replay, not claimed rewards');
  leaders=await levelLeaderboard(db,user,'cascade');assert.equal(leaders.you.cascade,state.longestCascade);
  const second=await startMatch(db,user,'rat');
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'cherry-bomb','consumable',1)").run(user);
  await db.prepare('UPDATE match_consumable_proofs SET consumables_json=? WHERE match_id=?').run(JSON.stringify({'cherry-bomb':1}),second.matchId);
  await assert.rejects(checkpointMatch(db,user,second.matchId,[{t:'consume',itemId:'cherry-bomb'}]),e=>e.message==='consumable_proof_failed','a checkpoint cannot invent item use');
  await consumeMatchItem(db,user,second.matchId,'cherry-bomb');
  const bomb=await openMatch(db,user);assert.equal(bomb.state.targetMode,'consumable_break');assert.equal(bomb.state.consumables['cherry-bomb'],0,'paid bomb resumes without being charged twice');assert.equal(bomb.transcript[0].t,'consume');
  const bombActions=[...bomb.transcript,{t:'target',x:0,y:0}];const bombTarget=await checkpointMatch(db,user,second.matchId,bombActions);assert(bombTarget.state.gemsPopped>=1);
  await surrenderMatch(db,user,second.matchId);await surrenderMatch(db,user,second.matchId);
  leaders=await levelLeaderboard(db,user,'winrate');assert.equal(leaders.you.played,2);assert.equal(leaders.you.wins,1);assert.equal(leaders.you.winrate,50,'surrender counts as exactly one loss');
  assert.equal((await levelLeaderboard(db,user,'gems')).you.gems,state.gemsPopped+bombTarget.state.gemsPopped);
  leaders=await levelLeaderboard(db,other,'unlocked');assert.equal(leaders.entries[0].name,'Resume Hero','equal collections use stable account order');assert.equal(leaders.you.unlocked,1,'starter weapon counts before playing any match');
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'salve','gem',7)").run(other);
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'shield','gem',0)").run(other);
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'frayed-hood','gear',1)").run(other);
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'cherry-bomb','consumable',4)").run(other);
  await db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,'unknown-gem','gem',1)").run(other);
  leaders=await levelLeaderboard(db,other,'unlocked');assert.equal(leaders.entries[0].name,'Other Hero');assert.equal(leaders.you.rank,1);assert.equal(leaders.you.unlocked,2,'count distinct known owned gems, not quantities, gear or consumables');assert.equal(leaders.you.totalGemTypes,require('./catalog.cjs').GEM_IDS.length);assert(leaders.you.isYou);
  assert(!JSON.stringify(leaders).includes('otherhero'),'collection rankings expose character names only');
  const fallen=await seedAccount(db,{usernameNorm:'fallenhero',usernameDisplay:'FallenHero',passwordHash:'test'});await registerCharacter(db,fallen,'Fallen Hero');await chooseStarterWeapon(db,fallen,'crystal-wand');
  await buySkill(db,fallen,'blue-cap-1');assert((await accountSnapshot(db,fallen)).skills.purchased.includes('blue-cap-1'),'skills can be learned at Camp');
  await moveWorld(db,fallen,'crossroads');await moveWorld(db,fallen,'shrine');let fallAccount=await accountSnapshot(db,fallen);assert.equal(fallAccount.world.checkpoint,'shrine');assert(fallAccount.world.discoveredCheckpoints.includes('shrine'));
  await moveWorld(db,fallen,'crossroads');await moveWorld(db,fallen,'rat');const deathMatch=await startMatch(db,fallen,'rat');await assert.rejects(buySkill(db,fallen,'blue-cap-1'),/unfinished_match/);
  const deathState=createRatCombat({seed:13,sack:['crystal-wand',null,null,null,null],skills:['blue-cap-1'],rewardBudget:deathMatch.rewardBudget}),deathActions=[];
  while(deathState.pHP>0&&deathActions.length<200){const move=legalMoves(deathState)[0];assert(move);const [a,b]=move,action={t:'swap',ax:a.x,ay:a.y,bx:b.x,by:b.y};deathActions.push(action);assert(applyCombatAction(deathState,action))}
  assert(deathState.pHP<=0,'legal actions reach a verified death');await db.prepare("UPDATE match_combat_proofs SET seed=13,version='replay-v2' WHERE match_id=?").run(deathMatch.matchId);
  const beforeDeath=await accountSnapshot(db,fallen),deathResult=await settleMatch(db,fallen,{matchId:deathMatch.matchId,won:false,gold:0,xp:0,transcript:deathActions});assert.equal(deathResult.respawnNode,'shrine');fallAccount=await accountSnapshot(db,fallen);assert.equal(fallAccount.world.currentNode,'shrine');assert.equal(fallAccount.profile.xp,beforeDeath.profile.xp);assert.deepEqual(fallAccount.inventory,beforeDeath.inventory);
  await moveWorld(db,fallen,'crossroads');await settleMatch(db,fallen,{matchId:deathMatch.matchId,won:false,gold:0,xp:0,transcript:deathActions});assert.equal((await accountSnapshot(db,fallen)).world.currentNode,'crossroads','retry must not teleport again');
  assert.equal((await accountSnapshot(db,user)).world.currentNode,'rat','surrender does not pretend to be a verified death');
  await assert.rejects(levelLeaderboard(db,user,'unsafe SQL'),e=>e.message==='invalid_leaderboard');
  console.log('PASS: persistent match recovery, RNG state, checkpoint ownership/monotonicity, consumable recovery, idempotent statistics, win rate and all combat leaderboards.');
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
