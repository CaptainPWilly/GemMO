'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {GEM_SET,GEAR,EQUIPMENT_SLOTS,STARTER_GEM_SET,WORLD_NODES,SHOP_CATALOG}=require('./catalog.cjs');
const {randomUUID}=require('node:crypto');
const {hashToken}=require('./security.cjs');

const SCHEMA=[
  'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username_norm TEXT NOT NULL UNIQUE,username_display TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,failed_logins INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0) STRICT;',
  'CREATE TABLE IF NOT EXISTS profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,level INTEGER NOT NULL DEFAULT 1 CHECK(level>=1),xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),gold INTEGER NOT NULL DEFAULT 0 CHECK(gold>=0),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL) STRICT;',
  "CREATE TABLE IF NOT EXISTS inventory(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('gem','gear')),qty INTEGER NOT NULL DEFAULT 1 CHECK(qty>=0),PRIMARY KEY(user_id,item_id)) STRICT;",
  'CREATE TABLE IF NOT EXISTS sack_slots(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 4),gem_id TEXT NOT NULL,PRIMARY KEY(user_id,slot),UNIQUE(user_id,gem_id)) STRICT;',
  'CREATE TABLE IF NOT EXISTS equipment_slots(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,item_id TEXT,PRIMARY KEY(user_id,slot)) STRICT;',
  'CREATE TABLE IF NOT EXISTS starter_choices(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,gem_id TEXT NOT NULL,chosen_at INTEGER NOT NULL) STRICT;',
  "CREATE TABLE IF NOT EXISTS world_state(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,region TEXT NOT NULL DEFAULT 'brackenreach',current_node TEXT NOT NULL DEFAULT 'camp',updated_at INTEGER NOT NULL) STRICT;",
  "CREATE TABLE IF NOT EXISTS world_flags(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,flag TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,flag)) STRICT;",
  "CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,encounter_id TEXT NOT NULL,started_at INTEGER NOT NULL,settled_at INTEGER,won INTEGER,gold INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 0) STRICT;",
  "CREATE INDEX IF NOT EXISTS idx_matches_user_open ON matches(user_id,settled_at);",
  'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,revoked_at INTEGER) STRICT;',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);',
  "CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,type TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) STRICT;"
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
    return db;
  }
  const dbPath=options.dbPath||':memory:';
  if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const conn=new DatabaseSync(dbPath,{open:true,timeout:5000});
  const db=localAdapter(conn,dbPath,dbPath!==':memory:'&&process.env.RENDER!=='true');
  await db.exec(['PRAGMA foreign_keys=ON;','PRAGMA journal_mode=WAL;','PRAGMA synchronous=NORMAL;','PRAGMA trusted_schema=OFF;',...SCHEMA].join('\n'));
  return db;
}
async function transaction(db,fn){return db.transaction(fn)}
async function audit(db,userId,type,detail=''){await db.prepare('INSERT INTO audit_events(user_id,type,detail,created_at) VALUES(?,?,?,?)').run(userId??null,type,String(detail).slice(0,500),Date.now())}
async function seedAccount(db,{usernameNorm,usernameDisplay,passwordHash}){
  return transaction(db,async tx=>{
    const now=Date.now(),result=await tx.prepare('INSERT INTO users(username_norm,username_display,password_hash,created_at) VALUES(?,?,?,?)').run(usernameNorm,usernameDisplay,passwordHash,now),userId=Number(result.lastInsertRowid);
    await tx.prepare('INSERT INTO profiles(user_id,level,xp,gold,created_at,updated_at) VALUES(?,1,0,0,?,?)').run(userId,now,now);
    for(const slot of Object.keys(EQUIPMENT_SLOTS))await tx.prepare('INSERT INTO equipment_slots(user_id,slot,item_id) VALUES(?,?,NULL)').run(userId,slot);
    await tx.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach','camp',?)").run(userId,now);
    await audit(tx,userId,'account_created_blank');
    return userId;
  });
}
async function userByName(db,usernameNorm){return await db.prepare('SELECT * FROM users WHERE username_norm=?').get(usernameNorm)}
async function accountSnapshot(db,userId){
  const user=await db.prepare('SELECT id,username_display,created_at FROM users WHERE id=?').get(userId);if(!user)return null;
  const [profile,inventoryRows,equipmentRows,starter,world,clearRows,sackRows]=await Promise.all([
    db.prepare('SELECT level,xp,gold,created_at,updated_at FROM profiles WHERE user_id=?').get(userId),
    db.prepare('SELECT item_id FROM inventory WHERE user_id=? AND qty>0 ORDER BY item_id').all(userId),
    db.prepare('SELECT slot,item_id FROM equipment_slots WHERE user_id=? ORDER BY slot').all(userId),
    db.prepare('SELECT gem_id,chosen_at FROM starter_choices WHERE user_id=?').get(userId),
    db.prepare('SELECT region,current_node,updated_at FROM world_state WHERE user_id=?').get(userId),
    db.prepare("SELECT flag FROM world_flags WHERE user_id=? AND flag LIKE 'encounter:%' ORDER BY flag").all(userId),
    db.prepare('SELECT slot,gem_id FROM sack_slots WHERE user_id=? ORDER BY slot').all(userId)
  ]);
  const inventory=inventoryRows.map(r=>r.item_id),sack=Array(5).fill(null),equipment=Object.fromEntries(equipmentRows.map(r=>[r.slot,r.item_id])),worldRow=world||{region:'brackenreach',current_node:'camp',updated_at:user.created_at},clearedEncounters=clearRows.map(r=>r.flag.slice(10));
  for(const row of sackRows)sack[Number(row.slot)]=row.gem_id;
  return {user:{id:Number(user.id),username:user.username_display,createdAt:Number(user.created_at)},profile:{...profile,level:Number(profile.level),xp:Number(profile.xp),gold:Number(profile.gold),created_at:Number(profile.created_at),updated_at:Number(profile.updated_at)},sack,equipment,inventory,starter:starter?{gemId:starter.gem_id,chosenAt:Number(starter.chosen_at)}:null,needsStarter:!starter&&inventory.length===0,world:{region:worldRow.region,currentNode:worldRow.current_node,updatedAt:Number(worldRow.updated_at),clearedEncounters}};
}
async function owns(db,userId,itemId){return !!(await db.prepare('SELECT 1 ok FROM inventory WHERE user_id=? AND item_id=? AND qty>0').get(userId,itemId))}
async function updateSack(db,userId,sack){
  if(!Array.isArray(sack)||sack.length!==5)throw Object.assign(new Error('invalid_sack'),{status:400});
  const equipped=sack.filter(Boolean);
  if(equipped.length<1||new Set(equipped).size!==equipped.length||!equipped.every(id=>GEM_SET.has(id)))throw Object.assign(new Error('invalid_sack'),{status:400});
  if(!(await Promise.all(equipped.map(id=>owns(db,userId,id)))).every(Boolean))throw Object.assign(new Error('unowned_item'),{status:403});
  await transaction(db,async tx=>{
    await tx.prepare('DELETE FROM sack_slots WHERE user_id=?').run(userId);
    for(let slot=0;slot<sack.length;slot++)if(sack[slot])await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,?,?)').run(userId,slot,sack[slot]);
    await audit(tx,userId,'sack_updated',equipped.join(','));
  });
}
async function chooseStarter(db,userId,gemId){
  if(!STARTER_GEM_SET.has(gemId))throw Object.assign(new Error('invalid_starter'),{status:400});
  await transaction(db,async tx=>{
    if(await tx.prepare('SELECT 1 ok FROM starter_choices WHERE user_id=?').get(userId))throw Object.assign(new Error('starter_already_chosen'),{status:409});
    if(await tx.prepare('SELECT 1 ok FROM inventory WHERE user_id=? AND qty>0').get(userId))throw Object.assign(new Error('starter_state_invalid'),{status:409});
    const now=Date.now();
    await tx.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,'gem',1)").run(userId,gemId);
    await tx.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,?)').run(userId,gemId);
    await tx.prepare('INSERT INTO starter_choices(user_id,gem_id,chosen_at) VALUES(?,?,?)').run(userId,gemId,now);
    await audit(tx,userId,'starter_chosen',gemId);
  });
}
async function hasWorldFlag(db,userId,flag){return !!(await db.prepare('SELECT 1 ok FROM world_flags WHERE user_id=? AND flag=?').get(userId,flag))}
async function moveWorld(db,userId,nodeId){
  const target=WORLD_NODES[nodeId];if(!target)throw Object.assign(new Error('invalid_world_node'),{status:400});
  const row=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),current=row?.current_node||'camp',from=WORLD_NODES[current];
  if(nodeId!==current&&!from?.neighbors.includes(nodeId))throw Object.assign(new Error('world_path_blocked'),{status:409});
  if(nodeId!==current&&target.requires&&!(await hasWorldFlag(db,userId,'encounter:'+target.requires)))throw Object.assign(new Error('world_path_locked'),{status:409});
  const now=Date.now();
  await db.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach',?,?) ON CONFLICT(user_id) DO UPDATE SET current_node=excluded.current_node,updated_at=excluded.updated_at").run(userId,nodeId,now);
  await audit(db,userId,'world_moved',current+'>'+nodeId);
}
async function completeEncounter(db,userId,encounterId){
  const row=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  const flag='encounter:'+encounterId,now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,flag,now);
  await audit(db,userId,'encounter_cleared',encounterId);
}
const MATCH_REWARD_CAPS=Object.freeze({rat:{gold:1000,xp:1000},bandit:{gold:1000,xp:1000}});
async function startMatch(db,userId,encounterId){
  const row=await db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  if(!MATCH_REWARD_CAPS[encounterId])throw Object.assign(new Error('invalid_encounter'),{status:400});
  const id=randomUUID(),now=Date.now();
  await db.prepare('INSERT INTO matches(id,user_id,encounter_id,started_at) VALUES(?,?,?,?)').run(id,userId,encounterId,now);
  await audit(db,userId,'match_started',encounterId+':'+id);
  return {matchId:id,encounterId};
}
async function settleMatch(db,userId,{matchId,won,gold,xp}){
  if(typeof matchId!=='string'||matchId.length<16||matchId.length>80||typeof won!=='boolean'||!Number.isInteger(gold)||!Number.isInteger(xp)||gold<0||xp<0||(!won&&(gold!==0||xp!==0)))throw Object.assign(new Error('invalid_match_result'),{status:400});
  return transaction(db,async tx=>{
    const match=await tx.prepare('SELECT * FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
    if(!match)throw Object.assign(new Error('match_not_found'),{status:404});
    if(match.settled_at!==null&&match.settled_at!==undefined)return {alreadySettled:true,won:Boolean(match.won),gold:Number(match.gold),xp:Number(match.xp),encounterId:match.encounter_id};
    const now=Date.now();
    if(!won){
      const changed=await tx.prepare('UPDATE matches SET settled_at=?,won=0,gold=0,xp=0 WHERE id=? AND user_id=? AND settled_at IS NULL').run(now,matchId,userId);
      if(!changed.changes){
        const settled=await tx.prepare('SELECT won,gold,xp,encounter_id FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
        return {alreadySettled:true,won:Boolean(settled.won),gold:Number(settled.gold),xp:Number(settled.xp),encounterId:settled.encounter_id};
      }
      await audit(tx,userId,'match_settled_loss',match.encounter_id+':'+matchId);
      return {alreadySettled:false,won:false,gold:0,xp:0,encounterId:match.encounter_id};
    }
    const row=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
    if(!node?.encounter||node.encounter!==match.encounter_id)throw Object.assign(new Error('encounter_not_here'),{status:409});
    const caps=MATCH_REWARD_CAPS[match.encounter_id],awardGold=Math.min(gold,caps.gold),awardXp=Math.min(xp,caps.xp);
    const changed=await tx.prepare('UPDATE matches SET settled_at=?,won=1,gold=?,xp=? WHERE id=? AND user_id=? AND settled_at IS NULL').run(now,awardGold,awardXp,matchId,userId);
    if(!changed.changes){
      const settled=await tx.prepare('SELECT gold,xp,encounter_id FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
      return {alreadySettled:true,gold:Number(settled.gold),xp:Number(settled.xp),encounterId:settled.encounter_id};
    }
    await tx.prepare('UPDATE profiles SET gold=gold+?,xp=xp+?,updated_at=? WHERE user_id=?').run(awardGold,awardXp,now,userId);
    if(match.encounter_id==='rat')await tx.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,'encounter:rat',now);
    await audit(tx,userId,'match_settled',match.encounter_id+':'+matchId+':g'+awardGold+':xp'+awardXp);
    return {alreadySettled:false,won:true,gold:awardGold,xp:awardXp,encounterId:match.encounter_id};
  });
}
async function cleanupMatches(db,staleMs=24*60*60*1000){
  const now=Date.now(),cutoff=now-staleMs;
  return await db.prepare('UPDATE matches SET settled_at=?,won=0,gold=0,xp=0 WHERE settled_at IS NULL AND started_at<?').run(now,cutoff);
}
async function buyShopItem(db,userId,shopId,itemId){
  const catalog=SHOP_CATALOG[shopId],price=catalog?.[itemId];
  if(!catalog||!Number.isInteger(price))throw Object.assign(new Error('item_not_sold_here'),{status:400});
  const kind=GEAR[itemId]?'gear':GEM_SET.has(itemId)?'gem':null;if(!kind)throw Object.assign(new Error('invalid_shop_item'),{status:400});
  await transaction(db,async tx=>{
    const world=await tx.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId);
    if(world?.current_node!==shopId)throw Object.assign(new Error('not_at_shop'),{status:409});
    if(await owns(tx,userId,itemId))throw Object.assign(new Error('already_owned'),{status:409});
    const profile=await tx.prepare('SELECT gold FROM profiles WHERE user_id=?').get(userId);
    if(!profile||Number(profile.gold)<price)throw Object.assign(new Error('insufficient_gold'),{status:409});
    await tx.prepare('UPDATE profiles SET gold=gold-?,updated_at=? WHERE user_id=?').run(price,Date.now(),userId);
    await tx.prepare('INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,?,1)').run(userId,itemId,kind);
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

module.exports={createDb,remoteAdapter,normalizeTursoConfig,transaction,audit,seedAccount,userByName,accountSnapshot,updateSack,updateEquipment,chooseStarter,moveWorld,completeEncounter,startMatch,settleMatch,cleanupMatches,buyShopItem,createSession,sessionUser,revokeSession,cleanupSessions};
