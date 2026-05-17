"use client";

export default function RouteLauncher({
  legs,
  currentLegIndex,
  buildMapsUrl,
  onAdvance,
  onReset,
}) {
  const totalLegs = legs.length;
  const allLegsDone = currentLegIndex >= totalLegs;
  const activeLeg = allLegsDone ? null : legs[currentLegIndex];

  function handleLaunch() {
    if (!activeLeg) return;
    const url = buildMapsUrl({
      origin: activeLeg.origin,
      destination: activeLeg.destination,
      waypoints: activeLeg.waypoints,
    });
    window.open(url, "_blank", "noopener,noreferrer");
    onAdvance();
  }

  if (allLegsDone) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm text-center space-y-3">
        <p className="text-base font-semibold text-emerald-800">
          All {totalLegs} {totalLegs === 1 ? "leg" : "legs"} launched
        </p>
        <p className="text-sm text-emerald-700">
          Tap Restart to send the route again.
        </p>
        <button
          onClick={onReset}
          className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 cursor-pointer"
        >
          Restart from leg 1
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {totalLegs > 1 && (
        <p className="text-xs text-slate-500">
          Google Maps supports up to 9 stops per route. Your{" "}
          {legs.reduce((n, l) => n + l.stops.length, 0)} outlets are split into {totalLegs} legs.
        </p>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">
          Leg {currentLegIndex + 1} of {totalLegs}
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
        Start Route in Google Maps
      </button>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="truncate">
          Starts at:{" "}
          <span className="font-medium text-slate-700">{activeLeg.origin.name}</span>
        </span>
        {currentLegIndex > 0 && (
          <button
            onClick={onReset}
            className="text-slate-500 underline underline-offset-2 hover:text-slate-700 cursor-pointer shrink-0 ml-3"
          >
            Restart from leg 1
          </button>
        )}
      </div>

      {currentLegIndex + 1 < totalLegs && (
        <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
          After this leg, return here to launch leg {currentLegIndex + 2} of {totalLegs} (starts at{" "}
          <span className="font-medium text-slate-700">{activeLeg.destination.name}</span>).
        </p>
      )}
    </div>
  );
}
