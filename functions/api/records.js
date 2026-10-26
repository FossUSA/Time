const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "PUT") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!email || !/^[^@]+@fossna\.com$/.test(email)) {
    return json({ ok: false, error: "Sign in with your authorized FOSS North America account to access cloud records." }, 401);
  }
  if (!env.MYTIME_DB) {
    return json({ ok: false, error: "Cloud storage is not configured yet." }, 503);
  }

  try {
    if (request.method === "GET") {
      const row = await env.MYTIME_DB.prepare(
        "SELECT payload, updated_at FROM mytime_user_data WHERE email = ?"
      ).bind(email).first();
      return json({ ok: true, email, payload: row ? JSON.parse(row.payload) : null, updatedAt: row?.updated_at || null });
    }

    const length = Number(request.headers.get("content-length") || 0);
    if (length > 2_000_000) return json({ ok: false, error: "Record backup is too large." }, 413);
    const body = await request.json();
    if (!body || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
      return json({ ok: false, error: "Invalid record payload." }, 400);
    }
    const payload = JSON.stringify(body.payload);
    if (payload.length > 2_000_000) return json({ ok: false, error: "Record backup is too large." }, 413);
    await env.MYTIME_DB.prepare(
      "INSERT INTO mytime_user_data (email, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP"
    ).bind(email, payload).run();
    return json({ ok: true, email, updatedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, error: "Cloud storage request failed." }, 500);
  }
}
