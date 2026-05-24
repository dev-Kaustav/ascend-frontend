"use client";

export default function RouteLauncher({
  legs,
  selectedIndex,
  launchedLegs,
  buildMapsUrl,
  onSelect,
  onLaunched,
  onReset,
}) {
  const totalLegs = legs.length;
  const activeLeg = legs[selectedIndex];
  if (!activeLeg) return null;

  const launched = new Set(launchedLegs);
  const allLaunched = totalLegs > 0 && launched.size >= totalLegs;
  const totalStops = legs.reduce((n, l) => n + l.stops.length, 0);

  function handleLaunch() {
    const url = buildMapsUrl({
      origin: activeLeg.origin,
      destination: activeLeg.destination,
      waypoints: activeLeg.waypoints,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    onLaunched(selectedIndex);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {totalLegs > 1 && (
        <>
          {allLaunched ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-medium text-emerald-800">
                All {totalLegs} legs launched — tap a leg to send it again.
              </p>
              <button
                onClick={onReset}
                className="shrink-0 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 cursor-pointer"
              >
                Restart
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Google Maps supports up to 9 stops per route. Your {totalStops} outlets are split into{" "}
              {totalLegs} legs — tap a leg, then start it.
            </p>
          )}

          {/* Leg picker */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {legs.map((leg, i) => {
              const isActive = i === selectedIndex;
              const isDone = launched.has(i);
              return (
                <button
                  key={i}
                  onClick={() => onSelect(i)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                    isActive
                      ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-semibold ${
                        isActive ? "text-violet-700" : "text-slate-700"
                      }`}
                    >
                      Leg {i + 1}
                    </span>
                    {isDone && <span className="text-xs text-emerald-600">✓</span>}
                  </div>
                  <span className="mt-0.5 block whitespace-nowrap text-[11px] text-slate-500">
                    {leg.stops.length} {leg.stops.length === 1 ? "stop" : "stops"}
                    {leg.distanceKm > 0 ? ` · ~${leg.distanceKm.toFixed(0)} km` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">
          {totalLegs > 1 ? `Leg ${selectedIndex + 1} of ${totalLegs}` : "Your route"}
          <span className="text-slate-400"> · </span>
          {activeLeg.stops.length} {activeLeg.stops.length === 1 ? "stop" : "stops"}
          {activeLeg.distanceKm > 0 && (
            <>
              <span className="text-slate-400"> · </span>~{activeLeg.distanceKm.toFixed(0)} km
            </>
          )}
        </p>
      </div>

      <button
        onClick={handleLaunch}
        className="w-full min-h-[60px] rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3"
      >
        <span aria-hidden className="text-xl leading-none">▶</span>
        {launched.has(selectedIndex) ? "Restart this leg in Google Maps" : "Start Route in Google Maps"}
      </button>

      <p className="text-xs text-slate-500">
        Starts at:{" "}
        <span className="font-medium text-slate-700">{activeLeg.origin.name}</span>
      </p>
    </div>
  );
}
