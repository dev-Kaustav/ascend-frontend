// Behaviour tests for the shop and delivery-address decisions (09-06). node:test, no framework,
// no network, no Google:
//
//   node --test tests/store-address.test.mjs
//
// Google is replaced by small fakes injected into lib/store/maps.mjs, so nothing here loads the
// Maps script, spends a billable request or reads a key. The state list is injected too (the
// module takes it as an argument), so these imports need nothing from the app's own source.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADDRESS_LIMITS,
  MapsError,
  addressStorageKey,
  buildShopPayload,
  canonicalState,
  clearSelectedAddressId,
  createPlaceSearch,
  describeAddressError,
  diffAddressPatch,
  draftFromAddress,
  fieldErrorsFromResponse,
  formatAddressLines,
  headerAddressLabel,
  loadMaps,
  normalizePlaceAddress,
  readSelectedAddressId,
  resetMapsLoader,
  resolveSelectedAddress,
  reverseGeocode,
  saveSelectedAddressId,
  shopSheetPlan,
  validateAddressDraft,
  validateShopDraft
} from "../lib/store/maps.mjs";
import { StoreApiError, createStoreTransport } from "../lib/store/api.mjs";

// The backend's canonical list, as far as these tests need it.
const STATES = [
  "Delhi",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Jammu and Kashmir",
  "Karnataka",
  "Maharashtra",
  "Odisha",
  "Puducherry",
  "Uttarakhand",
  "West Bengal"
];

const component = (longText, types) => ({ longText, shortText: longText, types });

const searchPlace = (overrides = {}) => ({
  formattedAddress: "Shop 4, 12 MG Road, Indiranagar, Bengaluru, Karnataka 560038, India",
  location: { lat: () => 12.9784, lng: () => 77.6408 },
  addressComponents: [
    component("Shop 4", ["subpremise"]),
    component("12", ["street_number"]),
    component("MG Road", ["route"]),
    component("Indiranagar", ["sublocality_level_1", "sublocality", "political"]),
    component("Bengaluru", ["locality", "political"]),
    component("Bengaluru Urban", ["administrative_area_level_2", "political"]),
    component("Karnataka", ["administrative_area_level_1", "political"]),
    component("India", ["country", "political"]),
    component("560038", ["postal_code"])
  ],
  ...overrides
});

// ---------------------------------------------------------------------------------------------
// State mapping: Google's label must become the backend's canonical value or ask for a correction.
// ---------------------------------------------------------------------------------------------

test("Google's own spellings map to the canonical state", () => {
  assert.equal(canonicalState("Karnataka", STATES), "Karnataka");
  assert.equal(canonicalState("karnataka ", STATES), "Karnataka");
  assert.equal(canonicalState("Jammu & Kashmir", STATES), "Jammu and Kashmir");
  assert.equal(canonicalState("National Capital Territory of Delhi", STATES), "Delhi");
  assert.equal(canonicalState("Orissa", STATES), "Odisha");
  assert.equal(canonicalState("Uttaranchal", STATES), "Uttarakhand");
  assert.equal(canonicalState("Pondicherry", STATES), "Puducherry");
  assert.equal(canonicalState("Dadra & Nagar Haveli and Daman & Diu", STATES), "Dadra and Nagar Haveli and Daman and Diu");
});

test("an unknown, empty or non-text state is not guessed", () => {
  assert.equal(canonicalState("Narnia", STATES), null);
  assert.equal(canonicalState("", STATES), null);
  assert.equal(canonicalState(undefined, STATES), null);
  assert.equal(canonicalState(42, STATES), null);
});

test("an alias is only honoured when its target is in the supplied list", () => {
  // The list is the authority: Orissa maps to Odisha only if Odisha is a known state.
  assert.equal(canonicalState("Orissa", ["Delhi"]), null);
});

// ---------------------------------------------------------------------------------------------
// Place to editable draft.
// ---------------------------------------------------------------------------------------------

