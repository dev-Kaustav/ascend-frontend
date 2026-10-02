"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import SheetHost from "@/components/store/SheetHost";
import {
  cartQuantity,
  acceptStockChanges,
  applyStockConflict,
  cartReadiness,
  cartUnitCount,
  clearCart,
  describeQuoteError,
  emptyCart,
  performReorder,
  quoteRequestBody,
  reconcileReorder,
  readStoredCart,
  removeCartLine,
  removeCartLines,
  sameCartLines,
  storedCartMatches,
  updateCartQuantity,
  writeStoredCart
} from "@/lib/store/cart.mjs";
import { createRequestGate } from "@/lib/store/catalogue.mjs";
import {
  IDLE_CHECKOUT,
  checkoutGate,
  checkoutView,
  createCheckoutController,
  isStaleStoreError,
  storeEndpoints,
  storeFetch
} from "@/lib/store/api.mjs";
import { normalizeOrderDetail, normalizeOrderList } from "@/lib/store/orders.mjs";
import { historyEntry } from "@/lib/store/sheet-history";
import { disposePhoneVerifier, signOutPhoneProof } from "@/lib/store/firebase";
import {
  clearSelectedAddressId,
  readSelectedAddressId,
  resolveSelectedAddress,
  saveSelectedAddressId
} from "@/lib/store/maps.mjs";
import {
  clearRetailerTokens,
  deriveRetailerState,
  getRetailerSession,
  getSessionGeneration,
  subscribeRetailerSession,
  validateRetailerIntent
} from "@/lib/store/session.mjs";

// Retailer state for the storefront only. It reads the retailer session (its own storage keys)
// and never touches the staff provider or staff storage (D-04); /login, /landing and /app are
// outside the store layout that mounts it.
//
// Same hydration rule as the staff AuthProvider: the server cannot see browser storage, so
// getServerSnapshot returns undefined, which renders as "loading" on the server and during
// hydration and is only then replaced by the real credentials.
//
// The provider never blocks rendering: whatever the state (loading, anonymous, expired, error)
// the shell and the public catalogue stay usable.

const SHEETS = ["login", "shop", "address", "cart"];
const getServerSnapshot = () => undefined;
const NO_ADDRESSES = [];
const NO_LINES = {};

