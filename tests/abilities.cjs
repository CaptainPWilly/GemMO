const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class El{constructor(){this.style={};this.children=[];this.dataset={};this.classList={add(){},remove(){}};this.textContent='';this.value='all'}set innerHTML(v){this.children=Array.from({length:(v.match(/<button/g)||[]).length},()=>new El());if(v.includes('<span'))this.firstElementChild=new El()}appendChild(e){this.children.push(e)}setAttribute(){}addEventListener(){}remove(){}getBoundingClientRect(){return {left:0,top:0,width:320,height:320}}animate(){return {finished:Promise.resolve(),cancel(){}}}}
const es=new Map(),document={getElementById(id){if(!es.has(id))es.set(id,new El());return es.get(id)},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El()};
let src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];src=src.replace("showScreen('splash');",`globalThis.api={ITEMS,findMatches,legalMoves,reservoirCap,enemyUseActive,setEnemyReady:color=>ec[color]=ENEMY[color].cap,startFight,applyColor,activate,trySwap,tapCell,get:()=>({charges,sack,pHP,eHP,pGuard,eGuard,freeSwap,overdrive,playerTurn,board}),setHP:v=>pHP=v,setGuard:v=>eGuard=v,setBoard:v=>{board=v;render()},setTurn:v=>playerTurn=v,setSack:v=>sack=v,setReady:i=>{charges[itemById(sack[i]).color]=itemById(sack[i]).cap;playerTurn=true;pHP=10},finish:async()=>{await Promise.all(damageAnimations.splice(0))}};showScreen('splash');`);
const c={document,window:{matchMedia:()=>({matches:true})},localStorage:{getItem:()=>null,setItem(){}},setTimeout:()=>0,clearTimeout(){},console};vm.runInNewContext(src,c);const a=c.api;

