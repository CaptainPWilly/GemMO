'use strict';
const {WEAPON_GEM_IDS,STARTER_WEAPON_IDS,validWeaponGems}=require('../shared/weapon-gems.js');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {GEM_SET,GEAR,CONSUMABLE_SET,EQUIPMENT_SLOTS,DEFAULT_STARTER_GEM,WORLD_NODES,SHOP_CATALOG,ENCOUNTERS}=require('./catalog.cjs');
const {randomUUID,randomInt}=require('node:crypto');
const {hashToken}=require('./security.cjs');
const {verifyCombatTranscript,replayCombatTranscript}=require('./combat.cjs');
const {QUESTS,CUTSCENES,NPCS}=require('../shared/story.js');
const {skillEffects,levelForXp,xpProgress,availableSkillPoints,canPurchase,normalizePurchased,rankMap}=require('../shared/progression.js');

const SCHEMA=[
  "CREATE TABLE IF NOT EXISTS player_checkpoints(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,node_id TEXT NOT NULL,updated_at INTEGER NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_checkpoints(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,transcript_json TEXT NOT NULL DEFAULT '[]',updated_at INTEGER NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_stats(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,gems_popped INTEGER NOT NULL DEFAULT 0,longest_cascade INTEGER NOT NULL DEFAULT 0) STRICT;",

  "CREATE TABLE IF NOT EXISTS characters(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,name_norm TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL) STRICT;",
  'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username_norm TEXT NOT NULL UNIQUE,username_display TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,failed_logins INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0) STRICT;',
  'CREATE TABLE IF NOT EXISTS profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,level INTEGER NOT NULL DEFAULT 1 CHECK(level>=1),xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),gold INTEGER NOT NULL DEFAULT 0 CHECK(gold>=0),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL) STRICT;',
  "CREATE TABLE IF NOT EXISTS inventory(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('gem','gear','consumable')),qty INTEGER NOT NULL DEFAULT 1 CHECK(qty>=0),PRIMARY KEY(user_id,item_id)) STRICT;",
  'CREATE TABLE IF NOT EXISTS sack_slots(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 4),gem_id TEXT NOT NULL,PRIMARY KEY(user_id,slot),UNIQUE(user_id,gem_id)) STRICT;',
  'CREATE TABLE IF NOT EXISTS equipment_slots(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,item_id TEXT,PRIMARY KEY(user_id,slot)) STRICT;',
  'CREATE TABLE IF NOT EXISTS starter_choices(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,gem_id TEXT NOT NULL,chosen_at INTEGER NOT NULL) STRICT;',
  "CREATE TABLE IF NOT EXISTS world_state(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,region TEXT NOT NULL DEFAULT 'brackenreach',current_node TEXT NOT NULL DEFAULT 'camp',updated_at INTEGER NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS world_flags(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,flag TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,flag)) STRICT;",
  "CREATE TABLE IF NOT EXISTS story_flags(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,flag TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,flag)) STRICT;",
  "CREATE TABLE IF NOT EXISTS quest_progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,quest_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','completed')),accepted_at INTEGER NOT NULL,completed_at INTEGER,PRIMARY KEY(user_id,quest_id)) STRICT;",
  "CREATE TABLE IF NOT EXISTS skill_unlocks(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,skill_id TEXT NOT NULL,purchased_at INTEGER NOT NULL,PRIMARY KEY(user_id,skill_id)) STRICT;",
  "CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,encounter_id TEXT NOT NULL,started_at INTEGER NOT NULL,settled_at INTEGER,won INTEGER,gold INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 0) STRICT;",
  "CREATE INDEX IF NOT EXISTS idx_matches_user_open ON matches(user_id,settled_at);",
  "CREATE TABLE IF NOT EXISTS match_reward_budgets(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,gold_cap INTEGER NOT NULL CHECK(gold_cap>=0),xp_cap INTEGER NOT NULL CHECK(xp_cap>=0)) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_combat_proofs(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,version TEXT NOT NULL,seed INTEGER NOT NULL,sack_json TEXT NOT NULL,equipment_json TEXT NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_skill_proofs(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,skills_json TEXT NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_consumable_proofs(match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,consumables_json TEXT NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS match_consumable_uses(match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,item_id TEXT NOT NULL,qty INTEGER NOT NULL DEFAULT 0 CHECK(qty>=0),PRIMARY KEY(match_id,item_id)) STRICT;",
  'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,revoked_at INTEGER) STRICT;',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);',
  "CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,type TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS app_migrations(key TEXT PRIMARY KEY,applied_at INTEGER NOT NULL) STRICT;"
];

