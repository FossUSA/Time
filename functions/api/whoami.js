const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export async function onRequest({ request }) {
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!email || !email.endsWith("@fossna.com") || email.indexOf("@") < 1) return json({ ok: false, error: "Authentication required" }, 401);
  return json({ ok: true, email });
}
