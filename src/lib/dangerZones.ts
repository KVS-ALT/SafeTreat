import { circle } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { LatLng } from "./geo";

export type ZoneSource = { id: string; type: string; lat: number; lng: number; severity: number; title: string; placeName: string };
export type DangerZone = Feature<Polygon, { reportId: string; type: string; severity: number; radiusM: number; title: string; placeName: string }>;

/**
 * Candy is a problem at one door, so its zone just covers that house and its neighbours (35–55 m).
 * Incidents (traffic, someone following kids, a loose dog) affect the street: 60–140 m.
 */
export const zoneRadius = (severity: number, type: string = "INCIDENT") => {
  const s = Math.min(5, Math.max(1, severity));
  return type === "CANDY" ? 30 + 5 * s : 40 + 20 * s;
};

export function buildDangerZones(reports: ZoneSource[]): DangerZone[] {
  return reports.map((r) => {
    const radiusM = zoneRadius(r.severity, r.type);
    return circle([r.lng, r.lat], radiusM / 1000, {
      steps: 20,
      units: "kilometers",
      properties: { reportId: r.id, type: r.type, severity: r.severity, radiusM, title: r.title, placeName: r.placeName },
    }) as DangerZone;
  });
}

export function toMultiPolygon(zones: DangerZone[]): MultiPolygon | null {
  if (!zones.length) return null;
  return { type: "MultiPolygon", coordinates: zones.map((z) => z.geometry.coordinates) };
}

/** Zones that contain this point (cheap circle test, no polygon maths needed). */
export function zonesContaining(p: LatLng, zones: DangerZone[], haversine: (a: LatLng, b: LatLng) => number): DangerZone[] {
  return zones.filter((z) => {
    const [lng, lat] = centerOf(z);
    return haversine(p, { lat, lng }) <= z.properties.radiusM;
  });
}

export function centerOf(z: DangerZone): [number, number] {
  const ring = z.geometry.coordinates[0];
  let x = 0, y = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}
