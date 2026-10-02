"use client";

import { useState } from "react";
import { Crosshair, Plus } from "lucide-react";
import AddressForm from "@/components/store/AddressForm";
import SheetFrame from "@/components/store/SheetFrame";
import { useRetailer } from "@/components/store/RetailerProvider";
import { INDIAN_STATES } from "@/lib/states";
import { isStaleStoreError, storeEndpoints, storeFetch } from "@/lib/store/api.mjs";
import {
  describeAddressError,
  diffAddressPatch,
  draftFromAddress,
  fieldErrorsFromResponse,
  formatAddressLines,
  headerAddressLabel
} from "@/lib/store/maps.mjs";

// The saved delivery addresses (D-20, D-22): choose one, add one (search or Detect my location),
// edit one, delete one after naming it. The server owns the list; after every change the sheet
// asks /store/me again and shows what it returns. Only the id of the chosen address is remembered
// in the browser, and only while the server still lists it.
//
// Ship to is this list. The registered shop (Bill to) is a different thing and is not editable
// here: the ready branch of PUT /store/me/shop ignores an address.

const nameOf = (address) => headerAddressLabel(address);

export default function AddressSheet({ onClose }) {
  const { addresses, selectedAddress, selectAddress, reloadMe, refreshMe } = useRetailer();
  const [view, setView] = useState({ name: "list" }); // list | form {address?, autoDetect} | delete {address}
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  const toList = (message = "") => {
    setView({ name: "list" });
    setFormError("");
    setFieldErrors({});
    setNotice(message);
  };

  // The list shown is always the server's. The change itself has already succeeded by now, so a
  // failed refresh is not reported as a failed save (a retry would add the address twice): the
  // provider reloads in the visible way instead and the list catches up.
  async function refreshAfterChange() {
    try {
      return await reloadMe();
    } catch {
      refreshMe();
      return null;
    }
  }

  async function saveAddress(value) {
    const editing = view.address;
    setBusy(true);
    setFormError("");
    setFieldErrors({});
    try {
      if (editing) {
        const patch = diffAddressPatch(editing, value);
        if (patch) await storeFetch(storeEndpoints.address(editing.id), { method: "PATCH", body: JSON.stringify(patch) });
        await refreshAfterChange();
        toList(patch ? "Address updated." : "");
      } else {
        const created = await storeFetch(storeEndpoints.addresses, { method: "POST", body: JSON.stringify(value) });
        const me = await refreshAfterChange();
        // A new address becomes the delivery address, as in any shopping app.
        if (created?.id != null && me?.addresses) selectAddress(created.id, me.addresses);
        onClose();
      }
    } catch (error) {
      if (isStaleStoreError(error)) return;
      setFieldErrors(fieldErrorsFromResponse(error));
      setFormError(describeAddressError(error, "save").message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(address) {
    setBusy(true);
    setFormError("");
    try {
      // 204: the transport resolves null without reading a body.
      await storeFetch(storeEndpoints.address(address.id), { method: "DELETE" });
      await refreshAfterChange();
      // If it was the delivery address the provider forgets it now (it is no longer listed); with
      // several left the person chooses again, with one left that one is it.
      toList("Address deleted.");
    } catch (error) {
      if (isStaleStoreError(error)) return;
      // A refused last-address delete (409) leaves the list exactly as it was and says why.
      setFormError(describeAddressError(error, "delete").message);
    } finally {
      setBusy(false);
    }
  }

  function choose(address) {
    if (selectAddress(address.id)) onClose();
  }

  const title = view.name === "form" ? "Confirm delivery address" : view.name === "delete" ? "Delete address" : "Delivery address";

  return (
    <SheetFrame title={title} titleId="store-address-title" closeLabel="Close delivery addresses" onDismiss={onClose}>
      {view.name === "form" ? (
        <AddressForm
          // A different address (or add versus edit) is a different form, never a leftover draft.
          key={view.address ? `edit-${view.address.id}` : `add-${view.autoDetect ? "detect" : "search"}`}
          initialDraft={view.address ? draftFromAddress(view.address, INDIAN_STATES) : undefined}
          onSubmit={saveAddress}
          fieldErrors={fieldErrors}
          formError={formError}
          busy={busy}
          autoDetect={Boolean(view.autoDetect)}
          submitLabel={view.address ? "Save address" : "Confirm delivery address"}
          onCancel={() => toList()}
          cancelLabel="Back to my addresses"
        />
      ) : view.name === "delete" ? (
        <div>
          <p className="store-address-delete__name">{nameOf(view.address)}</p>
          <div className="store-address-row__text">
            {formatAddressLines(view.address).map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          <p className="store-hint">Delete this address? You can add it again later.</p>
          {formError ? (
            <p className="store-form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            className="store-button store-button--danger store-sheet__submit"
            onClick={() => deleteAddress(view.address)}
            disabled={busy}
          >
            {busy ? "Deleting" : "Delete address"}
          </button>
          <button type="button" className="store-link-button store-sheet__cancel" onClick={() => toList()} disabled={busy}>
            Keep address
          </button>
        </div>
      ) : (
        <div>
          <div className="store-address-actions">
            <button type="button" className="store-button" onClick={() => setView({ name: "form" })} data-autofocus="">
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
              Add address
            </button>
            <button type="button" className="store-button store-button--secondary" onClick={() => setView({ name: "form", autoDetect: true })}>
              <Crosshair size={18} strokeWidth={1.75} aria-hidden="true" />
              Detect my location
            </button>
          </div>

          {addresses.length === 0 ? (
            <p className="store-hint">Add a delivery address to place your order.</p>
          ) : (
            <ul className="store-address-list" aria-label="Saved delivery addresses">
              {addresses.map((address) => {
                const selected = selectedAddress && String(selectedAddress.id) === String(address.id);
                return (
                  <li key={address.id} className="store-address-row" data-selected={selected ? "true" : "false"} data-address-id={address.id}>
                    <button
                      type="button"
                      className="store-address-row__main"
                      onClick={() => choose(address)}
                      aria-current={selected ? "true" : undefined}
                    >
                      <span className="store-address-row__name">
                        {nameOf(address)}
                        {selected ? <span className="store-address-row__badge">Selected</span> : null}
                      </span>
                      <span className="store-address-row__text">
                        {formatAddressLines(address).map((line, index) => (
                          <span key={index}>{line}</span>
                        ))}
                      </span>
                    </button>
                    <div className="store-address-row__actions">
                      <button
                        type="button"
                        className="store-link-button"
                        onClick={() => setView({ name: "form", address })}
                        aria-label={`Edit address ${nameOf(address)}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="store-link-button"
                        onClick={() => {
                          setFormError("");
                          setView({ name: "delete", address });
                        }}
                        aria-label={`Delete address ${nameOf(address)}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {addresses.length > 1 && !selectedAddress ? <p className="store-hint">Choose where to deliver.</p> : null}
          <p className="store-sheet__live" role="status" aria-live="polite">
            {notice}
          </p>
        </div>
      )}
    </SheetFrame>
  );
}
