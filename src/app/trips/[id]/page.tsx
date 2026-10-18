"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LazyMap from "@/components/LazyMap";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import { useSafetyData } from "@/components/useSafetyData";
import { api } from "@/lib/client";
import { haversine, type LatLng } from "@/lib/geo";
import Icon from "@/components/Icon";
import MapFrame, { MapLegend } from "@/components/MapFrame";
import RouteNews from "@/components/RouteNews";

type P = LatLng & { recordedAt: string };
type TripData = {
  trip: { id: string; name: string; status: "PLANNED" | "ACTIVE" | "DONE"; startedAt: string | null; endedAt: string | null;
    plannedRoute: { geometry: { coordinates: [number, number][] } } | null; waypoints: (LatLng & { label: string })[] };
  points: P[];
  alerts: { id: string; message: string; distanceM: number; passedAt: string; report: LatLng & { title: string; placeName: string } }[];
};

const FLUSH_MS = 15000;
const MIN_MOVE_M = 15;

export default function TripPage() {
  const me = useRequireMe();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { reports, zones } = useSafetyData({ houses: false });
  const [data, setData] = useState<TripData | null>(null);
  const [track, setTrack] = useState<P[]>([]);
  const [here, setHere] = useState<LatLng | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const buffer = useRef<P[]>([]);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    const d = await api<TripData>(`/api/trips/${id}`);
    setData(d);
    setTrack(d.points);
    return d;
  }, [id]);

  useEffect(() => {
    if (me) load().then(() => setFitKey((k) => k + 1)).catch((e) => setErr(e.message));
  }, [me, load]);

  const flush = useCallback(async () => {
    if (!buffer.current.length) return;
    const pts = buffer.current;
    buffer.current = [];
    try {
      await api(`/api/trips/${id}/points`, { method: "POST", body: { points: pts } });
    } catch {
      buffer.current = [...pts, ...buffer.current]; // retry next time (e.g. patchy signal)
    }
  }, [id]);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return setErr("This browser can't share location. Try 'Simulate walk' instead.");
    if (watchId.current !== null) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {});
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: P = { lat: pos.coords.latitude, lng: pos.coords.longitude, recordedAt: new Date(pos.timestamp).toISOString() };
        setHere(p);
        setTrack((t) => {
          const last = t[t.length - 1];
          if (last && haversine(last, p) < MIN_MOVE_M) return t;
          buffer.current.push(p);
          return [...t, p];
        });
      },
      (e) => setErr(`Location error: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }, []);

  // While active: keep watching GPS and flush points regularly.
  useEffect(() => {
    if (data?.trip.status !== "ACTIVE" || simulating) return;
    startWatching();
    const t = setInterval(flush, FLUSH_MS);
    return () => { clearInterval(t); flush(); stopWatching(); };
  }, [data?.trip.status, simulating, startWatching, stopWatching, flush]);

  const insideZone = useMemo(() => {
    if (!here) return null;
    const z = zones.find((z) => haversine(here, z) <= z.radiusM);
    return z ? reports.find((r) => r.id === z.reportId) ?? null : null;
  }, [here, zones, reports]);

  async function start() {
    setErr("");
    await api(`/api/trips/${id}`, { method: "PATCH", body: { action: "start" } });
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    await load();
  }

  async function finish() {
    stopWatching();
    await flush();
    const r = await api<{ alertsCreated: number }>(`/api/trips/${id}`, { method: "PATCH", body: { action: "finish" } });
    setMsg(r.alertsCreated
      ? `Trip saved. ${r.alertsCreated} place${r.alertsCreated > 1 ? "s" : ""} you passed already had unsafe candy reports — see below.`
      : "Trip saved. We'll keep watching and alert you if unsafe candy is reported anywhere you walked.");
    window.dispatchEvent(new Event("safetreat:alerts"));
    await load();
  }

  /** Demo mode: replay the planned route as if the walk happened over the last ~hour. */
  async function simulate() {
    const coords = data?.trip.plannedRoute?.geometry.coordinates;
    if (!coords || coords.length < 2) return setErr("This trip has no planned route to simulate.");
    setSimulating(true);
    setErr("");
    await api(`/api/trips/${id}`, { method: "PATCH", body: { action: "start" } });
    await load();
    const pts = densify(coords.map(([lng, lat]) => ({ lat, lng })), 20);
    const stepMs = 25000; // ~20 m every 25 s ≈ kid pace with door stops
    const t0 = Date.now() - pts.length * stepMs;
    const timed: P[] = pts.map((p, i) => ({ ...p, recordedAt: new Date(t0 + i * stepMs).toISOString() }));
    setTrack([]);
    const batch = Math.max(1, Math.ceil(timed.length / 40)); // animate in ~40 frames
    for (let i = 0; i < timed.length; i += batch) {
      const chunk = timed.slice(i, i + batch);
      await api(`/api/trips/${id}/points`, { method: "POST", body: { points: chunk } });
      setTrack((t) => [...t, ...chunk]);
      setHere(chunk[chunk.length - 1]);
      await new Promise((r) => setTimeout(r, 120));
    }
    await finish();
    setSimulating(false); // only after finishing, so the real-GPS effect never kicks in
  }

  async function reset() {
    await api(`/api/trips/${id}`, { method: "PATCH", body: { action: "reset" } });
    setMsg("");
    setHere(null);
    await load();
  }

  async function remove() {
    if (!confirm("Delete this trip and its recorded route?")) return;
    await api(`/api/trips/${id}`, { method: "DELETE" });
    router.push("/trips");
  }

  if (err && !data) return <p className="text-danger">{err}</p>;
  if (!data) return <Loading />;
  const { trip } = data;
  const planned = trip.plannedRoute?.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
      <div className="space-y-4">
        <div className="card space-y-4 !p-6">
          <Link href="/trips" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"><Icon name="back" size={13} /> My trips</Link>
          <h1 className="display-lg">{trip.name}</h1>
          <p className="text-sm text-muted">{trip.waypoints.length - 1} stops · {track.length} GPS points recorded</p>

          {trip.status === "PLANNED" && (
            <>
              <button className="btn-primary w-full" onClick={start}><Icon name="play" size={16} /> Start trick-or-treating</button>
              <button className="btn-ghost w-full" onClick={simulate} disabled={simulating}><Icon name="forward" size={16} /> Simulate walk (demo)</button>
              <p className="text-xs text-muted">We record your location while the trip is running so we can warn you later. Keep this page open; your screen stays on.</p>
            </>
          )}
          {trip.status === "ACTIVE" && (
            <>
              <div className="flex items-center gap-2 text-safe"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-safe" /> {simulating ? "Simulating walk…" : "Recording your route"}</div>
              {insideZone && (
                <div className="rounded-xl border border-danger bg-danger/15 p-3 text-sm">
                  <b className="text-danger">You&apos;re near a reported problem:</b> {insideZone.title} ({insideZone.placeName}). Consider skipping this area.
                </div>
              )}
              {!simulating && <button className="btn-primary w-full" onClick={finish}><Icon name="stop" size={16} /> Finish trip</button>}
            </>
          )}
          {trip.status === "DONE" && (
            <p className="flex items-start gap-2 text-sm"><Icon name="check" size={16} className="mt-0.5 text-safe" /><span>Finished {trip.endedAt && new Date(trip.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. We&apos;re watching for new reports along your route.</span></p>
          )}
          {msg && <p className="well p-3 text-sm">{msg}</p>}
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-3 border-t border-line pt-3 text-xs text-muted">
            {trip.status !== "PLANNED" && <button className="underline" onClick={reset}>Reset recording</button>}
            <button className="underline hover:text-danger" onClick={remove}>Delete trip</button>
          </div>
        </div>

        <RouteNews labels={trip.waypoints.map((w) => w.label)} />

        {data.alerts.length > 0 && (
          <div className="card space-y-3 !border-danger">
            <h2 className="display-sm inline-flex items-center gap-2 text-danger"><Icon name="bell" /> Alerts for this trip</h2>
            {data.alerts.map((a) => (
              <div key={a.id} className="well p-3 text-sm">
                <div className="font-semibold">{a.report.title}</div>
                <div className="text-xs text-muted">{a.report.placeName} · passed within {Math.round(a.distanceM)} m at {new Date(a.passedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                <p className="mt-1">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <MapFrame className="h-[60vh] lg:h-[calc(100dvh-8rem)]" legend={<MapLegend houses={false} track />}
          title={trip.status === "ACTIVE" ? (simulating ? "Simulating walk" : "Recording") : undefined}>
          <LazyMap className="h-full w-full" reports={reports} zones={zones}
            plannedRoute={planned} track={track.map((p) => [p.lat, p.lng] as [number, number])} waypoints={trip.waypoints} me={here} fitKey={fitKey} />
        </MapFrame>
      </div>
    </div>
  );
}

/** Add points along each segment so there is one at least every `stepM` metres. */
function densify(pts: LatLng[], stepM: number): LatLng[] {
  const out: LatLng[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(haversine(a, b) / stepM));
    for (let k = 1; k <= n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lng: a.lng + ((b.lng - a.lng) * k) / n });
  }
  return out;
}
