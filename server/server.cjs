'use strict';
const http=require('node:http');
const {URL}=require('node:url');
const {createDb,audit,seedAccount,userByName,accountSnapshot,updateSack,updateEquipment,chooseStarter,moveWorld,startMatch,settleMatch,buyShopItem,createSession,sessionUser,revokeSession,cleanupSessions}=require('./db.cjs');
const {validateUsername,validatePassword,hashPassword,verifyPassword,burnPassword,createSessionToken}=require('./security.cjs');

const SESSION_TTL=7*24*60*60*1000;
const MAX_BODY=16*1024;

function defaultDbPath(options={}){
  if(options.dbPath)return options.dbPath;
  if(process.env.GEMMO_DB)return process.env.GEMMO_DB;
  return require('node:path').join(__dirname,'data','gemmo.db');
}
async function createGemmoServer(options={}){
  const dbPath=defaultDbPath(options);
  const db=await createDb({
    dbPath,
    tursoUrl:options.tursoUrl,
    tursoAuthToken:options.tursoAuthToken,
    forceLocal:options.forceLocal
  });
  const allowedOrigins=new Set(options.allowedOrigins||String(process.env.GEMMO_ORIGIN||'https://captainpwilly.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s=>s.trim()).filter(Boolean));
  const trustProxy=options.trustProxy??process.env.TRUST_PROXY==='1';
  const turnstileSiteKey=String(options.turnstileSiteKey??process.env.TURNSTILE_SITE_KEY??'').trim();
  const turnstileSecretKey=String(options.turnstileSecretKey??process.env.TURNSTILE_SECRET_KEY??'').trim();
  const turnstileExpectedHostname=String(options.turnstileExpectedHostname??process.env.TURNSTILE_EXPECTED_HOSTNAME??'captainpwilly.github.io').trim();
  const captchaEnabled=Boolean(turnstileSiteKey&&turnstileSecretKey);
  const turnstileVerifier=options.turnstileVerifier||(async({token,remoteip})=>{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({secret:turnstileSecretKey,response:token,remoteip})
    });
    if(!response.ok)return {success:false};
    return response.json();
  });
  const limits=new Map();

  function ipOf(req){if(trustProxy){const first=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();if(first)return first}return req.socket.remoteAddress||'unknown'}
  function allowRate(req,bucket,limit,windowMs){const now=Date.now(),key=ipOf(req)+'|'+bucket,old=limits.get(key);if(!old||now-old.start>=windowMs){limits.set(key,{start:now,count:1});return true}old.count++;return old.count<=limit}
  function responseHeaders(req){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','cross-origin-resource-policy':'same-site'};const origin=req.headers.origin;if(origin&&allowedOrigins.has(origin)){h['access-control-allow-origin']=origin;h.vary='Origin';h['access-control-allow-headers']='Authorization, Content-Type';h['access-control-allow-methods']='GET, POST, PUT, OPTIONS';h['access-control-max-age']='600'}return h}
  function send(req,res,status,payload){res.writeHead(status,responseHeaders(req));res.end(JSON.stringify(payload))}
  async function json(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error('body_too_large'),{status:413});chunks.push(chunk)}if(!chunks.length)return {};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(new Error('invalid_json'),{status:400})}}
  function bearer(req){const value=String(req.headers.authorization||'');if(!value.startsWith('Bearer '))return null;const token=value.slice(7).trim();return token.length>=32&&token.length<=128?token:null}
  async function requireUser(req){const token=bearer(req),user=await sessionUser(db,token);if(!user)throw Object.assign(new Error('unauthorized'),{status:401});return {user,token}}
  function corsAllowed(req){const origin=req.headers.origin;return !origin||allowedOrigins.has(origin)}
  async function requireCaptcha(req,token){
    if(!captchaEnabled)return;
    if(typeof token!=='string'||token.length<1||token.length>2048)throw Object.assign(new Error('captcha_required'),{status:403});
    let result;try{result=await turnstileVerifier({token,remoteip:ipOf(req)})}catch{throw Object.assign(new Error('captcha_unavailable'),{status:503})}
    if(!result?.success)throw Object.assign(new Error('captcha_failed'),{status:403});
    if(turnstileExpectedHostname&&result.hostname&&result.hostname!==turnstileExpectedHostname)throw Object.assign(new Error('captcha_failed'),{status:403});
    if(result.action&&result.action!=='auth')throw Object.assign(new Error('captcha_failed'),{status:403});
  }

  const server=http.createServer(async(req,res)=>{
    try{
      if(!corsAllowed(req)){send(req,res,403,{error:'origin_not_allowed'});return}
      if(req.method==='OPTIONS'){res.writeHead(204,responseHeaders(req));res.end();return}
      if(!allowRate(req,'global',180,60_000)){send(req,res,429,{error:'rate_limited'});return}
      const url=new URL(req.url,'http://gemmo.local'),pathname=url.pathname;

      if(req.method==='GET'&&pathname==='/health'){send(req,res,200,{ok:true,service:'gemmo-account',brand:'geMMO',captcha:captchaEnabled,release:String(process.env.RENDER_GIT_COMMIT||'dev').slice(0,12),storage:db.storage});return}
      if(req.method==='GET'&&pathname==='/v1/config'){send(req,res,200,{captcha:{enabled:captchaEnabled,provider:'turnstile',siteKey:captchaEnabled?turnstileSiteKey:null},brand:'geMMO'});return}

      if(req.method==='POST'&&pathname==='/v1/auth/register'){
        if(!allowRate(req,'register',5,10*60_000)){send(req,res,429,{error:'rate_limited'});return}
        const body=await json(req);await requireCaptcha(req,body.captchaToken);const name=validateUsername(body.username);
        if(!name||!validatePassword(body.password)){send(req,res,400,{error:'invalid_credentials_format'});return}
        if(await userByName(db,name.normalized)){send(req,res,409,{error:'username_unavailable'});return}
        const passwordHash=await hashPassword(body.password);
        const userId=await seedAccount(db,{usernameNorm:name.normalized,usernameDisplay:name.display,passwordHash});
        const token=createSessionToken();await createSession(db,userId,token,SESSION_TTL);
        send(req,res,201,{token,account:await accountSnapshot(db,userId)});return;
      }

      if(req.method==='POST'&&pathname==='/v1/auth/login'){
        if(!allowRate(req,'login',10,10*60_000)){send(req,res,429,{error:'rate_limited'});return}
        const body=await json(req);await requireCaptcha(req,body.captchaToken);const name=validateUsername(body.username);
        if(!name||typeof body.password!=='string'){await burnPassword(body.password);send(req,res,401,{error:'invalid_username_or_password'});return}
        const user=await userByName(db,name.normalized),now=Date.now();
        if(!user){await burnPassword(body.password);send(req,res,401,{error:'invalid_username_or_password'});return}
        if(Number(user.locked_until)>now){send(req,res,429,{error:'login_temporarily_locked'});return}
        const ok=await verifyPassword(body.password,user.password_hash);
        if(!ok){
          const failures=Number(user.failed_logins)+1,locked=failures>=5?now+10*60_000:0;
          await db.prepare('UPDATE users SET failed_logins=?,locked_until=? WHERE id=?').run(locked?0:failures,locked,user.id);
          await audit(db,user.id,'login_failed');send(req,res,401,{error:'invalid_username_or_password'});return;
        }
        await db.prepare('UPDATE users SET failed_logins=0,locked_until=0 WHERE id=?').run(user.id);
        const token=createSessionToken();await createSession(db,user.id,token,SESSION_TTL);await audit(db,user.id,'login_success');
        send(req,res,200,{token,account:await accountSnapshot(db,user.id)});return;
      }

      if(req.method==='POST'&&pathname==='/v1/auth/logout'){const token=bearer(req);await revokeSession(db,token);send(req,res,200,{ok:true});return}
      if(req.method==='GET'&&pathname==='/v1/account'){const {user}=await requireUser(req);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/account/starter'){const {user}=await requireUser(req),body=await json(req);await chooseStarter(db,user.id,body.gemId);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}
      if(req.method==='PUT'&&pathname==='/v1/account/sack'){const {user}=await requireUser(req),body=await json(req);await updateSack(db,user.id,body.sack);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}
      if(req.method==='PUT'&&pathname==='/v1/account/equipment'){const {user}=await requireUser(req),body=await json(req);await updateEquipment(db,user.id,body.equipment);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/world/move'){const {user}=await requireUser(req),body=await json(req);await moveWorld(db,user.id,body.nodeId);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/world/complete-encounter'){const {user}=await requireUser(req);await audit(db,user.id,'direct_encounter_clear_blocked');send(req,res,403,{error:'encounter_result_required'});return}
      if(req.method==='POST'&&pathname==='/v1/matches/start'){const {user}=await requireUser(req),body=await json(req),match=await startMatch(db,user.id,body.encounterId);send(req,res,201,{match,account:await accountSnapshot(db,user.id)});return}
      if(req.method==='POST'&&pathname==='/v1/shop/buy'){const {user}=await requireUser(req),body=await json(req);await buyShopItem(db,user.id,body.shopId,body.itemId);send(req,res,200,{account:await accountSnapshot(db,user.id)});return}

      if((req.method==='PUT'||req.method==='POST')&&pathname==='/v1/account/profile'){const {user}=await requireUser(req);await audit(db,user.id,'client_profile_write_blocked');send(req,res,403,{error:'server_authoritative_profile',message:'Level, XP, gold and inventory cannot be written by the client.'});return}
      if(req.method==='POST'&&pathname==='/v1/matches/settle'){const {user}=await requireUser(req),body=await json(req),settlement=await settleMatch(db,user.id,body);send(req,res,200,{settlement,account:await accountSnapshot(db,user.id)});return}

      send(req,res,404,{error:'not_found'});
    }catch(error){const status=Number(error.status)||500;if(status>=500)console.error(error);send(req,res,status,{error:status>=500?'server_error':error.message})}
  });

  const maintenance=setInterval(()=>void cleanupSessions(db).catch(error=>console.error('session cleanup failed',error)),60*60_000);maintenance.unref?.();
  server.on('close',()=>{clearInterval(maintenance);try{db.close()}catch{}});
  return {server,db};
}

if(require.main===module){
  (async()=>{
    const port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0';
    const {server,db}=await createGemmoServer();
    server.listen(port,host,()=>{console.log('geMMO account server listening on http://'+host+':'+port);console.log('geMMO storage: '+db.storage.provider+' · '+db.storage.location)});
  })().catch(error=>{console.error(error);process.exitCode=1});
}
module.exports={createGemmoServer,defaultDbPath};