test("a searched place becomes an editable draft with the building part in line 1", () => {
  const draft = normalizePlaceAddress(searchPlace(), STATES, { source: "search" });
  assert.equal(draft.line1, "Shop 4, 12, MG Road, Indiranagar");
  assert.equal(draft.city, "Bengaluru");
  assert.equal(draft.state, "Karnataka");
  assert.equal(draft.stateNeedsCorrection, false);
  assert.equal(draft.pincode, "560038");
  assert.equal(draft.latitude, 12.9784);
  assert.equal(draft.longitude, 77.6408);
  assert.equal(draft.source, "search");
  // Nothing optional is invented.
  assert.equal(draft.landmark, "");
  assert.equal(draft.line2, "");
  assert.equal(draft.label, "");
});

test("a place without a mappable state keeps its coordinates and asks for a correction", () => {
  const place = searchPlace({
    addressComponents: [component("Somewhere", ["locality"]), component("Narnia", ["administrative_area_level_1"])]
  });
  const draft = normalizePlaceAddress(place, STATES);
  assert.equal(draft.state, "");
  assert.equal(draft.stateNeedsCorrection, true);
  assert.equal(draft.latitude, 12.9784);
  const missing = normalizePlaceAddress(searchPlace({ addressComponents: [] }), STATES);
  assert.equal(missing.stateNeedsCorrection, true);
  assert.equal(missing.state, "");
});

test("with no usable components the formatted address (without India) is line 1", () => {
  const draft = normalizePlaceAddress(
    searchPlace({ addressComponents: undefined, formattedAddress: "Near Fort, Kalaburagi, Karnataka 585101, India" }),
    STATES
  );
  assert.equal(draft.line1, "Near Fort, Kalaburagi, Karnataka 585101");
});

test("a place with no location at all produces a draft that cannot be saved", () => {
  const draft = normalizePlaceAddress(searchPlace({ location: undefined }), STATES);
  assert.equal(draft.latitude, null);
  assert.equal(draft.longitude, null);
  assert.equal(validateAddressDraft(draft, STATES).errors.location !== undefined, true);
});

test("a Geocoder result is read through its own field names, and the detected point wins", () => {
  const result = {
    formatted_address: "5 Park Street, Kolkata, West Bengal 700016, India",
    geometry: { location: { lat: () => 22.5, lng: () => 88.3 } },
    address_components: [
      { long_name: "5", short_name: "5", types: ["street_number"] },
      { long_name: "Park Street", short_name: "Park St", types: ["route"] },
      { long_name: "Kolkata", short_name: "Kolkata", types: ["locality"] },
      { long_name: "West Bengal", short_name: "WB", types: ["administrative_area_level_1"] },
      { long_name: "700016", short_name: "700016", types: ["postal_code"] }
    ]
  };
  const draft = normalizePlaceAddress(result, STATES, { source: "detect", location: { latitude: 22.51, longitude: 88.31 } });
  assert.equal(draft.line1, "5, Park Street");
  assert.equal(draft.state, "West Bengal");
  assert.equal(draft.pincode, "700016");
  // The browser's own fix, not the geocoder's snapped point.
  assert.equal(draft.latitude, 22.51);
  assert.equal(draft.longitude, 88.31);
  assert.equal(draft.source, "detect");
});

test("line 1 never exceeds what the backend accepts", () => {
  const long = "A".repeat(500);
  const draft = normalizePlaceAddress(searchPlace({ addressComponents: [component(long, ["route"])] }), STATES);
  assert.equal(draft.line1.length, ADDRESS_LIMITS.line1);
});

test("a pincode that is not six digits is left blank rather than carried to the backend", () => {
  const draft = normalizePlaceAddress(
    searchPlace({ addressComponents: [component("1234", ["postal_code"]), component("Karnataka", ["administrative_area_level_1"])] }),
    STATES
  );
  assert.equal(draft.pincode, "");
});

// ---------------------------------------------------------------------------------------------
// Validation: line 1, state and coordinates are required; nothing else blocks.
// ---------------------------------------------------------------------------------------------

const goodDraft = () => ({
  label: "",
  line1: "12 MG Road",
  line2: "",
  landmark: "",
  city: "",
  state: "Karnataka",
  pincode: "",
  latitude: 12.97,
  longitude: 77.64
});

