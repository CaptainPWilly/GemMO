'use strict';
const assert=require('node:assert/strict');
const {createGemmoServer}=require('./server.cjs');

(async()=>{
  const {server,db}=createGemmoServer({dbPath:':memory:',allowedOrigins:['http://test']});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,{method='GET',token,body,origin='http://test'}={}){
    const headers={Origin:origin};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
    const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data={};try{data=await res.json()}catch{}
    return {status:res.status,data};
  }
  try{
    let r=await call('/health');assert.equal(r.status,200);assert.equal(r.data.ok,true);assert.equal(r.data.captcha,false);
    r=await call('/v1/auth/register',{method:'POST',body:{username:'FiveChar',password:'12345'}});assert.equal(r.status,400,'five-character passwords stay invalid');
    r=await call('/v1/auth/register',{method:'POST',body:{username:'LevelOneHero',password:'abc123'}});
    assert.equal(r.status,201);const token=r.data.token;assert(token&&token.length>32);
    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);
    assert.equal(r.data.account.inventory.length,0);assert.deepEqual(r.data.account.sack,[null,null,null,null,null]);assert.equal(r.data.account.needsStarter,true);
    r=await call('/v1/account',{token});assert.equal(r.status,200);assert.equal(r.data.account.user.username,'LevelOneHero');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger',null,null,null,null]}});assert.equal(r.status,403,'cannot equip unowned starter before choice');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'axe'}});assert.equal(r.status,400,'only five starter gems are legal');
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'dagger'}});assert.equal(r.status,200);
    assert.deepEqual(r.data.account.inventory,['dagger']);assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null]);assert.equal(r.data.account.needsStarter,false);
    r=await call('/v1/account/starter',{method:'POST',token,body:{gemId:'shield'}});assert.equal(r.status,409,'starter choice is one-time');
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger',null,null,null,null]}});assert.equal(r.status,200);
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['dagger','shield',null,null,null]}});assert.equal(r.status,403,'cannot equip gems not owned');
    const equipment={head:'frayed-hood',chest:null,hands:null,legs:null,feet:null,necklace:null,ring1:null,ring2:null};
    r=await call('/v1/account/equipment',{method:'PUT',token,body:{equipment}});assert.equal(r.status,403,'blank new inventory owns no armor');

    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,409,'cannot skip the road graph');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'crossroads');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'bandit-pass'}});assert.equal(r.status,200);assert.equal(r.data.account.world.currentNode,'bandit-pass');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,409,'bandit pass does not teleport to camp');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'crossroads'}});assert.equal(r.status,200);
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'camp'}});assert.equal(r.status,200);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'must physically travel to the shop');
    r=await call('/v1/world/move',{method:'POST',token,body:{nodeId:'gem-shop'}});assert.equal(r.status,200);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'zero-gold player cannot buy');
    const userId=db.prepare("SELECT id FROM users WHERE username_norm='levelonehero'").get().id;
    db.prepare('UPDATE profiles SET gold=100 WHERE user_id=?').run(userId);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,200);assert(r.data.account.inventory.includes('hand-crossbow'));assert.equal(r.data.account.profile.gold,82);
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'hand-crossbow'}});assert.equal(r.status,409,'cannot buy an owned unique item');
    r=await call('/v1/shop/buy',{method:'POST',token,body:{shopId:'gem-shop',itemId:'frayed-hood'}});assert.equal(r.status,400,'shop stock is server-defined');

    r=await call('/v1/account/profile',{method:'PUT',token,body:{gold:999999,xp:999999,level:99}});assert.equal(r.status,403);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{won:true,gold:999999,xp:999999}});assert.equal(r.status,403);
    r=await call('/v1/account',{token,origin:'https://evil.example'});assert.equal(r.status,403);

    r=await call('/v1/auth/logout',{method:'POST',token});assert.equal(r.status,200);
    r=await call('/v1/account',{token});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'wrong-password'}});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'abc123'}});assert.equal(r.status,200);
    assert(r.data.account.inventory.includes('hand-crossbow'),'inventory survives logout/login');
    assert.equal(r.data.account.profile.gold,82,'gold survives logout/login');
    assert.equal(r.data.account.world.currentNode,'gem-shop','world position survives logout/login');
    assert.deepEqual(r.data.account.sack,['dagger',null,null,null,null],'Sack survives logout/login');

    console.log('PASS: account registration/login, persistent profile, secure sessions, loadout validation, CORS and client-write anti-cheat boundaries.');
  }finally{await new Promise(resolve=>server.close(resolve))}

  const captcha=createGemmoServer({dbPath:':memory:',allowedOrigins:['http://test'],turnstileSiteKey:'site-test',turnstileSecretKey:'secret-test',turnstileExpectedHostname:'test.example',turnstileVerifier:async({token})=>token==='captcha-ok'?{success:true,hostname:'test.example',action:'auth'}:{success:false}});
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
