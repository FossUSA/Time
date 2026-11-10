export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin) return json({ error: "Missing origin" }, 403);
  let originUrl;
  try { originUrl = new URL(origin); } catch { return json({ error: "Invalid origin" }, 403); }
  if (originUrl.protocol !== "https:" || !(
    originUrl.hostname === "time.fossna.cloud" ||
    originUrl.hostname === "foss-time.pages.dev" ||
    originUrl.hostname.endsWith(".foss-time.pages.dev")
  )) {
    return json({ error: "Origin not allowed" }, 403);
  }
  const accountEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!/^[^@\\s]+@fossna\\.com$/.test(accountEmail)) {
    return json({ error: "A signed-in FOSS account is required." }, 401);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 1_000_000) return json({ error: "Payload too large" }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return json({ error: "Expected a JSON payload" }, 400);
  }
  const configuredUrl = typeof env?.MYTIME_MAKE_WEBHOOK_URL === "string" ? env.MYTIME_MAKE_WEBHOOK_URL : "";
  const suppliedUrl = typeof body.url === "string" ? body.url : "";
  const targetValue = suppliedUrl || configuredUrl;
  if (!targetValue) return json({ error: "The managed Make connection is not configured on this deployment." }, 503);
  let target;
  try { target = new URL(targetValue); } catch { return json({ error: "Invalid configured Make webhook" }, 500); }
  if (target.protocol !== "https:" || !["hook.us2.make.com", "hook.make.com"].includes(target.hostname) || target.username || target.password || target.search || target.hash) {
    return json({ error: "Only official Make.com webhook URLs are allowed" }, 400);
  }
  const isWeekly = body.payload.event === "weekly_timecard_report" && !body.payload.test;
  let deliveryKey = null;
  if (isWeekly) {
    if (!env?.MYTIME_DB) return json({ error: "The cloud delivery ledger is unavailable." }, 503);
    const dates = Array.isArray(body.payload.records) ? body.payload.records.map(r => String(r.date || "")).filter(d => /^\\d{4}-\\d{2}-\\d{2}$/.test(d)).sort() : [];
    const weekEnding = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(body.payload.periodEnd || "")) ? body.payload.periodEnd : dates[dates.length - 1];
    if (!weekEnding) return json({ error: "A valid weekly report end date is required." }, 400);
    deliveryKey = { email: accountEmail, weekEnding, event: "weekly_timecard_report" };
    await env.MYTIME_DB.prepare("CREATE TABLE IF NOT EXISTS mytime_report_delivery (account_email TEXT NOT NULL, week_ending TEXT NOT NULL, event TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (account_email, week_ending, event))").run();
    const prior = await env.MYTIME_DB.prepare("SELECT status, updated_at FROM mytime_report_delivery WHERE account_email = ? AND week_ending = ? AND event = ?").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).first();
    if (prior?.status === "sent") return json({ ok: true, provider: "make", accepted: true, duplicate: true, message: "This weekly report was already delivered." });
    const pendingAge = prior?.updated_at ? Date.now() - Date.parse(prior.updated_at + "Z") : 0;
    if (prior?.status === "pending" && pendingAge >= 0 && pendingAge < 10 * 60 * 1000) return json({ error: "This weekly report is already being delivered. Check the delivery status before retrying." }, 409);
    if (prior?.status === "failed" || prior?.status === "pending") {
      await env.MYTIME_DB.prepare("UPDATE mytime_report_delivery SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE account_email = ? AND week_ending = ? AND event = ?").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).run();
    } else {
      await env.MYTIME_DB.prepare("INSERT OR IGNORE INTO mytime_report_delivery (account_email, week_ending, event, status) VALUES (?, ?, ?, 'pending')").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).run();
    }
  }
  try {
    const upstream = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body.payload)
    });
    if (!upstream.ok) {
      if (deliveryKey) await env.MYTIME_DB.prepare("UPDATE mytime_report_delivery SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE account_email = ? AND week_ending = ? AND event = ?").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).run();
      return json({ error: "Make.com returned HTTP " + upstream.status }, 502);
    }
    if (deliveryKey) await env.MYTIME_DB.prepare("UPDATE mytime_report_delivery SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE account_email = ? AND week_ending = ? AND event = ?").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).run();
    return json({ ok: true, provider: "make", accepted: true, status: upstream.status, message: "Make accepted the payload; check the scenario run and mailbox for final delivery." });
  } catch {
    if (deliveryKey) await env.MYTIME_DB.prepare("UPDATE mytime_report_delivery SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE account_email = ? AND week_ending = ? AND event = ?").bind(deliveryKey.email, deliveryKey.weekEnding, deliveryKey.event).run();
    return json({ error: "Could not reach Make.com" }, 502);
  }
}
export async function onRequest() {
  return json({ error: "Method not allowed" }, 405);
}
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
