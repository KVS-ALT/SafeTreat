import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { HttpError } from "@/lib/session";

const cache = new Map<string, { at: number; results: unknown }>();

/** Proxy to OpenStreetMap Nominatim (sets a proper User-Agent and caches, per their usage policy). */
export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) throw new HttpError(400, "Type at least 3 characters.");
  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json({ results: hit.results });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": "SafeTreat-demo/0.1 (Halloween safety hackathon app)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new HttpError(502, "Address search is unavailable right now. Tap the map instead.");
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const results = rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
  cache.set(q.toLowerCase(), { at: Date.now(), results });
  return NextResponse.json({ results });
});
