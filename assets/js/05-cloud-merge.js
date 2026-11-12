(function(root){
 'use strict';
 const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function keyed(events){
  const map=new Map();
  for(const item of Array.isArray(events)?events:[]){
   if(!item||typeof item!=='object')continue;
   const baseId=String(item.eventId||((String(item.type||'unknown'))+'|'+String(item.ts??'')));
   let id=baseId,suffix=1;
   while(map.has(id))id=baseId+'#'+suffix++;
   map.set(id,{...clone(item),eventId:id});
  }
  return map;
 }
 function mergePunches(base,local,remote){
  const b=keyed(base),l=keyed(local),r=keyed(remote),ids=new Set([...b.keys(),...l.keys(),...r.keys()]),merged=[];
  let conflicts=0;
  for(const id of ids){
   const before=b.get(id),left=l.get(id),right=r.get(id);
   let chosen;
   if(equal(left,before))chosen=right;
   else if(equal(right,before))chosen=left;
   else if(equal(left,right))chosen=left;
   else {chosen=left===undefined?right:left;conflicts++}
   if(chosen!==undefined)merged.push(clone(chosen));
  }
  merged.sort((a,b)=>Number(a?.ts||0)-Number(b?.ts||0));
  mergePunches.lastConflicts=conflicts;
  if(root.MyTimeCloudMerge)root.MyTimeCloudMerge.lastConflicts=(root.MyTimeCloudMerge.lastConflicts||0)+conflicts;
  return merged;
 }
 root.MyTimeCloudMerge={mergePunches,lastConflicts:0};
})(typeof window!=='undefined'?window:globalThis);
