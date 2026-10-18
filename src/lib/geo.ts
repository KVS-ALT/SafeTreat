export type LatLng = { lat: number; lng: number };

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Lat/lng box that contains every point within `metres` of `p`. */
export function bboxAround(p: LatLng, metres: number) {
  const dLat = metres / 111320;
  const dLng = metres / (111320 * Math.cos(toRad(p.lat)));
  return { minLat: p.lat - dLat, maxLat: p.lat + dLat, minLng: p.lng - dLng, maxLng: p.lng + dLng };
}

/** Distance from p to segment a-b in metres (equirectangular, fine at street scale). */
export function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos(toRad(p.lat));
  const ax = (a.lng - p.lng) * k, ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * k, by = b.lat - p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const x = ax + t * dx, y = ay + t * dy;
  return Math.sqrt(x * x + y * y) * 111320;
}
