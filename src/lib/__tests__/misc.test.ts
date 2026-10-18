import { describe, expect, it } from "vitest";
import { addressMatches, decideVerification, namesMatch, type IdRead } from "../identity";
import { extractJson, fallbackTriage } from "../gemma";
import { findAllergenConflicts, knownAllergens } from "../allergens";

describe("namesMatch", () => {
  it("accepts middle names and case/accent differences", () => {
    expect(namesMatch("María Elena García", "MARIA", "GARCIA")).toBe(true);
    expect(namesMatch("Ken Sato-Clark", "Ken", "Sato-Clark")).toBe(true);
  });
  it("rejects a different person", () => {
    expect(namesMatch("Maria Garcia", "Mario", "Garcia")).toBe(false);
  });
});

describe("addressMatches", () => {
  it("matches by house number + street (+ city)", () => {
    expect(addressMatches("65 Archdekin Dr, Brampton, ON", "65 Archdekin Drive", "Brampton")).toBe(true);
    expect(addressMatches("65 Archdekin Dr, Brampton, ON", "65 Archdekin Dr", null)).toBe(true);
    expect(addressMatches("65 Archdekin Dr, Brampton, ON", "165 Archdekin Dr", "Brampton")).toBe(false);
    expect(addressMatches("65 Archdekin Dr, Brampton, ON", "65 Archdekin Dr", "Mississauga")).toBe(false);
    expect(addressMatches("65 Archdekin Dr", null, null)).toBe(false);
  });
});

describe("decideVerification", () => {
  const ok: IdRead = {
    readable: true, isGovernmentPhotoId: true, isSampleOrSpecimen: false, documentType: "Ontario driver's licence", issuer: "Ontario",
    givenNames: "MARIA ELENA", surname: "GARCIA", expiryDate: "2029-05-01", addressLine: "65 ARCHDEKIN DR", city: "BRAMPTON", concerns: [],
  };
  const ctx = { legalName: "Maria Garcia", houseAddress: "65 Archdekin Dr, Brampton, ON", allowSamples: false, today: new Date("2026-10-18") };
  it("verifies a readable, valid ID with a matching name", () => {
    const d = decideVerification(ok, ctx);
    expect(d.status).toBe("VERIFIED");
    expect(d.verifiedName).toBe("Maria Garcia");
    expect(d.addressMatchesId).toBe(true);
  });
  it("rejects expired, mismatched, unreadable and non-ID images", () => {
    expect(decideVerification({ ...ok, expiryDate: "2025-01-01" }, ctx).note).toMatch(/expired/);
    expect(decideVerification({ ...ok, givenNames: "MARIO" }, ctx).note).toMatch(/doesn't match/);
    expect(decideVerification({ ...ok, readable: false }, ctx).note).toMatch(/couldn't read/);
    expect(decideVerification({ ...ok, isGovernmentPhotoId: false }, ctx).note).toMatch(/government photo ID/);
    expect(decideVerification({ ...ok, expiryDate: null }, ctx).note).toMatch(/expiry/);
  });
  it("rejects specimens unless demo mode allows samples", () => {
    expect(decideVerification({ ...ok, isSampleOrSpecimen: true }, ctx).status).toBe("FAILED");
    // A generic SAMPLE card isn't a government ID, but in demo mode it stands in for one.
    expect(decideVerification({ ...ok, isSampleOrSpecimen: true, isGovernmentPhotoId: false }, ctx).note).toMatch(/sample/);
    const d = decideVerification({ ...ok, isSampleOrSpecimen: true, isGovernmentPhotoId: false }, { ...ctx, allowSamples: true });
    expect(d.status).toBe("VERIFIED");
    expect(d.idDocumentType).toMatch(/demo mode/);
  });
});

describe("gemma helpers", () => {
  it("extracts JSON from fenced replies", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  it("falls back to keyword triage", () => {
    const r = fallbackTriage({ type: "CANDY", title: "Needle in a candy bar", description: "Found a needle inside", placeName: "12 Elm" });
    expect(r.category).toBe("foreign_object");
    expect(r.severity).toBe(5);
    expect(r.isSpam).toBe(false);
  });
});

describe("allergens", () => {
  it("prefers the longest brand match", () => {
    expect(knownAllergens("Peanut M&M's")).toContain("PEANUT");
    expect(knownAllergens("M&M's")).not.toContain("PEANUT");
  });
  it("knows Canadian Smarties are chocolate but Rockets are not", () => {
    expect(knownAllergens("Smarties")).toContain("MILK");
    expect(knownAllergens("Rockets")).toEqual([]);
    expect(knownAllergens("Oh Henry!")).toContain("PEANUT");
  });
  it("flags a peanut-free claim with Reese's", () => {
    expect(findAllergenConflicts([{ name: "Reese's", wrapped: true, homemade: false }], ["PEANUT"])).toEqual([{ candy: "Reese's", allergen: "PEANUT" }]);
  });
});

describe("decodePolyline6", () => {
  it("decodes Valhalla shapes to [lng, lat]", async () => {
    const { decodePolyline6 } = await import("../routing");
    // Two points: (42.269, -83.733) then (42.26901, -83.73299)
    const enc = (n: number) => { let v = n < 0 ? ~(n << 1) : n << 1; let s = ""; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
    const str = enc(42269000) + enc(-83733000) + enc(10) + enc(10);
    const out = decodePolyline6(str);
    expect(out[0][0]).toBeCloseTo(-83.733, 6);
    expect(out[0][1]).toBeCloseTo(42.269, 6);
    expect(out[1][1]).toBeCloseTo(42.26901, 6);
  });
});
