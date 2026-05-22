import { haversineKm } from "@/lib/geo";

export const MAPS_BATCH_SIZE = 9;

export function recomputeDistances(outlets, userLat, userLng) {
  let curLat = userLat;
  let curLng = userLng;
  return outlets.map((o) => {
    const d = haversineKm(curLat, curLng, o.latitude, o.longitude);
    curLat = o.latitude;
    curLng = o.longitude;
    return { ...o, distFromPrev: d };
  });
}

export async function optimizeWithOSRM(userLat, userLng, outlets) {
  const coords = [[userLng, userLat], ...outlets.map((o) => [o.longitude, o.latitude])];
  const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/trip/v1/driving/${coordStr}?source=first&roundtrip=false&annotations=distance,duration`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM request failed");
  const data = await res.json();
  if (data.code !== "Ok") throw new Error("OSRM returned error: " + data.code);

  const waypoints = data.waypoints;
  const outletWaypoints = waypoints.slice(1);
  const sorted = [...outlets];
  outletWaypoints.forEach((wp, inputIdx) => {
    sorted[wp.waypoint_index - 1] = outlets[inputIdx];
  });

  return recomputeDistances(sorted, userLat, userLng);
}

export function greedyNearest(userLat, userLng, outlets) {
  const pool = [...outlets];
  const sorted = [];
  let curLat = userLat;
  let curLng = userLng;
  while (pool.length) {
    let nearestIdx = 0;
    let minDist = Infinity;
    pool.forEach((o, i) => {
      const d = haversineKm(curLat, curLng, o.latitude, o.longitude);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    const chosen = pool.splice(nearestIdx, 1)[0];
    sorted.push({ ...chosen, distFromPrev: minDist });
    curLat = chosen.latitude;
    curLng = chosen.longitude;
  }
  return sorted;
}

export async function optimizeRoute(userLat, userLng, outlets) {
  try {
    return await optimizeWithOSRM(userLat, userLng, outlets);
  } catch {
    return greedyNearest(userLat, userLng, outlets);
  }
}

export function buildLegs(userPos, outlets, batchSize = MAPS_BATCH_SIZE) {
  if (!userPos || !outlets.length) return [];
  const legs = [];
  let originStop = { latitude: userPos.lat, longitude: userPos.lng, name: "Your location" };

  for (let i = 0; i < outlets.length; i += batchSize) {
    const batch = outlets.slice(i, i + batchSize);
    const destination = batch[batch.length - 1];
    const waypoints = batch.slice(0, -1);
    const legDistance = batch.reduce((acc, stop) => acc + (stop.distFromPrev ?? 0), 0);

    legs.push({
      origin: originStop,
      destination,
      waypoints,
      stops: batch,
      distanceKm: legDistance,
    });
    originStop = destination;
  }
  return legs;
}

export function buildMapsUrl({ origin, destination, waypoints }) {
  const coord = (s) => `${s.latitude},${s.longitude}`;
  const params = new URLSearchParams({
    api: "1",
    origin: coord(origin),
    destination: coord(destination),
    travelmode: "driving",
  });
  if (waypoints.length) {
    params.set("waypoints", waypoints.map(coord).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function fingerprintOutlets(outlets) {
  return outlets.map((o) => o.external_id).join(",");
}

export async function getCurrentPos() {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
  );
}
