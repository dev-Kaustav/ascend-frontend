// Server-side n8n forwarder. Webhook URL + secret are read here and never
// returned to the browser. Normalizes timeout / network / non-2xx / malformed
// JSON into an explicit ERROR object. It does NOT invent fallback live data.
// n8n runs an OpenAI agent (~30s typical), so allow generous headroom.
const TIMEOUT_MS = 55_000;

function errBody(code, message, retryable = true) {
  return { orchestrator: 'n8n', status: 'ERROR', error: { code, message, retryable } };
}

export async function forwardToN8n({ url, secret, idempotencyKey, payload }) {
  if (!url) {
    return { status: 500, json: errBody('MISSING_WEBHOOK_URL', 'Live mode is enabled but N8N_ANALYSE_WEBHOOK_URL is not configured on the server.', false) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Ascend-Webhook-Secret': secret } : {}),
        'X-Ascend-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; }
    catch { return { status: 502, json: errBody('BAD_GATEWAY', 'n8n returned a non-JSON response.') }; }

    if (!res.ok) {
      return { status: 502, json: errBody('UPSTREAM_ERROR', `n8n responded ${res.status}.`) };
    }
    return { status: 200, json };
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    return {
      status: aborted ? 504 : 502,
      json: errBody(aborted ? 'TIMEOUT' : 'NETWORK_ERROR', aborted ? 'n8n timed out.' : 'Could not reach n8n.'),
    };
  } finally {
    clearTimeout(timer);
  }
}
