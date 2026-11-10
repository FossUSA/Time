import { verifiedAccessEmail } from "../_shared/access-auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "pragma": "no-cache" } });

export function normalizeCloudPayload(input) {
  const normalized = { ...input };
  if (normalized.localState && typeof normalized.localState === "object" && !Array.isArray(normalized.localState)) {
    normalized.localState = { ...normalized.localState };
    delete normalized.localState["foss-time-recovery-snapshot-v1"];
    delete normalized.localState["foss-time-recovery-snapshot-v1-status"];
  }
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableCloudJson(value) {
  return JSON.stringify(stableValue(value));
}

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
    const normalizedPayload = normalizeCloudPayload(body.payload);
    const payload = stableCloudJson(normalizedPayload);
    if (payload.length > 2_000_000) return json({ ok: false, error: "Cloud record data is too large (2 MB maximum)." }, 413);

    // Treat retries and UI-only snapshots as no-ops. Old open tabs may still
    // send local recovery snapshot timestamps every 15 seconds; these do not
    // represent timecard edits and must never advance the D1 revision.
    const existing = await env.MYTIME_DB.prepare(
      "SELECT payload, updated_at, revision FROM mytime_user_data WHERE email = ?",
    ).bind(email).first();
    if (existing) {
      let currentPayload;
      try { currentPayload = stableCloudJson(normalizeCloudPayload(JSON.parse(existing.payload))); }
      catch { currentPayload = null; }
      if (currentPayload === payload) {
        return json({
          ok: true, unchanged: true, email,
          updatedAt: existing.updated_at || null,
          revision: Number(existing.revision || 0),
        });
      }
    }

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
