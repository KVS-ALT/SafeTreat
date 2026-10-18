import type { Feature, LineString } from "geojson";
import { distanceToSegment, haversine, type LatLng } from "./geo";
import { centerOf, toMultiPolygon, zonesContaining, type DangerZone } from "./dangerZones";

export type Waypoint = LatLng & { label: string; houseId?: string };

export type PlannedRoute = {
  line: Feature<LineString>;
  distanceM: number;
  durationS: number;
  engine: "openrouteservice" | "valhalla" | "osm-walking" | "straight-line";
  usedWaypoints: Waypoint[];
  skipped: { waypoint: Waypoint; reason: string }[];
  zonesCrossed: { reportId: string; type: string; title: string; placeName: string }[];
  /** Street names walked, most-walked first (from the router, plus the stops' addresses). */
  streets: string[];
  note?: string;
};

/** Metres walked per street name, as reported by the router. */
type StreetTally = Map<string, number>;
const tally = (t: StreetTally, name: string | undefined, metres: number) => {
  const n = name?.trim();
  if (n) t.set(n, (t.get(n) ?? 0) + metres);
};

const WALK_SPEED_MPS = 1.0; // kids + stops at doors

export async function planSafeRoute(waypoints: Waypoint[], zones: DangerZone[]): Promise<PlannedRoute> {
  const skipped: PlannedRoute["skipped"] = [];
  const used: Waypoint[] = [];
  waypoints.forEach((w, i) => {
    const inside = zonesContaining(w, zones, haversine);
    // Always keep the start (home) even if it is near a report — we just can't avoid it.
    if (inside.length && i !== 0) {
      skipped.push({ waypoint: w, reason: `${inside[0].properties.type === "CANDY" ? "unsafe candy" : "incident"} reported: ${inside[0].properties.title}` });
    } else {
      used.push(w);
    }
  });
  if (used.length < 2) throw new Error("Add at least one stop outside the danger zones.");

  // Zones around the start/stops can't be avoided by the router (ORS errors if a point is inside an avoid polygon).
  const avoidable = zones.filter((z) => !used.some((w) => zonesContaining(w, [z], haversine).length));

  let route: (Omit<PlannedRoute, "usedWaypoints" | "skipped" | "zonesCrossed" | "streets"> & { streetTally?: StreetTally }) | null = null;
  const problems: string[] = [];
  if (process.env.ORS_API_KEY) {
    try {
      route = await orsRoute(used, avoidable);
    } catch (err) {
      problems.push((err as Error).message);
    }
  }
  if (!route) {
    try {
      route = await valhallaRoute(used, avoidable);
    } catch (err) {
      problems.push((err as Error).message);
      console.warn(`[routing] Valhalla failed, trying OSRM: ${(err as Error).message}`);
    }
  }
  if (!route) {
    try {
      route = await osmWalkingRoute(used, avoidable);
    } catch (err) {
      problems.push((err as Error).message);
    }
  }
  const note = route ? undefined : `Walking directions unavailable (${problems.join("; ")}); showing straight lines between stops.`;
  route ??= straightLine(used);

  const { streetTally, ...rest } = route;
  return {
    ...rest,
    usedWaypoints: used,
    skipped,
    zonesCrossed: zonesCrossedBy(route.line, zones),
    streets: rankStreets(streetTally, used.map((w) => w.label)),
    note: route.note ?? note,
  };
}

/** Router streets by distance walked, then streets from stop addresses; de-duplicated across "Dr"/"Drive" spellings. */
export function rankStreets(t: StreetTally | undefined, labels: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = streetKey(name);
    if (key && !seen.has(key)) { seen.add(key); out.push(name); }
  };
  [...(t ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).forEach(([n]) => add(n));
  labels.map(streetFromLabel).forEach((n) => n && add(n));
  return out;
}

const SUFFIX: Record<string, string> = {
  ave: "avenue", st: "street", rd: "road", dr: "drive", crt: "court", ct: "court", cres: "crescent", pl: "place",
  blvd: "boulevard", cir: "circle", trl: "trail", terr: "terrace", ln: "lane", pkwy: "parkway", sq: "square",
  gdns: "gardens", hts: "heights", n: "north", s: "south", e: "east", w: "west",
};
const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** "Archdekin Dr" and "Archdekin Drive" compare equal. */
export function streetKey(name: string) {
  return name.toLowerCase().replace(/[.,]/g, "").split(/\s+/).filter(Boolean).map((w) => SUFFIX[w] ?? w).join(" ");
}

