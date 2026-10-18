import { haversine, type LatLng } from "./geo";
import { houseConflictReason, type Candy } from "./allergens";
import { centerOf, zonesContaining, type DangerZone } from "./dangerZones";

export type PlannerHouse = LatLng & {
  id: string;
  displayName: string;
  address: string;
  candies: Candy[];
  allergenFree: string[];
  nonFoodTreats: boolean;
  hoursStart: string;
  hoursEnd: string;
  active: boolean;
  verified: boolean;
  safetyFlag: string;
};

/** Houses this close to a zone's edge are skipped too: the walk to their door usually runs through the zone. */
export const ZONE_BUFFER_M = 40;

function nearZone(p: LatLng, zones: DangerZone[]) {
  return zones.find((z) => {
    const [lng, lat] = centerOf(z);
    return haversine(p, { lat, lng }) <= z.properties.radiusM + ZONE_BUFFER_M;
  });
}

export type HouseVerdict = { house: PlannerHouse; ok: boolean; reason?: string; score: number; distanceM: number };

export type SuggestOptions = {
  childAllergens: string[];
  radiusM: number;
  maxStops: number;
  verifiedOnly: boolean;
  /** "HH:MM" the family plans to be out; houses closed then are skipped. */
  atTime?: string;
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function isOpenAt(h: Pick<PlannerHouse, "hoursStart" | "hoursEnd">, at: string) {
  const t = minutes(at);
  return t >= minutes(h.hoursStart) && t <= minutes(h.hoursEnd);
}

/** Decide, for every house, whether it is a good stop for this child and why not if not. */
export function judgeHouses(home: LatLng, houses: PlannerHouse[], zones: DangerZone[], opts: SuggestOptions): HouseVerdict[] {
  return houses.map((house) => {
    const distanceM = haversine(home, house);
    const no = (reason: string): HouseVerdict => ({ house, ok: false, reason, score: -Infinity, distanceM });
    if (!house.active) return no("not handing out candy this year");
    if (house.safetyFlag === "REPORTED") return no("unsafe candy was reported here");
    const zone = zonesContaining(house, zones, haversine)[0];
    if (zone) return no(`inside a danger zone (${zone.properties.title})`);
    const near = nearZone(house, zones);
    if (near) return no(`right next to a reported problem (${near.properties.title})`);
    if (opts.verifiedOnly && !house.verified) return no("homeowner ID not checked");
    if (opts.atTime && !isOpenAt(house, opts.atTime)) return no(`only open ${house.hoursStart}–${house.hoursEnd}`);
    const allergy = houseConflictReason(house, opts.childAllergens);
    if (allergy) return no(allergy);
    if (distanceM > opts.radiusM) return no("too far from home");
    let score = 0;
    if (house.verified) score += 3;
    if (house.nonFoodTreats && opts.childAllergens.length) score += 1;
    if (house.candies.every((c) => c.wrapped && !c.homemade)) score += 1;
    score -= distanceM / 200;
    return { house, ok: true, score, distanceM };
  });
}

/** Best houses, ordered as a nearest-neighbour loop starting from home. */
export function suggestStops(home: LatLng, houses: PlannerHouse[], zones: DangerZone[], opts: SuggestOptions) {
  const verdicts = judgeHouses(home, houses, zones, opts);
  const picked = verdicts.filter((v) => v.ok).sort((a, b) => b.score - a.score).slice(0, opts.maxStops).map((v) => v.house);
  return { stops: nearestNeighbourOrder(home, picked), verdicts };
}

export function nearestNeighbourOrder<T extends LatLng>(start: LatLng, points: T[]): T[] {
  const left = [...points];
  const out: T[] = [];
  let cur = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (haversine(cur, left[i]) < haversine(cur, left[best])) best = i;
    cur = left.splice(best, 1)[0];
    out.push(cur as T);
  }
  return out;
}
