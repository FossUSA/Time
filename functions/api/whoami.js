import { verifiedAccessEmail } from "../_shared/access-auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff",
  },
});

export async function onRequest({ request }) {
  try {
    return json({ ok: true, email: await verifiedAccessEmail(request) });
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || "Cloudflare Access authentication could not be verified.",
    }, 401);
  }
}