function normalizeRun(result){
  return {
    changes:Number(result?.changes??result?.rowsAffected??0),
    lastInsertRowid:Number(result?.lastInsertRowid??result?.info?.lastInsertRowid??0)
  };
}
function localAdapter(conn,label,persistent=false){
  const api={
    kind:'local',
    storage:{provider:'sqlite',location:label,persistent},
    prepare(sql){
      const stmt=conn.prepare(sql);
      return {
        async get(...args){return stmt.get(...args)||null},
        async all(...args){return stmt.all(...args)},
        async run(...args){return normalizeRun(stmt.run(...args))}
      };
    },
    async exec(sql){conn.exec(sql)},
    async batch(statements,mode='immediate'){
      const begin=mode==='deferred'?'BEGIN':'BEGIN IMMEDIATE';
      conn.exec(begin);
      try{
        let last={changes:0,lastInsertRowid:0};
        for(const entry of statements){
          if(typeof entry==='string'){conn.exec(entry);continue}
          const stmt=conn.prepare(entry.sql),args=Array.isArray(entry.args)?entry.args:[];
          last=normalizeRun(stmt.run(...args));
        }
        conn.exec('COMMIT');return last;
      }catch(error){try{conn.exec('ROLLBACK')}catch{}throw error}
    },
    async transaction(fn){
      conn.exec('BEGIN IMMEDIATE');
      try{const value=await fn(api);conn.exec('COMMIT');return value}
      catch(error){try{conn.exec('ROLLBACK')}catch{}throw error}
    },
    close(){conn.close()}
  };
  return api;
}
function remoteAdapter(conn,label,transactionHandle=false){
  const api={
    kind:'turso',
    storage:{provider:'turso',location:label,persistent:true},
    prepare(sql){
      const stmtPromise=Promise.resolve(conn.prepare(sql));
      return {
        async get(...args){const stmt=await stmtPromise;return (await stmt.get(args))||null},
        async all(...args){const stmt=await stmtPromise;return await stmt.all(args)},
        async run(...args){const stmt=await stmtPromise;return normalizeRun(await stmt.run(args))}
      };
    },
    async exec(sql){return await conn.exec(sql)},
    async batch(statements,mode='immediate'){return await conn.batch(statements,mode)}
  };
  if(!transactionHandle)api.transaction=async fn=>{
    const runner=conn.transactionAsync(async tx=>fn(remoteAdapter(tx,label,true)));
    return await runner.immediate();
  };
  api.close=()=>{try{conn.close?.()}catch{}};
  return api;
}
function looksLikeTursoUrl(value){return /^(?:https?|libsql):\/\//i.test(String(value||''))}
function looksLikeJwt(value){return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value||''))}
function normalizeTursoConfig(rawUrl,rawToken){
  let url=String(rawUrl||'').trim(),authToken=String(rawToken||'').trim(),swapped=false;
  if(looksLikeJwt(url)&&looksLikeTursoUrl(authToken)){const hold=url;url=authToken;authToken=hold;swapped=true}
  if(url.toLowerCase().startsWith('libsql://'))url='https://'+url.slice('libsql://'.length);
  if(!looksLikeTursoUrl(url))throw Object.assign(new Error('invalid_turso_database_url'),{code:'INVALID_TURSO_CONFIG'});
  if(!authToken||looksLikeTursoUrl(authToken))throw Object.assign(new Error('invalid_turso_auth_token'),{code:'INVALID_TURSO_CONFIG'});
  return {url,authToken,swapped};
}
async function createDb(options={}){
  if(typeof options==='string')options={dbPath:options};
  const rawTursoUrl=String(options.tursoUrl??process.env.TURSO_DATABASE_URL??'').trim();
  const rawTursoAuthToken=String(options.tursoAuthToken??process.env.TURSO_AUTH_TOKEN??process.env.TURSO_DATABASE_AUTH_TOKEN??'').trim();
  if(!options.forceLocal&&(rawTursoUrl||rawTursoAuthToken)){
    if(!rawTursoUrl||!rawTursoAuthToken)throw Object.assign(new Error('incomplete_turso_config'),{code:'INVALID_TURSO_CONFIG'});
    const {url,authToken,swapped}=normalizeTursoConfig(rawTursoUrl,rawTursoAuthToken);
    if(swapped)console.warn('geMMO detected TURSO_DATABASE_URL and TURSO_AUTH_TOKEN were reversed; using corrected order. Fix the Render environment variables.');
    const {connect}=await import('@tursodatabase/serverless');
    const conn=connect({url,authToken});
    const db=remoteAdapter(conn,url);
    await db.batch(SCHEMA,'immediate');
    await applyDataMigrations(db);
    return db;
  }
  const dbPath=options.dbPath||':memory:';
  if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const conn=new DatabaseSync(dbPath,{open:true,timeout:5000});
  const db=localAdapter(conn,dbPath,dbPath!==':memory:'&&process.env.RENDER!=='true');
  await db.exec(['PRAGMA foreign_keys=ON;','PRAGMA journal_mode=WAL;','PRAGMA synchronous=NORMAL;','PRAGMA trusted_schema=OFF;',...SCHEMA].join('\n'));
  await applyDataMigrations(db);
  return db;
}
const DATA_RESET_KEY='2026-09-28-iron-dagger-start-v3';
async function transaction(db,fn){return db.transaction(fn)}
async function audit(db,userId,type,detail=''){await db.prepare('INSERT INTO audit_events(user_id,type,detail,created_at) VALUES(?,?,?,?)').run(userId??null,type,String(detail).slice(0,500),Date.now())}
const INVENTORY_KIND_MIGRATION_KEY='2026-09-28-consumables-v1';
async function applyDataMigrations(db){
  let changed=false;const now=Date.now();
  if(!(await db.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(DATA_RESET_KEY))){
    await transaction(db,async tx=>{
      if(await tx.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(DATA_RESET_KEY))return;
      await tx.prepare('DELETE FROM matches').run();await tx.prepare('DELETE FROM sack_slots').run();await tx.prepare('DELETE FROM starter_choices').run();await tx.prepare('DELETE FROM inventory').run();await tx.prepare('DELETE FROM world_flags').run();await tx.prepare('DELETE FROM story_flags').run();await tx.prepare('DELETE FROM quest_progress').run();await tx.prepare('DELETE FROM skill_unlocks').run();await tx.prepare('UPDATE equipment_slots SET item_id=NULL').run();
      await tx.prepare("UPDATE world_state SET region='brackenreach',current_node='camp',updated_at=?").run(now);await tx.prepare('UPDATE profiles SET level=1,xp=0,gold=0,updated_at=?').run(now);
      await tx.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) SELECT id,?,'gem',1 FROM users").run(DEFAULT_STARTER_GEM);await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) SELECT id,0,? FROM users').run(DEFAULT_STARTER_GEM);
      await tx.prepare('INSERT INTO app_migrations(key,applied_at) VALUES(?,?)').run(DATA_RESET_KEY,now);await tx.prepare('INSERT INTO audit_events(user_id,type,detail,created_at) VALUES(NULL,?,?,?)').run('global_progress_reset','iron-dagger-start-v3',now);
    });changed=true;
  }
  if(!(await db.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(INVENTORY_KIND_MIGRATION_KEY))){
    await transaction(db,async tx=>{
      if(await tx.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(INVENTORY_KIND_MIGRATION_KEY))return;
      await tx.prepare('DROP TABLE IF EXISTS inventory_v2').run();
      await tx.prepare("CREATE TABLE inventory_v2(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('gem','gear','consumable')),qty INTEGER NOT NULL DEFAULT 1 CHECK(qty>=0),PRIMARY KEY(user_id,item_id)) STRICT").run();
      await tx.prepare('INSERT INTO inventory_v2(user_id,item_id,kind,qty) SELECT user_id,item_id,kind,qty FROM inventory').run();await tx.prepare('DROP TABLE inventory').run();await tx.prepare('ALTER TABLE inventory_v2 RENAME TO inventory').run();
      await tx.prepare('INSERT INTO app_migrations(key,applied_at) VALUES(?,?)').run(INVENTORY_KIND_MIGRATION_KEY,Date.now());
    });changed=true;
  }
  const key='2026-09-29-one-weapon-gem-v1';
  if(!(await db.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(key))){
    await transaction(db,async tx=>{
      if(await tx.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(key))return;
      const placeholders=WEAPON_GEM_IDS.map(()=>'?').join(',');
      // Keep the first weapon equipped; all ownership and active combat proofs survive.
      await tx.prepare('DELETE FROM sack_slots WHERE gem_id IN ('+placeholders+') AND slot > (SELECT MIN(s.slot) FROM sack_slots s WHERE s.user_id=sack_slots.user_id AND s.gem_id IN ('+placeholders+'))').run(...WEAPON_GEM_IDS,...WEAPON_GEM_IDS);
      await tx.prepare('INSERT INTO app_migrations(key,applied_at) VALUES(?,?)').run(key,Date.now());
    });changed=true;
  }
  // Owner-requested, one-time test reset. Exact login identity; never a global wipe.
  const testResetKey='2026-09-30-pwilly-test-reset-v1';
  if(!(await db.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(testResetKey))){
    await transaction(db,async tx=>{
      if(await tx.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(testResetKey))return;
      const user=await tx.prepare('SELECT id FROM users WHERE username_norm=?').get('pwilly');
      if(user){
        const userId=Number(user.id);
        // Explicit child cleanup works with either database driver's FK settings.
        for(const table of ['match_checkpoints','match_stats','match_reward_budgets','match_combat_proofs','match_skill_proofs','match_consumable_proofs','match_consumable_uses'])await tx.prepare('DELETE FROM '+table+' WHERE match_id IN (SELECT id FROM matches WHERE user_id=?)').run(userId);
        for(const table of ['matches','sack_slots','starter_choices','inventory','world_flags','story_flags','quest_progress','skill_unlocks'])await tx.prepare('DELETE FROM '+table+' WHERE user_id=?').run(userId);
        await tx.prepare('UPDATE equipment_slots SET item_id=NULL WHERE user_id=?').run(userId);
        await tx.prepare("UPDATE world_state SET region='brackenreach',current_node='camp',updated_at=? WHERE user_id=?").run(now,userId);
        await tx.prepare('UPDATE profiles SET level=1,xp=0,gold=0,updated_at=? WHERE user_id=?').run(now,userId);
        await tx.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,'gem',1)").run(userId,DEFAULT_STARTER_GEM);
        await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,?)').run(userId,DEFAULT_STARTER_GEM);
        await audit(tx,userId,'requested_progress_reset',testResetKey);
      }
      // Mark even if absent so a future account with this name is never reset.
      await tx.prepare('INSERT INTO app_migrations(key,applied_at) VALUES(?,?)').run(testResetKey,now);
    });changed=true;
  }
  const starterKey='2026-10-01-warden-weapon-choice-v1';
  if(!(await db.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(starterKey))){
    await transaction(db,async tx=>{
      if(await tx.prepare('SELECT 1 ok FROM app_migrations WHERE key=?').get(starterKey))return;
      const users=await tx.prepare('SELECT u.id,p.xp,p.gold,w.current_node FROM users u JOIN profiles p ON p.user_id=u.id JOIN world_state w ON w.user_id=u.id WHERE NOT EXISTS(SELECT 1 FROM starter_choices c WHERE c.user_id=u.id)').all();
      for(const user of users){
        const inventory=await tx.prepare('SELECT item_id FROM inventory WHERE user_id=? AND qty>0').all(user.id),match=await tx.prepare('SELECT 1 ok FROM matches WHERE user_id=? LIMIT 1').get(user.id);
        // Only untouched automatic-dagger starts become empty. Established players keep everything.
        if(Number(user.xp)===0&&Number(user.gold)===0&&user.current_node==='camp'&&!match&&inventory.length===1&&inventory[0].item_id==='dagger'){
          await tx.prepare('DELETE FROM sack_slots WHERE user_id=?').run(user.id);await tx.prepare('DELETE FROM inventory WHERE user_id=?').run(user.id);
        }else{
          const weapon=inventory.find(row=>WEAPON_GEM_IDS.includes(row.item_id));
          await tx.prepare('INSERT INTO starter_choices(user_id,gem_id,chosen_at) VALUES(?,?,?)').run(user.id,weapon?.item_id||DEFAULT_STARTER_GEM,now);
        }
      }
      await tx.prepare('INSERT INTO app_migrations(key,applied_at) VALUES(?,?)').run(starterKey,now);
    });changed=true;
  }
  await db.prepare("INSERT OR IGNORE INTO player_checkpoints(user_id,node_id,updated_at) SELECT id,'shrine',? FROM users").run(now);
  return changed;
}
async function seedAccount(db,{usernameNorm,usernameDisplay,passwordHash}){
  return transaction(db,async tx=>{
    const now=Date.now(),result=await tx.prepare('INSERT INTO users(username_norm,username_display,password_hash,created_at) VALUES(?,?,?,?)').run(usernameNorm,usernameDisplay,passwordHash,now),userId=Number(result.lastInsertRowid);
    await tx.prepare('INSERT INTO profiles(user_id,level,xp,gold,created_at,updated_at) VALUES(?,1,0,0,?,?)').run(userId,now,now);
    for(const slot of Object.keys(EQUIPMENT_SLOTS))await tx.prepare('INSERT INTO equipment_slots(user_id,slot,item_id) VALUES(?,?,NULL)').run(userId,slot);
    await tx.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach','camp',?)").run(userId,now);
    await tx.prepare("INSERT INTO player_checkpoints(user_id,node_id,updated_at) VALUES(?,'shrine',?)").run(userId,now);
    await audit(tx,userId,'account_created_weapon_choice');
    return userId;
  });
}
async function userByName(db,usernameNorm){return await db.prepare('SELECT * FROM users WHERE username_norm=?').get(usernameNorm)}
async function registerCharacter(db,userId,value){
  const name=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  if(!/^[A-Za-z][A-Za-z0-9 '\-]{2,19}$/.test(name))throw Object.assign(new Error('invalid_character_name'),{status:400});
  return transaction(db,async tx=>{
    const existing=await tx.prepare('SELECT name FROM characters WHERE user_id=?').get(userId);
    if(existing){if(existing.name===name)return;throw Object.assign(new Error('character_already_registered'),{status:409})}
    if(await tx.prepare('SELECT user_id FROM characters WHERE name_norm=?').get(name.toLowerCase()))throw Object.assign(new Error('character_name_unavailable'),{status:409});
    try{await tx.prepare('INSERT INTO characters(user_id,name,name_norm,created_at) VALUES(?,?,?,?)').run(userId,name,name.toLowerCase(),Date.now())}catch(error){if(/unique/i.test(error.message))throw Object.assign(new Error('character_name_unavailable'),{status:409});throw error}
  });
}
async function levelLeaderboard(db,userId,metric='level'){
  if(metric==='unlocked'){
    const ids=[...GEM_SET],placeholders=ids.map(()=>'?').join(',');
    const ranking=`SELECT c.user_id,c.name,COALESCE(g.unlocked,0) unlocked,ROW_NUMBER() OVER (ORDER BY COALESCE(g.unlocked,0) DESC,c.user_id ASC) rank FROM characters c LEFT JOIN (SELECT user_id,COUNT(DISTINCT item_id) unlocked FROM inventory WHERE kind='gem' AND qty>0 AND item_id IN (${placeholders}) GROUP BY user_id) g ON g.user_id=c.user_id`;
    const format=r=>({rank:Number(r.rank),name:r.name,unlocked:Number(r.unlocked),totalGemTypes:ids.length,isYou:Number(r.user_id)===Number(userId)});
    const rows=await db.prepare(`SELECT * FROM (${ranking}) ORDER BY rank LIMIT 100`).all(...ids),me=await db.prepare(`SELECT * FROM (${ranking}) WHERE user_id=?`).get(...ids,userId);
    return {metric,entries:rows.map(format),you:me?format(me):null};
  }

  if(metric!=='level'){
    const orders={wins:'wins DESC',winrate:'rate DESC,wins DESC',cascade:'cascade DESC',gems:'gems DESC'};
    if(!orders[metric])throw Object.assign(new Error('invalid_leaderboard'),{status:400});
    const base=`SELECT c.user_id,c.name,p.xp,COALESCE(m.wins,0) wins,COALESCE(m.played,0) played,COALESCE(s.gems,0) gems,COALESCE(s.cascade,0) cascade,CASE WHEN m.played>0 THEN 100.0*m.wins/m.played ELSE 0 END rate FROM characters c JOIN profiles p ON p.user_id=c.user_id LEFT JOIN (SELECT user_id,SUM(CASE WHEN won=1 THEN 1 ELSE 0 END) wins,COUNT(*) played FROM matches WHERE settled_at IS NOT NULL GROUP BY user_id) m ON m.user_id=c.user_id LEFT JOIN (SELECT m.user_id,SUM(s.gems_popped) gems,MAX(s.longest_cascade) cascade FROM match_stats s JOIN matches m ON m.id=s.match_id WHERE m.settled_at IS NOT NULL GROUP BY m.user_id) s ON s.user_id=c.user_id`;
    const ranking=`SELECT *,ROW_NUMBER() OVER (ORDER BY ${orders[metric]},user_id ASC) rank FROM (${base}) WHERE played>0`;
    const format=r=>({rank:Number(r.rank),name:r.name,level:levelForXp(Number(r.xp)),xp:Number(r.xp),wins:Number(r.wins),played:Number(r.played),winrate:Number(r.rate),cascade:Number(r.cascade),gems:Number(r.gems),isYou:Number(r.user_id)===Number(userId)});
    const rows=await db.prepare(`SELECT * FROM (${ranking}) ORDER BY rank LIMIT 100`).all(),me=await db.prepare(`SELECT * FROM (${ranking}) WHERE user_id=?`).get(userId);
    return {metric,entries:rows.map(format),you:me?format(me):null};
  }

  const rows=await db.prepare('SELECT c.user_id,c.name,p.xp FROM characters c JOIN profiles p ON p.user_id=c.user_id ORDER BY p.xp DESC,c.user_id ASC LIMIT 100').all();
  const entries=rows.map((r,i)=>({rank:i+1,name:r.name,level:levelForXp(Number(r.xp)),xp:Number(r.xp),isYou:Number(r.user_id)===Number(userId)}));
  const me=await db.prepare('SELECT c.name,p.xp FROM characters c JOIN profiles p ON p.user_id=c.user_id WHERE c.user_id=?').get(userId);
  let you=null;if(me){const higher=await db.prepare('SELECT COUNT(*) n FROM characters c JOIN profiles p ON p.user_id=c.user_id WHERE p.xp>? OR (p.xp=? AND c.user_id<?)').get(me.xp,me.xp,userId);you={rank:Number(higher.n)+1,name:me.name,level:levelForXp(Number(me.xp)),xp:Number(me.xp)}}
  return {entries,you};
}
async function accountSnapshot(db,userId){
  const user=await db.prepare('SELECT id,username_display,created_at FROM users WHERE id=?').get(userId);if(!user)return null;
  const character=await db.prepare('SELECT name FROM characters WHERE user_id=?').get(userId);
  const starter=await db.prepare('SELECT gem_id FROM starter_choices WHERE user_id=?').get(userId);
  const checkpoint=await db.prepare('SELECT node_id FROM player_checkpoints WHERE user_id=?').get(userId);
  const checkpointRows=await db.prepare("SELECT flag FROM world_flags WHERE user_id=? AND flag LIKE 'checkpoint:%'").all(userId);
  const checkpointNode=WORLD_NODES[checkpoint?.node_id]?.checkpoint?checkpoint.node_id:'shrine';
  const pendingMatch=await db.prepare('SELECT m.id matchId,m.encounter_id encounterId FROM matches m JOIN match_checkpoints c ON c.match_id=m.id WHERE m.user_id=? AND m.settled_at IS NULL ORDER BY m.started_at DESC LIMIT 1').get(userId);
  const [profile,inventoryRows,equipmentRows,world,clearRows,sackRows,questRows,storyRows,skillRows]=await Promise.all([
    db.prepare('SELECT level,xp,gold,created_at,updated_at FROM profiles WHERE user_id=?').get(userId),
    db.prepare('SELECT item_id,kind,qty FROM inventory WHERE user_id=? AND qty>0 ORDER BY kind,item_id').all(userId),
    db.prepare('SELECT slot,item_id FROM equipment_slots WHERE user_id=? ORDER BY slot').all(userId),
    db.prepare('SELECT region,current_node,updated_at FROM world_state WHERE user_id=?').get(userId),
    db.prepare("SELECT flag FROM world_flags WHERE user_id=? AND flag LIKE 'encounter:%' ORDER BY flag").all(userId),
    db.prepare('SELECT slot,gem_id FROM sack_slots WHERE user_id=? ORDER BY slot').all(userId),
    db.prepare('SELECT quest_id,status,accepted_at,completed_at FROM quest_progress WHERE user_id=? ORDER BY accepted_at,quest_id').all(userId),
    db.prepare('SELECT flag FROM story_flags WHERE user_id=? ORDER BY flag').all(userId),
    db.prepare('SELECT skill_id FROM skill_unlocks WHERE user_id=? ORDER BY purchased_at,skill_id').all(userId)
  ]);
  const xp=Number(profile.xp),level=levelForXp(xp);if(Number(profile.level)!==level)await db.prepare('UPDATE profiles SET level=?,updated_at=? WHERE user_id=?').run(level,Date.now(),userId);
  const inventory=inventoryRows.map(r=>r.item_id),inventoryItems=inventoryRows.map(r=>({id:r.item_id,kind:r.kind,qty:Number(r.qty)})),sack=Array(5).fill(null),equipment=Object.fromEntries(equipmentRows.map(r=>[r.slot,r.item_id])),worldRow=world||{region:'brackenreach',current_node:'camp',updated_at:user.created_at},clearedEncounters=clearRows.map(r=>r.flag.slice(10)),purchased=normalizePurchased(skillRows.map(r=>r.skill_id));
  for(const row of sackRows)sack[Number(row.slot)]=row.gem_id;
  const quests=[];for(const row of questRows){const quest=QUESTS[row.quest_id];if(!quest)continue;let status=row.status;if(status==='active'&&await questObjectiveMet(db,userId,quest))status='ready';quests.push({id:row.quest_id,status,acceptedAt:Number(row.accepted_at),completedAt:row.completed_at==null?null:Number(row.completed_at)})}
  return {pendingMatch:pendingMatch||null,character:character?{name:character.name}:null,needsCharacterName:!character,user:{id:Number(user.id),username:user.username_display,createdAt:Number(user.created_at)},profile:{...profile,level,xp,gold:Number(profile.gold),created_at:Number(profile.created_at),updated_at:Number(profile.updated_at)},skills:{purchased,ranks:rankMap(purchased),availablePoints:availableSkillPoints(level,purchased),totalPoints:level,progress:xpProgress(xp)},sack,equipment,inventory,inventoryItems,starter:starter?.gem_id||null,needsStarter:!starter,world:{checkpoint:checkpointNode,discoveredCheckpoints:[...new Set([checkpointNode,...checkpointRows.map(row=>row.flag.slice(11)).filter(id=>WORLD_NODES[id]?.checkpoint)])],region:worldRow.region,currentNode:worldRow.current_node,updatedAt:Number(worldRow.updated_at),clearedEncounters},quests,story:{seenCutscenes:storyRows.map(r=>r.flag)}};
}
async function owns(db,userId,itemId){return !!(await db.prepare('SELECT 1 ok FROM inventory WHERE user_id=? AND item_id=? AND qty>0').get(userId,itemId))}
async function updateSack(db,userId,sack){
  if(!Array.isArray(sack)||sack.length!==5)throw Object.assign(new Error('invalid_sack'),{status:400});
  const equipped=sack.filter(Boolean);
  if(equipped.length<1||new Set(equipped).size!==equipped.length||!equipped.every(id=>GEM_SET.has(id)))throw Object.assign(new Error('invalid_sack'),{status:400});
  const current=await accountSnapshot(db,userId);
  const effects=[skillEffects(current.skills.purchased),...Object.values(current.equipment).map(id=>GEAR[id]).filter(Boolean)];
  if(!validWeaponGems(sack,effects))throw Object.assign(new Error('weapon_gem_limit'),{status:400});
  if(!(await Promise.all(equipped.map(id=>owns(db,userId,id)))).every(Boolean))throw Object.assign(new Error('unowned_item'),{status:403});
  await transaction(db,async tx=>{
    await tx.prepare('DELETE FROM sack_slots WHERE user_id=?').run(userId);
    for(let slot=0;slot<sack.length;slot++)if(sack[slot])await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,?,?)').run(userId,slot,sack[slot]);
    await audit(tx,userId,'sack_updated',equipped.join(','));
  });
}
async function hasWorldFlag(db,userId,flag){return !!(await db.prepare('SELECT 1 ok FROM world_flags WHERE user_id=? AND flag=?').get(userId,flag))}
async function questObjectiveMet(db,userId,quest){
  const objective=quest?.objective;if(!objective)return false;
  if(objective.type==='encounter-clear')return await hasWorldFlag(db,userId,'encounter:'+objective.encounterId);
  return false;
}
function npcNode(npcId){return NPCS[npcId]?.node||null}
async function storyQuestAction(db,userId,action,questId){
  const quest=QUESTS[questId];if(!quest||!['accept','turnin'].includes(action))throw Object.assign(new Error('invalid_quest_action'),{status:400});
  const world=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),requiredNode=npcNode(action==='accept'?quest.giver:quest.returnTo);
  if(!requiredNode||world?.current_node!==requiredNode)throw Object.assign(new Error('quest_npc_not_here'),{status:409});
  if(action==='accept'){
    const existing=await db.prepare('SELECT status FROM quest_progress WHERE user_id=? AND quest_id=?').get(userId,questId);
    if(existing)throw Object.assign(new Error(existing.status==='completed'?'quest_already_completed':'quest_already_active'),{status:409});
    const now=Date.now();await db.prepare("INSERT INTO quest_progress(user_id,quest_id,status,accepted_at) VALUES(?,?,'active',?)").run(userId,questId,now);await audit(db,userId,'quest_accepted',questId);return;
  }
  const row=await db.prepare('SELECT status FROM quest_progress WHERE user_id=? AND quest_id=?').get(userId,questId);
  if(!row||row.status!=='active')throw Object.assign(new Error('quest_not_active'),{status:409});
  if(!(await questObjectiveMet(db,userId,quest)))throw Object.assign(new Error('quest_objective_incomplete'),{status:409});
  await transaction(db,async tx=>{
    const current=await tx.prepare('SELECT status FROM quest_progress WHERE user_id=? AND quest_id=?').get(userId,questId);
    if(!current||current.status!=='active')throw Object.assign(new Error('quest_not_active'),{status:409});
    if(!(await questObjectiveMet(tx,userId,quest)))throw Object.assign(new Error('quest_objective_incomplete'),{status:409});
    const now=Date.now(),gold=Number(quest.reward?.gold)||0,xp=Number(quest.reward?.xp)||0,profile=await tx.prepare('SELECT xp FROM profiles WHERE user_id=?').get(userId),nextXp=Number(profile?.xp||0)+xp,nextLevel=levelForXp(nextXp);
    await tx.prepare("UPDATE quest_progress SET status='completed',completed_at=? WHERE user_id=? AND quest_id=? AND status='active'").run(now,userId,questId);
    await tx.prepare('UPDATE profiles SET gold=gold+?,xp=?,level=?,updated_at=? WHERE user_id=?').run(gold,nextXp,nextLevel,now,userId);
    await audit(tx,userId,'quest_completed',questId+':g'+gold+':xp'+xp+':lv'+nextLevel);
  });
}
async function markCutsceneSeen(db,userId,cutsceneId){
  if(!CUTSCENES[cutsceneId])throw Object.assign(new Error('invalid_cutscene'),{status:400});
  await db.prepare('INSERT OR IGNORE INTO story_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,cutsceneId,Date.now());
  await audit(db,userId,'cutscene_seen',cutsceneId);
}
async function chooseStarterWeapon(db,userId,gemId){
  if(!STARTER_WEAPON_IDS.includes(gemId))throw Object.assign(new Error('invalid_starter_weapon'),{status:400});
  return transaction(db,async tx=>{
    const choice=await tx.prepare('SELECT gem_id FROM starter_choices WHERE user_id=?').get(userId);
    if(choice){if(choice.gem_id===gemId)return;throw Object.assign(new Error('starter_already_chosen'),{status:409})}
    if(!await tx.prepare('SELECT 1 ok FROM characters WHERE user_id=?').get(userId))throw Object.assign(new Error('character_name_required'),{status:403});
    const world=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId);
    if(world?.current_node!=='camp')throw Object.assign(new Error('starter_not_at_camp'),{status:409});
    if(await tx.prepare('SELECT 1 ok FROM matches WHERE user_id=? AND settled_at IS NULL').get(userId))throw Object.assign(new Error('unfinished_match'),{status:409});
    await tx.prepare('INSERT INTO starter_choices(user_id,gem_id,chosen_at) VALUES(?,?,?)').run(userId,gemId,Date.now());
    await tx.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,'gem',1) ON CONFLICT(user_id,item_id) DO NOTHING").run(userId,gemId);
    await tx.prepare('DELETE FROM sack_slots WHERE user_id=?').run(userId);
    await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,?)').run(userId,gemId);
    await audit(tx,userId,'starter_weapon_chosen',gemId);
  });
}
async function requireStarterWeapon(db,userId){if(!await db.prepare('SELECT 1 ok FROM starter_choices WHERE user_id=?').get(userId))throw Object.assign(new Error('choose_weapon_with_warden'),{status:409})}
async function moveWorld(db,userId,nodeId){
  if(nodeId!=='camp')await requireStarterWeapon(db,userId);
  const target=WORLD_NODES[nodeId];if(!target)throw Object.assign(new Error('invalid_world_node'),{status:400});
  return transaction(db,async tx=>{
  const row=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),current=row?.current_node||'camp',from=WORLD_NODES[current];
  if(nodeId!==current&&!from?.neighbors.includes(nodeId))throw Object.assign(new Error('world_path_blocked'),{status:409});
  if(nodeId!==current&&target.requires&&!(await hasWorldFlag(tx,userId,'encounter:'+target.requires)))throw Object.assign(new Error('world_path_locked'),{status:409});
  const now=Date.now();
  await tx.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach',?,?) ON CONFLICT(user_id) DO UPDATE SET current_node=excluded.current_node,updated_at=excluded.updated_at").run(userId,nodeId,now);
  if(target.checkpoint){
    await tx.prepare('INSERT INTO player_checkpoints(user_id,node_id,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET node_id=excluded.node_id,updated_at=excluded.updated_at').run(userId,nodeId,now);
    await tx.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,'checkpoint:'+nodeId,now);
  }
  await audit(tx,userId,'world_moved',current+'>'+nodeId);
  });
}
async function completeEncounter(db,userId,encounterId){
  const row=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  const flag='encounter:'+encounterId,now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,flag,now);
  await audit(db,userId,'encounter_cleared',encounterId);
}
function rollRewardBudget(encounterId){
  const policy=ENCOUNTERS[encounterId]?.reward;if(!policy)return null;
  return {gold:randomInt(policy.gold[0],policy.gold[1]+1),xp:randomInt(policy.xp[0],policy.xp[1]+1)};
}
async function replayStoredMatch(db,userId,matchId,transcript){
  const match=await db.prepare('SELECT * FROM matches WHERE id=? AND user_id=?').get(matchId,userId);if(!match)throw Object.assign(new Error('match_not_found'),{status:404});
  if(match.settled_at!=null)throw Object.assign(new Error('match_already_settled'),{status:409});
  const proof=await db.prepare('SELECT * FROM match_combat_proofs WHERE match_id=?').get(matchId),skills=await db.prepare('SELECT skills_json FROM match_skill_proofs WHERE match_id=?').get(matchId),items=await db.prepare('SELECT consumables_json FROM match_consumable_proofs WHERE match_id=?').get(matchId),budget=await db.prepare('SELECT gold_cap,xp_cap FROM match_reward_budgets WHERE match_id=?').get(matchId),checkpoint=await db.prepare('SELECT transcript_json FROM match_checkpoints WHERE match_id=?').get(matchId);
  if(!proof)throw Object.assign(new Error('match_not_resumable'),{status:409});
  const actions=transcript??JSON.parse(checkpoint?.transcript_json||'[]');
  const state=replayCombatTranscript({encounterId:match.encounter_id,seed:Number(proof.seed),version:proof.version,sack:JSON.parse(proof.sack_json),equipment:JSON.parse(proof.equipment_json),skills:JSON.parse(skills?.skills_json||'[]'),consumables:JSON.parse(items?.consumables_json||'{}'),rewardBudget:{gold:Number(budget?.gold_cap||0),xp:Number(budget?.xp_cap||0)},transcript:actions});
  return {matchId,encounterId:match.encounter_id,authority:{mode:proof.version,seed:Number(proof.seed)},rewardBudget:state.rewardBudget,transcript:actions,state};
}
async function openMatch(db,userId){
  const row=await db.prepare('SELECT m.id FROM matches m JOIN match_checkpoints c ON c.match_id=m.id WHERE m.user_id=? AND m.settled_at IS NULL ORDER BY m.started_at DESC LIMIT 1').get(userId);
  return row?await replayStoredMatch(db,userId,row.id):null;
}
async function checkpointMatch(db,userId,matchId,transcript){
  return transaction(db,async tx=>{
    const row=await tx.prepare('SELECT transcript_json FROM match_checkpoints WHERE match_id=?').get(matchId);if(!row)throw Object.assign(new Error('match_not_resumable'),{status:409});
    const saved=JSON.parse(row.transcript_json);if(!Array.isArray(transcript)||transcript.length>1024)throw Object.assign(new Error('invalid_combat_proof'),{status:400});
    const length=Math.min(saved.length,transcript.length);for(let i=0;i<length;i++)if(JSON.stringify(saved[i])!==JSON.stringify(transcript[i]))throw Object.assign(new Error('checkpoint_conflict'),{status:409});
    const result=await replayStoredMatch(tx,userId,matchId,transcript.length>=saved.length?transcript:saved);
    const uses=await tx.prepare('SELECT item_id,qty FROM match_consumable_uses WHERE match_id=?').all(matchId),recorded=Object.fromEntries(uses.map(r=>[r.item_id,Number(r.qty)]));
    for(const id of new Set([...Object.keys(recorded),...Object.keys(result.state.usedConsumables)]))if((recorded[id]||0)!==(result.state.usedConsumables[id]||0))throw Object.assign(new Error('consumable_proof_failed'),{status:409});
    if(transcript.length>=saved.length)await tx.prepare('UPDATE match_checkpoints SET transcript_json=?,updated_at=? WHERE match_id=?').run(JSON.stringify(transcript),Date.now(),matchId);
    return result;
  });
}
async function surrenderMatch(db,userId,matchId){
  const row=await db.prepare('SELECT transcript_json FROM match_checkpoints WHERE match_id=?').get(matchId);
  return await settleMatch(db,userId,{matchId,won:false,gold:0,xp:0,transcript:JSON.parse(row?.transcript_json||'[]')});
}
async function startMatch(db,userId,encounterId){
  await requireStarterWeapon(db,userId);
  const row=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  const rewardBudget=rollRewardBudget(encounterId);if(!rewardBudget)throw Object.assign(new Error('invalid_encounter'),{status:400});
  const id=randomUUID(),now=Date.now(),authority={mode:'replay-v2',seed:randomInt(0,0x100000000)};
  await transaction(db,async tx=>{
    const pending=await tx.prepare('SELECT m.id FROM matches m JOIN match_checkpoints c ON c.match_id=m.id WHERE m.user_id=? AND m.settled_at IS NULL LIMIT 1').get(userId);if(pending)throw Object.assign(new Error('unfinished_match'),{status:409});
    await tx.prepare('INSERT INTO matches(id,user_id,encounter_id,started_at) VALUES(?,?,?,?)').run(id,userId,encounterId,now);
    await tx.prepare('INSERT INTO match_checkpoints(match_id,updated_at) VALUES(?,?)').run(id,now);
    await tx.prepare('INSERT INTO match_reward_budgets(match_id,gold_cap,xp_cap) VALUES(?,?,?)').run(id,rewardBudget.gold,rewardBudget.xp);
    if(authority){
      const sack=Array(5).fill(null),equipment=Object.fromEntries(Object.keys(EQUIPMENT_SLOTS).map(slot=>[slot,null]));
      for(const row of await tx.prepare('SELECT slot,gem_id FROM sack_slots WHERE user_id=? ORDER BY slot').all(userId))sack[Number(row.slot)]=row.gem_id;
      for(const row of await tx.prepare('SELECT slot,item_id FROM equipment_slots WHERE user_id=? ORDER BY slot').all(userId))equipment[row.slot]=row.item_id;
      const skills=normalizePurchased((await tx.prepare('SELECT skill_id FROM skill_unlocks WHERE user_id=? ORDER BY purchased_at,skill_id').all(userId)).map(r=>r.skill_id));
      const consumables=Object.fromEntries((await tx.prepare("SELECT item_id,qty FROM inventory WHERE user_id=? AND kind='consumable' AND qty>0").all(userId)).map(r=>[r.item_id,Number(r.qty)]));
      await tx.prepare('INSERT INTO match_combat_proofs(match_id,version,seed,sack_json,equipment_json) VALUES(?,?,?,?,?)').run(id,authority.mode,authority.seed,JSON.stringify(sack),JSON.stringify(equipment));
      await tx.prepare('INSERT INTO match_skill_proofs(match_id,skills_json) VALUES(?,?)').run(id,JSON.stringify(skills));
      await tx.prepare('INSERT INTO match_consumable_proofs(match_id,consumables_json) VALUES(?,?)').run(id,JSON.stringify(consumables));
    }
    await audit(tx,userId,'match_started',encounterId+':'+id+':budget'+rewardBudget.gold+'/'+rewardBudget.xp+(authority?':'+authority.mode:''));
  });
  return {matchId:id,encounterId,rewardBudget,authority};
}
async function consumeMatchItem(db,userId,matchId,itemId){
  if(typeof matchId!=='string'||!CONSUMABLE_SET.has(itemId))throw Object.assign(new Error('invalid_consumable'),{status:400});
  return transaction(db,async tx=>{
    const match=await tx.prepare('SELECT settled_at FROM matches WHERE id=? AND user_id=?').get(matchId,userId);if(!match)throw Object.assign(new Error('match_not_found'),{status:404});if(match.settled_at!=null)throw Object.assign(new Error('match_already_settled'),{status:409});
    const proof=await tx.prepare('SELECT consumables_json FROM match_consumable_proofs WHERE match_id=?').get(matchId),available=proof?JSON.parse(proof.consumables_json):{},limit=Number(available[itemId]||0),usedRow=await tx.prepare('SELECT qty FROM match_consumable_uses WHERE match_id=? AND item_id=?').get(matchId,itemId),used=Number(usedRow?.qty||0);
    if(used>=limit)throw Object.assign(new Error('consumable_not_in_match'),{status:409});
    const row=await tx.prepare("SELECT qty FROM inventory WHERE user_id=? AND item_id=? AND kind='consumable'").get(userId,itemId);if(!row||Number(row.qty)<1)throw Object.assign(new Error('consumable_unavailable'),{status:409});
    await tx.prepare('UPDATE inventory SET qty=qty-1 WHERE user_id=? AND item_id=? AND qty>0').run(userId,itemId);await tx.prepare('DELETE FROM inventory WHERE user_id=? AND item_id=? AND qty<=0').run(userId,itemId);
    await tx.prepare('INSERT INTO match_consumable_uses(match_id,item_id,qty) VALUES(?,?,1) ON CONFLICT(match_id,item_id) DO UPDATE SET qty=qty+1').run(matchId,itemId);await audit(tx,userId,'consumable_used',matchId+':'+itemId);
    const checkpoint=await tx.prepare('SELECT transcript_json FROM match_checkpoints WHERE match_id=?').get(matchId);
    if(checkpoint){const actions=[...JSON.parse(checkpoint.transcript_json),{t:'consume',itemId}];await replayStoredMatch(tx,userId,matchId,actions);await tx.prepare('UPDATE match_checkpoints SET transcript_json=?,updated_at=? WHERE match_id=?').run(JSON.stringify(actions),Date.now(),matchId)}

  });
}
async function settleMatch(db,userId,{matchId,won,gold,xp,transcript}){
  if(typeof matchId!=='string'||matchId.length<16||matchId.length>80||typeof won!=='boolean'||!Number.isInteger(gold)||!Number.isInteger(xp)||gold<0||xp<0||(!won&&(gold!==0||xp!==0)))throw Object.assign(new Error('invalid_match_result'),{status:400});
  return transaction(db,async tx=>{
    const match=await tx.prepare('SELECT * FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
    if(!match)throw Object.assign(new Error('match_not_found'),{status:404});
    if(match.settled_at!==null&&match.settled_at!==undefined)return {alreadySettled:true,won:Boolean(match.won),gold:Number(match.gold),xp:Number(match.xp),encounterId:match.encounter_id};
    const savedCheckpoint=await tx.prepare('SELECT transcript_json FROM match_checkpoints WHERE match_id=?').get(matchId);if(savedCheckpoint&&Array.isArray(transcript)){const saved=JSON.parse(savedCheckpoint.transcript_json);if(transcript.length<saved.length||saved.some((a,i)=>JSON.stringify(a)!==JSON.stringify(transcript[i])))throw Object.assign(new Error('checkpoint_conflict'),{status:409})}
    const now=Date.now(),proof=await tx.prepare('SELECT version,seed,sack_json,equipment_json FROM match_combat_proofs WHERE match_id=?').get(matchId),useRows=await tx.prepare('SELECT item_id,qty FROM match_consumable_uses WHERE match_id=?').all(matchId),recordedUses=Object.fromEntries(useRows.map(r=>[r.item_id,Number(r.qty)]));let replay=null;
    if(['replay-v1','replay-v2'].includes(proof?.version)&&(won||useRows.length||Array.isArray(transcript))){
      const skillProof=await tx.prepare('SELECT skills_json FROM match_skill_proofs WHERE match_id=?').get(matchId),skills=normalizePurchased(skillProof?JSON.parse(skillProof.skills_json):[]),consumableProof=await tx.prepare('SELECT consumables_json FROM match_consumable_proofs WHERE match_id=?').get(matchId),consumables=consumableProof?JSON.parse(consumableProof.consumables_json):{},stored=await tx.prepare('SELECT gold_cap,xp_cap FROM match_reward_budgets WHERE match_id=?').get(matchId),policy0=ENCOUNTERS[match.encounter_id]?.reward,budget0=stored?{gold:Number(stored.gold_cap),xp:Number(stored.xp_cap)}:{gold:policy0?.gold?.[1]||0,xp:policy0?.xp?.[1]||0};
      if(!Array.isArray(transcript))throw Object.assign(new Error('invalid_combat_proof'),{status:400});
      replay=verifyCombatTranscript({encounterId:match.encounter_id,seed:Number(proof.seed),sack:JSON.parse(proof.sack_json),equipment:JSON.parse(proof.equipment_json),skills,consumables,rewardBudget:budget0,transcript,version:proof.version});
      const replayUses=replay.usedConsumables||{},ids=new Set([...Object.keys(recordedUses),...Object.keys(replayUses)]);for(const id of ids)if(Number(recordedUses[id]||0)!==Number(replayUses[id]||0))throw Object.assign(new Error('consumable_proof_failed'),{status:409});
    }
    if(!won){
      const changed=await tx.prepare('UPDATE matches SET settled_at=?,won=0,gold=0,xp=0 WHERE id=? AND user_id=? AND settled_at IS NULL').run(now,matchId,userId);
      if(!changed.changes){
        const settled=await tx.prepare('SELECT won,gold,xp,encounter_id FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
        return {alreadySettled:true,won:Boolean(settled.won),gold:Number(settled.gold),xp:Number(settled.xp),encounterId:settled.encounter_id};
      }
      if(replay)await tx.prepare('INSERT OR IGNORE INTO match_stats(match_id,gems_popped,longest_cascade) VALUES(?,?,?)').run(matchId,replay.gemsPopped||0,replay.longestCascade||0);
      let respawnNode=null;
      if(replay&&replay.pHP<=0){
        const checkpoint=await tx.prepare('SELECT node_id FROM player_checkpoints WHERE user_id=?').get(userId);
        respawnNode=WORLD_NODES[checkpoint?.node_id]?.checkpoint?checkpoint.node_id:'shrine';
        await tx.prepare("UPDATE world_state SET region='brackenreach',current_node=?,updated_at=? WHERE user_id=?").run(respawnNode,now,userId);
        await audit(tx,userId,'respawned',respawnNode+':'+matchId);
      }
      await audit(tx,userId,'match_settled_loss',match.encounter_id+':'+matchId);
      return {alreadySettled:false,won:false,gold:0,xp:0,encounterId:match.encounter_id,respawnNode};
    }
    const row=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
    if(!node?.encounter||node.encounter!==match.encounter_id)throw Object.assign(new Error('encounter_not_here'),{status:409});
    const policy=ENCOUNTERS[match.encounter_id]?.reward;if(!policy)throw Object.assign(new Error('invalid_encounter'),{status:400});
    const storedBudget=await tx.prepare('SELECT gold_cap,xp_cap FROM match_reward_budgets WHERE match_id=?').get(matchId);
    const rewardBudget=storedBudget?{gold:Number(storedBudget.gold_cap),xp:Number(storedBudget.xp_cap)}:{gold:policy.gold[1],xp:policy.xp[1]};
    let awardGold=Math.min(gold,rewardBudget.gold),awardXp=Math.min(xp,rewardBudget.xp),authority='legacy-budget';
    if(['replay-v1','replay-v2'].includes(proof?.version)){
      if(!replay){const skillProof=await tx.prepare('SELECT skills_json FROM match_skill_proofs WHERE match_id=?').get(matchId),skills=normalizePurchased(skillProof?JSON.parse(skillProof.skills_json):[]),consumableProof=await tx.prepare('SELECT consumables_json FROM match_consumable_proofs WHERE match_id=?').get(matchId),consumables=consumableProof?JSON.parse(consumableProof.consumables_json):{};replay=verifyCombatTranscript({encounterId:match.encounter_id,seed:Number(proof.seed),sack:JSON.parse(proof.sack_json),equipment:JSON.parse(proof.equipment_json),skills,consumables,rewardBudget,transcript,version:proof.version})}
      if(!replay.won)throw Object.assign(new Error('combat_proof_failed'),{status:409});
      awardGold=replay.gold;awardXp=replay.xp;authority=proof.version;
      if(gold!==awardGold||xp!==awardXp)await audit(tx,userId,'match_result_mismatch',match.encounter_id+':'+matchId+':client'+gold+'/'+xp+':server'+awardGold+'/'+awardXp);
    }else if(gold>rewardBudget.gold||xp>rewardBudget.xp)await audit(tx,userId,'match_reward_overclaim',match.encounter_id+':'+matchId+':asked'+gold+'/'+xp+':budget'+rewardBudget.gold+'/'+rewardBudget.xp);
    const changed=await tx.prepare('UPDATE matches SET settled_at=?,won=1,gold=?,xp=? WHERE id=? AND user_id=? AND settled_at IS NULL').run(now,awardGold,awardXp,matchId,userId);
    if(!changed.changes){
      const settled=await tx.prepare('SELECT gold,xp,encounter_id FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
      return {alreadySettled:true,gold:Number(settled.gold),xp:Number(settled.xp),encounterId:settled.encounter_id};
    }
    const profile=await tx.prepare('SELECT xp FROM profiles WHERE user_id=?').get(userId),nextXp=Number(profile?.xp||0)+awardXp,nextLevel=levelForXp(nextXp);
    await tx.prepare('UPDATE profiles SET gold=gold+?,xp=?,level=?,updated_at=? WHERE user_id=?').run(awardGold,nextXp,nextLevel,now,userId);
    await tx.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,'encounter:'+match.encounter_id,now);
    if(replay)await tx.prepare('INSERT OR IGNORE INTO match_stats(match_id,gems_popped,longest_cascade) VALUES(?,?,?)').run(matchId,replay.gemsPopped||0,replay.longestCascade||0);
    await audit(tx,userId,'match_settled',match.encounter_id+':'+matchId+':g'+awardGold+':xp'+awardXp);
    return {alreadySettled:false,won:true,gold:awardGold,xp:awardXp,encounterId:match.encounter_id,rewardBudget,authority};
  });
}
async function cleanupMatches(db,staleMs=24*60*60*1000){
  const now=Date.now(),cutoff=now-staleMs;
  return await db.prepare('UPDATE matches SET settled_at=?,won=0,gold=0,xp=0 WHERE settled_at IS NULL AND started_at<? AND id NOT IN (SELECT match_id FROM match_checkpoints)').run(now,cutoff);
}
async function buySkill(db,userId,skillId){
  return transaction(db,async tx=>{
    if(await tx.prepare('SELECT 1 ok FROM matches WHERE user_id=? AND settled_at IS NULL').get(userId))throw Object.assign(new Error('unfinished_match'),{status:409});
    const profile=await tx.prepare('SELECT level,xp FROM profiles WHERE user_id=?').get(userId);if(!profile)throw Object.assign(new Error('profile_missing'),{status:404});
    const level=levelForXp(Number(profile.xp)),rows=await tx.prepare('SELECT skill_id FROM skill_unlocks WHERE user_id=? ORDER BY purchased_at,skill_id').all(userId),purchased=normalizePurchased(rows.map(r=>r.skill_id)),check=canPurchase(skillId,purchased,level);
    if(!check.ok)throw Object.assign(new Error(check.reason),{status:check.reason==='invalid_skill'?400:409});
    const now=Date.now();await tx.prepare('INSERT INTO skill_unlocks(user_id,skill_id,purchased_at) VALUES(?,?,?)').run(userId,check.token,now);if(Number(profile.level)!==level)await tx.prepare('UPDATE profiles SET level=?,updated_at=? WHERE user_id=?').run(level,now,userId);await audit(tx,userId,'skill_unlocked',skillId+':rank'+check.nextRank+':lv'+level);return check.token;
  });
}
async function buyShopItem(db,userId,shopId,itemId){
  const catalog=SHOP_CATALOG[shopId],price=catalog?.[itemId];
  if(!catalog||!Number.isInteger(price))throw Object.assign(new Error('item_not_sold_here'),{status:400});
  const kind=GEAR[itemId]?'gear':GEM_SET.has(itemId)?'gem':CONSUMABLE_SET.has(itemId)?'consumable':null;if(!kind)throw Object.assign(new Error('invalid_shop_item'),{status:400});
  await transaction(db,async tx=>{
    const world=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId);
    if(world?.current_node!==shopId)throw Object.assign(new Error('not_at_shop'),{status:409});
    if(kind!=='consumable'&&await owns(tx,userId,itemId))throw Object.assign(new Error('already_owned'),{status:409});
    const profile=await tx.prepare('SELECT gold FROM profiles WHERE user_id=?').get(userId);
    if(!profile||Number(profile.gold)<price)throw Object.assign(new Error('insufficient_gold'),{status:409});
    await tx.prepare('UPDATE profiles SET gold=gold-?,updated_at=? WHERE user_id=?').run(price,Date.now(),userId);
    if(kind==='consumable')await tx.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,'consumable',1) ON CONFLICT(user_id,item_id) DO UPDATE SET qty=qty+1").run(userId,itemId);else await tx.prepare('INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,?,1)').run(userId,itemId,kind);
    await audit(tx,userId,'shop_purchase',shopId+':'+itemId+':'+price);
  });
}
async function updateEquipment(db,userId,equipment){
  if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))throw Object.assign(new Error('invalid_equipment'),{status:400});
  const slots=Object.keys(EQUIPMENT_SLOTS);if(Object.keys(equipment).some(k=>!slots.includes(k)))throw Object.assign(new Error('invalid_equipment'),{status:400});
  const used=new Set(),ownedChecks=[];
  for(const slot of slots){
    const itemId=equipment[slot]??null;if(itemId===null)continue;
    const gear=GEAR[itemId];if(!gear||gear.slot!==EQUIPMENT_SLOTS[slot])throw Object.assign(new Error('wrong_slot'),{status:400});
    if(used.has(itemId))throw Object.assign(new Error('duplicate_physical_item'),{status:400});used.add(itemId);ownedChecks.push(owns(db,userId,itemId));
  }
  if(!(await Promise.all(ownedChecks)).every(Boolean))throw Object.assign(new Error('unowned_item'),{status:403});
  await transaction(db,async tx=>{
    for(const slot of slots)await tx.prepare('UPDATE equipment_slots SET item_id=? WHERE user_id=? AND slot=?').run(equipment[slot]??null,userId,slot);
    await audit(tx,userId,'equipment_updated');
  });
}
async function createSession(db,userId,token,ttlMs){const now=Date.now();await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?)').run(hashToken(token),userId,now,now+ttlMs,now)}
async function sessionUser(db,token){
  if(!token)return null;const now=Date.now(),hash=hashToken(token),row=await db.prepare('SELECT s.token_hash,s.user_id,s.expires_at,s.revoked_at,u.username_display FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash);
  if(!row||row.revoked_at||Number(row.expires_at)<=now)return null;
  await db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(now,hash);
  return {id:Number(row.user_id),username:row.username_display,tokenHash:hash};
}
async function revokeSession(db,token){if(token)await db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').run(Date.now(),hashToken(token))}
async function cleanupSessions(db){await db.prepare('DELETE FROM sessions WHERE expires_at<? OR revoked_at IS NOT NULL').run(Date.now())}

module.exports={chooseStarterWeapon,checkpointMatch,openMatch,surrenderMatch,registerCharacter,levelLeaderboard,createDb,remoteAdapter,normalizeTursoConfig,transaction,audit,applyDataMigrations,DATA_RESET_KEY,seedAccount,userByName,accountSnapshot,updateSack,updateEquipment,moveWorld,completeEncounter,startMatch,consumeMatchItem,settleMatch,cleanupMatches,buySkill,buyShopItem,storyQuestAction,markCutsceneSeen,questObjectiveMet,createSession,sessionUser,revokeSession,cleanupSessions};
