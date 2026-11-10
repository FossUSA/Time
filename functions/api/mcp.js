import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const APP_URL = "https://time.fossna.cloud";

function jsonText(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
function getIdentity(request) {
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  return /^[^@]+@fossna\.com$/.test(email) ? email : null;
}
function normalizeDate(value, fallback) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD.");
  const d = new Date(value + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error("Invalid calendar date.");
  return value;
}
function minutesPaid(record, now) {
  const punches = Array.isArray(record?.punches) ? [...record.punches].sort((a,b) => Number(a.ts)-Number(b.ts)) : [];
  let start = null, total = 0;
  for (const punch of punches) {
    const ts = Number(punch.ts);
    if (!Number.isFinite(ts)) continue;
    if (punch.type === "in") start = ts;
    else if (punch.type === "lunch-start" && start !== null) { total += Math.max(0, ts-start); start = null; }
    else if (punch.type === "lunch-end") start = ts;
    else if (punch.type === "out" && start !== null) { total += Math.max(0, ts-start); start = null; }
  }
  if (start !== null) total += Math.max(0, now-start);
  return Math.floor(total/60000);
}
async function loadAccount(env,email) {
  if (!env.MYTIME_DB) throw new Error("myTIME cloud database binding is unavailable.");
  const row=await env.MYTIME_DB.prepare("SELECT payload, updated_at FROM mytime_user_data WHERE email = ?").bind(email).first();
  if (!row) return {records:{},settings:{},bankEntries:[],updatedAt:null};
  const payload=JSON.parse(row.payload);
  return {
    records:payload.records&&typeof payload.records==="object"?payload.records:{},
    settings:payload.settings&&typeof payload.settings==="object"?payload.settings:{},
    bankEntries:Array.isArray(payload.bankEntries)?payload.bankEntries:[],
    updatedAt:row.updated_at||null
  };
}
function createServer(email,account) {
  const server=new McpServer({name:"foss-mytime",version:"1.0.0"});
  server.registerTool("mytime_status",{description:"Show the authenticated FOSS account, myTIME cloud-sync status, work schedule targets, and app address. Read-only.",inputSchema:z.object({})},async()=>jsonText({
    account:email,app:APP_URL,cloudRecordFound:!!account.updatedAt,lastCloudUpdate:account.updatedAt,
    timezone:account.settings.timezone||"local",scheduledStart:account.settings.startTime||"08:00",
    scheduledEnd:account.settings.endTime||"17:00",dailyPaidHourGoal:Number(account.settings.goalHours||8),
    weeklyPaidHourGoal:Number(account.settings.weeklyGoalHours||40)
  }));
  server.registerTool("mytime_timecard_summary",{description:"Get a read-only timecard summary for the authenticated account over a date range. Dates are YYYY-MM-DD. Includes daily paid minutes and total paid time.",inputSchema:z.object({
    startDate:z.string().optional().describe("Inclusive start date YYYY-MM-DD; defaults to the last 7 days."),
    endDate:z.string().optional().describe("Inclusive end date YYYY-MM-DD; defaults to today.")
  })},async({startDate,endDate})=>{
    const today=new Date().toISOString().slice(0,10);
    const end=normalizeDate(endDate,today),start=normalizeDate(startDate,new Date(Date.now()-6*86400000).toISOString().slice(0,10));
    if(start>end)throw new Error("startDate must be on or before endDate.");
    const dates=Object.keys(account.records).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=start&&d<=end).sort();
    const daily=dates.map(date=>{
      const rec=account.records[date]||{},p=Array.isArray(rec.punches)?rec.punches:[];
      const paidMinutes=minutesPaid(rec,Date.now());
      return {date,paidMinutes,paidHours:Math.round(paidMinutes/60*100)/100,punchCount:p.length,punches:p.map(x=>({type:String(x.type||"unknown"),time:x.ts?new Date(Number(x.ts)).toISOString():null}))};
    });
    const totalPaidMinutes=daily.reduce((sum,d)=>sum+d.paidMinutes,0);
    return jsonText({account:email,startDate:start,endDate:end,days:daily,totalPaidMinutes,totalPaidHours:Math.round(totalPaidMinutes/60*100)/100,targetWeeklyHours:Number(account.settings.weeklyGoalHours||40),sourceUpdatedAt:account.updatedAt});
  });
  server.registerTool("mytime_day_punches",{description:"List clock-in, lunch, break, and clock-out punches for one date belonging to the authenticated account. Read-only.",inputSchema:z.object({date:z.string().describe("Date YYYY-MM-DD")})},async({date})=>{
    const day=normalizeDate(date,""),rec=account.records[day]||{},p=Array.isArray(rec.punches)?rec.punches:[];
    return jsonText({account:email,date:day,punches:p.map((x,i)=>({sequence:i+1,type:String(x.type||"unknown"),timestamp:Number.isFinite(Number(x.ts))?new Date(Number(x.ts)).toISOString():null,note:typeof x.note==="string"?x.note:undefined})),paidMinutes:minutesPaid(rec,Date.now()),auditCount:Array.isArray(rec.audit)?rec.audit.length:0});
  });
  server.registerTool("mytime_schedule",{description:"Read the authenticated user's myTIME work schedule and daily/weekly paid-hour goals.",inputSchema:z.object({})},async()=>jsonText({
    account:email,timezone:account.settings.timezone||"local",startTime:account.settings.startTime||"08:00",
    endTime:account.settings.endTime||"17:00",lunchStart:account.settings.lunchStart||"11:30",
    lunchEnd:account.settings.lunchEnd||"12:30",morningBreakTime:account.settings.morningBreakTime||"09:45",
    afternoonBreakTime:account.settings.afternoonBreakTime||"14:45",dailyPaidHourGoal:Number(account.settings.goalHours||8),
    weeklyPaidHourGoal:Number(account.settings.weeklyGoalHours||40),workDays:["Monday","Tuesday","Wednesday","Thursday","Friday"]
  }));
  server.registerTool("mytime_time_bank",{description:"Read the authenticated user's time-bank entries. Read-only.",inputSchema:z.object({})},async()=>jsonText({
    account:email,entries:account.bankEntries.map(e=>({date:e.date||null,hours:Number(e.hours??e.amount??0),note:String(e.note||e.reason||"")}))
  }));
  return server;
}
export async function onRequest(context) {
  const {request,env}=context,email=getIdentity(request);
  const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
  if(!email)return new Response(JSON.stringify({error:"Sign in with your authorized @fossna.com account through Cloudflare Access."}),{status:401,headers});
  try {
    const account=await loadAccount(env,email);
    const handler=createMcpHandler(()=>createServer(email,account));
    return await handler(request,env,context);
  } catch(error) {
    return new Response(JSON.stringify({error:"MCP request could not be completed.",detail:error instanceof Error?error.message:"Unknown error"}),{status:500,headers});
  }
}
