import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { OAuthProvider, AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { z } from "zod";

const APP_URL = "https://time.fossna.cloud";
const MCP_URL = "https://mcp.fossna.cloud/api/mcp";
const SCOPES = ["mytime:read", "mytime:write", "offline_access"];

const jsonText = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const response = (body, status = 200, headers = {}) => new Response(body, {
  status,
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    ...headers,
  },
});

function getAccessIdentity(request) {
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  return /^[^@\s]+@fossna\.com$/.test(email) ? email : null;
}
function normalizeDate(value, fallback) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD.");
  const d = new Date(value + "T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error("Invalid calendar date.");
  return value;
}
function todayInZone(zone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
}
function paidMinutes(record, now = Date.now()) {
  const punches = Array.isArray(record?.punches)
    ? [...record.punches].sort((a, b) => Number(a.ts) - Number(b.ts))
    : [];
  let start = null;
  let total = 0;
  for (const punch of punches) {
    const ts = Number(punch.ts);
    if (!Number.isFinite(ts)) continue;
    if (punch.type === "in") start = ts;
    else if (punch.type === "lunch-start" && start !== null) {
      total += Math.max(0, ts - start);
      start = null;
    } else if (punch.type === "lunch-end") start = ts;
    else if (punch.type === "out" && start !== null) {
      total += Math.max(0, ts - start);
      start = null;
    }
  }
  if (start !== null) total += Math.max(0, now - start);
  return Math.floor(total / 60000);
}
async function loadAccount(env, email) {
  if (!env.MYTIME_DB) throw new Error("myTIME cloud database binding is unavailable.");
  const row = await env.MYTIME_DB.prepare(
    "SELECT payload, updated_at FROM mytime_user_data WHERE email = ?",
  ).bind(email).first();
  if (!row) return { records: {}, settings: {}, bankEntries: [], updatedAt: null };
  const payload = JSON.parse(row.payload);
  return {
    records: payload.records && typeof payload.records === "object" ? payload.records : {},
    settings: payload.settings && typeof payload.settings === "object" ? payload.settings : {},
    bankEntries: Array.isArray(payload.bankEntries) ? payload.bankEntries : [],
    updatedAt: row.updated_at || null,
  };
}
function buildMcpServer(env) {
  function signedInEmail() {
    const auth = getMcpAuthContext();
    const email = String(auth?.props?.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@fossna\.com$/.test(email)) {
      throw new Error("The OAuth grant does not contain an authorized FOSS account identity.");
    }
    return email;
  }
  const server = new McpServer({ name: "FOSS myTIME", version: "1.1.0" });
  server.registerTool(
    "mytime_status",
    { description: "Show the signed-in FOSS account, myTIME cloud-save status, goals and app URL. Read-only.", inputSchema: z.object({}) },
    async (_args, extra) => {
      const email = signedInEmail();
      const account = await loadAccount(env, email);
      return jsonText({
        account: email, app: APP_URL, cloudRecordFound: !!account.updatedAt,
        lastCloudUpdate: account.updatedAt, timezone: account.settings.timezone || "local",
        scheduledStart: account.settings.startTime || "08:00",
        scheduledEnd: account.settings.endTime || "17:00",
        dailyPaidHourGoal: Number(account.settings.goalHours || 8),
        weeklyPaidHourGoal: Number(account.settings.weeklyGoalHours || 40),
      });
    },
  );
  server.registerTool(
    "mytime_timecard_summary",
    {
      description: "Get a read-only timecard summary for the signed-in account over a date range. Dates use YYYY-MM-DD.",
      inputSchema: z.object({
        startDate: z.string().optional().describe("Inclusive start date YYYY-MM-DD; defaults to the previous six days."),
        endDate: z.string().optional().describe("Inclusive end date YYYY-MM-DD; defaults to today in the account timezone."),
      }),
    },
    async ({ startDate, endDate }, extra) => {
      const email = signedInEmail();
      const account = await loadAccount(env, email);
      const zone = account.settings.timezone && account.settings.timezone !== "local"
        ? account.settings.timezone : "America/Chicago";
      const today = todayInZone(zone);
      const end = normalizeDate(endDate, today);
      const start = normalizeDate(
        startDate,
        new Date(new Date(today + "T12:00:00Z").getTime() - 6 * 86400000).toISOString().slice(0, 10),
      );
      if (start > end) throw new Error("startDate must be on or before endDate.");
      const dates = Object.keys(account.records)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date <= end)
        .sort();
      const days = dates.map((date) => {
        const record = account.records[date] || {};
        const punches = Array.isArray(record.punches) ? record.punches : [];
        const minutes = paidMinutes(record);
        return {
          date, paidMinutes: minutes, paidHours: Math.round(minutes / 60 * 100) / 100,
          punchCount: punches.length,
          clockedOut: punches.some((p) => p.type === "out"),
          punches: punches.map((p) => ({
            type: String(p.type || "unknown"),
            time: Number.isFinite(Number(p.ts)) ? new Date(Number(p.ts)).toISOString() : null,
          })),
        };
      });
      const totalPaidMinutes = days.reduce((sum, day) => sum + day.paidMinutes, 0);
      return jsonText({
        account: email, startDate: start, endDate: end, days,
        totalPaidMinutes, totalPaidHours: Math.round(totalPaidMinutes / 60 * 100) / 100,
        targetWeeklyHours: Number(account.settings.weeklyGoalHours || 40),
        sourceUpdatedAt: account.updatedAt,
      });
    },
  );
  server.registerTool(
    "mytime_day_punches",
    { description: "List the signed-in user's clock, lunch and break punches for one date. Read-only.", inputSchema: z.object({ date: z.string().describe("Date YYYY-MM-DD") }) },
    async ({ date }, extra) => {
      const email = signedInEmail();
      const day = normalizeDate(date, "");
      const account = await loadAccount(env, email);
      const record = account.records[day] || {};
      const punches = Array.isArray(record.punches) ? record.punches : [];
      return jsonText({
        account: email, date: day,
        punches: punches.map((p, i) => ({
          sequence: i + 1, type: String(p.type || "unknown"),
          timestamp: Number.isFinite(Number(p.ts)) ? new Date(Number(p.ts)).toISOString() : null,
        })),
        paidMinutes: paidMinutes(record),
        breakStatus: record.breakStatus || {},
        breakTimes: record.breakTimes || {},
        auditCount: Array.isArray(record.audit) ? record.audit.length : 0,
      });
    },
  );
  server.registerTool(
    "mytime_schedule",
    { description: "Read the signed-in user's myTIME work schedule, lunch and break settings, and hour goals.", inputSchema: z.object({}) },
    async (_args, extra) => {
      const email = signedInEmail();
      const account = await loadAccount(env, email);
      const s = account.settings;
      return jsonText({
        account: email, timezone: s.timezone || "local",
        startTime: s.startTime || "08:00", endTime: s.endTime || "17:00",
        lunchStart: s.lunchStart || "11:30", lunchEnd: s.lunchEnd || "12:30",
        morningBreakTime: s.morningBreakTime || "09:45",
        afternoonBreakTime: s.afternoonBreakTime || "14:45",
        dailyPaidHourGoal: Number(s.goalHours || 8),
        weeklyPaidHourGoal: Number(s.weeklyGoalHours || 40),
        workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      });
    },
  );
  server.registerTool(
    "mytime_time_bank",
    { description: "Read the signed-in user's time-bank entries. Read-only.", inputSchema: z.object({}) },
    async (_args, extra) => {
      const email = signedInEmail();
      const account = await loadAccount(env, email);
      return jsonText({
        account: email,
        entries: account.bankEntries.map((entry) => ({
          date: entry.date || null,
          hours: Number(entry.hours ?? entry.amount ?? 0),
          note: String(entry.note || entry.reason || ""),
        })),
      });
    },
  );
  server.registerTool(
    "mytime_analyze_week",
    {
      description: "Return a structured workweek audit for AI analysis, including missing clock-outs, unusually long days, overtime and paid-hour totals. Does not modify records.",
      inputSchema: z.object({
        weekEnding: z.string().optional().describe("Friday date YYYY-MM-DD; defaults to the most recent Friday."),
      }),
    },
    async ({ weekEnding }, extra) => {
      const email = signedInEmail();
      const account = await loadAccount(env, email);
      const zone = account.settings.timezone && account.settings.timezone !== "local"
        ? account.settings.timezone : "America/Chicago";
      const today = todayInZone(zone);
      let friday = normalizeDate(weekEnding, today);
      if (!weekEnding) {
        const d = new Date(today + "T12:00:00Z");
        const day = d.getUTCDay();
        d.setUTCDate(d.getUTCDate() - ((day + 2) % 7));
        friday = d.toISOString().slice(0, 10);
      }
      const fridayDate = new Date(friday + "T12:00:00Z");
      if (fridayDate.getUTCDay() !== 5) throw new Error("weekEnding must be a Friday.");
      const mondayDate = new Date(fridayDate.getTime() - 4 * 86400000);
      const monday = mondayDate.toISOString().slice(0, 10);
      const daily = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(mondayDate.getTime() + i * 86400000).toISOString().slice(0, 10);
        const record = account.records[date] || {};
        const punches = Array.isArray(record.punches) ? record.punches : [];
        const minutes = paidMinutes(record);
        const hasIn = punches.some((p) => p.type === "in");
        const hasOut = punches.some((p) => p.type === "out");
        daily.push({
          date, paidMinutes: minutes, paidHours: Math.round(minutes / 60 * 100) / 100,
          punchCount: punches.length, hasClockIn: hasIn, hasClockOut: hasOut,
          missingClockOut: hasIn && !hasOut,
          overDailyGoalMinutes: Math.max(0, minutes - Number(account.settings.goalHours || 8) * 60),
        });
      }
      const totalPaidMinutes = daily.reduce((sum, d) => sum + d.paidMinutes, 0);
      return jsonText({
        account: email, weekStart: monday, weekEnd: friday, days: daily,
        totalPaidMinutes, totalPaidHours: Math.round(totalPaidMinutes / 60 * 100) / 100,
        weeklyGoalMinutes: Number(account.settings.weeklyGoalHours || 40) * 60,
        overtimeMinutes: Math.max(0, totalPaidMinutes - Number(account.settings.weeklyGoalHours || 40) * 60),
        missingPunchDates: daily.filter((d) => d.missingClockOut).map((d) => d.date),
        sourceUpdatedAt: account.updatedAt,
      });
    },
  );
  server.registerTool(
    "mytime_correct_punch",
    {
      title: "Correct an existing myTIME punch",
      description: "Approval-gated correction of one existing punch in the signed-in user's own cloud record. Requires mytime:write, a reason, and confirm=true. The operation is audited and uses an optimistic concurrency check; it never creates or deletes punches.",
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
      inputSchema: z.object({
        date: z.string().describe("Work date YYYY-MM-DD"),
        sequence: z.number().int().min(1).describe("1-based position of the punch in the current day's chronological punch list"),
        newType: z.enum(["in", "lunch-start", "lunch-end", "out", "morning-break-start", "morning-break-end", "afternoon-break-start", "afternoon-break-end"]),
        newTimestamp: z.string().describe("Replacement timestamp as an ISO 8601 date-time with timezone, e.g. 2026-11-06T08:02:00-06:00"),
        reason: z.string().min(8).max(500).describe("Reason for the correction; stored in the audit log"),
        confirm: z.literal(true).describe("Must be explicitly true. ChatGPT should require a human approval for this destructive tool call."),
      }),
    },
    async ({ date, sequence, newType, newTimestamp, reason, confirm }, context) => {
      const email = signedInEmail();
      const scopes = context?.http?.authInfo?.scopes || [];
      if (!scopes.includes("mytime:write")) {
        return jsonText({ ok: false, error: "This connection has read-only permission. Reconnect FOSS myTIME and explicitly grant mytime:write before correcting a punch." });
      }
      if (confirm !== true) return jsonText({ ok: false, error: "Correction not applied: explicit confirmation is required." });
      const workDate = normalizeDate(date, "");
      if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(newTimestamp)) throw new Error("newTimestamp must include an explicit timezone, such as Z or -06:00.");
      const timestamp = Date.parse(newTimestamp);
      if (!Number.isFinite(timestamp)) throw new Error("newTimestamp must be a valid ISO 8601 date-time.");
      const normalizedTimestamp = new Date(timestamp).toISOString();
      const account = await env.MYTIME_DB.prepare(
        "SELECT payload, updated_at FROM mytime_user_data WHERE email = ?",
      ).bind(email).first();
      if (!account) throw new Error("No cloud record exists for the signed-in FOSS account.");
      const payload = JSON.parse(account.payload);
      const record = payload.records && payload.records[workDate];
      if (!record || !Array.isArray(record.punches)) throw new Error("No punches exist for that work date.");
      const ordered = [...record.punches].sort((a, b) => Number(a.ts) - Number(b.ts));
      if (sequence > ordered.length) throw new Error("The selected punch sequence no longer exists. Refresh the timecard and try again.");
      const oldPunch = ordered[sequence - 1];
      const zone = payload.settings?.timezone && payload.settings.timezone !== "local" ? payload.settings.timezone : "America/Chicago";
      const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
      if (localDate !== workDate) throw new Error("The replacement timestamp must remain on the selected work date in the account timezone.");
      if (timestamp > Date.now() + 5 * 60 * 1000) throw new Error("A punch cannot be corrected to a future time.");
      const newPunch = { ...oldPunch, type: newType, ts: timestamp };
      const corrected = ordered.map((p, index) => index === sequence - 1 ? newPunch : p)
        .sort((a, b) => Number(a.ts) - Number(b.ts));
      if (corrected.some((p, index) => index > 0 && Number(p.ts) <= Number(corrected[index - 1].ts))) {
        throw new Error("Punch timestamps must be unique and strictly chronological.");
      }
      record.punches = corrected;
      record.audit = Array.isArray(record.audit) ? record.audit : [];
      record.audit.push({
        at: Date.now(), action: "mcp-punch-correction", actor: email, reason: reason.trim(),
        sequence, oldPunch: { type: oldPunch.type, ts: oldPunch.ts },
        newPunch: { type: newType, ts: timestamp },
      });
      record.audit = record.audit.slice(-200);
      const updated = await env.MYTIME_DB.prepare(
        "UPDATE mytime_user_data SET payload = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ? AND updated_at = ?",
      ).bind(JSON.stringify(payload), email, account.updated_at).run();
      if (Number(updated.meta?.changes || 0) !== 1) {
        throw new Error("The cloud record changed while this correction was being prepared. No change was made; refresh and retry.");
      }
      return jsonText({
        ok: true, account: email, date: workDate, sequence,
        oldPunch: { type: oldPunch.type, timestamp: oldPunch.ts ? new Date(Number(oldPunch.ts)).toISOString() : null },
        newPunch: { type: newType, timestamp: normalizedTimestamp },
        auditRecorded: true, updatedAt: new Date().toISOString(),
      });
    },
  );
  return server;
}