test("missing line 1, state and coordinates each block the save with their own message", () => {
  const result = validateAddressDraft({ ...goodDraft(), line1: "   ", state: "", latitude: null, longitude: null }, STATES);
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["line1", "location", "state"]);
  assert.equal(result.value, null);
});

test("absent optional details never block", () => {
  const result = validateAddressDraft(goodDraft(), STATES);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, {
    label: null,
    line1: "12 MG Road",
    line2: null,
    landmark: null,
    city: null,
    state: "Karnataka",
    pincode: null,
    latitude: 12.97,
    longitude: 77.64
  });
});

test("values are trimmed and a pincode is only checked when present", () => {
  const ok = validateAddressDraft({ ...goodDraft(), line1: "  12 MG Road ", landmark: " Near the temple ", pincode: " 560 038 " }, STATES);
  assert.equal(ok.valid, true);
  assert.equal(ok.value.line1, "12 MG Road");
  assert.equal(ok.value.landmark, "Near the temple");
  assert.equal(ok.value.pincode, "560038");
  const bad = validateAddressDraft({ ...goodDraft(), pincode: "56003" }, STATES);
  assert.equal(bad.valid, false);
  assert.deepEqual(Object.keys(bad.errors), ["pincode"]);
});

test("a state outside the canonical list is refused even if the select was bypassed", () => {
  const result = validateAddressDraft({ ...goodDraft(), state: "Narnia" }, STATES);
  assert.equal(result.valid, false);
  assert.ok(result.errors.state);
});

test("optional fields are bounded to the backend's limits", () => {
  const result = validateAddressDraft(
    {
      ...goodDraft(),
      label: "x".repeat(ADDRESS_LIMITS.label + 1),
      landmark: "y".repeat(ADDRESS_LIMITS.landmark + 1),
      city: "z".repeat(ADDRESS_LIMITS.city + 1),
      line2: "w".repeat(ADDRESS_LIMITS.line2 + 1),
      line1: "v".repeat(ADDRESS_LIMITS.line1 + 1)
    },
    STATES
  );
  assert.deepEqual(Object.keys(result.errors).sort(), ["city", "label", "landmark", "line1", "line2"]);
  // Exactly at the limit is fine.
  assert.equal(validateAddressDraft({ ...goodDraft(), landmark: "y".repeat(ADDRESS_LIMITS.landmark) }, STATES).valid, true);
});

test("coordinates outside the earth, or not numbers, are not a location", () => {
  for (const [latitude, longitude] of [[91, 77], [12, 181], [Number.NaN, 77], ["12.9", 77], [Infinity, 1]]) {
    const result = validateAddressDraft({ ...goodDraft(), latitude, longitude }, STATES);
    assert.equal(result.valid, false, `${latitude},${longitude}`);
    assert.ok(result.errors.location);
  }
});

// ---------------------------------------------------------------------------------------------
// Editing a saved address: only changed keys are sent, required fields are never cleared.
// ---------------------------------------------------------------------------------------------

const saved = () => ({
  id: 9,
  label: "Shop",
  line1: "12 MG Road",
  line2: null,
  landmark: "Near temple",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: 560038,
  latitude: 12.97,
  longitude: 77.64
});

test("an unchanged form sends nothing", () => {
  const value = validateAddressDraft(draftFromAddress(saved(), STATES), STATES).value;
  assert.equal(diffAddressPatch(saved(), value), null);
});

test("only the changed keys are sent, and a cleared optional field is an explicit null", () => {
  const draft = { ...draftFromAddress(saved(), STATES), line1: "14 MG Road", landmark: "" };
  const value = validateAddressDraft(draft, STATES).value;
  assert.deepEqual(diffAddressPatch(saved(), value), { line1: "14 MG Road", landmark: null });
});

test("a re-pinned location sends both coordinates; the state is only sent when it changed", () => {
  const draft = { ...draftFromAddress(saved(), STATES), latitude: 12.98, longitude: 77.65 };
  const patch = diffAddressPatch(saved(), validateAddressDraft(draft, STATES).value);
  assert.deepEqual(patch, { latitude: 12.98, longitude: 77.65 });
  const moved = diffAddressPatch(saved(), validateAddressDraft({ ...draft, state: "Maharashtra" }, STATES).value);
  assert.equal(moved.state, "Maharashtra");
});

