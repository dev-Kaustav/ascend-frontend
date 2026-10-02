// Shop and delivery-address decisions for the storefront, and the Google Maps adapter.
//
// Pure functions take what they need as arguments (the canonical state list, the storage, the Maps
// namespace), so this module imports nothing from the app and runs under plain Node for tests.
//
// What is stored where (D-20, D-22): the server owns every address. The browser keeps one thing,
// the id of the address chosen for delivery, under a key that names the retailer.
//
// Google is reached only through the official JS loader and the Places (New) element and JS
// Geocoder. The REST geocoding endpoint is never called from the browser, and the key is a public,
// referrer-restricted browser key: it is read here from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and is
// never logged or put in an error.

export const ADDRESS_LIMITS = { label: 40, line1: 200, line2: 200, landmark: 120, city: 80 };
const MAX_SHOP_NAME = 120;
const GSTIN = /^[A-Z0-9]{15}$/;
const PINCODE = /^[0-9]{6}$/;

// ---- State mapping ---------------------------------------------------------------------------

const comparable = (value) =>
  String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Google's and older spellings, mapped to the backend's name. An alias only counts when its target
// is in the list the caller supplied: the list is the authority.
const STATE_ALIASES = {
  "national capital territory of delhi": "Delhi",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  pondicherry: "Puducherry",
  telengana: "Telangana",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu"
};

/** The canonical state for what Google (or an old record) calls it, or null: never a guess. */
export function canonicalState(raw, states) {
  if (typeof raw !== "string" || !Array.isArray(states)) return null;
  const key = comparable(raw);
  if (!key) return null;
  const direct = states.find((state) => comparable(state) === key);
  if (direct) return direct;
  const alias = STATE_ALIASES[key];
  return alias && states.includes(alias) ? alias : null;
}

// ---- Place to draft --------------------------------------------------------------------------

export function emptyAddressDraft() {
  return {
    label: "",
    line1: "",
    line2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    latitude: null,
    longitude: null,
    source: "manual",
    stateNeedsCorrection: false
  };
}

