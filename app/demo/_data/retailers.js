// Deterministic retailer fixtures spanning every workflow state.
// Phone numbers are masked placeholders only — never a real number.
export const DEMO_RETAILERS = [
  { id: 'RET-1027', outletId: 'RET-1027', name: 'Sharma Super Store', location: 'Sector 46, Gurugram', type: 'Kirana', preferredLanguage: 'hinglish', paymentPreference: 'credit', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1027', state: 'window_exceeded', daysSinceLastOrder: 6, medianReorderDays: 5, avgBasketValue: 2650, lastContactStatus: 'No active conversation' },
  { id: 'RET-1043', outletId: 'RET-1043', name: 'Verma Provision Store', location: 'Sector 12, Gurugram', type: 'Kirana', preferredLanguage: 'hinglish', paymentPreference: 'upi', darkStore: 'Sector 12', phoneMasked: '+91 9XXXX X1043', state: 'likely_due', daysSinceLastOrder: 9, medianReorderDays: 8, avgBasketValue: 1850, lastContactStatus: 'No active conversation' },
  { id: 'RET-1055', outletId: 'RET-1055', name: 'Gupta General Store', location: 'DLF Phase 3, Gurugram', type: 'Convenience', preferredLanguage: 'hi', paymentPreference: 'credit', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1055', state: 'whatsapp_sent', daysSinceLastOrder: 7, medianReorderDays: 6, avgBasketValue: 3100, lastContactStatus: 'Reorder nudge sent · 2h ago' },
  { id: 'RET-1061', outletId: 'RET-1061', name: 'New Apsara Kirana', location: 'Palam Vihar, Gurugram', type: 'Kirana', preferredLanguage: 'hinglish', paymentPreference: 'cash', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1061', state: 'awaiting_reply', daysSinceLastOrder: 8, medianReorderDays: 7, avgBasketValue: 2200, lastContactStatus: 'Nudge sent · awaiting reply · 5h ago' },
  { id: 'RET-1074', outletId: 'RET-1074', name: 'Singh Mart', location: 'Sohna Road, Gurugram', type: 'Convenience', preferredLanguage: 'en', paymentPreference: 'upi', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1074', state: 'call_requested', daysSinceLastOrder: 10, medianReorderDays: 7, avgBasketValue: 2950, lastContactStatus: 'Retailer requested a call · 1h ago' },
  { id: 'RET-1088', outletId: 'RET-1088', name: 'Krishna Convenience', location: 'Sector 56, Gurugram', type: 'Convenience', preferredLanguage: 'hinglish', paymentPreference: 'credit', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1088', state: 'order_confirmed', daysSinceLastOrder: 2, medianReorderDays: 8, avgBasketValue: 1750, lastContactStatus: 'Order confirmed via WhatsApp · today' },
  { id: 'RET-1092', outletId: 'RET-1092', name: 'Bansal Kirana', location: 'Sector 31, Gurugram', type: 'Kirana', preferredLanguage: 'hi', paymentPreference: 'cash', darkStore: 'Sector 44', phoneMasked: '+91 9XXXX X1092', state: 'declined', daysSinceLastOrder: 4, medianReorderDays: 6, avgBasketValue: 1400, lastContactStatus: 'Declined — sufficient stock · today' },
  { id: 'RET-1109', outletId: 'RET-1109', name: 'Metro Daily Needs', location: 'Sector 29, Gurugram', type: 'Convenience', preferredLanguage: 'en', paymentPreference: 'upi', darkStore: 'Sector 12', phoneMasked: '+91 9XXXX X1109', state: 'on_cycle', daysSinceLastOrder: 3, medianReorderDays: 9, avgBasketValue: 3400, lastContactStatus: 'On cycle — no action needed' },
];

export const RETAILER_BY_ID = Object.fromEntries(DEMO_RETAILERS.map((r) => [r.id, r]));

export const STATE_RANK = {
  window_exceeded: 0, likely_due: 1, awaiting_reply: 2, call_requested: 3,
  whatsapp_sent: 4, order_confirmed: 5, on_cycle: 6, declined: 7,
};
