"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import LazyMap from "@/components/LazyMap";
import AddressSearch from "@/components/AddressSearch";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import { useSafetyData } from "@/components/useSafetyData";
import { api } from "@/lib/client";
import { ALLERGENS, houseConflictReason } from "@/lib/allergens";
import type { LL } from "@/components/MapView";
import Icon from "@/components/Icon";
import MapFrame, { MapLegend } from "@/components/MapFrame";
import RouteNews from "@/components/RouteNews";

type Stop = LL & { label: string; houseId?: string };
type Route = {
  line: { type: "Feature"; geometry: { type: "LineString"; coordinates: [number, number][] } };
  distanceM: number; durationS: number; engine: string; note?: string;
  usedWaypoints: Stop[]; skipped: { waypoint: Stop; reason: string }[]; zonesCrossed: { reportId: string; type: string; title: string; placeName: string }[];
  streets: string[];
};
type PlanResp = { route: Route; suggestionNotes: { houseId: string; displayName: string; reason: string }[] };

export default function PlanPage() {
  const me = useRequireMe();
  const router = useRouter();
  const { reports, zones, houses } = useSafetyData();
  const [home, setHome] = useState<Stop | null>(null);
  const [movingHome, setMovingHome] = useState(false);
  const [mode, setMode] = useState<"suggest" | "pick">("suggest");
  const [stops, setStops] = useState<Stop[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [radiusM, setRadius] = useState(600);
  const [maxStops, setMaxStops] = useState(10);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [atTime, setAtTime] = useState("18:00");
  const [loop, setLoop] = useState(true);
  const [plan, setPlan] = useState<PlanResp | null>(null);
  const [tripName, setTripName] = useState("Halloween night 🎃");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fitKey, setFitKey] = useState(0);

  useEffect(() => { if (me) setAllergens(me.childAllergens); }, [me]);

  // Dim houses that don't suit this child, so parents see why before planning.
  const annotated = useMemo(() => houses.map((h) => ({
    ...h,
    selected: stops.some((s) => s.houseId === h.id) || plan?.route.usedWaypoints.some((w) => w.houseId === h.id),
    dimReason: h.safetyFlag === "REPORTED" ? "unsafe candy reported here" : verifiedOnly && !h.verified ? "ID not checked" : houseConflictReason(h, allergens),
  })), [houses, stops, plan, allergens, verifiedOnly]);

  if (!me) return <Loading />;

  function toggleAllergen(a: string) {
    const next = allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a];
    setAllergens(next);
    api("/api/me", { method: "PATCH", body: { childAllergens: next } }).catch(() => {});
  }

  function onMapClick(p: LL) {
    if (!home || movingHome) {
      setHome({ ...p, label: "Home" });
      setMovingHome(false);
      setPlan(null);
      return;
    }
    if (mode === "pick") {
      setStops((s) => [...s, { ...p, label: `Stop at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` }]);
      setPlan(null);
    }
  }

  function onHouseClick(id: string) {
    const h = houses.find((x) => x.id === id);
    if (!h) return;
    if (!home) return setErr("Set your starting point first.");
    setMode("pick");
    setStops((s) => (s.some((x) => x.houseId === id) ? s.filter((x) => x.houseId !== id) : [...s, { lat: h.lat, lng: h.lng, label: `${h.displayName} — ${h.address}`, houseId: h.id }]));
    setPlan(null);
  }

  async function makePlan() {
    if (!home) return setErr("Set your starting point first (search or tap the map).");
    setBusy(true);
    setErr("");
    try {
      const body = mode === "suggest"
        ? { home, loop, suggest: { childAllergens: allergens, radiusM, maxStops, verifiedOnly, atTime } }
        : { home, loop, stops };
      const r = await api<PlanResp>("/api/route-plan", { method: "POST", body });
      setPlan(r);
      setFitKey((k) => k + 1);
    } catch (e) {
      setErr((e as Error).message);
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveTrip() {
    if (!plan) return;
    setBusy(true);
    try {
      const { trip } = await api<{ trip: { id: string } }>("/api/trips", {
        method: "POST",
        body: { name: tripName || "Trick-or-treat", plannedRoute: plan.route.line, waypoints: plan.route.usedWaypoints },
      });
      router.push(`/trips/${trip.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const route = plan?.route;
  const routeLatLng = route?.line.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  const pickedOrder = route ? route.usedWaypoints : home ? [home, ...stops] : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <div className="card space-y-5 !p-6">
          <div>
            <p className="eyebrow mb-2">Route planner</p>
            <h1 className="display-lg">Plan a safe route</h1>
          </div>
          <div>
            <label className="label">1 · Start from</label>
            <AddressSearch placeholder="Your home address…" onPick={(r) => { setHome({ lat: r.lat, lng: r.lng, label: r.label.split(",")[0] }); setPlan(null); setFitKey((k) => k + 1); }} />
            <p className="mt-1 text-xs text-muted">
              {home ? <><Icon name="house" size={13} className="mr-1 align-[-2px]" />{home.label} · <button className="text-accent-text underline" onClick={() => setMovingHome(true)}>{movingHome ? "tap the map…" : "move"}</button></> : "…or tap the map where you'll start."}
            </p>
          </div>
          <div>
            <label className="label">2 · Your child&apos;s allergies</label>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => <button key={a.code} onClick={() => toggleAllergen(a.code)} className={`chip ${allergens.includes(a.code) ? "chip-on" : ""}`}>{a.label}</button>)}
            </div>
          </div>
          <div>
            <label className="label">3 · Stops</label>
            <div className="segmented mb-4">
              {(["suggest", "pick"] as const).map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); setPlan(null); }} className="inline-flex items-center justify-center gap-2">
                  <Icon name={m === "suggest" ? "sparkle" : "pin"} size={15} /> {m === "suggest" ? "Suggest for me" : "I'll pick"}
                </button>
              ))}
            </div>
            {mode === "suggest" ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between"><span>Walk up to</span><b className="num">{radiusM} m from home</b></div>
                  <input type="range" min={200} max={1500} step={50} value={radiusM} onChange={(e) => setRadius(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <div className="flex justify-between"><span>Up to</span><b className="num">{maxStops} houses</b></div>
                  <input type="range" min={3} max={25} value={maxStops} onChange={(e) => setMaxStops(+e.target.value)} className="w-full" />
                </div>
                <div className="flex items-center justify-between"><span>Heading out at</span><input type="time" className="input w-32" value={atTime} onChange={(e) => setAtTime(e.target.value)} /></div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> <Icon name="seal" size={15} className="text-gold" /> ID-checked hosts only</label>
              </div>
            ) : (
              <div className="text-sm">
                <p className="text-muted">Tap houses on the map (or any spot) to add stops.</p>
                {stops.length > 0 && (
                  <ol className="mt-2 space-y-1">
                    {stops.map((s, i) => (
                      <li key={i} className="well flex items-center gap-2 px-2 py-1.5">
                        <span className="num grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</span>
                        <span className="flex-1 truncate">{s.label}</span>
                        <button className="text-muted hover:text-danger" onClick={() => { setStops((x) => x.filter((_, j) => j !== i)); setPlan(null); }} aria-label="Remove stop"><Icon name="x" size={14} /></button>
                      </li>
                    ))}
                  </ol>
                )}
                {stops.length > 2 && home && <button className="chip mt-2" onClick={() => { setStops(nearestNeighbour(home, stops)); setPlan(null); }}><Icon name="route" size={14} /> Optimize order</button>}
              </div>
            )}
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Finish back home</label>
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn-primary w-full" onClick={makePlan} disabled={busy || !home}><Icon name="route" size={16} /> {busy ? "Finding a safe way…" : "Plan safe route"}</button>
        </div>

        {route && plan && (
          <div className="card space-y-4 !p-6">
            <RouteSafety crossed={route.zonesCrossed} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="well p-3"><div className="num text-xl font-semibold">{(route.distanceM / 1000).toFixed(1)} km</div><div className="text-[11px] text-muted">distance</div></div>
              <div className="well p-3"><div className="num text-xl font-semibold">{Math.round(route.durationS / 60)} min</div><div className="text-[11px] text-muted">walking*</div></div>
              <div className="well p-3"><div className="num text-xl font-semibold">{route.usedWaypoints.filter((w) => w.houseId).length}</div><div className="text-[11px] text-muted">houses</div></div>
            </div>
            {route.engine === "straight-line" ? (
              <p className="well flex items-start gap-2 border border-warn p-3 text-sm text-warn" style={{ borderWidth: "var(--border-w)" }}>
                <Icon name="alert" size={16} className="mt-0.5" />
                <span>Walking directions are unavailable right now, so this shows straight lines between stops, not real streets. Try again in a minute.</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted">*at kid pace, not counting time at doors. Walking directions from {route.engine === "openrouteservice" ? "OpenRouteService" : "OpenStreetMap"}.</p>
            )}
            {route.skipped.length > 0 && (
              <div className="text-sm"><div className="label">Skipped stops</div>
                <ul className="space-y-1">{route.skipped.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-accent-text"><Icon name="x" size={14} className="mt-0.5" /> <span>{s.waypoint.label} — {s.reason}</span></li>)}</ul>
              </div>
            )}
            {plan.suggestionNotes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">{plan.suggestionNotes.length} nearby houses left out — why?</summary>
                <ul className="mt-1 space-y-0.5 text-xs text-muted">{plan.suggestionNotes.map((n) => <li key={n.houseId}>{n.displayName}: {n.reason}</li>)}</ul>
              </details>
            )}
            <div>
              <label className="label" htmlFor="tn">Trip name</label>
              <input id="tn" className="input" value={tripName} onChange={(e) => setTripName(e.target.value)} />
            </div>
            <button className="btn-primary w-full" onClick={saveTrip} disabled={busy}>Save trip and get ready <Icon name="arrow" size={16} /></button>
            <p className="text-xs text-muted">We&apos;ll record where you actually walk so we can warn you if unsafe candy is reported along the way. <Link href="/trips" className="underline">My trips</Link></p>
          </div>
        )}

        {route && <RouteNews streets={route.streets} labels={route.usedWaypoints.map((w) => w.label)} />}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <MapFrame className="h-[60vh] lg:h-[calc(100dvh-8rem)]" legend={<MapLegend route={!!route} />}
          title={!home || movingHome ? "Tap to set your start" : mode === "pick" && !route ? "Tap houses to add stops" : undefined}>
          <LazyMap className="h-full w-full" reports={reports} zones={zones} houses={annotated}
            route={routeLatLng} waypoints={pickedOrder} onMapClick={onMapClick} onHouseClick={onHouseClick} fitKey={fitKey} />
        </MapFrame>
      </div>
    </div>
  );
}

/** Incidents on the route are a real warning; walking past a reported house without stopping is just a heads-up. */
function RouteSafety({ crossed }: { crossed: Route["zonesCrossed"] }) {
  const incidents = crossed.filter((z) => z.type !== "CANDY");
  const candy = crossed.filter((z) => z.type === "CANDY");
  if (!crossed.length) {
    return <p className="inline-flex items-center gap-2 font-semibold text-safe"><Icon name="check" /> Route avoids every reported danger zone</p>;
  }
  return (
    <div className="space-y-2 text-sm">
      {incidents.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-2 font-semibold text-danger"><Icon name="alert" /> Passes {incidents.length} incident area{incidents.length > 1 ? "s" : ""}</p>
          <ul className="mt-1 space-y-0.5 text-danger">{incidents.map((z) => <li key={z.reportId}>Near {z.placeName.split(",")[0]}: {z.title}</li>)}</ul>
        </div>
      )}
      {candy.length > 0 && (
        <div>
          <p className={`inline-flex items-center gap-2 font-semibold ${incidents.length ? "text-warn" : "text-safe"}`}>
            <Icon name={incidents.length ? "candy" : "check"} /> {incidents.length ? "" : "No incident areas. "}Walks past {candy.length} reported house{candy.length > 1 ? "s" : ""} without stopping
          </p>
          <ul className="mt-1 space-y-0.5 text-muted">{candy.map((z) => <li key={z.reportId}>{z.placeName.split(",")[0]}: {z.title}. Don&apos;t take candy here.</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function dist(a: LL, b: LL) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat), (a.lng - b.lng) * k);
}

function nearestNeighbour(start: LL, pts: Stop[]) {
  const left = [...pts];
  const out: Stop[] = [];
  let cur: LL = start;
  while (left.length) {
    left.sort((a, b) => dist(cur, a) - dist(cur, b));
    cur = left.shift()!;
    out.push(cur as Stop);
  }
  return out;
}
