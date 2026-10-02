"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { getCoords } from "@/lib/geo";
import { INDIAN_STATES } from "@/lib/states";
import {
  ADDRESS_LIMITS,
  createPlaceSearch,
  emptyAddressDraft,
  loadMaps,
  normalizePlaceAddress,
  reverseGeocode,
  validateAddressDraft
} from "@/lib/store/maps.mjs";

// The editable, confirmable delivery address. Two equal ways in, searching Google Places and
// Detect my location, and then the same form: nothing is saved until the person reads the fields
// and presses the submit button (D-20). A detected point is never accepted silently, and the
// browser is asked for its position only when Detect my location is pressed (D-19).
//
// The shop sheet puts the shop's own fields around it (header, footer) and runs their validation
// through beforeSubmit, so one submit confirms the whole thing.

const DETECT_FAILED = "We couldn't detect your location. Search for your delivery address instead.";
const SEARCH_UNAVAILABLE = "Address search isn't available right now. Use your location, or type the address below.";
const READ_FAILED = "We found your location but couldn't read the address. Type it below.";

// Field order for moving focus to the first problem.
const FIELD_ORDER = ["line1", "state", "pincode", "label", "line2", "landmark", "city"];

export default function AddressForm({
  initialDraft,
  header = null,
  footer = null,
  beforeSubmit,
  onSubmit,
  fieldErrors,
  formError = "",
  busy = false,
  submitLabel = "Confirm delivery address",
  autoDetect = false,
  onCancel,
  cancelLabel = "Cancel"
}) {
  const uid = useId().replace(/:/g, "");
  const id = (name) => `store-addr-${uid}-${name}`;

  const [draft, setDraft] = useState(() => initialDraft || emptyAddressDraft());
  const [errors, setErrors] = useState({});
  const [maps, setMaps] = useState("loading"); // "loading" | "ready" | "unavailable"
  const [searchNotice, setSearchNotice] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectNotice, setDetectNotice] = useState("");
  const [picked, setPicked] = useState(""); // "search" | "detect" | "" : how the pin was last set

  const searchRef = useRef(null);
  const formRef = useRef(null);
  const mountedRef = useRef(true);
  const detectRef = useRef(0);
  const autoRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Server-side field errors (a 422) land beside the field they name, and the draft stays.
  useEffect(() => {
    if (fieldErrors && Object.keys(fieldErrors).length) setErrors((previous) => ({ ...previous, ...fieldErrors }));
  }, [fieldErrors]);

  // A chosen place or a detected point replaces what is derived from the place; the label, the
  // second line and the landmark are the person's own words and stay.
  const applyPicked = useCallback((next, source) => {
    setDraft((previous) => ({
      ...previous,
      line1: next.line1,
      city: next.city,
      state: next.state,
      pincode: next.pincode,
      latitude: next.latitude,
      longitude: next.longitude,
      stateNeedsCorrection: next.stateNeedsCorrection,
      source
    }));
    setErrors({});
    setPicked(source);
  }, []);

  // The Google search element. Created once Maps has loaded, removed with its listeners on unmount.
  useEffect(() => {
    let cancelled = false;
    let search = null;
    loadMaps()
      .then((api) =>
        createPlaceSearch({
          maps: api,
          container: searchRef.current,
          placeholder: "Search for your shop or area",
          isCancelled: () => cancelled || !searchRef.current,
          onSelect: (place) => {
            if (cancelled) return;
            setSearchNotice("");
            setDetectNotice("");
            applyPicked(normalizePlaceAddress(place, INDIAN_STATES, { source: "search" }), "search");
          },
          onError: () => {
            if (!cancelled) setSearchNotice(SEARCH_UNAVAILABLE);
          }
        })
      )
      .then((created) => {
        if (cancelled) created.destroy();
        else {
          search = created;
          setMaps("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaps("unavailable");
          setSearchNotice(SEARCH_UNAVAILABLE);
        }
      });
    return () => {
      cancelled = true;
      search?.destroy();
    };
  }, [applyPicked]);

  const detect = useCallback(async () => {
    const run = ++detectRef.current;
    setDetecting(true);
    setDetectNotice("");
    let coords;
    try {
      coords = await getCoords();
    } catch {
      // Denied, unavailable or timed out: the search stays, and nothing asks again by itself.
      if (mountedRef.current && run === detectRef.current) {
        setDetectNotice(DETECT_FAILED);
        setDetecting(false);
      }
      return;
    }
    if (!mountedRef.current || run !== detectRef.current) return;
    try {
      const api = await loadMaps();
      const result = await reverseGeocode({ maps: api, coords });
      if (!mountedRef.current || run !== detectRef.current) return;
      if (result) {
        applyPicked(normalizePlaceAddress(result, INDIAN_STATES, { source: "detect", location: coords }), "detect");
      } else {
        setDraft((previous) => ({ ...previous, latitude: coords.latitude, longitude: coords.longitude, source: "detect" }));
        setPicked("detect");
        setDetectNotice(READ_FAILED);
      }
    } catch {
      if (!mountedRef.current || run !== detectRef.current) return;
      // The fix is real even when the address lookup is not: keep the point, ask for the address.
      setDraft((previous) => ({ ...previous, latitude: coords.latitude, longitude: coords.longitude, source: "detect" }));
      setPicked("detect");
      setDetectNotice(READ_FAILED);
    } finally {
      if (mountedRef.current && run === detectRef.current) setDetecting(false);
    }
  }, [applyPicked]);

  // The address picker's own Detect my location button opens this form already pressed.
  useEffect(() => {
    if (!autoDetect || autoRef.current) return;
    autoRef.current = true;
    detect();
  }, [autoDetect, detect]);

  function update(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const { [field]: _removed, ...rest } = previous;
      return rest;
    });
  }

  function onFormSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const shopOk = beforeSubmit ? beforeSubmit() : true;
    const result = validateAddressDraft(draft, INDIAN_STATES);
    setErrors(result.errors);
    if (!shopOk || !result.valid) {
      // The shop's own fields sit above these; beforeSubmit has already put focus on its problem.
      if (!shopOk) return;
      const first = FIELD_ORDER.find((name) => result.errors[name]);
      if (first) formRef.current?.querySelector(`#${id(first)}`)?.focus();
      else if (result.errors.location) formRef.current?.querySelector(`#${id("detect")}`)?.focus();
      return;
    }
    onSubmit(result.value);
  }

  const hasLocation = typeof draft.latitude === "number" && typeof draft.longitude === "number";
  const problemCount = Object.keys(errors).length;
  const describe = (name, hint) => [hint, errors[name] ? id(`${name}-error`) : null].filter(Boolean).join(" ") || undefined;
  const fieldError = (name) =>
    errors[name] ? (
      <p id={id(`${name}-error`)} className="store-form-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form ref={formRef} className="store-address-form" onSubmit={onFormSubmit} noValidate>
      {header}

      <fieldset className="store-address-form__find">
        <legend className="store-label">Where should we deliver?</legend>
        <p id={id("search-label")} className="store-hint store-hint--tight">
          Search for your shop or area
        </p>
        {/* Only the Google element lives in this div; React renders nothing inside it. */}
        <div ref={searchRef} className="store-place-search" role="group" aria-labelledby={id("search-label")} data-maps={maps} />
        {maps === "loading" ? <p className="store-hint store-hint--tight">Loading address search</p> : null}
        {searchNotice ? (
          <p className="store-hint" role="status">
            {searchNotice}
          </p>
        ) : null}

        <p className="store-address-form__or" aria-hidden="true">
          or
        </p>
        <button
          type="button"
          id={id("detect")}
          className="store-button store-button--secondary"
          onClick={detect}
          disabled={detecting}
          data-autofocus=""
        >
          <Crosshair size={18} strokeWidth={1.75} aria-hidden="true" />
          {detecting ? "Detecting your location" : "Detect my location"}
        </button>
        {detectNotice ? (
          <p className="store-form-error" role="alert">
            {detectNotice}
          </p>
        ) : null}

        <p
          className="store-address-form__pin"
          role="status"
          aria-live="polite"
          data-pinned={hasLocation ? "true" : "false"}
        >
          {hasLocation
            ? picked === "detect"
              ? "Pinned from your location. Check the details below, then confirm."
              : picked === "search"
                ? "Pinned from your search. Check the details below, then confirm."
                : "Location pinned. Search or detect again to move it."
            : "No location pinned yet."}
        </p>
        {fieldError("location")}
      </fieldset>

      <label className="store-label" htmlFor={id("line1")}>
        Address
      </label>
      <input
        id={id("line1")}
        className="store-input"
        type="text"
        autoComplete="street-address"
        maxLength={ADDRESS_LIMITS.line1 + 1}
        value={draft.line1}
        onChange={(event) => update("line1", event.target.value)}
        aria-invalid={errors.line1 ? "true" : undefined}
        aria-describedby={describe("line1")}
        aria-required="true"
        placeholder="Shop number, building, street"
      />
      {fieldError("line1")}

      <label className="store-label" htmlFor={id("state")}>
        State
      </label>
      <select
        id={id("state")}
        className="store-input"
        value={draft.state}
        onChange={(event) => update("state", event.target.value)}
        aria-invalid={errors.state ? "true" : undefined}
        aria-describedby={describe("state", draft.stateNeedsCorrection && !draft.state && picked ? id("state-hint") : null)}
        aria-required="true"
      >
        <option value="">Select state</option>
        {INDIAN_STATES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {draft.stateNeedsCorrection && !draft.state && picked ? (
        <p id={id("state-hint")} className="store-hint">
          We couldn&apos;t match the state from the search. Choose yours.
        </p>
      ) : null}
      {fieldError("state")}

      <p className="store-address-form__optional">Optional details</p>

      <label className="store-label" htmlFor={id("line2")}>
        Address line 2
      </label>
      <input
        id={id("line2")}
        className="store-input"
        type="text"
        maxLength={ADDRESS_LIMITS.line2 + 1}
        value={draft.line2}
        onChange={(event) => update("line2", event.target.value)}
        aria-invalid={errors.line2 ? "true" : undefined}
        aria-describedby={describe("line2")}
      />
      {fieldError("line2")}

      <label className="store-label" htmlFor={id("landmark")}>
        Landmark
      </label>
      <input
        id={id("landmark")}
        className="store-input"
        type="text"
        maxLength={ADDRESS_LIMITS.landmark + 1}
        value={draft.landmark}
        onChange={(event) => update("landmark", event.target.value)}
        aria-invalid={errors.landmark ? "true" : undefined}
        aria-describedby={describe("landmark")}
      />
      {fieldError("landmark")}

      <div className="store-address-form__pair">
        <div>
          <label className="store-label" htmlFor={id("city")}>
            City
          </label>
          <input
            id={id("city")}
            className="store-input"
            type="text"
            autoComplete="address-level2"
            maxLength={ADDRESS_LIMITS.city + 1}
            value={draft.city}
            onChange={(event) => update("city", event.target.value)}
            aria-invalid={errors.city ? "true" : undefined}
            aria-describedby={describe("city")}
          />
          {fieldError("city")}
        </div>
        <div>
          <label className="store-label" htmlFor={id("pincode")}>
            Pincode
          </label>
          <input
            id={id("pincode")}
            className="store-input"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={7}
            value={draft.pincode}
            onChange={(event) => update("pincode", event.target.value)}
            aria-invalid={errors.pincode ? "true" : undefined}
            aria-describedby={describe("pincode")}
          />
          {fieldError("pincode")}
        </div>
      </div>

      <label className="store-label" htmlFor={id("label")}>
        Save as
      </label>
      <input
        id={id("label")}
        className="store-input"
        type="text"
        maxLength={ADDRESS_LIMITS.label + 1}
        value={draft.label}
        onChange={(event) => update("label", event.target.value)}
        aria-invalid={errors.label ? "true" : undefined}
        aria-describedby={describe("label", id("label-hint"))}
        placeholder="Shop, Godown, Home"
      />
      <p id={id("label-hint")} className="store-hint store-hint--tight">
        A short name to tell your addresses apart.
      </p>
      {fieldError("label")}

      {footer}

      {problemCount > 0 ? (
        <p className="store-form-error" role="alert">
          Check the details marked above and try again.
        </p>
      ) : null}
      {formError ? (
        <p className="store-form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <button type="submit" className="store-button store-sheet__submit" disabled={busy}>
        {busy ? "Saving" : submitLabel}
      </button>
      {onCancel ? (
        <button type="button" className="store-link-button store-sheet__cancel" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      ) : null}
    </form>
  );
}
