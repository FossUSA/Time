const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "pragma": "no-cache" } });

export async function onRequest({ request }) {
  const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@fossna\.com$/.test(email)) {
    return json({ ok: false, error: "No authorized FOSS identity was provided by Cloudflare Access." }, 401);
  }
  return json({ ok: true, email });
}