const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/authorize") return response("Not found.", 404);
    const email = getAccessIdentity(request);
    if (!email) return response("Sign in through your FOSS Cloudflare Access account to authorize myTIME.", 401);
    const oauth = env.OAUTH_PROVIDER;

    if (request.method === "GET") {
      try {
        const authRequest = await oauth.parseAuthRequest(request);
        const details = await oauth.describeConsent(authRequest);
        const consent = await oauth.beginConsent(authRequest);
        const scopes = details.scope.map((scope) => {
          const checked = scope === "mytime:write" ? "" : " checked";
          const label = scope === "mytime:write" ? "mytime:write — allow approved punch corrections" : escapeHtml(scope);
          return '<label><input type="checkbox" name="scope" value="' + escapeHtml(scope) + '"' + checked + '> ' + label + '</label>';
        }).join("<br>");
        const publisher = details.clientDomain
          ? "Published by <strong>" + escapeHtml(details.clientDomain) + "</strong>."
          : "This client registered its own name; its publisher domain is not verified.";
        const localWarning = details.redirectIsLoopback
          ? "<p><strong>Warning:</strong> this sends access to an application on your computer. Continue only if you started this connection.</p>"
          : "";
        consent.headers.set("content-type", "text/html; charset=utf-8");
        consent.headers.set("cache-control", "no-store");
        consent.headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
        return new Response(
          '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect FOSS myTIME</title><style>body{margin:0;background:#f4f6fb;color:#14254a;font:16px/1.55 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}main{width:min(100%,540px);background:white;border:1px solid #dce3f0;border-radius:18px;padding:30px;box-sizing:border-box;box-shadow:0 12px 40px #14254a12}h1{font-size:25px;margin:0 0 12px}p{color:#52617d}label{display:block;margin:12px 0}button{border:0;border-radius:9px;padding:12px 20px;font:700 15px system-ui;cursor:pointer;background:#1d2a7a;color:white;margin-right:8px}button.deny{background:#e9edf5;color:#14254a}small{color:#6c7891}</style><main><small>FOSS NORTH AMERICA · myTIME</small><h1>Connect ' + escapeHtml(details.clientName) + '?</h1><p>' + publisher + ' Access will be sent to <strong>' + escapeHtml(details.redirectHost) + '</strong>.</p>' + localWarning + '<p>Choose the permissions to grant:</p><form method="post"><input type="hidden" name="handle" value="' + escapeHtml(consent.handle) + '">' + scopes + '<p><button name="decision" value="approve">Approve access</button><button class="deny" name="decision" value="deny">Deny</button></p></form></main></html>',
          { status: 200, headers: consent.headers },
        );
      } catch (error) {
        if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
        const message = error instanceof AuthorizationError ? error.description : "The authorization request could not be verified.";
        return response(escapeHtml(message), 400, { "content-type": "text/plain; charset=utf-8" });
      }
    }

    if (request.method === "POST") {
      try {
        const form = await request.formData();
        const handle = String(form.get("handle") || "");
        if (form.get("decision") !== "approve") {
          const denied = await oauth.denyConsent(request, handle);
          return new Response(null, { status: 302, headers: denied.headers });
        }
        const approved = await oauth.approveConsent(request, handle, {
          scope: form.getAll("scope").map(String),
        });
        const { redirectTo } = await oauth.completeAuthorization({
          request: approved.request,
          userId: email,
          metadata: { email },
          scope: approved.request.scope,
          props: { email },
        });
        approved.headers.set("Location", redirectTo);
        return new Response(null, { status: 302, headers: approved.headers });
      } catch (error) {
        if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
        const message = error instanceof AuthorizationError ? error.description : "The authorization could not be completed.";
        return response(escapeHtml(message), 400, { "content-type": "text/plain; charset=utf-8" });
      }
    }
    return response("Method not allowed.", 405, { allow: "GET, POST" });
  },
};

