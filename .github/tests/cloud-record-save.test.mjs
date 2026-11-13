import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync("assets/js/10-app-core.js","utf8");
const start=source.indexOf("window.myTimeSaveAndVerifyRecord=async function(dateKey,expectedRecord){");
const end=source.indexOf("\nasync function initCloudSync()",start);
assert(start>=0&&end>start,"Cloudflare record save-and-verify helper must exist");
const helperSource=source.slice(start,end)+"\nthis.saveAndVerify=window.myTimeSaveAndVerifyRecord;";

function makeSandbox({ready=true,blocked=false,cloudRecord,revision=51}={}){
 const state={dirty:false,flushCalls:0,requests:[],revision,base:null};
 const sandbox={
  window:{myTimeFlushCloudSync:async()=>{state.flushCalls++;}},
  cloudSyncReady:ready,cloudSyncBlocked:blocked,cloudSyncDirty:false,cloudSyncTimer:null,
  clearTimeout(){},
  cloudValueEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
  cloneCloudValue:value=>JSON.parse(JSON.stringify(value)),
  cloudRequest:async(path,options)=>{
   state.requests.push({path,options});
   return {body:{payload:{records:{"2026-11-13":cloudRecord}},revision,updatedAt:"2026-11-13 15:00:00"}};
  },
  cloudRevision:0,cloudBasePayload:null
 };
 vm.createContext(sandbox);
 vm.runInContext(helperSource,sandbox);
 return {sandbox,state,save:sandbox.saveAndVerify};
}

test("Save changes forces a Cloudflare write and verifies the exact date",async()=>{
 const record={punches:[{type:"in",ts:1794578160000}],breakStatus:{lunch:"taken"},breakTimes:{lunch:{start:"11:30",end:"12:30"}},makeUpNote:""};
 const {sandbox,state,save}=makeSandbox({cloudRecord:record});
 const result=await save("2026-11-13",record);
 assert.equal(sandbox.cloudSyncDirty,true);
 assert.equal(state.flushCalls,1);
 assert.equal(state.requests.length,1);
 assert.equal(state.requests[0].path,"/api/records");
 assert.equal(state.requests[0].options.method,"GET");
 assert.equal(result.revision,51);
 assert.equal(sandbox.cloudRevision,51);
});

test("save is rejected when D1 has not loaded",async()=>{
 const record={punches:[]};
 const {state,save}=makeSandbox({ready:false,cloudRecord:record});
 await assert.rejects(()=>save("2026-11-13",record),/Cloudflare is still loading/);
 assert.equal(state.flushCalls,0);
});

test("save is rejected while the cloud conflict gate is active",async()=>{
 const record={punches:[]};
 const {state,save}=makeSandbox({blocked:true,cloudRecord:record});
 await assert.rejects(()=>save("2026-11-13",record),/Cloud changes are paused/);
 assert.equal(state.flushCalls,0);
});

test("read-back mismatch is never reported as saved",async()=>{
 const expected={punches:[{type:"in",ts:10}]},cloud={punches:[{type:"in",ts:20}]};
 const {save}=makeSandbox({cloudRecord:cloud});
 await assert.rejects(()=>save("2026-11-13",expected),/different version/);
});

test("invalid work dates are rejected before sending a request",async()=>{
 const record={punches:[]};
 const {state,save}=makeSandbox({cloudRecord:record});
 await assert.rejects(()=>save("13-Nov-2026",record),/valid work date/);
 assert.equal(state.flushCalls,0);
});