test("a required field cleared in the form never becomes a patch key", () => {
  const draft = { ...draftFromAddress(saved(), STATES), line1: "" };
  const result = validateAddressDraft(draft, STATES);
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
});

test("a saved address whose state is no longer on the list opens with the state to be corrected", () => {
  const draft = draftFromAddress({ ...saved(), state: "Orissa" }, STATES);
  assert.equal(draft.state, "Odisha");
  const unknown = draftFromAddress({ ...saved(), state: "Narnia" }, STATES);
  assert.equal(unknown.state, "");
  assert.equal(unknown.stateNeedsCorrection, true);
});

// ---------------------------------------------------------------------------------------------
// Shop details and the confirm-shop payload.
// ---------------------------------------------------------------------------------------------

test("a shop needs a name; the GSTIN is optional and normalised only when given", () => {
  assert.equal(validateShopDraft({ shopName: "  ", gstNumber: "" }).valid, false);
  assert.ok(validateShopDraft({ shopName: "  ", gstNumber: "" }).errors.shop_name);
  const blankGst = validateShopDraft({ shopName: " Sri Stores ", gstNumber: "   " });
  assert.equal(blankGst.valid, true);
  assert.deepEqual(blankGst.value, { shop_name: "Sri Stores", gst_number: null });
  const upper = validateShopDraft({ shopName: "Sri Stores", gstNumber: "29abcde1234f1z5" });
  assert.equal(upper.value.gst_number, "29ABCDE1234F1Z5");
  const bad = validateShopDraft({ shopName: "Sri Stores", gstNumber: "123" });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.gst_number);
  assert.equal(validateShopDraft({ shopName: "x".repeat(121), gstNumber: "" }).valid, false);
});

test("the shop payload is exactly shop_name, gst_number and address", () => {
  const shop = { shop_name: "Sri Stores", gst_number: null };
  const address = validateAddressDraft(goodDraft(), STATES).value;
  assert.deepEqual(Object.keys(buildShopPayload(shop, address)).sort(), ["address", "gst_number", "shop_name"]);
  assert.equal(buildShopPayload(shop, address).address.state, "Karnataka");
  // No submission without a reviewed address (D-26).
  assert.throws(() => buildShopPayload(shop, null));
});

test("only new and confirm retailers get the shop sheet; ready, anonymous and loading skip it", () => {
  assert.equal(shopSheetPlan("ready", null, STATES).show, false);
  assert.equal(shopSheetPlan("anonymous", null, STATES).show, false);
  assert.equal(shopSheetPlan("loading", null, STATES).show, false);
  assert.equal(shopSheetPlan("error", null, STATES).show, false);

  const fresh = shopSheetPlan("new", { onboarding: "new", prefill: null }, STATES);
  assert.equal(fresh.show, true);
  assert.equal(fresh.mode, "new");
  assert.equal(fresh.shopName, "");
  assert.equal(fresh.draft.line1, "");
  assert.equal(fresh.draft.latitude, null);
});

test("an existing shop is prefilled from the server, with a legacy state corrected not trusted", () => {
  const me = {
    onboarding: "confirm",
    prefill: {
      shop_name: "Sri Stores",
      address_line1: "12 MG Road",
      address_line2: "First floor",
      city: "Bengaluru",
      state: "Orissa",
      pincode: 560038,
      gst_number: "29ABCDE1234F1Z5",
      latitude: 12.97,
      longitude: 77.64
    }
  };
  const plan = shopSheetPlan("confirm", me, STATES);
  assert.equal(plan.show, true);
  assert.equal(plan.mode, "confirm");
  assert.equal(plan.shopName, "Sri Stores");
  assert.equal(plan.gstNumber, "29ABCDE1234F1Z5");
  assert.equal(plan.draft.line1, "12 MG Road");
  assert.equal(plan.draft.line2, "First floor");
  assert.equal(plan.draft.state, "Odisha");
  assert.equal(plan.draft.pincode, "560038");
  // A prefill with no coordinates cannot be submitted as it stands.
  const noPoint = shopSheetPlan("confirm", { onboarding: "confirm", prefill: { ...me.prefill, latitude: null, longitude: null } }, STATES);
  assert.equal(validateAddressDraft(noPoint.draft, STATES).valid, false);
  // And a blank prefill is not a submission.
  const blank = shopSheetPlan("confirm", { onboarding: "confirm", prefill: { shop_name: "X" } }, STATES);
  assert.equal(validateAddressDraft(blank.draft, STATES).valid, false);
});