// A location arrives as a google.maps.LatLng (lat() and lng()), a literal, or the shape the
// browser geolocation helper returns. Anything else is no location.
function readPoint(location) {
  if (!location || typeof location !== "object") return null;
  const pick = (named, fn) => {
    const value = typeof location[fn] === "function" ? location[fn]() : location[named];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const latitude = location.latitude !== undefined ? pick("latitude", "latitude") : pick("lat", "lat");
  const longitude = location.longitude !== undefined ? pick("longitude", "longitude") : pick("lng", "lng");
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

const componentText = (c) => c?.longText ?? c?.long_name ?? c?.name ?? "";
const componentTypes = (c) => (Array.isArray(c?.types) ? c.types : []);

// What goes in line 1: the building, street and area. The city, state and pincode have their own
// fields, so they are left out rather than typed twice.
const LINE1_TYPES = [
  "premise",
  "subpremise",
  "street_number",
  "route",
  "sublocality_level_3",
  "sublocality_level_2",
  "sublocality_level_1",
  "neighborhood"
];

const bound = (text, max) => (text.length > max ? text.slice(0, max).trimEnd() : text);

/**
 * Turns a Places (New) place, or a Geocoder result, into an editable draft. It never saves and
 * never decides: a state that cannot be mapped is left blank with stateNeedsCorrection set.
 * options.location overrides the place's own point (a detected position is the browser's fix, not
 * the point the geocoder snapped it to); options.source is "search" or "detect".
 */
export function normalizePlaceAddress(place, states, options = {}) {
  const components = Array.isArray(place?.addressComponents)
    ? place.addressComponents
    : Array.isArray(place?.address_components)
      ? place.address_components
      : [];
  const ofType = (type) => componentText(components.find((c) => componentTypes(c).includes(type)));

  const parts = [];
  for (const type of LINE1_TYPES) {
    const text = ofType(type).trim();
    if (text && !parts.includes(text)) parts.push(text);
  }
  const formatted = String(place?.formattedAddress ?? place?.formatted_address ?? "")
    .replace(/,\s*India\s*$/i, "")
    .trim();
  const line1 = bound(parts.length ? parts.join(", ") : formatted, ADDRESS_LIMITS.line1);

  const city = bound(
    (ofType("locality") || ofType("postal_town") || ofType("administrative_area_level_2")).trim(),
    ADDRESS_LIMITS.city
  );
  const state = canonicalState(ofType("administrative_area_level_1"), states);
  const pincode = ofType("postal_code").replace(/\s/g, "");
  const point = readPoint(options.location) ?? readPoint(place?.location) ?? readPoint(place?.geometry?.location);

  return {
    ...emptyAddressDraft(),
    line1,
    city,
    state: state ?? "",
    stateNeedsCorrection: state === null,
    pincode: PINCODE.test(pincode) ? pincode : "",
    latitude: point ? point.latitude : null,
    longitude: point ? point.longitude : null,
    source: options.source ?? "search"
  };
}

/** A saved address, as the editable draft the form opens with. */
export function draftFromAddress(address, states) {
  const state = canonicalState(address?.state, states);
  return {
    ...emptyAddressDraft(),
    label: address?.label ?? "",
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    landmark: address?.landmark ?? "",
    city: address?.city ?? "",
    state: state ?? "",
    stateNeedsCorrection: state === null,
    pincode: address?.pincode == null ? "" : String(address.pincode),
    latitude: typeof address?.latitude === "number" ? address.latitude : null,
    longitude: typeof address?.longitude === "number" ? address.longitude : null,
    source: "saved"
  };
}

// ---- Validation ------------------------------------------------------------------------------

const text = (value) => (typeof value === "string" ? value.trim() : "");
const orNull = (value) => (value === "" ? null : value);

/**
 * Line 1, state and coordinates are required; everything else is optional and never blocks.
 * Returns { valid, errors, value } where value is the payload the backend takes (null if invalid).
 */
export function validateAddressDraft(draft, states) {
  const errors = {};
  const value = {
    label: text(draft?.label),
    line1: text(draft?.line1),
    line2: text(draft?.line2),
    landmark: text(draft?.landmark),
    city: text(draft?.city),
    state: text(draft?.state),
    pincode: text(draft?.pincode).replace(/\s/g, ""),
    latitude: draft?.latitude,
    longitude: draft?.longitude
  };

  if (!value.line1) errors.line1 = "Enter the building, street or area.";
  if (!value.state) errors.state = "Choose your state.";
  else if (!Array.isArray(states) || !states.includes(value.state)) errors.state = "Choose your state from the list.";

  const inRange = (n, limit) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
  if (!inRange(value.latitude, 90) || !inRange(value.longitude, 180)) {
    errors.location = "Search for your address or use your location so we can pin it.";
  }

  for (const field of ["label", "line1", "line2", "landmark", "city"]) {
    if (value[field].length > ADDRESS_LIMITS[field] && !errors[field]) {
      errors[field] = `Keep this under ${ADDRESS_LIMITS[field] + 1} characters.`;
    }
  }
  if (value.pincode && !PINCODE.test(value.pincode)) errors.pincode = "A pincode is 6 digits.";

  if (Object.keys(errors).length) return { valid: false, errors, value: null };
  return {
    valid: true,
    errors: {},
    value: {
      label: orNull(value.label),
      line1: value.line1,
      line2: orNull(value.line2),
      landmark: orNull(value.landmark),
      city: orNull(value.city),
      state: value.state,
      pincode: orNull(value.pincode),
      latitude: value.latitude,
      longitude: value.longitude
    }
  };
}

const PATCH_FIELDS = ["label", "line1", "line2", "landmark", "city", "state", "pincode", "latitude", "longitude"];

/**
 * The PATCH body for an edit: only the keys that changed. A cleared optional field is an explicit
 * null; line 1, state and the coordinates are never null here because the value was validated.
 * Returns null when nothing changed. `value` is a validated payload.
 */
export function diffAddressPatch(address, value) {
  const patch = {};
  for (const field of PATCH_FIELDS) {
    const before = address?.[field] ?? null;
    const same = field === "pincode" ? String(before ?? "") === String(value[field] ?? "") : before === value[field];
    if (!same) patch[field] = value[field];
  }
  return Object.keys(patch).length ? patch : null;
}

/** Shop name required; GSTIN optional and only normalised when given. */
export function validateShopDraft({ shopName, gstNumber }) {
  const errors = {};
  const name = text(shopName);
  const gst = text(gstNumber).toUpperCase();
  if (!name) errors.shop_name = "Enter your shop's name.";
  else if (name.length > MAX_SHOP_NAME) errors.shop_name = `Keep the name under ${MAX_SHOP_NAME + 1} characters.`;
  if (gst && !GSTIN.test(gst)) errors.gst_number = "A GST number is 15 letters or digits.";
  if (Object.keys(errors).length) return { valid: false, errors, value: null };
  return { valid: true, errors: {}, value: { shop_name: name, gst_number: gst || null } };
}

/** The body of PUT /store/me/shop. There is no submission without a reviewed address (D-26). */
export function buildShopPayload(shop, address) {
  if (!address) throw new Error("A shop needs a reviewed delivery address.");
  return { shop_name: shop.shop_name, gst_number: shop.gst_number, address };
}

/**
 * Whether the shop sheet applies, and what it opens with. Onboarding is the server's answer (/store/me),
 * never a local guess: only new and confirm retailers see it; a ready one skips it on every login.
 */
export function shopSheetPlan(readiness, me, states) {
  if (readiness !== "new" && readiness !== "confirm") return { show: false };
  const prefill = readiness === "confirm" ? me?.prefill : null;
  if (!prefill) {
    return { show: true, mode: readiness, shopName: "", gstNumber: "", draft: emptyAddressDraft() };
  }
  const state = canonicalState(prefill.state, states);
  return {
    show: true,
    mode: readiness,
    shopName: prefill.shop_name ?? "",
    gstNumber: prefill.gst_number ?? "",
    draft: {
      ...emptyAddressDraft(),
      line1: prefill.address_line1 ?? "",
      line2: prefill.address_line2 ?? "",
      city: prefill.city ?? "",
      state: state ?? "",
      stateNeedsCorrection: state === null,
      pincode: prefill.pincode == null ? "" : String(prefill.pincode),
      latitude: typeof prefill.latitude === "number" ? prefill.latitude : null,
      longitude: typeof prefill.longitude === "number" ? prefill.longitude : null,
      source: "saved"
    }
  };
}

// ---- Selected delivery address ---------------------------------------------------------------

export const addressStorageKey = (retailerId) => `ascend_store_address:${retailerId}`;

export function readSelectedAddressId(storage, retailerId) {
  if (retailerId == null || !storage) return null;
  try {
    const value = storage.getItem(addressStorageKey(retailerId));
    return value === null || value === "" ? null : value;
  } catch {
    return null;
  }
}

export function saveSelectedAddressId(storage, retailerId, id) {
  if (retailerId == null || id == null || !storage) return;
  try {
    storage.setItem(addressStorageKey(retailerId), String(id));
  } catch {
    // Storage that refuses writes only means the choice is not remembered.
  }
}

export function clearSelectedAddressId(storage, retailerId) {
  if (retailerId == null || !storage) return;
  try {
    storage.removeItem(addressStorageKey(retailerId));
  } catch {
    // Same as above.
  }
}

/**
 * The address deliveries go to: the stored choice if the server still lists it, otherwise the only
 * saved address, otherwise none (the person must choose). Membership in the list the server
 * returned now is the only thing that makes an id usable, so a deleted or foreign id resolves to
 * nothing and can never reach an order.
 */
export function resolveSelectedAddress({ addresses, storedId }) {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  if (storedId != null) {
    const match = addresses.find((address) => String(address.id) === String(storedId));
    if (match) return match;
  }
  return addresses.length === 1 ? addresses[0] : null;
}

// ---- Display ---------------------------------------------------------------------------------

/** Whole text, one line per part. Wrapping is the surface's job; nothing is cut here. */
export function formatAddressLines(address) {
  const lines = [];
  if (address?.line1) lines.push(address.line1);
  if (address?.line2) lines.push(address.line2);
  if (address?.landmark) lines.push(`Near ${address.landmark}`);
  const place = [address?.city, [address?.state, address?.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (place) lines.push(place);
  return lines;
}

export const NO_ADDRESS_LABEL = "Select delivery address";

export function headerAddressLabel(address) {
  if (!address?.line1) return NO_ADDRESS_LABEL;
  return address.label ? `${address.label}, ${address.line1}` : address.line1;
}

// ---- Errors ----------------------------------------------------------------------------------

/**
 * Fixed copy for a failed shop or address request; server text is never shown. `action` is
 * "save" | "delete" | "load". field "form" is the message under the form, not under one input.
 */
export function describeAddressError(error, action = "save") {
  const status = error?.status;
  if (error?.reason === "session-expired" || error?.reason === "needs-login" || status === 401) {
    return { field: "form", message: "Your session ended. Log in again to continue." };
  }
  if (error?.reason === "network" || error?.reason === "refresh-unavailable") {
    return { field: "form", message: "We couldn't reach Ascend. Check your connection and try again." };
  }
  if (action === "delete" && status === 409) {
    return {
      field: "form",
      message: "You need at least one delivery address. Add another before deleting this one."
    };
  }
  if (status === 404) {
    return { field: "form", message: "That address is no longer there. Refresh and try again." };
  }
  if (status === 422) return { field: "form", message: "Check the details marked below and try again." };
  if (status === 429) return { field: "form", message: "Too many tries. Wait a moment and try again." };
  if (action === "delete") return { field: "form", message: "We couldn't delete that address. Please try again." };
  if (action === "load") return { field: "form", message: "We couldn't load your addresses. Please try again." };
  return { field: "form", message: "We couldn't save that. Please try again." };
}

const FIELD_COPY = {
  state: "Choose your state from the list.",
  pincode: "A pincode is 6 digits.",
  gst_number: "A GST number is 15 letters or digits.",
  shop_name: "Enter your shop's name.",
  line1: "Enter the building, street or area.",
  latitude: "Search for your address or use your location so we can pin it.",
  longitude: "Search for your address or use your location so we can pin it."
};

/** A 422 mapped back to the form fields it names. Fixed copy again; an unknown field is dropped. */
export function fieldErrorsFromResponse(error) {
  const detail = error?.status === 422 ? error.payload?.detail : null;
  if (!Array.isArray(detail)) return {};
  const errors = {};
  for (const item of detail) {
    const name = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
    if (typeof name !== "string" || !FIELD_COPY[name]) continue;
    errors[name === "latitude" || name === "longitude" ? "location" : name] = FIELD_COPY[name];
  }
  return errors;
}

// ---- Google adapter --------------------------------------------------------------------------

export class MapsError extends Error {
  constructor(reason) {
    super(`Google Maps is unavailable (${reason})`);
    this.name = "MapsError";
    // "missing-key" | "load-failed". Never carries the key.
    this.reason = reason;
  }
}

const MAPS_CALLBACK = "__ascendMapsReady";
let loading = null;

/** Test hook: forget a previous load. */
export function resetMapsLoader() {
  loading = null;
}

/**
 * Loads the Maps JavaScript API once and resolves google.maps, whose importLibrary then serves
 * "places" and "geocoding". This is the official bootstrap in readable form: one async script
 * (loading=async) whose callback fires when importLibrary exists. A failed load clears itself so
 * the next call retries. deps lets tests supply the page.
 */
export function loadMaps(deps = {}) {
  const win = deps.window ?? (typeof window === "undefined" ? undefined : window);
  const doc = deps.document ?? (typeof document === "undefined" ? undefined : document);
  if (win?.google?.maps?.importLibrary) return Promise.resolve(win.google.maps);
  if (loading) return loading;
  const key = deps.key ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!key) return Promise.reject(new MapsError("missing-key"));
  if (!win || !doc) return Promise.reject(new MapsError("load-failed"));

  loading = new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    win[MAPS_CALLBACK] = () => {
      delete win[MAPS_CALLBACK];
      resolve(win.google.maps);
    };
    const params = new URLSearchParams({ key, v: "weekly", loading: "async", region: "IN", callback: MAPS_CALLBACK });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      delete win[MAPS_CALLBACK];
      script.remove();
      loading = null;
      reject(new MapsError("load-failed"));
    };
    doc.head.append(script);
  });
  return loading;
}

