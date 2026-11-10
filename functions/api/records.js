import { verifiedAccessEmail } from "../_shared/access-auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "pragma": "no-cache" } });

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "PUT") return json({ ok: false, error: "Method not allowed" }, 405);
  let email;
  try { email = await verifiedAccessEmail(request); }
  catch (error) { return json({ ok: false, error: error?.message || "Cloudflare Access authentication could not be verified." }, 401); }
  if (!env.MYTIME_DB) return json({ ok: false, error: "Cloudflare D1 binding MYTIME_DB is unavailable." }, 503);

  try {
    if (request.method === "GET") {
      const row = await env.MYTIME_DB.prepare("SELECT payload, updated_at, revision FROM mytime_user_data WHERE email = ?").bind(email).first();
      return json({ ok: true, email, payload: row ? JSON.parse(row.payload) : null, updatedAt: row?.updated_at || null, revision: Number(row?.revision || 0) });
    }
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 2_000_000) return json({ ok: false, error: "Record backup is too large." }, 413);
    const body = await request.json();
    if (!body || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return json({ ok: false, error: "Invalid record payload." }, 400);
    const expectedRevision = Number(body.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ ok: false, error: "A valid cloud revision is required. Reload the latest cloud data before saving." }, 428);
    const payload = JSON.stringify(body.payload);
    if (payload.length > 2_000_000) return json({ ok: false, error: "Cloud record data is too large (2 MB maximum)." }, 413);
    let result;
    if (expectedRevision === 0) {
      result = await env.MYTIME_DB.prepare("INSERT INTO mytime_user_data (email, payload, updated_at, revision) VALUES (?, ?, CURRENT_TIMESTAMP, 1) ON CONFLICT(email) DO NOTHING").bind(email, payload).run();
    } else {
      result = await env.MYTIME_DB.prepare("UPDATE mytime_user_data SET payload = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1 WHERE email = ? AND revision = ?").bind(payload, email, expectedRevision).run();
    }
    if (Number(result?.meta?.changes || 0) !== 1) {
      const latest = await env.MYTIME_DB.prepare("SELECT updated_at, revision FROM mytime_user_data WHERE email = ?").bind(email).first();
      return json({ ok: false, conflict: true, error: "Cloud data changed on another computer. The newer cloud copy was protected; reload it before continuing.", revision: Number(latest?.revision || 0), updatedAt: latest?.updated_at || null }, 409);
    }
    const saved = await env.MYTIME_DB.prepare("SELECT updated_at, revision FROM mytime_user_data WHERE email = ?").bind(email).first();
    return json({ ok: true, email, updatedAt: saved?.updated_at || new Date().toISOString(), revision: Number(saved?.revision || expectedRevision + 1) });
  } catch (error) {
    const detail = String(error?.message || error || "Unknown D1 error").replace(/[\r\n\t]+/g, " ").slice(0, 240);
    console.error("myTIME records API error:", { name: error?.name || "Error", message: detail });
    return json({ ok: false, code: "CLOUD_STORAGE_ERROR", error: "Cloud storage failed: " + detail }, 500);
  }
}
