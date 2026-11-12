import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync("assets/js/20-navigation.js","utf8");
function extract(name,nextName){
 const start=source.indexOf("function "+name+"(");
 const end=source.indexOf("\nfunction "+nextName+"(",start);
 assert(start>=0&&end>start,name+" helper must exist");
 return source.slice(start,end)+"\nthis."+name+"="+name+";";
}
const sandbox={};
vm.runInNewContext(
 extract("calendarPunchOnlyIntervalMinutes","syncCalendarDraftFromControls")+"\n"+
 extract("calculateRecordPaidMinutes","updateRecordPaidTimePreview"),
 sandbox
);
const punchLunch=sandbox.calendarPunchOnlyIntervalMinutes;
const calculate=sandbox.calculateRecordPaidMinutes;
const at=time=>new Date("2026-11-10T"+time+":00-06:00").getTime();

test("selected-day analysis distinguishes a two-minute punch from a one-hour documented lunch",()=>{
 const record={punches:[{type:"lunch-start",ts:at("12:27")},{type:"lunch-end",ts:at("12:29")}]};
 const paidDeduction=punchLunch(record,"lunch-start","lunch-end");
 const documentedMinutes=60;
 assert.equal(paidDeduction,2);
 assert.equal(documentedMinutes-paidDeduction,58);
});

test("existing lunch punches calculate 9h01 paid time",()=>{
 const result=calculate({clockIn:"07:57",lunchOut:"12:27",lunchIn:"12:29",clockOut:"17:00"});
 assert.equal(result.valid,true);
 assert.equal(result.totalMinutes,541);
});

test("aligning paid-time punches to documented 11:30–12:30 lunch calculates 8h03",()=>{
 const result=calculate({clockIn:"07:57",lunchOut:"11:30",lunchIn:"12:30",clockOut:"17:00"});
 assert.equal(result.valid,true);
 assert.equal(result.totalMinutes,483);
});
