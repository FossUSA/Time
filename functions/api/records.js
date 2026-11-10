
async function verifiedAccessEmail(request) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Error("Cloudflare Access did not forward its signed identity token.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Cloudflare Access token.");
  const decode = (value) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported Cloudflare Access token.");
  const certResponse = await fetch("https://fossna.cloudflareaccess.com/cdn-cgi/access/certs", { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!certResponse.ok) throw new Error("Could not retrieve Cloudflare Access signing keys.");
  const certs = await certResponse.json();
  const jwk = (certs.keys || []).find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Cloudflare Access signing key was not found.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || claims.iss !== "https://fossna.cloudflareaccess.com" || !audience.includes("be13baf6dd40cfd1cbb67658f27069c13b65ada283abe5e93ed1c6bcbacb3ee5") || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60) throw new Error("Cloudflare Access token signature, issuer, audience, or expiry is invalid.");
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@fossna\.com$/.test(email)) throw new Error("The signed-in identity is not an authorized @fossna.com account.");
  const forwardedEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (forwardedEmail && forwardedEmail !== email) throw new Error("Cloudflare Access identity headers do not match.");
  return email;
}

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
    console.error("myTIME records API error:", error);
    return json({ ok: false, error: "Cloud storage request failed. Check the Cloudflare Pages function logs." }, 500);
  }
}
