// Zod schema for the analyse request (used by the Next.js proxy).
import { z } from 'zod';

export const analyseRequestSchema = z.object({
  event: z.literal('ANALYSE_REORDER_OPPORTUNITIES'),
  mode: z.enum(['live', 'simulation']),
  executionId: z.string().min(3),
  outletId: z.string().min(1),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Minimum response structure the frontend can render. The proxy rejects
// anything from n8n that does not carry the core recommendation.
export function isValidAnalysisResponse(json) {
  return !!(json && json.retailer && json.recommendation && json.basket && Array.isArray(json.basket.items));
}
