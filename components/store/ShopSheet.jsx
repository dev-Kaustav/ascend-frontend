"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddressForm from "@/components/store/AddressForm";
import SheetFrame from "@/components/store/SheetFrame";
import { useRetailer } from "@/components/store/RetailerProvider";
import { INDIAN_STATES } from "@/lib/states";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  buildShopPayload,
  describeAddressError,
  fieldErrorsFromResponse,
  shopSheetPlan,
  validateShopDraft
} from "@/lib/store/maps.mjs";
import { decideResume, getSessionGeneration } from "@/lib/store/session.mjs";
import { historyEntry } from "@/lib/store/sheet-history";

// New and confirm retailers review their shop and delivery location here (D-21). The answer to
// "does this person still owe a shop?" is the server's (/store/me), so a reload shows this again
// until the PUT succeeds, and a ready retailer never sees it. Nothing is saved until the person
// presses the button, and the PUT's own answer (the new /store/me) is what makes them ready.

const ADDRESS_FIELDS = ["line1", "state", "pincode", "location", "label", "line2", "landmark", "city"];

function ShopForm({ plan, onDismiss }) {
  const { applyMe } = useRetailer();
  const [shopName, setShopName] = useState(plan.shopName);
  const [gstNumber, setGstNumber] = useState(plan.gstNumber);
  const [shopErrors, setShopErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const shopRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Runs just before the address is validated, so one press shows every problem at once.
  function beforeSubmit() {
    const result = validateShopDraft({ shopName, gstNumber });
    setShopErrors(result.errors);
    setFieldErrors({});
    setFormError("");
    shopRef.current = result.value;
    if (!result.valid) {
      const first = result.errors.shop_name ? "store-shop-name" : "store-shop-gst";
      document.getElementById(first)?.focus();
    }
    return result.valid;
  }

  async function save(address) {
    const started = getSessionGeneration();
    setBusy(true);
    try {
      const me = await storeFetch(storeEndpoints.shop, {
        method: "PUT",
        body: JSON.stringify(buildShopPayload(shopRef.current, address))
      });
      // The provider turns this into readiness "ready"; the sheet then resumes and closes.
      applyMe(me, started);
    } catch (error) {
      if (isStaleStoreError(error) || !mountedRef.current) return;
      const fields = fieldErrorsFromResponse(error);
      setShopErrors((previous) => ({ ...previous, ...(fields.shop_name ? { shop_name: fields.shop_name } : {}), ...(fields.gst_number ? { gst_number: fields.gst_number } : {}) }));
      setFieldErrors(Object.fromEntries(Object.entries(fields).filter(([name]) => ADDRESS_FIELDS.includes(name))));
      setFormError(describeAddressError(error, "save").message);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  const header = (
    <div className="store-shop-field">
      <label className="store-label" htmlFor="store-shop-name">
        Shop name
      </label>
      <input
        id="store-shop-name"
        className="store-input"
        type="text"
        autoComplete="organization"
        maxLength={121}
        value={shopName}
        onChange={(event) => {
          setShopName(event.target.value);
          setShopErrors((previous) => ({ ...previous, shop_name: undefined }));
        }}
        aria-invalid={shopErrors.shop_name ? "true" : undefined}
        aria-describedby={shopErrors.shop_name ? "store-shop-name-error" : undefined}
        aria-required="true"
        data-autofocus=""
      />
      {shopErrors.shop_name ? (
        <p id="store-shop-name-error" className="store-form-error">
          {shopErrors.shop_name}
        </p>
      ) : null}
    </div>
  );

  const footer = (
    <div className="store-shop-field">
      <label className="store-label" htmlFor="store-shop-gst">
        GST number (optional)
      </label>
      <input
        id="store-shop-gst"
        className="store-input"
        type="text"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={16}
        value={gstNumber}
        onChange={(event) => {
          setGstNumber(event.target.value);
          setShopErrors((previous) => ({ ...previous, gst_number: undefined }));
        }}
        aria-invalid={shopErrors.gst_number ? "true" : undefined}
        aria-describedby={["store-shop-gst-hint", shopErrors.gst_number ? "store-shop-gst-error" : null].filter(Boolean).join(" ")}
      />
      <p id="store-shop-gst-hint" className="store-hint store-hint--tight">
        Add it if you have one. You can order without it.
      </p>
      {shopErrors.gst_number ? (
        <p id="store-shop-gst-error" className="store-form-error">
          {shopErrors.gst_number}
        </p>
      ) : null}
    </div>
  );

  return (
    <AddressForm
      initialDraft={plan.draft}
      header={header}
      footer={footer}
      beforeSubmit={beforeSubmit}
      onSubmit={save}
      fieldErrors={fieldErrors}
      formError={formError}
      busy={busy}
      submitLabel={plan.mode === "confirm" ? "Confirm shop" : "Save shop"}
      onCancel={onDismiss}
      cancelLabel="Not now"
    />
  );
}

export default function ShopSheet({ intent, onClose }) {
  const router = useRouter();
  const { readiness, me, takeIntent, closeSheet, refreshMe } = useRetailer();
  const plan = useMemo(() => shopSheetPlan(readiness, me, INDIAN_STATES), [readiness, me]);
  const resumedRef = useRef(false);

  // Ready (this sheet's PUT, or the shop confirmed in another tab): the held destination is
  // resumed exactly once and the sheet goes. A held product add stays held for the cart.
  useEffect(() => {
    if (readiness !== "ready" || resumedRef.current) return;
    resumedRef.current = true;
    const decision = decideResume(intent, readiness);
    if (decision.action === "navigate") {
      takeIntent();
      // The sheet's history entry is replaced by the destination, as the login sheet does.
      historyEntry.open = false;
      router.replace(decision.href);
    }
    closeSheet();
  }, [readiness, intent, takeIntent, closeSheet, router]);

  const title = plan.mode === "confirm" ? "Confirm your shop" : "What's your shop called?";

  return (
    <SheetFrame title={plan.show ? title : "Your shop"} titleId="store-shop-title" closeLabel="Close shop details" onDismiss={onClose}>
      {plan.show ? (
        // Remounted if the answer changes kind, so a prefill never lands in a half-typed form.
        <ShopForm key={plan.mode} plan={plan} onDismiss={onClose} />
      ) : readiness === "error" ? (
        <div className="store-form-error" role="alert">
          <p>We couldn&apos;t load your shop details.</p>
          <button type="button" className="store-link-button" onClick={refreshMe}>
            Try again
          </button>
        </div>
      ) : (
        <p className="store-hint" role="status">
          Loading your shop details
        </p>
      )}
    </SheetFrame>
  );
}
