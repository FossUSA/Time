import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync("assets/js/10-app-core.js","utf8");
const start=source.indexOf("function save(){");
const end=source.indexOf("\nfunction saveSet()",start);
assert(start>=0&&end>start,"save() function must exist");
const saveSource=source.slice(start,end);

function runSave({storageFails,cloudReady,blocked}){
 const state={queued:0,status:[],warnings:[]};
 const sandbox={
  localStorage:{setItem(){if(storageFails)throw new Error("QuotaExceededError")}},
  KEY:"mytime-records",data:{day:{punches:[]}},
  cloudSyncReady:cloudReady,cloudSyncBlocked:blocked,
  setSaveStatus(_ok,message){state.status.push(message)},
  queueCloudSync(){state.queued++},
  console:{warn(...args){state.warnings.push(args)}}
 };
 vm.createContext(sandbox);
 vm.runInContext(saveSource+"\nthis.result=save();",sandbox);
 return {...state,result:sandbox.result};
}

test("browser recovery storage failure does not block a ready Cloudflare save",()=>{
 const result=runSave({storageFails:true,cloudReady:true,blocked:false});
 assert.equal(result.result,true);
 assert.equal(result.queued,1);
 assert.ok(result.status.some(x=>x.includes("saving directly to Cloudflare")));
});

test("normal saves also queue Cloudflare synchronization",()=>{
 const result=runSave({storageFails:false,cloudReady:true,blocked:false});
 assert.equal(result.result,true);
 assert.equal(result.queued,1);
});

test("browser storage failure does not claim save success while Cloudflare is not ready",()=>{
 const result=runSave({storageFails:true,cloudReady:false,blocked:false});
 assert.equal(result.result,false);
 assert.equal(result.queued,0);
});

test("a cloud conflict block cannot be bypassed by a failed browser recovery write",()=>{
 const result=runSave({storageFails:true,cloudReady:true,blocked:true});
 assert.equal(result.result,false);
 assert.equal(result.queued,0);
});
