'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {GEM_SET,GEAR,EQUIPMENT_SLOTS,STARTER_GEM_SET,WORLD_NODES,SHOP_CATALOG}=require('./catalog.cjs');
const {randomUUID}=require('node:crypto');
const {hashToken}=require('./security.cjs');

function createDb(dbPath=':memory:'){
  if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const db=new DatabaseSync(dbPath,{open:true,timeout:5000});
  db.exec([
    'PRAGMA foreign_keys=ON;','PRAGMA journal_mode=WAL;','PRAGMA synchronous=NORMAL;','PRAGMA trusted_schema=OFF;',
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
    'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);','CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);',
    "CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,type TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL) STRICT;"
  ].join('\n'));
  return db;
}
function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(error){try{db.exec('ROLLBACK')}catch{}throw error}}
function audit(db,userId,type,detail=''){db.prepare('INSERT INTO audit_events(user_id,type,detail,created_at) VALUES(?,?,?,?)').run(userId??null,type,String(detail).slice(0,500),Date.now())}
function seedAccount(db,{usernameNorm,usernameDisplay,passwordHash}){return transaction(db,()=>{const now=Date.now(),result=db.prepare('INSERT INTO users(username_norm,username_display,password_hash,created_at) VALUES(?,?,?,?)').run(usernameNorm,usernameDisplay,passwordHash,now),userId=Number(result.lastInsertRowid);db.prepare('INSERT INTO profiles(user_id,level,xp,gold,created_at,updated_at) VALUES(?,1,0,0,?,?)').run(userId,now,now);const gear=db.prepare('INSERT INTO equipment_slots(user_id,slot,item_id) VALUES(?,?,NULL)');for(const slot of Object.keys(EQUIPMENT_SLOTS))gear.run(userId,slot);db.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach','camp',?)").run(userId,now);audit(db,userId,'account_created_blank');return userId})}
function userByName(db,usernameNorm){return db.prepare('SELECT * FROM users WHERE username_norm=?').get(usernameNorm)||null}
function accountSnapshot(db,userId){const user=db.prepare('SELECT id,username_display,created_at FROM users WHERE id=?').get(userId);if(!user)return null;const profile=db.prepare('SELECT level,xp,gold,created_at,updated_at FROM profiles WHERE user_id=?').get(userId),inventory=db.prepare('SELECT item_id FROM inventory WHERE user_id=? AND qty>0 ORDER BY item_id').all(userId).map(r=>r.item_id),sack=Array(5).fill(null),equipment=Object.fromEntries(db.prepare('SELECT slot,item_id FROM equipment_slots WHERE user_id=? ORDER BY slot').all(userId).map(r=>[r.slot,r.item_id])),starter=db.prepare('SELECT gem_id,chosen_at FROM starter_choices WHERE user_id=?').get(userId)||null,world=db.prepare('SELECT region,current_node,updated_at FROM world_state WHERE user_id=?').get(userId)||{region:'brackenreach',current_node:'camp',updated_at:user.created_at},clearedEncounters=db.prepare("SELECT flag FROM world_flags WHERE user_id=? AND flag LIKE 'encounter:%' ORDER BY flag").all(userId).map(r=>r.flag.slice(10));for(const row of db.prepare('SELECT slot,gem_id FROM sack_slots WHERE user_id=? ORDER BY slot').all(userId))sack[row.slot]=row.gem_id;return {user:{id:user.id,username:user.username_display,createdAt:user.created_at},profile,sack,equipment,inventory,starter:starter?{gemId:starter.gem_id,chosenAt:starter.chosen_at}:null,needsStarter:!starter&&inventory.length===0,world:{region:world.region,currentNode:world.current_node,updatedAt:world.updated_at,clearedEncounters}}}
function owns(db,userId,itemId){return !!db.prepare('SELECT 1 ok FROM inventory WHERE user_id=? AND item_id=? AND qty>0').get(userId,itemId)}
function updateSack(db,userId,sack){if(!Array.isArray(sack)||sack.length!==5)throw Object.assign(new Error('invalid_sack'),{status:400});const equipped=sack.filter(Boolean);if(equipped.length<1||new Set(equipped).size!==equipped.length||!equipped.every(id=>GEM_SET.has(id)))throw Object.assign(new Error('invalid_sack'),{status:400});if(!equipped.every(id=>owns(db,userId,id)))throw Object.assign(new Error('unowned_item'),{status:403});transaction(db,()=>{db.prepare('DELETE FROM sack_slots WHERE user_id=?').run(userId);const stmt=db.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,?,?)');sack.forEach((gemId,slot)=>{if(gemId)stmt.run(userId,slot,gemId)});audit(db,userId,'sack_updated',equipped.join(','))})}
function chooseStarter(db,userId,gemId){if(!STARTER_GEM_SET.has(gemId))throw Object.assign(new Error('invalid_starter'),{status:400});return transaction(db,()=>{if(db.prepare('SELECT 1 ok FROM starter_choices WHERE user_id=?').get(userId))throw Object.assign(new Error('starter_already_chosen'),{status:409});if(db.prepare('SELECT 1 ok FROM inventory WHERE user_id=? AND qty>0').get(userId))throw Object.assign(new Error('starter_state_invalid'),{status:409});const now=Date.now();db.prepare("INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,'gem',1)").run(userId,gemId);db.prepare('INSERT INTO sack_slots(user_id,slot,gem_id) VALUES(?,0,?)').run(userId,gemId);db.prepare('INSERT INTO starter_choices(user_id,gem_id,chosen_at) VALUES(?,?,?)').run(userId,gemId,now);audit(db,userId,'starter_chosen',gemId)})}
function hasWorldFlag(db,userId,flag){return !!db.prepare('SELECT 1 ok FROM world_flags WHERE user_id=? AND flag=?').get(userId,flag)}
function moveWorld(db,userId,nodeId){
  const target=WORLD_NODES[nodeId];if(!target)throw Object.assign(new Error('invalid_world_node'),{status:400});
  const row=db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId);
  const current=row?.current_node||'camp',from=WORLD_NODES[current];
  if(nodeId!==current&&!from?.neighbors.includes(nodeId))throw Object.assign(new Error('world_path_blocked'),{status:409});
  if(nodeId!==current&&target.requires&&!hasWorldFlag(db,userId,'encounter:'+target.requires))throw Object.assign(new Error('world_path_locked'),{status:409});
  const now=Date.now();
  db.prepare("INSERT INTO world_state(user_id,region,current_node,updated_at) VALUES(?,'brackenreach',?,?) ON CONFLICT(user_id) DO UPDATE SET current_node=excluded.current_node,updated_at=excluded.updated_at").run(userId,nodeId,now);
  audit(db,userId,'world_moved',current+'>'+nodeId);
}
function completeEncounter(db,userId,encounterId){
  const row=db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  const flag='encounter:'+encounterId,now=Date.now();
  db.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,flag,now);
  audit(db,userId,'encounter_cleared',encounterId);
}
const MATCH_REWARD_CAPS=Object.freeze({rat:{gold:1000,xp:1000},bandit:{gold:1000,xp:1000}});
function startMatch(db,userId,encounterId){
  const row=db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==encounterId)throw Object.assign(new Error('encounter_not_here'),{status:409});
  if(!MATCH_REWARD_CAPS[encounterId])throw Object.assign(new Error('invalid_encounter'),{status:400});
  const id=randomUUID(),now=Date.now();
  db.prepare('INSERT INTO matches(id,user_id,encounter_id,started_at) VALUES(?,?,?,?)').run(id,userId,encounterId,now);
  audit(db,userId,'match_started',encounterId+':'+id);
  return {matchId:id,encounterId};
}
function settleMatch(db,userId,{matchId,won,gold,xp}){
  if(typeof matchId!=='string'||matchId.length<16||matchId.length>80||won!==true||!Number.isInteger(gold)||!Number.isInteger(xp)||gold<0||xp<0)throw Object.assign(new Error('invalid_match_result'),{status:400});
  const match=db.prepare('SELECT * FROM matches WHERE id=? AND user_id=?').get(matchId,userId);
  if(!match)throw Object.assign(new Error('match_not_found'),{status:404});
  if(match.settled_at!==null){
    return {alreadySettled:true,gold:match.gold,xp:match.xp,encounterId:match.encounter_id};
  }
  const row=db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId),node=WORLD_NODES[row?.current_node||'camp'];
  if(!node?.encounter||node.encounter!==match.encounter_id)throw Object.assign(new Error('encounter_not_here'),{status:409});
  const caps=MATCH_REWARD_CAPS[match.encounter_id],awardGold=Math.min(gold,caps.gold),awardXp=Math.min(xp,caps.xp),now=Date.now();
  transaction(db,()=>{
    const changed=db.prepare('UPDATE matches SET settled_at=?,won=1,gold=?,xp=? WHERE id=? AND user_id=? AND settled_at IS NULL').run(now,awardGold,awardXp,matchId,userId);
    if(!changed.changes)return;
    db.prepare('UPDATE profiles SET gold=gold+?,xp=xp+?,updated_at=? WHERE user_id=?').run(awardGold,awardXp,now,userId);
    if(match.encounter_id==='rat')db.prepare('INSERT OR IGNORE INTO world_flags(user_id,flag,created_at) VALUES(?,?,?)').run(userId,'encounter:rat',now);
    audit(db,userId,'match_settled',match.encounter_id+':'+matchId+':g'+awardGold+':xp'+awardXp);
  });
  return {alreadySettled:false,gold:awardGold,xp:awardXp,encounterId:match.encounter_id};
}
function buyShopItem(db,userId,shopId,itemId){
  const catalog=SHOP_CATALOG[shopId],price=catalog?.[itemId];
  if(!catalog||!Number.isInteger(price))throw Object.assign(new Error('item_not_sold_here'),{status:400});
  const world=db.prepare('SELECT current_node FROM world_state WHERE user_id=?').get(userId);
  if(world?.current_node!==shopId)throw Object.assign(new Error('not_at_shop'),{status:409});
  if(owns(db,userId,itemId))throw Object.assign(new Error('already_owned'),{status:409});
  const kind=GEAR[itemId]?'gear':GEM_SET.has(itemId)?'gem':null;
  if(!kind)throw Object.assign(new Error('invalid_shop_item'),{status:400});
  return transaction(db,()=>{
    const profile=db.prepare('SELECT gold FROM profiles WHERE user_id=?').get(userId);
    if(!profile||profile.gold<price)throw Object.assign(new Error('insufficient_gold'),{status:409});
    db.prepare('UPDATE profiles SET gold=gold-?,updated_at=? WHERE user_id=?').run(price,Date.now(),userId);
    db.prepare('INSERT INTO inventory(user_id,item_id,kind,qty) VALUES(?,?,?,1)').run(userId,itemId,kind);
    audit(db,userId,'shop_purchase',shopId+':'+itemId+':'+price);
  });
}
function updateEquipment(db,userId,equipment){if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))throw Object.assign(new Error('invalid_equipment'),{status:400});const slots=Object.keys(EQUIPMENT_SLOTS);if(Object.keys(equipment).some(k=>!slots.includes(k)))throw Object.assign(new Error('invalid_equipment'),{status:400});const used=new Set();for(const slot of slots){const itemId=equipment[slot]??null;if(itemId===null)continue;const gear=GEAR[itemId];if(!gear||gear.slot!==EQUIPMENT_SLOTS[slot])throw Object.assign(new Error('wrong_slot'),{status:400});if(used.has(itemId))throw Object.assign(new Error('duplicate_physical_item'),{status:400});if(!owns(db,userId,itemId))throw Object.assign(new Error('unowned_item'),{status:403});used.add(itemId)}transaction(db,()=>{const stmt=db.prepare('UPDATE equipment_slots SET item_id=? WHERE user_id=? AND slot=?');for(const slot of slots)stmt.run(equipment[slot]??null,userId,slot);audit(db,userId,'equipment_updated')})}
function createSession(db,userId,token,ttlMs){const now=Date.now();db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?)').run(hashToken(token),userId,now,now+ttlMs,now)}
function sessionUser(db,token){if(!token)return null;const now=Date.now(),hash=hashToken(token),row=db.prepare('SELECT s.token_hash,s.user_id,s.expires_at,s.revoked_at,u.username_display FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash);if(!row||row.revoked_at||row.expires_at<=now)return null;db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').run(now,hash);return {id:row.user_id,username:row.username_display,tokenHash:hash}}
function revokeSession(db,token){if(token)db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').run(Date.now(),hashToken(token))}
function cleanupSessions(db){db.prepare('DELETE FROM sessions WHERE expires_at<? OR revoked_at IS NOT NULL').run(Date.now())}
module.exports={createDb,transaction,audit,seedAccount,userByName,accountSnapshot,updateSack,updateEquipment,chooseStarter,moveWorld,completeEncounter,startMatch,settleMatch,buyShopItem,createSession,sessionUser,revokeSession,cleanupSessions};
