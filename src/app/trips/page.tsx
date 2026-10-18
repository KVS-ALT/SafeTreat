"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";

type TripRow = { id: string; name: string; status: string; startedAt: string | null; endedAt: string | null; createdAt: string; _count: { points: number; alerts: number } };

const STATUS: Record<string, { label: string; tone: string }> = {
  PLANNED: { label: "Planned", tone: "text-muted" },
  ACTIVE: { label: "Out now", tone: "text-safe" },
  DONE: { label: "Finished", tone: "text-ink" },
};

export default function TripsPage() {
  const me = useRequireMe();
  const [trips, setTrips] = useState<TripRow[] | null>(null);

  useEffect(() => { if (me) api<{ trips: TripRow[] }>("/api/trips").then((r) => setTrips(r.trips)); }, [me]);

  if (!trips) return <Loading />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Recorded routes</p>
          <h1 className="display-lg">My trips</h1>
        </div>
        <Link href="/plan" className="btn-primary"><Icon name="plus" size={16} /> Plan a route</Link>
      </div>
      {trips.length === 0 && (
        <div className="card grid place-items-center gap-3 !py-14 text-center">
          <Icon name="route" size={30} className="text-accent-text" />
          <p className="max-w-sm text-muted">No trips yet. Plan a route, then record it while you walk so we can warn you about anything reported later.</p>
          <Link href="/plan" className="btn-primary">Plan your first route</Link>
        </div>
      )}
      <ul className="space-y-2">
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/trips/${t.id}`} className="card group flex items-center gap-4 transition-colors hover:border-line-strong">
              <span className="well grid h-11 w-11 shrink-0 place-items-center text-accent-text"><Icon name="route" size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span className={STATUS[t.status]?.tone}>{STATUS[t.status]?.label ?? t.status}</span>
                  <span className="num">{new Date(t.startedAt ?? t.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="num">{t._count.points} GPS points</span>
                </div>
              </div>
              {t._count.alerts > 0 && <span className="chip border-danger text-danger"><Icon name="bell" size={13} /> {t._count.alerts}</span>}
              <Icon name="arrow" size={16} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
