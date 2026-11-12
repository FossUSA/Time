import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source=readFileSync("assets/js/20-navigation.js","utf8");
const start=source.indexOf("function calculateRecordPaidMinutes(input){");
const end=source.indexOf("\nfunction updateRecordPaidTimePreview()",start);
assert(start>=0&&end>start,"paid-time calculation function must be present");
const sandbox={};
vm.runInNewContext(source.slice(start,end)+"\nthis.calculateRecordPaidMinutes=calculateRecordPaidMinutes;",sandbox);
const calculate=sandbox.calculateRecordPaidMinutes;
test("one-hour lunch produces 8h03 for 7:57 AM to 5 PM",()=>{
 const r=calculate({clockIn:"07:57",lunchOut:"11:30",lunchIn:"12:30",clockOut:"17:00"});
 assert.equal(r.valid,true);assert.equal(r.totalMinutes,483);
});
test("two-minute lunch punch values produce 9h01",()=>{
 const r=calculate({clockIn:"07:57",lunchOut:"12:27",lunchIn:"12:29",clockOut:"17:00"});
 assert.equal(r.totalMinutes,541);
});
test("missing lunch pair is rejected",()=>{
 assert.equal(calculate({clockIn:"07:57",lunchOut:"11:30",lunchIn:"",clockOut:"17:00"}).valid,false);
});
test("out-of-order punch times are rejected",()=>{
 assert.equal(calculate({clockIn:"07:57",lunchOut:"12:30",lunchIn:"11:30",clockOut:"17:00"}).valid,false);
});