// The remembered address id lives in localStorage, an external store: other tabs change it (the
// storage event) and this tab's own writes notify the same subscribers.
const selectionListeners = new Set();
const notifySelection = () => selectionListeners.forEach((listener) => listener());
function subscribeSelection(listener) {
  selectionListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    selectionListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function browserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const RetailerContext = createContext({
  status: "loading",
  readiness: "loading",
  me: null,
  retailerId: null,
  canPurchase: false,
  generation: null,
  activeSheet: null,
  pendingIntent: null,
  addresses: [],
  selectedAddress: null,
  cart: null,
  checkout: null,
  reorder: null,
  refreshMe: () => {},
  reloadMe: async () => null,
  applyMe: () => false,
  selectAddress: () => false,
  forgetAddress: () => {},
  openAddresses: () => {},
  requireRetailer: () => false,
  takeIntent: () => null,
  openSheet: () => {},
  closeSheet: () => {},
  logout: () => {}
});

// ---- Cart -----------------------------------------------------------------------------------------
// The cart is the retailer's intent (SKU ids and whole packets) under ascend_store_cart:<retailer_id>.
// It exists only for a ready retailer and only for the identity it was restored under: a new
// generation or retailer drops the visible cart at once and restores that retailer's own. Prices come
// only from POST /store/cart/quote, asked for one cart revision under one session generation; an
// answer that is not for the cart now on screen is ignored (see cartReadiness).
const QUOTE_DELAY_MS = 150; // quick taps on a stepper become one request

function useCartState({ ready, retailerId, generation }) {
  const ownerKey = ready && retailerId != null && generation != null ? `${generation}:${retailerId}` : null;
  const identity = useMemo(() => (ownerKey ? { generation, retailerId } : null), [ownerKey, generation, retailerId]);
  const [record, setRecord] = useState(null); // { owner, retailerId, cart }
  const recordRef = useRef(null);
  const ownerRef = useRef(null);
  const [quote, setQuote] = useState(null); // the latest quote request: { phase, identity, revision, quote, error }
  const [known, setKnown] = useState({ owner: null, lines: {} }); // last quoted product data, for display only
  const [retries, setRetries] = useState(0);

  // The owner changed (sign-in, sign-out, a switched account): drop the old cart from view in this
  // very render and restore the new owner's own, so another retailer's lines are never shown. A ready
  // retailer exists only in the browser, so the server render and hydration never read storage here.
  if (ownerKey !== (record?.owner ?? null)) {
    setRecord(ownerKey ? { owner: ownerKey, retailerId, cart: readStoredCart(browserStorage(), retailerId) } : null);
  }
  useEffect(() => {
    recordRef.current = record;
    ownerRef.current = ownerKey;
  });

  const cart = record && record.owner === ownerKey ? record.cart : null;

  useEffect(() => {
    if (!cart || !identity || cart.lines.length === 0) return undefined;
    const asked = { identity, revision: cart.revision };
    const gate = createRequestGate();
    const token = gate.begin();
    const timer = setTimeout(() => {
      storeFetch(storeEndpoints.quote, { method: "POST", body: JSON.stringify(quoteRequestBody(cart)) })
        .then((answer) => {
          if (!gate.isCurrent(token) || getSessionGeneration() !== identity.generation) return;
          setQuote({ phase: "ready", ...asked, quote: answer, error: null });
          const owner = `${identity.generation}:${identity.retailerId}`;
          const lines = {};
          for (const line of Array.isArray(answer?.lines) ? answer.lines : []) lines[line.sku_id] = line;
          setKnown((previous) => ({ owner, lines: { ...(previous.owner === owner ? previous.lines : {}), ...lines } }));
        })
        .catch((error) => {
          if (!gate.isCurrent(token) || isStaleStoreError(error)) return;
          // The session ended while this ran: the provider is about to go anonymous and drop the cart.
          if (error?.reason === "session-expired" || error?.reason === "needs-login") return;
          setQuote({ phase: "error", ...asked, quote: null, error });
        });
    }, QUOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      gate.invalidate();
    };
  }, [cart, identity, retries]);

  // Applies a change to the cart on screen, if it still belongs to the current owner, and remembers
  // it. A change that does nothing returns the same cart and is not re-quoted.
  const commit = useCallback((change) => {
    const current = recordRef.current;
    if (!current || current.owner !== ownerRef.current) return;
    const next = change(current.cart);
    if (next === current.cart) return;
    recordRef.current = { ...current, cart: next };
    writeStoredCart(browserStorage(), current.retailerId, next);
    setRecord(recordRef.current);
  }, []);

  // A confirmed order empties the cart it was placed for, and only that cart, only while it is still
  // what was ordered. On screen for the same session: the revision must be the one that was sent (a
  // change made while the order was in flight is later intent and stays). Otherwise (signed out or
  // another account since): the stored cart of the ordering retailer, if its lines are unchanged.
  const settleOrdered = useCallback(
    ({ owner, items }) => {
      const current = recordRef.current;
      if (current && current.owner === `${owner.generation}:${owner.retailerId}`) {
        commit((cart) => (cart.revision === owner.revision ? clearCart(cart) : cart));
        return;
      }
      const storage = browserStorage();
      if (!storedCartMatches(storage, owner.retailerId, items)) return;
      writeStoredCart(storage, owner.retailerId, emptyCart());
      if (current && String(current.retailerId) === String(owner.retailerId)) {
        commit((cart) => (sameCartLines(cart, items) ? clearCart(cart) : cart));
      }
    },
    [commit]
  );

  // A reorder is merged into the cart that is on screen when its reads finish, not the one there was when it
  // began, so a change made in between is kept. It counts only for the owner that asked: for anyone else
  // (signed out or another account since) nothing is touched and null comes back.
  const reorderInto = useCallback((lines, products, owner) => {
    const current = recordRef.current;
    if (!current || current.owner !== ownerRef.current || current.owner !== `${owner.generation}:${owner.retailerId}`) return null;
    const result = reconcileReorder(current.cart, lines, products);
    if (result.changed) {
      recordRef.current = { ...current, cart: result.cart };
      writeStoredCart(browserStorage(), current.retailerId, result.cart);
      setRecord(recordRef.current);
    }
    return result;
  }, []);

  const readiness = useMemo(() => cartReadiness({ cart: cart ?? emptyCart(), identity, record: quote }), [cart, identity, quote]);
  const knownLines = known.owner === ownerKey ? known.lines : NO_LINES;

  const cartApi = useMemo(() => {
    if (!cart) return null;
    return {
      lines: cart.lines,
      revision: cart.revision,
      unitCount: cartUnitCount(cart),
      quantityOf: (skuId) => cartQuantity(cart, skuId),
      setQuantity: (skuId, quantity, max) => commit((current) => updateCartQuantity(current, skuId, quantity, max)),
      removeLine: (skuId) => commit((current) => removeCartLine(current, skuId)),
      // The 409 STOCK_CHANGED review, once the retailer has agreed to it, and the empty cart a person
      // chooses after finding their order in My orders. Each is a new revision, so it is requoted.
      applyConflict: (items) => commit((current) => applyStockConflict(current, items)),
      clear: () => commit(clearCart),
      retryQuote: () => {
        setQuote(null);
        setRetries((count) => count + 1);
      },
      // Explicit, user-approved changes only: lower or drop the lines the quote says are short, or
      // drop products the server says are no longer sold. Each is a new revision, so it is re-quoted.
      acceptStock: () => commit((current) => acceptStockChanges(current, readiness.quote)),
      removeLines: (skuIds) => commit((current) => removeCartLines(current, skuIds)),
      readiness,
      problem: readiness.state === "error" ? describeQuoteError(quote?.error) : null,
      known: knownLines
    };
  }, [cart, commit, readiness, quote, knownLines]);

  return { cart: cartApi, identity, settleOrdered, reorderInto };
}

export function RetailerProvider({ children }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeRetailerSession, getRetailerSession, getServerSnapshot);
  // Stamped with the generation it was requested under, so the result for a previous account
  // is never shown after a logout or an account switch (see deriveRetailerState).
  const [meRecord, setMeRecord] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The sheet someone asked for, and the identity it was asked under. Shop and address sheets show
  // an account's data, so they only count for that identity (see activeSheet below).
  const [sheetState, setSheetState] = useState(null);
  const [promptDone, setPromptDone] = useState(null); // generation whose shop prompt was answered
  const [pendingIntent, setPendingIntent] = useState(null);
  const intentRef = useRef(null);
  // Set when the address sheet was opened from the cart: closing it returns to the cart (the order
  // is not resumed by itself, Place order is still pressed again).
  const returnToCartRef = useRef(false);

  const state = useMemo(() => deriveRetailerState(snapshot, meRecord), [snapshot, meRecord]);
  const generation = snapshot?.generation ?? null;

  // A token under the store keys that is not a retailer's is not a store session.
  useEffect(() => {
    if (state.invalidCredentials) clearRetailerTokens();
  }, [state.invalidCredentials]);

  // Server-owned onboarding: /store/me decides new/confirm/ready. Re-runs only when the identity
  // changes (or on refreshMe); a token rotation keeps the generation and does not refetch.
  const authed = state.status === "authed";
  useEffect(() => {
    if (!authed || generation === null) return undefined;
    let cancelled = false;
    storeFetch(storeEndpoints.me)
      .then((me) => {
        if (cancelled || getSessionGeneration() !== generation) return;
        setMeRecord({ generation, me });
      })
      .catch((error) => {
        if (cancelled || isStaleStoreError(error)) return;
        // 403: the credentials are not a retailer's. Anything else leaves the credentials alone
        // (an expiry has already been recorded by the transport) and shows a retryable error.
        if (error?.status === 403) {
          clearRetailerTokens();
          return;
        }
        if (getSessionGeneration() !== generation) return;
        setMeRecord({ generation, error });
      });
    return () => {
      cancelled = true;
    };
  }, [authed, generation, reloadKey]);

  const refreshMe = useCallback(() => {
    setMeRecord(null);
    setReloadKey((key) => key + 1);
  }, []);

  // A fresh /store/me without going back to "loading" (an address was added, edited or deleted),
  // so the open sheet stays on screen. Bound to the identity it started under: the answer for a
  // previous account is dropped. Rejects with the transport's error for the caller to word.
  const reloadMe = useCallback(async () => {
    const started = getSessionGeneration();
    try {
      const me = await storeFetch(storeEndpoints.me);
      if (getSessionGeneration() !== started) return null;
      setMeRecord({ generation: started, me });
      return me;
    } catch (error) {
      if (isStaleStoreError(error)) return null;
      throw error;
    }
  }, []);

  // The shop sheet's PUT already returns the new /store/me; take it as it is.
  const applyMe = useCallback((me, started) => {
    if (getSessionGeneration() !== started) return false;
    setMeRecord({ generation: started, me });
    return true;
  }, []);

  const openSheet = useCallback((name) => {
    // One active sheet: opening one replaces the other instead of stacking behind it.
    returnToCartRef.current = false;
    setSheetState(SHEETS.includes(name) ? { name, generation: getSessionGeneration() } : null);
  }, []);
  // Closing also answers the shop prompt for this identity, so a dismissed shop sheet is not
  // pushed back at the person until they reload or try something that needs a shop. An address
  // sheet that was opened from the cart hands back to the cart instead of leaving the person at the
  // page behind it.
  const closeSheet = useCallback(() => {
    const backToCart = returnToCartRef.current;
    returnToCartRef.current = false;
    setSheetState((current) => (backToCart && current?.name === "address" ? { name: "cart", generation: getSessionGeneration() } : null));
    setPromptDone(getSessionGeneration());
  }, []);

  const readiness = state.readiness;
  const needsShop = readiness === "new" || readiness === "confirm";

  // What is on screen. Login follows the visitor through the identity change it causes; the shop
  // and address sheets only count for the identity that opened them and only while that identity is
  // in the state they are for. A new or confirm retailer is shown the shop sheet once per identity
  // without asking (onboarding is the server's answer, so a reload resumes it).
  let activeSheet = null;
  if (sheetState && (sheetState.name === "login" || sheetState.generation === generation)) activeSheet = sheetState.name;
  if ((activeSheet === "address" || activeSheet === "cart") && readiness !== "ready") activeSheet = null;
  if (activeSheet === "shop" && readiness === "anonymous") activeSheet = null;
  if (activeSheet === null && needsShop && promptDone !== generation) activeSheet = "shop";

  // ---- Selected delivery address -------------------------------------------------------------
  // The server owns the addresses (state.me.addresses). The browser remembers one id, per
  // retailer, and it only counts while the server still lists it: membership in the list is the
  // check, so a deleted or foreign id is simply not a selection.
  const addresses = useMemo(() => state.me?.addresses ?? NO_ADDRESSES, [state.me]);
  const retailerId = state.retailerId;
  const storedId = useSyncExternalStore(
    subscribeSelection,
    useCallback(() => readSelectedAddressId(browserStorage(), retailerId), [retailerId]),
    () => null
  );
  const selectedAddress = useMemo(() => resolveSelectedAddress({ addresses, storedId }), [addresses, storedId]);

  // The cart seam Catalogue's controls read: { quantityOf, setQuantity, ... }, null until a ready
  // retailer's own cart has been restored.
  const { cart, identity: cartIdentity, settleOrdered, reorderInto } = useCartState({ ready: state.canPurchase, retailerId, generation });

  // ---- Placing the order -----------------------------------------------------------------------
  // One controller for the whole provider, so an order in flight survives the cart sheet closing and
  // is still the only one. It decides nothing about prices: the order carries SKU ids, packets and the
  // address id, and everything shown afterwards is what the server returned or what the order page
  // reads back.
  const [checkoutController] = useState(() =>
    createCheckoutController({ getGeneration: getSessionGeneration, getStorage: browserStorage, parseOrderList: normalizeOrderList })
  );
  const checkoutState = useSyncExternalStore(checkoutController.subscribe, checkoutController.getState, () => IDLE_CHECKOUT);
  useEffect(() => {
    checkoutController.sync(cartIdentity);
  }, [checkoutController, cartIdentity]);

  // list defaults to what is rendered; a caller that has just reloaded passes the fresh list, since
  // its own render has not happened yet. An id the server does not list is never selected.
  const selectAddress = useCallback(
    (id, list = addresses) => {
      if (!list.some((address) => String(address.id) === String(id))) return false;
      saveSelectedAddressId(browserStorage(), retailerId, id);
      notifySelection();
      return true;
    },
    [addresses, retailerId]
  );

  // Called once a delete has succeeded: the remembered id goes with the address.
  const forgetAddress = useCallback(
    (id) => {
      if (String(readSelectedAddressId(browserStorage(), retailerId)) !== String(id)) return;
      clearSelectedAddressId(browserStorage(), retailerId);
      notifySelection();
    },
    [retailerId]
  );

  // Gate for an action that needs a signed-in retailer with a confirmed shop. Returns true when
  // the caller may proceed. Otherwise it keeps the one validated intent (an internal route or a
  // SKU add) so 09-04's sheets can resume it after login/onboarding, and opens the right sheet.
  const requireRetailer = useCallback(
    (intent) => {
      if (state.canPurchase) return true;
      const valid = validateRetailerIntent(intent);
      intentRef.current = valid;
      setPendingIntent(valid);
      if (state.readiness === "anonymous") openSheet("login");
      else if (state.readiness === "new" || state.readiness === "confirm") openSheet("shop");
      return false;
    },
    [state.canPurchase, state.readiness, openSheet]
  );

  // The retained intent is handed out once.
  const takeIntent = useCallback(() => {
    const intent = intentRef.current;
    intentRef.current = null;
    setPendingIntent(null);
    return intent;
  }, []);

  // Header location and Account: a ready retailer picks an address; anyone else is taken to the
  // sheet that gets them there (login, or finishing the shop). Nothing is held to resume.
  // options.returnTo "cart": closing the address sheet goes back to the cart it was opened from.
  const openAddresses = useCallback(
    (options) => {
      if (state.readiness === "ready") {
        openSheet("address");
        returnToCartRef.current = options?.returnTo === "cart";
      } else if (state.readiness === "error") {
        refreshMe();
      } else if (state.readiness === "anonymous" || state.readiness === "new" || state.readiness === "confirm") {
        requireRetailer(null);
      }
    },
    [state.readiness, requireRetailer, refreshMe, openSheet]
  );

  // ---- Checkout actions ------------------------------------------------------------------------
  // What Place order reads at the moment it is pressed, not what the last render saw: the latest cart,
  // quote readiness, selected address and identity, kept in a ref that every render refreshes.
  const liveRef = useRef({ identity: null, cart: null, address: null });
  useEffect(() => {
    liveRef.current = { identity: cartIdentity, cart, address: selectedAddress };
  });

  const view = useMemo(() => checkoutView(checkoutState, cartIdentity, cart?.revision ?? null), [checkoutState, cartIdentity, cart]);
  const gate = useMemo(
    () =>
      checkoutGate({
        canPurchase: state.canPurchase,
        lineCount: cart?.lines.length ?? 0,
        readiness: cart?.readiness ?? null,
        address: selectedAddress,
        addresses,
        view
      }),
    [state.canPurchase, cart, selectedAddress, addresses, view]
  );

  const placeOrder = useCallback(() => {
    const live = liveRef.current;
    if (!live.identity || !live.cart || !live.cart.readiness.ready || !live.address) return Promise.resolve({ sent: false, reason: "not-ready" });
    const addressId = live.address.id;
    const owner = { generation: live.identity.generation, retailerId: live.identity.retailerId, revision: live.cart.revision };
    return checkoutController.submit({
      owner,
      items: live.cart.lines,
      addressId,
      // The list is asked for again after the lock is taken and before the send: an address deleted
      // elsewhere (or another tab) must not receive an order. null means the account changed meanwhile.
      confirmAddress: async () => {
        const fresh = await reloadMe();
        if (!fresh) return null;
        return (fresh.addresses ?? []).some((address) => String(address.id) === String(addressId));
      },
      isCurrent: () => {
        const now = liveRef.current;
        return (
          now.identity?.generation === owner.generation &&
          now.cart?.revision === owner.revision &&
          now.cart.readiness.ready &&
          String(now.address?.id) === String(addressId)
        );
      }
    });
  }, [checkoutController, reloadMe]);

  // A confirmed order: its cart is settled (cleared only if unchanged) for whoever placed it, and the
  // retailer who is still signed in is taken to the durable order page, which reads the order back.
  useEffect(() => {
    checkoutController.setOnConfirmed(({ order, owner, items }) => {
      settleOrdered({ owner, items });
      setReorderState((previous) => (previous?.owner === `${owner.generation}:${owner.retailerId}` ? null : previous));
      const live = liveRef.current;
      if (live.identity && live.identity.generation === owner.generation && String(live.identity.retailerId) === String(owner.retailerId)) {
        // The sheet's history entry is replaced by the order page, so Back returns to where the cart was opened.
        historyEntry.open = false;
        router.replace(`/orders/${order.id}?placed=1`);
        closeSheet();
      }
    });
  });

  // The retailer agreed to the stock review: lower or drop exactly the lines the server named, then ask
  // for a fresh quote. Nothing is sent; Place order is pressed again on purpose.
  const acceptReview = useCallback(() => {
    const review = checkoutController.getState();
    const live = liveRef.current;
    if (review.phase !== "stock-review" || !live.cart) return;
    live.cart.applyConflict(review.review);
    checkoutController.acceptReview();
    live.cart.retryQuote();
  }, [checkoutController]);

  // The person looked at My orders and found the order there: the cart they still hold is that order.
  const emptyCartAfterCheck = useCallback(() => {
    const live = liveRef.current;
    if (checkoutController.resolveUncertain()) live.cart?.clear();
  }, [checkoutController]);

  // ---- Reorder -----------------------------------------------------------------------------------------
  // Reads a past order's lines and today's products, merges them into the cart on screen and opens the cart
  // for review. It only ever reads: no order is sent from here, and the totals that follow are the server's
  // quote for the merged cart. What is told about it belongs to the identity that asked (reorderState.owner),
  // so a sign-out or an account switch while it runs leaves the next account with nothing of it.
  const [reorderState, setReorderState] = useState(null); // { owner, orderId, phase, view }
  const reorderRunning = useRef(null);
  const ownerKey = cartIdentity ? `${cartIdentity.generation}:${cartIdentity.retailerId}` : null;
  const reorderView = reorderState && reorderState.owner === ownerKey ? reorderState : null;

  const reorderOrder = useCallback(
    async ({ orderId, lines }) => {
      const live = liveRef.current;
      if (!live.identity || !live.cart) return { started: false, reason: "not-ready" };
      const owner = { generation: live.identity.generation, retailerId: live.identity.retailerId };
      const key = `${owner.generation}:${owner.retailerId}`;
      if (reorderRunning.current === key) return { started: false, reason: "busy" };
      reorderRunning.current = key;
      setReorderState({ owner: key, orderId, phase: "working", view: null });
      try {
        const outcome = await performReorder({
          owner,
          orderId,
          lines,
          getGeneration: getSessionGeneration,
          getOrder: (id) => storeFetch(storeEndpoints.order(id)).then(normalizeOrderDetail),
          getProduct: (id) => storeFetch(storeEndpoints.product(id)),
          apply: (past, products) => reorderInto(past, products, owner)
        });
        if (outcome.status === "stale") {
          setReorderState((previous) => (previous?.owner === key ? null : previous));
          return { started: true, status: "stale" };
        }
        if (outcome.status === "failed") {
          setReorderState({ owner: key, orderId, phase: "failed", view: outcome.view });
          return { started: true, status: "failed" };
        }
        const review = outcome.view.kind === "review";
        setReorderState({ owner: key, orderId, phase: review ? "review" : "none", view: outcome.view });
        // The cart is opened only when something was added; with nothing added the cart is as it was.
        if (review) openSheet("cart");
        return { started: true, status: review ? "review" : "none" };
      } finally {
        if (reorderRunning.current === key) reorderRunning.current = null;
      }
    },
    [reorderInto, openSheet]
  );

  const dismissReorder = useCallback(() => setReorderState(null), []);
  const reorder = useMemo(
    () => (cart ? { view: reorderView, run: reorderOrder, dismiss: dismissReorder } : null),
    [cart, reorderView, reorderOrder, dismissReorder]
  );

  const checkout = useMemo(
    () =>
      cart
        ? {
            view,
            gate,
            placeOrder,
            acceptReview,
            emptyCartAfterCheck,
            dismiss: checkoutController.dismiss,
            checkOrders: checkoutController.checkOrders,
            resolveUncertain: checkoutController.resolveUncertain
          }
        : null,
    [cart, view, gate, placeOrder, acceptReview, emptyCartAfterCheck, checkoutController]
  );

  // Clears the retailer session only; the staff session is a different storage key and is not
  // read or touched. No navigation: the visitor returns to browsing where they are.
  const logout = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    setSheetState(null);
    clearRetailerTokens();
    // The phone proof is only ever a bridge to the Ascend session; end it with the session.
    disposePhoneVerifier();
    signOutPhoneProof();
  }, []);

  // Dismissing the login or shop sheet (close, Escape, Back) discards the destination it was holding.
  const dismissLogin = useCallback(() => {
    intentRef.current = null;
    setPendingIntent(null);
    closeSheet();
  }, [closeSheet]);

  const value = useMemo(
    () => ({
      status: state.status,
      readiness: state.readiness,
      me: state.me,
      retailerId: state.retailerId,
      canPurchase: state.canPurchase,
      generation,
      activeSheet,
      pendingIntent,
      addresses,
      selectedAddress,
      cart,
      checkout,
      reorder,
      refreshMe,
      reloadMe,
      applyMe,
      selectAddress,
      forgetAddress,
      openAddresses,
      requireRetailer,
      takeIntent,
      openSheet,
      closeSheet,
      logout
    }),
    [
      state,
      generation,
      activeSheet,
      pendingIntent,
      addresses,
      selectedAddress,
      cart,
      checkout,
      reorder,
      refreshMe,
      reloadMe,
      applyMe,
      selectAddress,
      forgetAddress,
      openAddresses,
      requireRetailer,
      takeIntent,
      openSheet,
      closeSheet,
      logout
    ]
  );

  return (
    <RetailerContext.Provider value={value}>
      {/* display: contents keeps the wrapper out of layout; the attributes are a stable hook for
          tests and later slices to observe the session without reading storage. */}
      <div
        style={{ display: "contents" }}
        data-retailer-status={state.status}
        data-retailer-readiness={state.readiness}
        data-retailer-generation={generation ?? ""}
        data-retailer-intent={pendingIntent?.type ?? ""}
      >
        {children}
      </div>
      <SheetHost active={activeSheet} generation={generation} intent={pendingIntent} onDismissLogin={dismissLogin} onClose={closeSheet} />
    </RetailerContext.Provider>
  );
}

export function useRetailer() {
  return useContext(RetailerContext);
}

// Retailer-only destinations. An anonymous visitor who picks one gets the login sheet in place
// instead of a navigation, and a retailer whose shop is not confirmed gets the shop sheet; either
// is sent on once they are ready (never to the staff /login).
const RETAILER_ONLY = ["/orders", "/account"];
const isRetailerOnly = (href) => RETAILER_ONLY.some((base) => href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`));

/**
 * Returns href => onClick handler for a store link. A plain left click on a retailer-only
 * destination by an anonymous visitor opens login, and by a new or confirm retailer opens the shop
 * sheet, with that destination held; every other click
 * (modified, other buttons, public destinations, signed-in visitors) navigates as normal.
 */
export function useRetailerLinkGate() {
  const { readiness, requireRetailer } = useRetailer();
  return useCallback(
    (href) => (event) => {
      if (!["anonymous", "new", "confirm"].includes(readiness) || !isRetailerOnly(href)) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      requireRetailer({ type: "navigate", href });
    },
    [readiness, requireRetailer]
  );
}