/** "The Garcias — 65 Archdekin Dr, Brampton, ON" → "Archdekin Drive" (spelled out for news searches). */
export function streetFromLabel(label: string): string | null {
  const addr = label.includes(" — ") ? label.split(" — ").pop()! : label;
  const first = addr.split(",")[0].trim();
  const m = first.match(/^\d+[a-z]?\s+(.+)$/i);
  if (!m) return null;
  return m[1].split(/\s+/).map((w) => titleCase(SUFFIX[w.toLowerCase().replace(".", "")] ?? w)).join(" ");
}

/** "…, Brampton, ON" → "Brampton". */
export function cityFromLabels(labels: string[]): string | null {
  for (const l of labels) {
    const parts = l.split(",").map((p) => p.trim());
    if (parts.length >= 3) return parts[parts.length - 2];
  }
  return null;
}

// ---------------------------------------------------------------- keyless street routing: Valhalla

/**
 * Valhalla pedestrian routing on OpenStreetMap, hosted by FOSSGIS (valhalla1.openstreetmap.de, no key, fair use).
 * It avoids areas natively via exclude_polygons, and we penalize driveways, alleys and service roads
 * so kids stay on streets and sidewalks instead of cutting between houses.
 */
const VALHALLA = "https://valhalla1.openstreetmap.de/route";
/** FOSSGIS Valhalla limits exclude_polygons to 100 vertices in total and ~10 km of perimeter. */
const MAX_EXCLUDE_VERTICES = 100;
const MAX_EXCLUDE_PERIMETER_M = 9000;
const OCTAGON = 8;

/** An octagon that fully contains the zone circle (circumradius r / cos(π/8)), as a closed [lng, lat] ring. */
function octagon(z: DangerZone): number[][] {
  const [lng, lat] = centerOf(z);
  const r = z.properties.radiusM / Math.cos(Math.PI / OCTAGON) / 111320;
  const k = Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: OCTAGON }, (_, i) => {
    const t = (2 * Math.PI * i) / OCTAGON + Math.PI / OCTAGON;
    return [lng + (r * Math.cos(t)) / k, lat + r * Math.sin(t)];
  });
  return [...ring, ring[0]];
}

/** FOSSGIS Valhalla accepts at most 10 locations per request, so longer trips go in overlapping chunks. */
const MAX_LOCATIONS = 10;

export async function valhallaRoute(points: Waypoint[], zones: DangerZone[]) {
  const coords: [number, number][] = [];
  const streetTally: StreetTally = new Map();
  let distanceM = 0;
  for (let i = 0; i < points.length - 1; i += MAX_LOCATIONS - 1) {
    const part = await valhallaRequest(points.slice(i, i + MAX_LOCATIONS), zones);
    coords.push(...(coords.length ? part.coords.slice(1) : part.coords));
    distanceM += part.distanceM;
    part.streets.forEach((m, n) => tally(streetTally, n, m));
  }
  return { line: asLine(coords), distanceM, durationS: distanceM / WALK_SPEED_MPS, engine: "valhalla" as const, streetTally };
}

async function valhallaRequest(points: LatLng[], zones: DangerZone[]) {
  // Only zones near the trip matter; keep the most severe ones within Valhalla's limits.
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const pad = 0.006;
  const near = zones.filter((z) => {
    const [lng, lat] = centerOf(z);
    return lat > Math.min(...lats) - pad && lat < Math.max(...lats) + pad && lng > Math.min(...lngs) - pad && lng < Math.max(...lngs) + pad;
  });
  const exclude: number[][][] = [];
  let perimeter = 0;
  for (const z of near.sort((a, b) => b.properties.severity - a.properties.severity)) {
    const p = 2 * Math.PI * z.properties.radiusM * 1.03;
    if ((exclude.length + 1) * (OCTAGON + 1) > MAX_EXCLUDE_VERTICES || perimeter + p > MAX_EXCLUDE_PERIMETER_M) continue;
    perimeter += p;
    exclude.push(octagon(z));
  }
  const res = await fetch(VALHALLA, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "SafeTreat-demo/0.1 (Halloween safety hackathon app)" },
    body: JSON.stringify({
      locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
      costing: "pedestrian",
      costing_options: { pedestrian: { driveway_factor: 10, alley_factor: 5, service_factor: 3, use_tracks: 0, use_ferry: 0 } },
      exclude_polygons: exclude,
      directions_type: "maneuvers",
      units: "kilometers",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    trip?: { summary: { length: number }; legs: { shape: string; maneuvers?: { street_names?: string[]; length: number }[] }[] };
    error?: string;
  };
  if (!res.ok || !data.trip) throw new Error(`Valhalla ${res.status}${data.error ? `: ${data.error}` : ""}`);
  const coords: [number, number][] = [];
  for (const leg of data.trip.legs) {
    const pts = decodePolyline6(leg.shape);
    coords.push(...(coords.length ? pts.slice(1) : pts));
  }
  const streets: StreetTally = new Map();
  for (const leg of data.trip.legs) for (const m of leg.maneuvers ?? []) tally(streets, m.street_names?.[0], m.length * 1000);
  return { coords, distanceM: data.trip.summary.length * 1000, streets };
}

/** Decode a Google-style encoded polyline with 6-digit precision (Valhalla's shape format) into [lng, lat] pairs. */
export function decodePolyline6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}

