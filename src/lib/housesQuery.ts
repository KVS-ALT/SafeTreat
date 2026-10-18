import type { House } from "@prisma/client";
import { parseJson } from "./db";
import type { Candy } from "./allergens";
import type { PlannerHouse } from "./houses";

/** Fields safe to show to the public. Never the legal name, verified name or ID details. */
export function publicHouse(h: House): PlannerHouse & { addressMatchesId: boolean } {
  return {
    id: h.id, displayName: h.displayName, address: h.address, lat: h.lat, lng: h.lng,
    candies: parseJson<Candy[]>(h.candies, []), allergenFree: parseJson<string[]>(h.allergenFree, []),
    nonFoodTreats: h.nonFoodTreats, hoursStart: h.hoursStart, hoursEnd: h.hoursEnd, active: h.active,
    verified: h.verificationStatus === "VERIFIED", safetyFlag: h.safetyFlag, addressMatchesId: h.addressMatchesId,
  };
}