const provider = new OAuthProvider({
  apiRoute: "/api/mcp",
  apiHandler: {
    fetch(request, env, ctx) {
      const grantedScopes = Array.isArray(ctx.auth?.scope)
        ? ctx.auth.scope
        : String(ctx.auth?.scope || "").split(/\s+/).filter(Boolean);
      if (!grantedScopes.includes("mytime:read")) {
        return new Response("The myTIME read permission is required.", { status: 403 });
      }
      const handler = createMcpHandler(() => buildMcpServer(env), {
        route: "/api/mcp",
        allowedHostnames: ["mcp.fossna.cloud"],
      });
      return handler(request, env, ctx);
    },
  },
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: SCOPES,
  requiredScopes: ["mytime:read"],
  clientIdMetadataDocumentEnabled: true,
  resourceMetadata: {
    resource: MCP_URL,
    authorization_servers: ["https://mcp.fossna.cloud"],
  },
  refreshTokenIdleTTL: 60 * 60 * 24 * 30,
});

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname !== "mcp.fossna.cloud") return context.next();
  const isMcpRoute = url.pathname === "/api/mcp"
    || url.pathname === "/authorize"
    || url.pathname === "/oauth/token"
    || url.pathname === "/oauth/register"
    || url.pathname.startsWith("/.well-known/");
  if (!isMcpRoute) return context.next();
  return provider.fetch(context.request, context.env, context);
}
