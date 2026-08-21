// Browser-side agent client. Simulation runs locally; Live calls only the
// secure Next.js proxy. Live failures throw — there is NO silent fallback to
// simulation (the user must explicitly switch modes).
import { simulateAnalyse } from './simulation';

export class AgentError extends Error {
  constructor(message, retryable = true) {
    super(message);
    this.retryable = retryable;
  }
}

function assertContract(json) {
  if (!json || !json.recommendation || !json.basket || !json.retailer) {
    throw new AgentError('n8n returned an incomplete recommendation (missing retailer, basket or recommendation).', true);
  }
  return json;
}

export async function runAnalyse(req) {
  if (req.mode === 'simulation') return simulateAnalyse(req);

  let res;
  try {
    res = await fetch('/demo/api/agent/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    throw new AgentError('Could not reach the analysis service. Check the n8n configuration, then Retry.', true);
  }

  let json;
  try { json = await res.json(); } catch { throw new AgentError('n8n returned a malformed response.', true); }

  if (!res.ok || json.status === 'ERROR' || json.error) {
    const err = json.error;
    throw new AgentError(err?.message ?? `Analysis failed (${res.status}).`, err?.retryable ?? true);
  }
  return assertContract(json);
}
