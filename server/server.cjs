'use strict';
const http=require('node:http');
const {URL}=require('node:url');
const {createDb,audit,seedAccount,userByName,accountSnapshot,updateSack,updateEquipment,chooseStarter,moveWorld,buyShopItem,createSession,sessionUser,revokeSession,cleanupSessions}=require('./db.cjs');
const {validateUsername,validatePassword,hashPassword,verifyPassword,burnPassword,createSessionToken}=require('./security.cjs');

const SESSION_TTL=7*24*60*60*1000;
const MAX_BODY=16*1024;

function createGemmoServer(options={}){
  const db=createDb(options.dbPath||process.env.GEMMO_DB||require('node:path').join(__dirname,'data','gemmo.db'));
  const allowedOrigins=new Set(options.allowedOrigins||String(process.env.GEMMO_ORIGIN||'https://captainpwilly.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s=>s.trim()).filter(Boolean));
  const trustProxy=options.trustProxy??process.env.TRUST_PROXY==='1';
  const limits=new Map();

  function ipOf(req){if(trustProxy){const first=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();if(first)return first}return req.socket.remoteAddress||'unknown'}
  function allowRate(req,bucket,limit,windowMs){const now=Date.now(),key=ipOf(req)+'|'+bucket,old=limits.get(key);if(!old||now-old.start>=windowMs){limits.set(key,{start:now,count:1});return true}old.count++;return old.count<=limit}
  function responseHeaders(req){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','cross-origin-resource-policy':'same-site'};const origin=req.headers.origin;if(origin&&allowedOrigins.has(origin)){h['access-control-allow-origin']=origin;h.vary='Origin';h['access-control-allow-headers']='Authorization, Content-Type';h['access-control-allow-methods']='GET, POST, PUT, OPTIONS';h['access-control-max-age']='600'}return h}
  function send(req,res,status,payload){res.writeHead(status,responseHeaders(req));res.end(JSON.stringify(payload))}
  async function json(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error('body_too_large'),{status:413});chunks.push(chunk)}if(!chunks.length)return {};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('invalid_json'),{status:400})}}
  function bearer(req){const value=String(req.headers.authorization||'');if(!value.startsWith('Bearer '))return null;const token=value.slice(7).trim();return token.length>=32&&token.length<=128?token:null}
  function requireUser(req){const token=bearer(req),user=sessionUser(db,token);if(!user)throw Object.assign(new Error('unauthorized'),{status:401});return {user,token}}
  function corsAllowed(req){const origin=req.headers.origin;return !origin||allowedOrigins.has(origin)}

  const server=http.createServer(async(req,res)=>{
    try{
      if(!corsAllowed(req)){send(req,res,403,{error:'origin_not_allowed'});return}
      if(req.method==='OPTIONS'){res.writeHead(204,responseHeaders(req));res.end();return}
      if(!allowRate(req,'global',180,60_000)){send(req,res,429,{error:'rate_limited'});return}
      const url=new URL(req.url,'http://gemmo.local'),pathname=url.pathname;

      if(req.method==='GET'&&pathname==='/health'){send(req,res,200,{ok:true,service:'gemmo-account'});return}

      if(req.method==='POST'&&pathname==='/v1/auth/register'){
        if(!allowRate(req,'register',5,10*60_000)){send(req,res,429,{error:'rate_limited'});return}
        const body=await json(req),name=validateUsername(body.username);
        if(!name||!validatePassword(body.password)){send(req,res,400,{error:'invalid_credentials_format'});return}
        if(userByName(db,name.normalized)){send(req,res,409,{error:'username_unavailable'});return}
        const passwordHash=await hashPassword(body.password);
        const userId=seedAccount(db,{usernameNorm:name.normalized,usernameDisplay:name.display,passwordHash});
        const token=createSessionToken();createSession(db,userId,token,SESSION_TTL);
        send(req,res,201,{token,account:accountSnapshot(db,userId)});return;
      }

      if(req.method==='POST'&&pathname==='/v1/auth/login'){
        if(!allowRate(req,'login',10,10*60_000)){send(req,res,429,{error:'rate_limited'});return}
        const body=await json(req),name=validateUsername(body.username);
        if(!name||typeof body.password!=='string'){await burnPassword(body.password);send(req,res,401,{error:'invalid_username_or_password'});return}
        const user=userByName(db,name.normalized),now=Date.now();
        if(!user){await burnPassword(body.password);send(req,res,401,{error:'invalid_username_or_password'});return}
        if(user.locked_until>now){send(req,res,429,{error:'login_temporarily_locked'});return}
        const ok=await verifyPassword(body.password,user.password_hash);
        if(!ok){const failures=user.failed_logins+1,locked=failures>=5?now+10*60_000:0;db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').run(locked?0:failures,locked,user.id);audit(db,user.id,'login_failed');send(req,res,401,{error:'invalid_username_or_password'});return}
        db.prepare('UPDATE users SET failed_logins=0,locked_until=0 WHERE id=?').run(user.id);
        const token=createSessionToken();createSession(db,user.id,token,SESSION_TTL);audit(db,user.id,'login_success');
        send(req,res,200,{token,account:accountSnapshot(db,user.id)});return;
      }

      if(req.method==='POST'&&pathname==='/v1/auth/logout'){const token=bearer(req);revokeSession(db,token);send(req,res,200,{ok:true});return}
      if(req.method==='GET'&&pathname==='/v1/account'){const {user}=requireUser(req);send(req,res,200,{account:accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/account/starter'){const {user}=requireUser(req),body=await json(req);chooseStarter(db,user.id,body.gemId);send(req,res,200,{account:accountSnapshot(db,user.id)});return}
      if(req.method==='PUT'&&pathname==='/v1/account/sack'){const {user}=requireUser(req),body=await json(req);updateSack(db,user.id,body.sack);send(req,res,200,{account:accountSnapshot(db,user.id)});return}
      if(req.method==='PUT'&&pathname==='/v1/account/equipment'){const {user}=requireUser(req),body=await json(req);updateEquipment(db,user.id,body.equipment);send(req,res,200,{account:accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/world/move'){const {user}=requireUser(req),body=await json(req);moveWorld(db,user.id,body.nodeId);send(req,res,200,{account:accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/shop/buy'){const {user}=requireUser(req),body=await json(req);buyShopItem(db,user.id,body.shopId,body.itemId);send(req,res,200,{account:accountSnapshot(db,user.id)});return}

      if((req.method==='PUT'||req.method==='POST')&&pathname==='/v1/account/profile'){const {user}=requireUser(req);audit(db,user.id,'client_profile_write_blocked');send(req,res,403,{error:'server_authoritative_profile',message:'Level, XP, gold and inventory cannot be written by the client.'});return}
      if(req.method==='POST'&&pathname==='/v1/matches/settle'){const {user}=requireUser(req);audit(db,user.id,'client_match_settlement_blocked');send(req,res,403,{error:'server_authoritative_matches',message:'Clients cannot submit rewards or match outcomes.'});return}

      send(req,res,404,{error:'not_found'});
    }catch(error){const status=Number(error.status)||500;if(status>=500)console.error(error);send(req,res,status,{error:status>=500?'server_error':error.message})}
  });

  const maintenance=setInterval(()=>cleanupSessions(db),60*60_000);maintenance.unref?.();
  server.on('close',()=>{clearInterval(maintenance);try{db.close()}catch{}});
  return {server,db};
}

if(require.main===module){const port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0';const {server}=createGemmoServer();server.listen(port,host,()=>console.log('GemMO account server listening on http://'+host+':'+port))}
module.exports={createGemmoServer};
