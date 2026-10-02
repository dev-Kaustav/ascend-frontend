// One browser-history entry shared by every storefront sheet (login, shop, address), so the Back
// button closes whichever sheet is open before it leaves the page underneath.
//
// Module-level and shared on purpose. React Strict Mode mounts, unmounts and re-mounts in one tick,
// and a sheet that hands over to another (login to shop) unmounts one and mounts the next in the
// same commit; both must keep the single entry instead of popping it and pushing another.
export const historyEntry = { live: 0, open: false };

export function acquireHistoryEntry() {
  historyEntry.live += 1;
  if (!historyEntry.open) {
    window.history.pushState({ ascendSheet: true }, "");
    historyEntry.open = true;
  }
}

export function releaseHistoryEntry() {
  historyEntry.live -= 1;
  // Deferred, so a Strict Mode re-mount or a hand-over to another sheet (live back to 1) keeps the
  // entry. The popstate listener is already gone by the time this pop lands, so it cannot be
  // mistaken for the Back button.
  setTimeout(() => {
    if (historyEntry.live === 0 && historyEntry.open) {
      historyEntry.open = false;
      window.history.back();
    }
  }, 0);
}
