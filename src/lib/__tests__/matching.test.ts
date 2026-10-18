import { describe, expect, it } from "vitest";
import { closestPass } from "../matching";

// ~0.00045 deg latitude ≈ 50 m
const spot = { lat: 42.27, lng: -83.73 };
const t = (min: number) => new Date(Date.UTC(2026, 9, 31, 22, min));

describe("closestPass", () => {
  it("matches a track that passes 40 m away", () => {
    const track = [{ lat: 42.27036, lng: -83.7302, recordedAt: t(0) }];
    const pass = closestPass(track, spot, t(30));
    expect(pass).not.toBeNull();
    expect(pass!.distanceM).toBeLessThan(45);
  });

  it("ignores a track 80 m away", () => {
    const track = [{ lat: 42.27072, lng: -83.73, recordedAt: t(0) }];
    expect(closestPass(track, spot, t(30))).toBeNull();
  });

  it("catches a pass between two sparse GPS points", () => {
    // Points 200 m either side of the spot, walking straight past it.
    const track = [
      { lat: 42.27, lng: -83.7325, recordedAt: t(0) },
      { lat: 42.27, lng: -83.7275, recordedAt: t(5) },
    ];
    const pass = closestPass(track, spot, t(30));
    expect(pass).not.toBeNull();
    expect(pass!.distanceM).toBeLessThan(5);
  });

  it("ignores passes outside the time window", () => {
    const track = [{ lat: 42.27, lng: -83.73, recordedAt: new Date(Date.UTC(2026, 9, 20)) }];
    expect(closestPass(track, spot, t(0))).toBeNull();
  });
});
