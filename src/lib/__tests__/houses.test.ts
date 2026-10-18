import { describe, expect, it } from "vitest";
import { judgeHouses, suggestStops, type PlannerHouse } from "../houses";
import { buildDangerZones, zoneRadius } from "../dangerZones";

const home = { lat: 42.27, lng: -83.73 };
const house = (id: string, over: Partial<PlannerHouse> = {}): PlannerHouse => ({
  id, displayName: id, address: id, lat: 42.2705, lng: -83.7305, candies: [{ name: "Skittles", wrapped: true, homemade: false }],
  allergenFree: ["PEANUT", "TREE_NUT", "MILK"], nonFoodTreats: false, hoursStart: "17:00", hoursEnd: "21:00",
  active: true, verified: false, safetyFlag: "OK", ...over,
});
const opts = { childAllergens: ["PEANUT"], radiusM: 1000, maxStops: 10, verifiedOnly: false };

describe("judgeHouses", () => {
  it("never suggests Reese's to a peanut-allergic child", () => {
    const [v] = judgeHouses(home, [house("a", { candies: [{ name: "Reese's Cups", wrapped: true, homemade: false }] })], [], opts);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/peanut/i);
  });

  it("excludes reported houses and houses inside danger zones", () => {
    const zones = buildDangerZones([{ id: "r", type: "INCIDENT", lat: 42.2711, lng: -83.7311, severity: 3, title: "x", placeName: "y" }]);
    const verdicts = judgeHouses(home, [house("rep", { safetyFlag: "REPORTED" }), house("zone", { lat: 42.2711, lng: -83.7311 }), house("ok", { lat: 42.2695, lng: -83.7295 })], zones, opts);
    expect(verdicts.map((v) => v.ok)).toEqual([false, false, true]);
  });

  it("allows teal-pumpkin houses even if candy has the allergen", () => {
    const [v] = judgeHouses(home, [house("t", { candies: [{ name: "Snickers", wrapped: true, homemade: false }], nonFoodTreats: true })], [], opts);
    expect(v.ok).toBe(true);
  });

  it("ranks verified hosts first and respects verifiedOnly", () => {
    const hs = [house("plain"), house("verified", { verified: true, lat: 42.2706 })];
    expect(suggestStops(home, hs, [], { ...opts, maxStops: 1 }).stops[0].id).toBe("verified");
    expect(suggestStops(home, hs, [], { ...opts, verifiedOnly: true }).stops.map((h) => h.id)).toEqual(["verified"]);
  });

  it("skips houses closed at the planned time", () => {
    const [v] = judgeHouses(home, [house("late", { hoursStart: "19:00" })], [], { ...opts, atTime: "18:00" });
    expect(v.ok).toBe(false);
  });
});

describe("zoneRadius", () => {
  it("grows with severity and is clamped", () => {
    expect(zoneRadius(1)).toBe(60);
    expect(zoneRadius(5)).toBe(140);
    expect(zoneRadius(9)).toBe(140);
  });
  it("keeps candy zones to the house and its neighbours", () => {
    expect(zoneRadius(1, "CANDY")).toBe(35);
    expect(zoneRadius(5, "CANDY")).toBe(55);
  });
});
