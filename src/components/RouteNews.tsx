"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import Severity from "./Severity";
import { api, timeAgo } from "@/lib/client";
import type { RouteNewsResult } from "@/lib/news";

/** "Local news near this route": loads after the route so it never slows planning down. */
export default function RouteNews({ streets = [], labels }: { streets?: string[]; labels: string[] }) {
  const [data, setData] = useState<RouteNewsResult | null>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify([streets, labels]);

  useEffect(() => {
    let stop = false;
    setData(null);
    setFailed(false);
    api<RouteNewsResult>("/api/route-news", { method: "POST", body: { streets, labels } })
      .then((r) => { if (!stop) setData(r); })
      .catch(() => { if (!stop) setFailed(true); });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <section className="card space-y-3 !p-6" aria-live="polite">
      <h2 className="display-sm inline-flex items-center gap-2"><Icon name="search" /> Local news near this route</h2>

      {!data && !failed && (
        <div className="space-y-2" aria-busy="true">
          <p className="text-sm text-muted">Checking recent news for the streets on your route…</p>
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      )}

      {(failed || data?.unavailable) && <p className="text-sm text-muted">Couldn&apos;t check the news right now. Try planning again in a minute.</p>}

      {data && !data.unavailable && data.articles.length === 0 && (
        <p className="flex items-start gap-2 text-sm">
          <Icon name="check" size={16} className="mt-0.5 text-safe" />
          <span>
            No recent news about danger along these streets
            <span className="text-muted"> (checked {data.checked.streets.length} street{data.checked.streets.length === 1 ? "" : "s"}{data.checked.city ? ` in ${data.checked.city}` : ""}, last {data.checked.days} days)</span>.
          </span>
        </p>
      )}

      {data && data.articles.length > 0 && (
        <ul className="space-y-2">
          {data.articles.map((a) => (
            <li key={a.url} className="well p-3">
              <div className="flex items-start gap-2">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-sm font-semibold hover:text-accent-text">
                  {a.title}
                </a>
                <Severity n={a.severity} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {a.outlet}{a.publishedAt && <> · {timeAgo(a.publishedAt)}</>}{a.street && <> · <span className="text-ink">{a.street}</span></>}
                {!a.verified && <> · <span className="text-warn">unverified match</span></>}
              </p>
              {a.summary && <p className="mt-1.5 text-sm">{a.summary}</p>}
            </li>
          ))}
        </ul>
      )}

      {data && !data.unavailable && data.checked.streets.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Streets checked</summary>
          <p className="mt-1">{data.checked.streets.join(" · ")}</p>
        </details>
      )}
      <p className="text-[11px] text-muted">
        From Google News{data?.source === "gemma" ? ", checked by Gemma" : ""}. Matched by street name, so a story may be from another part of a long street.
      </p>
    </section>
  );
}