const PLACE_FIELDS = ["location", "formattedAddress", "addressComponents"];

/**
 * Mounts the Places (New) autocomplete into `container`. A chosen suggestion is resolved to
 * { formattedAddress, location, addressComponents } and handed to onSelect; it is never saved
 * here. destroy() removes the element and both listeners and discards a lookup still in flight.
 * isCancelled() is consulted after the library loads so a form that closed meanwhile adds nothing.
 */
export async function createPlaceSearch({ maps, container, onSelect, onError, placeholder, isCancelled }) {
  const { PlaceAutocompleteElement } = await maps.importLibrary("places");
  if (isCancelled?.()) return { destroy() {} };

  const element = new PlaceAutocompleteElement({ includedRegionCodes: ["in"] });
  if (placeholder) element.placeholder = placeholder;
  let alive = true;

  const onSelected = async (event) => {
    try {
      const place = event.placePrediction.toPlace();
      await place.fetchFields({ fields: PLACE_FIELDS });
      if (!alive) return;
      onSelect({
        formattedAddress: place.formattedAddress,
        location: place.location,
        addressComponents: place.addressComponents
      });
    } catch (error) {
      if (alive) onError(error);
    }
  };
  const onFailed = (event) => {
    if (alive) onError(event);
  };

  element.addEventListener("gmp-select", onSelected);
  element.addEventListener("gmp-error", onFailed);
  container.append(element);

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      element.removeEventListener("gmp-select", onSelected);
      element.removeEventListener("gmp-error", onFailed);
      element.remove();
    }
  };
}

/** The best Geocoder result for a browser fix, or null when Google knows nothing there. */
export async function reverseGeocode({ maps, coords }) {
  const { Geocoder } = await maps.importLibrary("geocoding");
  try {
    const { results } = await new Geocoder().geocode({ location: { lat: coords.latitude, lng: coords.longitude } });
    return Array.isArray(results) && results.length ? results[0] : null;
  } catch (error) {
    if (error?.code === "ZERO_RESULTS") return null;
    throw error;
  }
}
