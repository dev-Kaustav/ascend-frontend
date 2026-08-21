// Secure proxy: validate the request, forward to n8n, validate the minimum
// response structure, return n8n's response. This route NEVER calls OpenAI,
// reads Google Sheets, computes signals, or invents fallback data.
import { analyseRequestSchema, isValidAnalysisResponse } from '../../../_lib/validation';
import { forwardToN8n } from '../_n8n';

// n8n's OpenAI agent can take ~30s; allow up to 60s on Vercel.
export const maxDuration = 60;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = null; }

  const parsed = analyseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { status: 'ERROR', error: { code: 'INVALID_REQUEST', message: parsed.error.issues.map((i) => i.message).join('; '), retryable: false } },
      { status: 400 },
    );
  }
  const req = parsed.data;

  // Simulation never hits this route (handled client-side). Be explicit.
  if (req.mode === 'simulation') {
    return Response.json(
      { status: 'ERROR', error: { code: 'SIMULATION_IS_LOCAL', message: 'Simulation mode runs in the browser and must not call the proxy.', retryable: false } },
      { status: 400 },
    );
  }

  const { json } = await forwardToN8n({
    url: process.env.N8N_ANALYSE_WEBHOOK_URL,
    secret: process.env.N8N_WEBHOOK_SECRET,
    idempotencyKey: req.executionId,
    payload: req,
  });

  // Analysis/upstream failures are returned as a 200 error envelope (the client
  // branches on `status: 'ERROR'`), so a recoverable failure isn't a network error.
  if (!json || json.status === 'ERROR') {
    return Response.json(json ?? { status: 'ERROR', error: { code: 'NO_RESPONSE', message: 'No response from n8n.', retryable: true } }, { status: 200 });
  }
  if (!isValidAnalysisResponse(json)) {
    return Response.json(
      { status: 'ERROR', error: { code: 'BAD_RESPONSE', message: 'n8n response is missing the core recommendation, basket or retailer.', retryable: true } },
      { status: 200 },
    );
  }
  return Response.json(json, { status: 200 });
}