// ---------------------------------------------------------------------------------------------
// Selected address: per retailer, restored only while the server still lists it.
// ---------------------------------------------------------------------------------------------

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
};

const list = (...ids) => ids.map((id) => ({ id, line1: `Address ${id}` }));

test("the stored choice is keyed by retailer and holds only an id", () => {
  const storage = memoryStorage();
  assert.equal(addressStorageKey(7), "ascend_store_address:7");
  saveSelectedAddressId(storage, 7, 12);
  assert.deepEqual([...storage.data.entries()], [["ascend_store_address:7", "12"]]);
  assert.equal(readSelectedAddressId(storage, 7), "12");
  assert.equal(readSelectedAddressId(storage, 8), null);
  clearSelectedAddressId(storage, 7);
  assert.equal(readSelectedAddressId(storage, 7), null);
});

test("without a retailer there is nothing to store or read", () => {
  const storage = memoryStorage();
  saveSelectedAddressId(storage, null, 12);
  assert.equal(storage.data.size, 0);
  assert.equal(readSelectedAddressId(storage, null), null);
});

test("a storage that throws is survived", () => {
  const broken = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    }
  };
  assert.equal(readSelectedAddressId(broken, 7), null);
  assert.doesNotThrow(() => saveSelectedAddressId(broken, 7, 1));
  assert.doesNotThrow(() => clearSelectedAddressId(broken, 7));
  assert.equal(readSelectedAddressId(null, 7), null);
});

test("a stored id resolves only inside the list the server returned now", () => {
  assert.equal(resolveSelectedAddress({ addresses: list(1, 2, 3), storedId: "2" }).id, 2);
  assert.equal(resolveSelectedAddress({ addresses: list(1, 2, 3), storedId: 2 }).id, 2);
  // Deleted elsewhere, or belonging to another retailer: not a member, so no selection among many.
  assert.equal(resolveSelectedAddress({ addresses: list(1, 3), storedId: "2" }), null);
  assert.equal(resolveSelectedAddress({ addresses: list(1, 3), storedId: null }), null);
  assert.equal(resolveSelectedAddress({ addresses: list(1, 3), storedId: "abc" }), null);
});

test("a retailer with exactly one saved address is delivering there without choosing", () => {
  assert.equal(resolveSelectedAddress({ addresses: list(5), storedId: null }).id, 5);
  // Even if the stored id points at a deleted address.
  assert.equal(resolveSelectedAddress({ addresses: list(5), storedId: "9" }).id, 5);
});

test("zero addresses and a missing list select nothing", () => {
  assert.equal(resolveSelectedAddress({ addresses: [], storedId: "1" }), null);
  assert.equal(resolveSelectedAddress({ addresses: undefined, storedId: "1" }), null);
});

// ---------------------------------------------------------------------------------------------
// Display text: long text is passed whole, wrapping is the surface's job.
// ---------------------------------------------------------------------------------------------

test("an address is shown whole, with Near before the landmark and the place line last", () => {
  const lines = formatAddressLines({ ...saved(), line2: "First floor", landmark: "Gokul temple" });
  assert.deepEqual(lines, ["12 MG Road", "First floor", "Near Gokul temple", "Bengaluru, Karnataka 560038"]);
  assert.deepEqual(formatAddressLines({ line1: "x", state: "Goa" }), ["x", "Goa"]);
  const long = "L".repeat(300);
  assert.equal(formatAddressLines({ line1: long, state: "Goa" })[0], long);
});

