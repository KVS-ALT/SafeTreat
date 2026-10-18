"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import LazyMap from "@/components/LazyMap";
import Loading from "@/components/Loading";
import Severity from "@/components/Severity";
import Icon from "@/components/Icon";
import MapFrame from "@/components/MapFrame";
import { useRequireMe } from "@/components/useMe";
import { api, timeAgo } from "@/lib/client";

type AlertRow = {
  id: string; message: string; distanceM: number; passedAt: string; read: boolean; createdAt: string;
  report: { id: string; title: string; placeName: string; lat: number; lng: number; severity: number; category: string; candyDescription: string | null; createdAt: string };
  trip: { id: string; name: string };
};

export default function AlertsPage() {
  const me = useRequireMe();
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    if (!me) return;
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    api<{ alerts: AlertRow[] }>("/api/alerts").then((r) => {
      setAlerts(r.alerts);
      setOpen(r.alerts.find((a) => !a.read)?.id ?? null);
      const unread = r.alerts.filter((a) => !a.read).map((a) => a.id);
      if (unread.length) api("/api/alerts", { method: "PATCH", body: { ids: unread } }).then(() => window.dispatchEvent(new Event("safetreat:alerts")));
    });
  }, [me]);

  if (!alerts) return <Loading />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div><p className="eyebrow mb-2">Your recorded routes</p><h1 className="display-lg">Alerts</h1></div>
        {perm === "default" && typeof Notification !== "undefined" && (
          <button className="chip ml-auto" onClick={() => Notification.requestPermission().then(setPerm)}><Icon name="bell" size={14} /> Turn on browser notifications</button>
        )}
      </div>
      {alerts.length === 0 && (
        <div className="card grid place-items-center gap-3 !py-14 text-center"><Icon name="check" size={30} className="text-safe" /><p className="max-w-sm text-muted">No alerts. If unsafe candy is ever reported somewhere your recorded trips went, it&apos;ll show up here.</p></div>
      )}
      <ul className="space-y-3">
        {alerts.map((a) => (
          <li key={a.id} className={`card space-y-2 ${!a.read ? "border-danger" : ""}`}>
            <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(open === a.id ? null : a.id)}>
              <span className="well grid h-10 w-10 shrink-0 place-items-center text-danger"><Icon name="candy" size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{a.report.title} {!a.read && <span className="ml-1 rounded bg-danger px-1.5 text-[10px] font-bold text-white">NEW</span>}</div>
                <div className="text-xs text-muted">{a.report.placeName} · trip &quot;{a.trip.name}&quot; · {timeAgo(a.createdAt)}</div>
              </div>
              <Severity n={a.report.severity} />
            </button>
            <p className="text-sm">{a.message}</p>
            {open === a.id && (
              <>
                <MapFrame className="h-64">
                  <LazyMap className="h-full w-full" center={[a.report.lat, a.report.lng]} zoom={17}
                    reports={[{ ...a.report, type: "CANDY", aiSummary: "" }]} highlight={{ lat: a.report.lat, lng: a.report.lng }} />
                </MapFrame>
                <div className="flex gap-2 text-xs">
                  <Link href={`/trips/${a.trip.id}`} className="chip">View trip route <Icon name="arrow" size={13} /></Link>
                  <span className="text-muted">You passed within {Math.round(a.distanceM)} m at {new Date(a.passedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name="phone" size={13} /> If a child ate something suspicious and feels unwell, call the Ontario Poison Centre at 1-800-268-9017 or 911.</p>
    </div>
  );
}
