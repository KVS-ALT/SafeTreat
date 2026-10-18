"use client";
import Link from "next/link";
import { useState } from "react";
import LazyMap from "@/components/LazyMap";
import AddressSearch from "@/components/AddressSearch";
import Severity from "@/components/Severity";
import Icon from "@/components/Icon";
import MapFrame, { MapLegend } from "@/components/MapFrame";
import { useSafetyData } from "@/components/useSafetyData";
import { api } from "@/lib/client";
import type { LL } from "@/components/MapView";

type Created = {
  report: { id: string; status: string; severity: number; category: string; aiSummary: string; aiSource: string };
  alertsCreated: number;
  housesFlagged: number;
};

export default function ReportPage() {
  const { reports, zones } = useSafetyData({ houses: false });
  const [type, setType] = useState<"CANDY" | "INCIDENT">("CANDY");
  const [pick, setPick] = useState<LL | null>(null);
  const [center, setCenter] = useState<[number, number] | undefined>();
  const [placeName, setPlaceName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [candyDescription, setCandy] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Created | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) return setErr("Your browser can't share location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPick(p);
        setCenter([p.lat, p.lng]);
      },
      () => setErr("Couldn't get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) return setErr("Tap the map (or search) to mark where it happened.");
    setBusy(true);
    setErr("");
    try {
      const r = await api<Created>("/api/reports", {
        method: "POST",
        body: { type, title, description, placeName, candyDescription: type === "CANDY" ? candyDescription : null, lat: pick.lat, lng: pick.lng },
      });
      setDone(r);
      window.dispatchEvent(new Event("safetreat:alerts"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const hidden = done.report.status === "HIDDEN";
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <div className="card space-y-3">
          <p className="eyebrow">{hidden ? "Held for review" : "Report posted"}</p>
          <h1 className="display-lg">{hidden ? "Report received" : "Thanks. Neighbours can see it now."}</h1>
          {hidden ? (
            <p className="text-muted">Our checker thinks this might not be a real safety report, so it&apos;s held back from the map.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Severity n={done.report.severity} />
                <span className="text-muted">{done.report.category.replaceAll("_", " ")}</span>
                <span className="ml-auto text-[11px] text-muted">first check: keyword rules · Gemma is reviewing</span>
              </div>
              <p className="italic">{done.report.aiSummary}</p>
              {done.alertsCreated > 0 && <p className="flex items-start gap-2 text-safe"><Icon name="bell" size={16} className="mt-0.5" />We&apos;ve warned {done.alertsCreated} famil{done.alertsCreated === 1 ? "y" : "ies"} whose trick-or-treat route passed this spot.</p>}
              {done.housesFlagged > 0 && <p className="flex items-start gap-2 text-accent-text"><Icon name="house" size={16} className="mt-0.5" />A registered house here has been flagged and removed from route suggestions.</p>}
            </>
          )}
          <p className="well p-3 text-sm text-muted">
            If someone is hurt or in danger, call <b className="text-ink">911</b>. If a child ate something suspicious, call the Ontario Poison Centre at{" "}
            <b className="text-ink">1-800-268-9017</b>. Keep the candy and wrapper for police.
          </p>
          <div className="flex gap-2">
            <Link href="/" className="btn-primary"><Icon name="map" size={16} /> See the map</Link>
            <button className="btn-ghost" onClick={() => { setDone(null); setTitle(""); setDescription(""); setCandy(""); setPick(null); }}>Report another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[440px_1fr]">
      <form onSubmit={submit} className="card space-y-5 !p-6">
        <div>
          <p className="eyebrow mb-2">No account needed</p>
          <h1 className="display-lg">Report a problem</h1>
          <p className="mt-2 text-sm text-muted">Reports show on the map right away and warn families whose recorded route went past.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["CANDY", "INCIDENT"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)} aria-pressed={type === t}
              className={`well border p-3 text-left transition-colors ${type === t ? "!border-accent !bg-accent/10" : "border-line hover:border-line-strong"}`} style={{ borderWidth: "var(--border-w)" }}>
              <Icon name={t === "CANDY" ? "candy" : "alert"} size={22} className={t === "CANDY" ? "text-danger" : "text-warn"} />
              <div className="mt-2 text-sm font-semibold">{t === "CANDY" ? "Unsafe candy" : "Incident"}</div>
              <div className="text-xs text-muted">{t === "CANDY" ? "tampered, drugs, allergens…" : "traffic, threats, hazards…"}</div>
            </button>
          ))}
        </div>

        <div>
          <label className="label">Where?</label>
          <AddressSearch placeholder="Address or party location…" onPick={(r) => {
            setPick({ lat: r.lat, lng: r.lng });
            setCenter([r.lat, r.lng]);
            if (!placeName) setPlaceName(r.label.split(",").slice(0, 2).join(","));
          }} />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <button type="button" className="chip" onClick={useMyLocation}><Icon name="locate" size={14} /> Use my location</button>
            <span>{pick ? `Pinned at ${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)}` : "…or tap the map"}</span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="place">House / party name</label>
          <input id="place" className="input" required value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder='e.g. "Party at 412 Elm St" or "Corner of Elm & 5th"' />
        </div>
        <div>
          <label className="label" htmlFor="title">What happened? (short)</label>
          <input id="title" className="input" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "CANDY" ? "Chocolate bar with a pinhole in the wrapper" : "Car speeding through crowd of kids"} />
        </div>
        {type === "CANDY" && (
          <div>
            <label className="label" htmlFor="candy">The candy</label>
            <input id="candy" className="input" value={candyDescription} onChange={(e) => setCandy(e.target.value)} placeholder="Brand, size, wrapper colour…" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="desc">Details</label>
          <textarea id="desc" className="input min-h-24" required minLength={5} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you notice? When? Don't include anyone's name." />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn-danger w-full" disabled={busy}><Icon name="flag" size={16} /> {busy ? "Posting…" : "Submit report"}</button>
        <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name="phone" size={13} /> Someone in danger? Call 911 first.</p>
      </form>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <MapFrame className="h-[50vh] lg:h-[calc(100dvh-8rem)]" title={pick ? "Pinned. Tap to move" : "Tap where it happened"} legend={<MapLegend houses={false} />}>
          <LazyMap className="h-full w-full" reports={reports} zones={zones} pick={pick} center={center} onMapClick={(p) => setPick(p)} />
        </MapFrame>
      </div>
    </div>
  );
}