test("the header label prefers the label, falls back to line 1 and has a prompt for none", () => {
  assert.equal(headerAddressLabel({ label: "Shop", line1: "12 MG Road" }), "Shop, 12 MG Road");
  assert.equal(headerAddressLabel({ label: null, line1: "12 MG Road" }), "12 MG Road");
  assert.equal(headerAddressLabel(null), "Select delivery address");
});

// ---------------------------------------------------------------------------------------------
// Error wording and server field errors.
// ---------------------------------------------------------------------------------------------

test("a refused last-address delete is explained, not shown as a generic failure", () => {
  const error = new StoreApiError("Keep at least one delivery address", { status: 409 });
  assert.match(describeAddressError(error, "delete").message, /at least one delivery address/i);
  assert.equal(describeAddressError(error, "delete").field, "form");
});

test("other failures read as fixed copy, never server text", () => {
  const network = new StoreApiError("Network error", { reason: "network" });
  assert.match(describeAddressError(network, "save").message, /connection/i);
  const missing = new StoreApiError("secret server text", { status: 404 });
  assert.doesNotMatch(describeAddressError(missing, "save").message, /secret/);
  const down = new StoreApiError("boom", { status: 503 });
  assert.doesNotMatch(describeAddressError(down, "save").message, /boom/);
  const expired = new StoreApiError("x", { status: 401, reason: "session-expired" });
  assert.match(describeAddressError(expired, "save").message, /log in/i);
});

test("a 422 is mapped back to the field it names, including inside the shop's address", () => {
  const payload = {
    detail: [
      { loc: ["body", "address", "state"], msg: "Value error, State must be one of the 28 Indian states or 8 union territories." },
      { loc: ["body", "gst_number"], msg: "Value error, GST number must be 15 letters or digits." },
      { loc: ["body", "address", "pincode"], msg: "Value error, Pincode must be 6 digits." }
    ]
  };
  const errors = fieldErrorsFromResponse(new StoreApiError("x", { status: 422, payload }));
  assert.deepEqual(Object.keys(errors).sort(), ["gst_number", "pincode", "state"]);
  assert.doesNotMatch(errors.state, /Value error/);
  // A 422 about a field the form does not have is not invented into one.
  assert.deepEqual(fieldErrorsFromResponse(new StoreApiError("x", { status: 422, payload: { detail: "nope" } })), {});
  assert.deepEqual(fieldErrorsFromResponse(new StoreApiError("x", { status: 500 })), {});
});

// ---------------------------------------------------------------------------------------------
// The transport: a 204 delete does not parse JSON; a 409 keeps its body.
// ---------------------------------------------------------------------------------------------

const fakeSession = () => ({
  getGeneration: () => 1,
  getAccessToken: () => "token",
  getRefreshToken: () => "refresh",
  rotate: () => false,
  expire: () => false
});

test("deleting resolves null on a 204 whose body is never read as JSON", async () => {
  const response = {
    ok: true,
    status: 204,
    headers: new Headers(),
    text: async () => {
      throw new Error("a 204 has no body to read");
    },
    json: async () => {
      throw new Error("a 204 must not be parsed");
    }
  };
  const { storeFetch } = createStoreTransport({ session: fakeSession(), baseUrl: "http://api.test", fetch: async () => response, now: () => 0 });
  assert.equal(await storeFetch("/store/me/addresses/9", { method: "DELETE" }), null);
});

test("a refused last-address delete surfaces as a 409 StoreApiError", async () => {
  const response = new Response(JSON.stringify({ detail: "Keep at least one delivery address" }), { status: 409 });
  const { storeFetch } = createStoreTransport({ session: fakeSession(), baseUrl: "http://api.test", fetch: async () => response, now: () => 0 });
  await assert.rejects(storeFetch("/store/me/addresses/9", { method: "DELETE" }), (error) => {
    assert.equal(error.status, 409);
    assert.match(describeAddressError(error, "delete").message, /at least one/i);
    return true;
  });
});

// ---------------------------------------------------------------------------------------------
// The Google adapter, against fakes. No network, no key.
// ---------------------------------------------------------------------------------------------

