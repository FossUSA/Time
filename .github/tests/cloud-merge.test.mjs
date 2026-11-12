import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox={};
vm.runInNewContext(readFileSync("assets/js/05-cloud-merge.js","utf8"),sandbox);
const merge=sandbox.MyTimeCloudMerge.mergePunches;

test("a corrected timestamp replaces its original event instead of duplicating it",()=>{
 const original=[{type:"in",ts:100},{type:"lunch-start",ts:200},{type:"lunch-end",ts:300},{type:"out",ts:500}];
 const local=original.map(x=>({...x}));
 local[1]={...local[1],eventId:"lunch-start|200",ts:240};
 const result=merge(original,local,original);
 assert.equal(result.filter(x=>x.type==="lunch-start").length,1);
 assert.equal(result.find(x=>x.type==="lunch-start").ts,240);
});

test("independent punch additions from two devices are both retained",()=>{
 const base=[{type:"in",ts:100}];
 const local=[...base,{type:"lunch-start",ts:200}];
 const remote=[...base,{type:"morning-break-start",ts:150}];
 const result=merge(base,local,remote);
 assert.equal(result.map(x=>x.type).join(","),"in,morning-break-start,lunch-start");
});

test("a local deletion is preserved when the remote event did not change",()=>{
 const base=[{type:"in",ts:100},{type:"lunch-start",ts:200}];
 const result=merge(base,[base[0]],base);
 assert.equal(result.map(x=>x.type).join(","),"in");
});

test("an unchanged local event adopts a remote correction",()=>{
 const base=[{type:"in",ts:100},{type:"out",ts:500}];
 const remote=[{...base[0]},{...base[1],eventId:"out|500",ts:550}];
 const result=merge(base,base,remote);
 assert.equal(result.find(x=>x.type==="out").ts,550);
});

test("simultaneous edits to the same event keep the active local correction and flag conflict",()=>{
 const base=[{type:"lunch-start",ts:100}];
 const local=[{...base[0],eventId:"lunch-start|100",ts:120}];
 const remote=[{...base[0],eventId:"lunch-start|100",ts:130}];
 const result=merge(base,local,remote);
 assert.equal(result[0].ts,120);
 assert.equal(sandbox.MyTimeCloudMerge.lastConflicts,1);
});
