(()=>{
'use strict';

function makeRng(seed){
 let a=Number(seed)>>>0;
 return ()=>{
  a=(a+0x6D2B79F5)|0;
  let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}

function swap(board,a,b){
 [board[a.y][a.x],board[b.y][b.x]]=[board[b.y][b.x],board[a.y][a.x]];
}

function findMatches(board,types){
 const height=board.length,width=board[0]?.length||0,cells=new Map(),runs=[];
 const key=(x,y)=>x+','+y;
 function scan(line){
  for(const type of types){
   let run=[];
   const flush=()=>{
    if(run.length>=3&&run.some(p=>board[p.y][p.x]===type)){
     runs.push({type,len:run.length,cells:run.slice()});
     for(const p of run){
      const k=key(p.x,p.y);
      if(!cells.has(k))cells.set(k,{...p,type:board[p.y][p.x]==='wild'?type:board[p.y][p.x]});
     }
    }
    run=[];
   };
   for(const p of line){
    const tile=board[p.y][p.x];
    if(tile===type||tile==='wild')run.push(p);
    else flush();
   }
   flush();
  }
 }
 for(let y=0;y<height;y++)scan(Array.from({length:width},(_,x)=>({x,y})));
 for(let x=0;x<width;x++)scan(Array.from({length:height},(_,y)=>({x,y})));
 return cells.size?{cells:[...cells.values()],runs}:null;
}

function legalMoves(board,types){
 const height=board.length,width=board[0]?.length||0,list=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const a={x,y};
  for(const [dx,dy] of [[1,0],[0,1]]){
   const b={x:x+dx,y:y+dy};
   if(b.x>=width||b.y>=height)continue;
   swap(board,a,b);
   if(findMatches(board,types))list.push([a,b]);
   swap(board,a,b);
  }
 }
 return list;
}

globalThis.GEMMO_COMBAT_CORE=Object.freeze({makeRng,swap,findMatches,legalMoves});
})();
