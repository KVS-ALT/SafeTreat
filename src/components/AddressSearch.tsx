"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export type GeoResult = { label: string; lat: number; lng: number };

export default function AddressSearch({ onPick, placeholder }: { onPick: (r: GeoResult) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Not a <form>: this sits inside other forms (report, house), and forms can't nest.
  async function search() {
    if (q.trim().length < 3) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ results: GeoResult[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      setResults(r.results);
      if (!r.results.length) setErr("No matches. Try adding the city, or tap the map instead.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? "Search an address…"}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" className="btn-ghost shrink-0" disabled={busy} onClick={search}>{busy ? "…" : "Search"}</button>
      </div>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      {results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface shadow-xl">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => { onPick(r); setResults([]); setQ(r.label.split(",").slice(0, 2).join(",")); }}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
