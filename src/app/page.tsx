"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LazyMap from "@/components/LazyMap";
import MapFrame, { MapLegend } from "@/components/MapFrame";
import Icon from "@/components/Icon";
import Ticker from "@/components/Ticker";
import Severity from "@/components/Severity";
import { useSafetyData } from "@/components/useSafetyData";
import { api, timeAgo } from "@/lib/client";
import type { LL } from "@/components/MapView";

type Status = { gemma: { provider: string; model: string }; routing: string; idCheck: boolean };
type Filter = "ALL" | "CANDY" | "INCIDENT";

export default function Home() {
  const { reports, zones, houses, loaded } = useSafetyData();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showHouses, setShowHouses] = useState(true);
  const [focus, setFocus] = useState<LL | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => { api<Status>("/api/status").then(setStatus).catch(() => {}); }, []);

  const shown = useMemo(() => reports.filter((r) => filter === "ALL" || r.type === filter), [reports, filter]);
  const candyCount = reports.filter((r) => r.type === "CANDY").length;
  const stats = [
    { label: "Unsafe candy reports", value: candyCount, tone: "text-danger" },
    { label: "Active incidents", value: reports.length - candyCount, tone: "text-warn" },
    { label: "Houses on the map", value: houses.length, tone: "text-ink" },
    { label: "ID-checked hosts", value: houses.filter((h) => h.verified).length, tone: "text-gold" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid items-end gap-6 pt-2 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow mb-3">Halloween night · live neighbourhood map</p>
          <h1 className="display-xl max-w-[16ch] text-ink">Trick-or-treat, <span className="text-accent-text">safely.</span></h1>
          <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed text-muted">
            Neighbours report unsafe candy and incidents as they happen. Plan a route that steers around them, and
            we&apos;ll warn you if something turns up later along the way you walked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link href="/report" className="btn-danger"><Icon name="flag" size={16} /> Report something</Link>
          <Link href="/plan" className="btn-primary"><Icon name="route" size={16} /> Plan a route</Link>
        </div>
      </section>

      <Ticker reports={reports} />

      <section className="card grid grid-cols-2 gap-y-4 !p-0 md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i > 0 ? "md:border-l" : ""} ${i % 2 ? "border-l" : ""} border-line`}>
            <div className={`num text-3xl font-semibold ${s.tone}`}>{loaded ? s.value : "–"}</div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "CANDY", "INCIDENT"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`chip ${filter === f ? "chip-on" : ""}`}>
                {f !== "ALL" && <Icon name={f === "CANDY" ? "candy" : "alert"} size={14} className={f === "CANDY" ? "text-danger" : "text-warn"} />}
                {f === "ALL" ? "All reports" : f === "CANDY" ? "Candy" : "Incidents"}
              </button>
            ))}
            <button onClick={() => setShowHouses((s) => !s)} aria-pressed={showHouses} className={`chip ${showHouses ? "chip-on" : ""}`}>
              <Icon name="house" size={14} /> Houses
            </button>
          </div>
          <MapFrame className="h-[62vh] min-h-[420px]" title="Live safety map" legend={<MapLegend houses={showHouses} />}>
            <LazyMap className="h-full w-full" reports={shown}
              zones={zones.filter((z) => shown.some((r) => r.id === z.reportId))}
              houses={showHouses ? houses : []} highlight={focus}
              fitTo={focus ? undefined : reports} fitKey={focus ? `${focus.lat},${focus.lng}` : loaded ? `all-${reports.length}` : undefined} />
          </MapFrame>
        </div>

        <aside className="card flex max-h-[calc(62vh+46px)] min-h-[420px] flex-col !p-0">
          <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <h2 className="display-sm">Latest reports</h2>
            <span className="num text-xs text-muted">{shown.length}</span>
          </div>
          {loaded && shown.length === 0 && (
            <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted">
              <div><Icon name="check" size={28} className="mb-2 text-safe" /><p>Nothing reported. Have a good night out.</p></div>
            </div>
          )}
          <ul className="flex-1 overflow-auto p-2">
            {shown.map((r) => (
              <li key={r.id}>
                <button onClick={() => setFocus({ lat: r.lat, lng: r.lng })} className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-2">
                  <span className={`mt-0.5 ${r.type === "CANDY" ? "text-danger" : "text-warn"}`}>
                    <Icon name={r.type === "CANDY" ? "candy" : "alert"} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-muted">{r.placeName.split(",")[0]} · {timeAgo(r.createdAt)}</span>
                  </span>
                  <Severity n={r.severity} />
                </button>
              </li>
            ))}
          </ul>
          {status && (
            <p className="border-t border-line px-5 py-3 text-[11px] text-muted">
              Reports checked by {status.gemma.provider === "none" ? "keyword rules" : <>Gemma <span className="num">{status.gemma.model}</span></>} · routing: {status.routing}
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
