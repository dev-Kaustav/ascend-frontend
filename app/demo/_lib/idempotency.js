// ID + idempotency-key helpers. Keys flow client → /api → n8n → Apps Script log.
function rand() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function newExecutionId() {
  return `exec_${Date.now().toString(36)}_${rand().slice(0, 8)}`;
}

export function newIdempotencyKey(seed) {
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return `idem_${(h >>> 0).toString(36)}`;
  }
  return `idem_${rand()}`;
}
