export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// One copy of the browser geolocation call. Three screens now ask for a fix — the driver's
// outlet-finder, the driver's order list, and the salesman onboarding a shop — and they must
// agree on the timeout and on what a refusal reads like, because "nothing happened" is the
// worst possible answer to a button press in a market with one bar of signal.
const POSITION_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

// Browser messages here are unreadable to a salesman ("User denied Geolocation"). These say
// what to actually do about it.
const POSITION_ERRORS = {
  1: "Location permission is blocked. Allow location for this site in your browser settings, then try again.",
  2: "Couldn't get a location fix. Step outside or near a window and try again.",
  3: "Location is taking too long. Step outside or near a window and try again.",
};

export function getPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser can't share a location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(new Error(POSITION_ERRORS[err?.code] || "Couldn't get your location. Try again.")),
      { ...POSITION_OPTIONS, ...options }
    );
  });
}

// Coordinates in the shape both the retailer-request and the order-status endpoints accept.
export async function getCoords(options) {
  const pos = await getPosition(options);
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy_m: pos.coords.accuracy ?? null,
  };
}

export function formatAccuracy(accuracy) {
  // A non-positive radius is not a perfect fix, it is an absent one — some devices and every
  // mocked geolocation report 0. Showing "±0 m" would claim a precision nothing measured.
  if (accuracy == null || !(accuracy > 0)) return null;
  const rounded = accuracy >= 1000 ? `±${(accuracy / 1000).toFixed(1)} km` : `±${Math.round(accuracy)} m`;
  return rounded;
}

// A Google Maps link for a retailer: the saved pin when there is one, otherwise its address. On a
// phone this URL opens the Google Maps app.
export function mapsUrl(retailer) {
  const hasPin = retailer?.latitude != null && retailer?.longitude != null;
  const query = hasPin
    ? `${retailer.latitude},${retailer.longitude}`
    : [retailer?.name, retailer?.address_line1, retailer?.address_line2, retailer?.city, retailer?.pincode]
        .filter(Boolean)
        .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
