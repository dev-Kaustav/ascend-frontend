// Centralised workflow state machine for the currently implemented journey.
// The journey stops at human approval — no send/reply/order/ops/voice exists yet.
export const STAGE_LABEL = {
  READY: 'Ready',
  ANALYSING: 'Analysing',
  RECOMMENDATION_READY: 'Recommendation ready',
  AWAITING_HUMAN_APPROVAL: 'Awaiting human approval',
  APPROVED: 'Approved',
  ERROR: 'Error',
};

const TRANSITIONS = {
  READY: ['ANALYSING'],
  ANALYSING: ['RECOMMENDATION_READY', 'AWAITING_HUMAN_APPROVAL', 'ERROR'],
  RECOMMENDATION_READY: ['AWAITING_HUMAN_APPROVAL', 'ANALYSING'],
  AWAITING_HUMAN_APPROVAL: ['APPROVED', 'ANALYSING', 'READY'],
  APPROVED: ['READY', 'ANALYSING'],
  ERROR: ['READY', 'ANALYSING'],
};

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const STAGE_RAIL = ['ANALYSING', 'RECOMMENDATION_READY', 'AWAITING_HUMAN_APPROVAL', 'APPROVED'];

// Map a response `status` string onto a UI stage.
export function stageFromStatus(status) {
  if (status === 'AWAITING_HUMAN_APPROVAL') return 'AWAITING_HUMAN_APPROVAL';
  if (status === 'RECOMMENDATION_READY') return 'RECOMMENDATION_READY';
  if (status === 'ERROR') return 'ERROR';
  return 'AWAITING_HUMAN_APPROVAL';
}
