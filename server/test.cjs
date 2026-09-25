'use strict';
const assert=require('node:assert/strict');
const {createGemmoServer}=require('./server.cjs');

(async()=>{
  const {server}=createGemmoServer({dbPath:':memory:',allowedOrigins:['http://test']});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,{method='GET',token,body,origin='http://test'}={}){
    const headers={Origin:origin};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
    const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data={};try{data=await res.json()}catch{}
    return {status:res.status,data};
  }
  try{
    let r=await call('/health');assert.equal(r.status,200);assert.equal(r.data.ok,true);
    r=await call('/v1/auth/register',{method:'POST',body:{username:'LevelOneHero',password:'CorrectHorseBattery!42'}});
    assert.equal(r.status,201);const token=r.data.token;assert(token&&token.length>32);
    assert.equal(r.data.account.profile.level,1);assert.equal(r.data.account.profile.xp,0);assert.equal(r.data.account.profile.gold,0);
    assert.equal(r.data.account.inventory.length,80);assert.deepEqual(r.data.account.sack,['dagger','shield','salve','boots','charm']);
    r=await call('/v1/account',{token});assert.equal(r.status,200);assert.equal(r.data.account.user.username,'LevelOneHero');

    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['axe','shield','salve','boots','charm']}});
    assert.equal(r.status,200);assert.deepEqual(r.data.account.sack,['axe','shield','salve','boots','charm']);
    r=await call('/v1/account/sack',{method:'PUT',token,body:{sack:['axe','axe','salve','boots','charm']}});assert.equal(r.status,400);

    const equipment={head:'frayed-hood',chest:'padded-tunic',hands:null,legs:null,feet:null,necklace:'copper-pendant',ring1:'tin-ring',ring2:'iron-band'};
    r=await call('/v1/account/equipment',{method:'PUT',token,body:{equipment}});assert.equal(r.status,200);
    r=await call('/v1/account/equipment',{method:'PUT',token,body:{equipment:{...equipment,ring2:'tin-ring'}}});assert.equal(r.status,400);

    r=await call('/v1/account/profile',{method:'PUT',token,body:{gold:999999,xp:999999,level:99}});assert.equal(r.status,403);
    r=await call('/v1/matches/settle',{method:'POST',token,body:{won:true,gold:999999,xp:999999}});assert.equal(r.status,403);
    r=await call('/v1/account',{token,origin:'https://evil.example'});assert.equal(r.status,403);

    r=await call('/v1/auth/logout',{method:'POST',token});assert.equal(r.status,200);
    r=await call('/v1/account',{token});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'wrong-password'}});assert.equal(r.status,401);
    r=await call('/v1/auth/login',{method:'POST',body:{username:'LevelOneHero',password:'CorrectHorseBattery!42'}});assert.equal(r.status,200);

    console.log('PASS: account registration/login, persistent profile, secure sessions, loadout validation, CORS and client-write anti-cheat boundaries.');
  }finally{await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
