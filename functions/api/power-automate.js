const ALLOWED_FLOW_HOSTS = [
  "logic.azure.com",
  "powerplatform.com",
  "azure-apihub.net"
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function allowedAppOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" &&
      (u.hostname === "foss-time.pages.dev" || u.hostname.endsWith(".foss-time.pages.dev"));
  } catch {
    return false;
  }
}

function allowedFlowUrl(value) {
  try {
    const u = new URL(value);
    const hostOk = ALLOWED_FLOW_HOSTS.some(host => u.hostname === host || u.hostname.endsWith("." + host));
    return u.protocol === "https:" && hostOk && !u.username && !u.password;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request }) {
  const origin = request.headers.get("Origin") || "";
  if (!allowedAppOrigin(origin)) {
    return json({ error: "Requests must come from the official FOSS myTIME site." }, 403);
  }

  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return json({ error: "Send a JSON request." }, 415);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > 1024 * 1024) {
    return json({ error: "Request is too large. Send a smaller report or backup." }, 413);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Request body is not valid JSON." }, 400);
  }

  if (!input || typeof input !== "object" || !allowedFlowUrl(input.url)) {
    return json({
      error: "Paste the HTTPS URL from a Microsoft Power Automate HTTP trigger. Only approved Microsoft Power Automate / Azure Logic Apps hosts are supported."
    }, 400);
  }
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return json({ error: "A valid myTIME report payload is required." }, 400);
  }

  const body = JSON.stringify(input.payload);
  if (body.length > 1024 * 1024) {
    return json({ error: "The report payload is too large to send." }, 413);
  }

  try {
    const upstream = await fetch(input.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/plain, */*" },
      body,
      redirect: "manual"
    });

    // Avoid relaying Microsoft's response body, which can contain flow metadata.
    if (upstream.status >= 200 && upstream.status < 300) {
      return json({ ok: true, accepted: true, upstreamStatus: upstream.status });
    }
    return json({
      error: "Power Automate returned HTTP " + upstream.status + ". Check the trigger URL, flow permissions, and flow run history."
    }, 502);
  } catch {
    return json({
      error: "Could not reach Power Automate. Check your internet connection and the trigger URL."
    }, 502);
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Allow": "POST, OPTIONS", "Cache-Control": "no-store" } });
  }
  return json({ error: "Use POST to send a myTIME report to Power Automate." }, 405);
}