(async()=>{
 const cases={dagger:[10,18,0],axe:[10,16,0],spear:[10,21,3],shield:[10,24,6],buckler:[10,21,3],ward:[12,24,3],salve:[15,24,0],poultice:[13,24,0],briar:[12,21,0],boots:[10,24,0],cloak:[10,24,5],knife:[10,19,0],charm:[10,24,0],seal:[10,16,0],relic:[14,24,4]};
 Object.assign(cases,{"arming-sword":[10,17,0],"warhammer":[10,14,0],"longbow":[10,19,0],"rapier":[10,21,3],"halberd":[10,15,0],"hand-crossbow":[10,21,0],"flail":[10,16,0],"tower-shield":[10,24,10],"swordbreaker":[10,21,3],"quarterstaff":[10,24,4],"pavise":[10,24,8],"war-pick":[10,17,0],"kite-shield":[12,24,3],"hook-spear":[10,24,7],"sickle":[12,21,0],"druid-staff":[18,24,0],"hunting-bow":[10,18,0],"thorn-whip":[10,20,0],"grove-spear":[12,24,3],"woodland-club":[10,24,6],"willow-wand":[12,24,0],"twin-knives":[10,17,0],"light-crossbow":[10,18,0],"sling":[10,22,0],"duelist-sabre":[10,21,3],"glaive":[10,16,0],"parrying-dagger":[10,24,3],"javelin":[10,15,0],"rune-blade":[10,17,0],"hex-staff":[10,19,0],"relic-mace":[14,24,4],"moon-scythe":[12,21,0],"crystal-wand":[10,24,4],"spell-tome":[12,24,3],"ritual-dagger":[10,21,3]});
 assert.equal(a.ITEMS.length,50);assert.equal(new Set(a.ITEMS.map(i=>i.id)).size,50);for(const color of ['red','blue','green','yellow','purple'])assert.equal(a.ITEMS.filter(i=>i.color===color).length,10);
 for(const item of a.ITEMS){
  a.setSack([item.id,'dagger','shield','salve','boots']);a.startFight();
  const initial=JSON.stringify(a.get());a.activate(0);assert.equal(JSON.stringify(a.get()),initial,item.id+' cannot activate without charge');
  a.setReady(0);a.activate(0);const state=a.get(),expected=cases[item.id];
  assert.deepEqual([state.pHP,state.eHP,state.pGuard],expected,item.id+' exact effects');
  assert.equal(state.charges[item.color],0,item.id+' spends charge');
  assert.equal(state.playerTurn,item.id==='boots',item.id+' turn cost');
  assert.equal(state.freeSwap,item.id==='boots');assert.equal(state.overdrive,item.id==='charm');
  await a.finish();console.log('PASS '+item.item+' / '+item.name);
  if(['heal','shelter','leech','renew'].includes(item.kind)){a.startFight();a.setReady(0);a.setHP(23);a.activate(0);assert.equal(a.get().pHP,24,item.id+' healing cap');await a.finish()}
 }
 a.setSack(Array(5).fill('dagger'));a.startFight();a.applyColor('red',5,'player');assert.equal(a.get().charges.red,5);assert.equal(a.reservoirCap('red'),35);assert.equal(a.get().eHP,19);await a.finish();
 a.setReady(2);a.activate(2);assert.equal(a.get().charges.red,0);await a.finish();
 a.setSack(['charm','charm','dagger','shield','boots']);a.startFight();a.setReady(0);a.activate(0);a.setReady(1);a.activate(1);assert.equal(a.get().charges.purple,10);
 a.applyColor('red',3,'player');assert.equal(a.get().eHP,18);assert.equal(a.get().charges.red,6);assert.equal(a.get().overdrive,false);await a.finish();a.applyColor('red',3,'player');assert.equal(a.get().eHP,15);await a.finish();
 a.setSack(['boots','dagger','shield','salve','charm']);a.startFight();const b=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));a.setBoard(b);a.setReady(0);a.activate(0);a.tapCell(0,0);a.tapCell(1,0);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.get().freeSwap,false);assert.equal(a.get().board[0][0],'blue');assert.equal(a.get().board[0][1],'red');assert.equal(a.get().playerTurn,false);
 a.setSack(['dagger','shield','salve','boots','charm']);a.startFight();a.setReady(0);a.setGuard(4);a.activate(0);assert.equal(a.get().eHP,22);assert.equal(a.get().eGuard,0);await a.finish();
 a.startFight();assert(Object.values(a.get().charges).every(n=>n===0));assert.equal(a.get().pHP,24);assert.equal(a.get().eHP,24);

 // Shared pool keeps unspent charge; either item can spend it.
 a.setSack(['dagger','axe','shield','salve','boots']);a.startFight();a.applyColor('red',99,'player');assert.equal(a.get().charges.red,16);assert.equal(a.reservoirCap('red'),16);await a.finish();
 a.setHP(24);a.startFight();a.applyColor('red',12,'player');await a.finish();a.activate(1);assert.equal(a.get().charges.red,3);
 a.startFight();a.applyColor('purple',3,'player');assert.equal(a.get().charges.purple,0);
 const grid=()=>Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>['red','blue','green','yellow','purple'][(x+y)%5]));
 for(const type of ['red','blue','green','yellow','purple','gold','xp','env']){
  const g=grid();g[0][0]=type;g[0][1]='wild';g[0][2]=type;a.setBoard(g);const m=a.findMatches();assert(m&&m.runs.some(r=>r.type===type&&r.len>=3),type+' accepts Wild');assert.equal(new Set(m.cells.map(p=>p.x+','+p.y)).size,m.cells.length,'Wild counted once');
 }
 const all=grid();all[0][0]=all[0][1]=all[0][2]='wild';all[0][3]='';a.setBoard(all);assert(!a.findMatches()?.runs.some(r=>r.cells.every(p=>p.y===0)&&r.cells.length===3),'all-Wild trio needs a real type');
 a.startFight();const g=grid();g[0][0]='wild';a.setBoard(g);const before=JSON.stringify(a.get().board);const valid=await a.trySwap({x:0,y:0},{x:1,y:0},'player');assert.equal(valid,false);assert.equal(JSON.stringify(a.get().board),before,'invalid Wild swap reverts, never clears board');
 for(const color of ['red','blue','green','yellow','purple']){a.startFight();a.setEnemyReady(color);assert.equal(a.enemyUseActive(),color!=='green');if(color!=='green')assert(es.get('abilityName').textContent.length>0)}
 console.log('PASS: all 50 abilities, shared pool capacity/spending, Wild substitution for all 8 types, deduplicated matches, invalid Wild swaps, enemy announcements, healing caps and turn rules.');
})().catch(e=>{console.error(e);process.exitCode=1});