// ---------------------------------------------------------------- keyless street routing: OSRM backup

/**
 * OSRM "foot" profile on OpenStreetMap data, hosted by FOSSGIS (routing.openstreetmap.de, no key, fair use).
 * It can't avoid areas, so each leg that crosses a danger zone is retried with a detour point
 * on either side of the zone and the best street route is kept.
 */
const OSRM_FOOT = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
const DETOUR_MARGINS_M = [50, 130, 230];
const MAX_DETOURS_PER_LEG = 3;
type OsrmResult = { coords: [number, number][]; distanceM: number; streets: StreetTally };
const osrmCache = new Map<string, OsrmResult>();

async function osrm(points: LatLng[]) {
  const key = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const hit = osrmCache.get(key);
  if (hit) return hit;
  const res = await fetch(`${OSRM_FOOT}/${key}?overview=full&geometries=geojson&steps=true`, {
    headers: { "User-Agent": "SafeTreat-demo/0.1 (Halloween safety hackathon app)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`walking router ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; geometry: { coordinates: [number, number][] }; legs: { steps?: { name: string; distance: number }[] }[] }[];
  };
  if (data.code !== "Ok" || !data.routes?.length) throw new Error(`walking router: ${data.code}`);
  const streets: StreetTally = new Map();
  for (const leg of data.routes[0].legs) for (const st of leg.steps ?? []) tally(streets, st.name, st.distance);
  const out: OsrmResult = { coords: data.routes[0].geometry.coordinates, distanceM: data.routes[0].distance, streets };
  if (osrmCache.size > 500) osrmCache.clear();
  osrmCache.set(key, out);
  return out;
}

/**
 * How bad it is to walk this line, in "metres of detour we'd accept to avoid it":
 * each zone entered costs a flat 600 m plus 25 m per metre walked into it, scaled by severity.
 * So a route that brushes a small candy zone beats one that walks through a severity-4 incident.
 */
export function exposure(coords: [number, number][], zones: DangerZone[]) {
  let cost = 0;
  for (const z of zones) {
    const [lng, lat] = centerOf(z);
    const c = { lat, lng };
    let min = Infinity;
    for (let i = 1; i < coords.length; i++) {
      min = Math.min(min, distanceToSegment(c, { lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }));
    }
    const depth = z.properties.radiusM - EDGE_TOLERANCE_M - min;
    if (depth > 0) cost += (600 + 25 * depth) * (z.properties.severity / 3);
  }
  return cost;
}

const asLine = (coords: [number, number][]): Feature<LineString> => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });

/** Points on either side of a zone, perpendicular to the leg direction, at a few distances outside its edge. */
export function detourCandidates(a: LatLng, b: LatLng, zone: DangerZone): LatLng[] {
  const [lng, lat] = centerOf(zone);
  const k = Math.cos((lat * Math.PI) / 180);
  const dx = (b.lng - a.lng) * k, dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // unit normal (in metre-scaled space)
  return DETOUR_MARGINS_M.flatMap((margin) => {
    const off = (zone.properties.radiusM + margin) / 111320;
    return [1, -1].map((side) => ({ lat: lat + ny * off * side, lng: lng + (nx * off * side) / k }));
  });
}

