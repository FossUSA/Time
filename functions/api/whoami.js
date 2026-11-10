const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "pragma": "no-cache" } });

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

export async function onRequest({ request }) {
  try { return json({ ok: true, email: await verifiedAccessEmail(request) }); }
  catch (error) { return json({ ok: false, error: error?.message || "Cloudflare Access authentication could not be verified." }, 401); }
}