class FakeElement extends EventTarget {
  constructor(options) {
    super();
    this.options = options;
    this.removed = false;
  }
  remove() {
    this.removed = true;
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
}

const fakeContainer = () => ({
  children: [],
  append(child) {
    child.parent = this;
    this.children.push(child);
  }
});

const fakeMaps = ({ fetchFields, geocode } = {}) => {
  const state = { elements: [], fieldRequests: [], imported: [] };
  return {
    state,
    importLibrary: async (name) => {
      state.imported.push(name);
      if (name === "places") {
        return {
          PlaceAutocompleteElement: class extends FakeElement {
            constructor(options) {
              super(options);
              state.elements.push(this);
            }
          }
        };
      }
      if (name === "geocoding") {
        return {
          Geocoder: class {
            geocode(request) {
              return geocode(request);
            }
          }
        };
      }
      throw new Error(`unexpected library ${name}`);
    },
    place(data) {
      return {
        toPlace: () => ({
          ...data,
          fetchFields: async (request) => {
            state.fieldRequests.push(request);
            if (fetchFields) await fetchFields(request);
          }
        })
      };
    }
  };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("choosing a suggestion fetches exactly the three fields and delivers an unsaved place", async () => {
  const maps = fakeMaps();
  const container = fakeContainer();
  const selected = [];
  const search = await createPlaceSearch({ maps, container, onSelect: (place) => selected.push(place), onError: () => assert.fail("no error expected") });
  assert.equal(container.children.length, 1);
  const element = maps.state.elements[0];
  assert.deepEqual(element.options.includedRegionCodes, ["in"]);

  const event = new Event("gmp-select");
  event.placePrediction = maps.place({
    formattedAddress: "12 MG Road, Bengaluru",
    location: { lat: () => 1, lng: () => 2 },
    addressComponents: []
  });
  element.dispatchEvent(event);
  await tick();

  assert.deepEqual(maps.state.fieldRequests, [{ fields: ["location", "formattedAddress", "addressComponents"] }]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].formattedAddress, "12 MG Road, Bengaluru");
  search.destroy();
});

test("a failed place lookup is reported once and not delivered as a place", async () => {
  const maps = fakeMaps({
    fetchFields: async () => {
      throw new Error("REQUEST_DENIED");
    }
  });
  const errors = [];
  await createPlaceSearch({ maps, container: fakeContainer(), onSelect: () => assert.fail("must not select"), onError: (e) => errors.push(e) });
  const event = new Event("gmp-select");
  event.placePrediction = maps.place({});
  maps.state.elements[0].dispatchEvent(event);
  await tick();
  assert.equal(errors.length, 1);
});

test("the widget's own error event reaches the caller", async () => {
  const maps = fakeMaps();
  const errors = [];
  await createPlaceSearch({ maps, container: fakeContainer(), onSelect: () => {}, onError: (e) => errors.push(e) });
  maps.state.elements[0].dispatchEvent(new Event("gmp-error"));
  assert.equal(errors.length, 1);
});

test("destroying the search removes the element and its listeners, and a late result is dropped", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const maps = fakeMaps({ fetchFields: () => gate });
  const container = fakeContainer();
  const selected = [];
  const search = await createPlaceSearch({ maps, container, onSelect: (p) => selected.push(p), onError: () => {} });
  const element = maps.state.elements[0];

  const event = new Event("gmp-select");
  event.placePrediction = maps.place({ formattedAddress: "late" });
  element.dispatchEvent(event);
  search.destroy();
  release();
  await tick();

  assert.equal(element.removed, true);
  assert.equal(container.children.length, 0);
  assert.equal(selected.length, 0, "a result that lands after destroy is discarded");

  // The listeners are gone: a new event does nothing.
  const again = new Event("gmp-select");
  again.placePrediction = maps.place({ formattedAddress: "again" });
  element.dispatchEvent(again);
  await tick();
  assert.equal(maps.state.fieldRequests.length, 1);
  assert.doesNotThrow(() => search.destroy());
});