/** Order via points along the leg so the route doesn't zig-zag back. */
function alongLeg(a: LatLng, b: LatLng, vias: LatLng[]) {
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  return [...vias].sort((p, q) => (p.lng - a.lng) * dx + (p.lat - a.lat) * dy - ((q.lng - a.lng) * dx + (q.lat - a.lat) * dy));
}

export async function safeLeg(a: LatLng, b: LatLng, zones: DangerZone[]) {
  // Zones around either end can't be avoided on this leg.
  const relevant = zones.filter((z) => !zonesContaining(a, [z], haversine).length && !zonesContaining(b, [z], haversine).length);
  const score = (r: OsrmResult) => r.distanceM + exposure(r.coords, relevant);

  let vias: LatLng[] = [];
  let best = await osrm([a, b]);
  for (let i = 0; i < MAX_DETOURS_PER_LEG; i++) {
    // Deal with the worst zone on this leg first.
    const crossed = relevant
      .filter((z) => zonesCrossedBy(asLine(best.coords), [z]).length)
      .sort((x, y) => exposure(best.coords, [y]) - exposure(best.coords, [x]));
    if (!crossed.length) break;
    // Try both sides at the closest margin first; widen only if that didn't help (keeps router calls low).
    const candidates = detourCandidates(a, b, crossed[0]).filter((v) => !zonesContaining(v, relevant, haversine).length);
    let improved = false;
    for (let m = 0; m < candidates.length && !improved; m += 2) {
      const options = await Promise.all(
        candidates.slice(m, m + 2).map(async (v) => {
          const next = alongLeg(a, b, [...vias, v]);
          return { vias: next, route: await osrm([a, ...next, b]).catch(() => null) };
        }),
      );
      const better = options
        .filter((o): o is { vias: LatLng[]; route: OsrmResult } => !!o.route)
        .sort((x, y) => score(x.route) - score(y.route))[0];
      if (better && score(better.route) < score(best)) {
        best = better.route;
        vias = better.vias;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return best;
}

async function osmWalkingRoute(points: Waypoint[], zones: DangerZone[]) {
  const coords: [number, number][] = [];
  const streetTally: StreetTally = new Map();
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    const leg = await safeLeg(points[i - 1], points[i], zones);
    coords.push(...(coords.length ? leg.coords.slice(1) : leg.coords));
    distanceM += leg.distanceM;
    leg.streets.forEach((m, n) => tally(streetTally, n, m));
  }
  return { line: asLine(coords), distanceM, durationS: distanceM / WALK_SPEED_MPS, engine: "osm-walking" as const, streetTally };
}

async function orsRoute(points: Waypoint[], zones: DangerZone[]) {
  const avoid = toMultiPolygon(zones);
  const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
    method: "POST",
    headers: { Authorization: process.env.ORS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      coordinates: points.map((p) => [p.lng, p.lat]),
      ...(avoid ? { options: { avoid_polygons: avoid } } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ORS ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  const fc = (await res.json()) as { features: (Feature<LineString> & { properties: { summary: { distance: number; duration: number } } })[] };
  const f = fc.features[0];
  return {
    line: { type: "Feature", properties: {}, geometry: f.geometry } as Feature<LineString>,
    distanceM: f.properties.summary.distance,
    durationS: f.properties.summary.distance / WALK_SPEED_MPS,
    engine: "openrouteservice" as const,
  };
}

export function straightLine(points: LatLng[]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return {
    line: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) } } as Feature<LineString>,
    distanceM: d * 1.3, // streets are rarely straight
    durationS: (d * 1.3) / WALK_SPEED_MPS,
    engine: "straight-line" as const,
  };
}

/** A route grazing a zone's outer edge is fine; it "crosses" only if it gets this far inside. */
export const EDGE_TOLERANCE_M = 20;

/** Zones the line passes through (closest approach to the report < radius − tolerance). */
export function zonesCrossedBy(line: Feature<LineString>, zones: DangerZone[]) {
  const pts = line.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  return zones
    .filter((z) => {
      const [lng, lat] = centerOf(z);
      const c = { lat, lng };
      const limit = z.properties.radiusM - EDGE_TOLERANCE_M;
      if (pts.length === 1) return haversine(pts[0], c) < limit;
      for (let i = 1; i < pts.length; i++) if (distanceToSegment(c, pts[i - 1], pts[i]) < limit) return true;
      return false;
    })
    .map((z) => ({ reportId: z.properties.reportId, type: z.properties.type, title: z.properties.title, placeName: z.properties.placeName }));
}