test("a search that is destroyed while the library loads never adds its element", async () => {
  const maps = fakeMaps();
  const container = fakeContainer();
  const search = await createPlaceSearch({ maps, container, onSelect: () => {}, onError: () => {}, isCancelled: () => true });
  assert.equal(container.children.length, 0);
  assert.equal(maps.state.elements.length, 0);
  assert.doesNotThrow(() => search.destroy());
});

test("reverse geocoding asks the JS Geocoder for the point and returns the best result", async () => {
  const requests = [];
  const maps = fakeMaps({
    geocode: async (request) => {
      requests.push(request);
      return { results: [{ formatted_address: "first" }, { formatted_address: "second" }] };
    }
  });
  const result = await reverseGeocode({ maps, coords: { latitude: 12.5, longitude: 77.5, accuracy_m: 30 } });
  assert.equal(result.formatted_address, "first");
  assert.deepEqual(requests, [{ location: { lat: 12.5, lng: 77.5 } }]);
});

test("no result for a point is null, and any other Geocoder failure is thrown", async () => {
  const none = fakeMaps({ geocode: async () => ({ results: [] }) });
  assert.equal(await reverseGeocode({ maps: none, coords: { latitude: 1, longitude: 2 } }), null);
  const zero = fakeMaps({
    geocode: async () => {
      throw Object.assign(new Error("ZERO_RESULTS"), { code: "ZERO_RESULTS" });
    }
  });
  assert.equal(await reverseGeocode({ maps: zero, coords: { latitude: 1, longitude: 2 } }), null);
  const denied = fakeMaps({
    geocode: async () => {
      throw Object.assign(new Error("REQUEST_DENIED"), { code: "REQUEST_DENIED" });
    }
  });
  await assert.rejects(reverseGeocode({ maps: denied, coords: { latitude: 1, longitude: 2 } }));
});

// A document and window just big enough for the loader.
const fakePage = () => {
  const scripts = [];
  const win = {};
  const doc = {
    head: {
      append(script) {
        scripts.push(script);
      }
    },
    createElement: () => ({
      remove() {
        const at = scripts.indexOf(this);
        if (at >= 0) scripts.splice(at, 1);
      }
    })
  };
  return { win, doc, scripts };
};

test("with no key the loader refuses without touching the page", async () => {
  resetMapsLoader();
  const { win, doc, scripts } = fakePage();
  await assert.rejects(loadMaps({ key: "", window: win, document: doc }), (error) => error instanceof MapsError && error.reason === "missing-key");
  assert.equal(scripts.length, 0);
});

test("the loader injects one script with the key and a callback, and shares the result", async () => {
  resetMapsLoader();
  const { win, doc, scripts } = fakePage();
  const first = loadMaps({ key: "test-key", window: win, document: doc });
  const second = loadMaps({ key: "test-key", window: win, document: doc });
  assert.equal(scripts.length, 1, "one script however many callers");
  const url = new URL(scripts[0].src);
  assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/js");
  assert.equal(url.searchParams.get("key"), "test-key");
  assert.equal(url.searchParams.get("loading"), "async");
  const callback = url.searchParams.get("callback");
  assert.equal(typeof win[callback], "function");

  win.google = { maps: { importLibrary: async () => ({}) } };
  win[callback]();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, win.google.maps);
  assert.equal(b, win.google.maps);
  // Once loaded, no second script is ever injected.
  assert.equal(await loadMaps({ key: "test-key", window: win, document: doc }), win.google.maps);
  assert.equal(scripts.length, 1);
});

test("a script that fails to load rejects and can be retried", async () => {
  resetMapsLoader();
  const { win, doc, scripts } = fakePage();
  const attempt = loadMaps({ key: "test-key", window: win, document: doc });
  scripts[0].onerror();
  await assert.rejects(attempt, (error) => error instanceof MapsError && error.reason === "load-failed");
  assert.equal(scripts.length, 0, "the failed script is removed");

  const retry = loadMaps({ key: "test-key", window: win, document: doc });
  assert.equal(scripts.length, 1);
  const callback = new URL(scripts[0].src).searchParams.get("callback");
  win.google = { maps: { importLibrary: async () => ({}) } };
  win[callback]();
  assert.equal(await retry, win.google.maps);
});
