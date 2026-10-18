import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";
import { loadDangerZones } from "@/lib/zonesQuery";
import { planSafeRoute } from "@/lib/routing";
import { suggestStops } from "@/lib/houses";
import { publicHouse } from "@/lib/housesQuery";

const Point = z.object({ lat: z.number(), lng: z.number(), label: z.string().max(200), houseId: z.string().optional() });

const Body = z.object({
  home: Point,
  /** Hand-picked stops. Ignored when suggest is set. */
  stops: z.array(Point).max(40).default([]),
  suggest: z
    .object({
      childAllergens: z.array(z.string()),
      radiusM: z.number().min(100).max(3000),
      maxStops: z.number().int().min(1).max(30),
      verifiedOnly: z.boolean(),
      atTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    })
    .optional(),
  /** Walk back home at the end. */
  loop: z.boolean().default(true),
});

export const POST = handler(async (req: Request) => {
  await requireUser();
  const body = Body.parse(await req.json());
  const zones = await loadDangerZones();

  let stops = body.stops;
  let suggestionNotes: { houseId: string; displayName: string; reason: string }[] = [];
  if (body.suggest) {
    const houses = (await db.house.findMany({ where: { active: true } })).map(publicHouse);
    const { stops: picked, verdicts } = suggestStops(body.home, houses, zones, body.suggest);
    if (!picked.length) throw new HttpError(422, "No suitable houses found nearby. Try a bigger radius or turn off 'verified only'.");
    stops = picked.map((h) => ({ lat: h.lat, lng: h.lng, label: `${h.displayName} — ${h.address}`, houseId: h.id }));
    suggestionNotes = verdicts
      .filter((v) => !v.ok && v.distanceM <= body.suggest!.radiusM)
      .map((v) => ({ houseId: v.house.id, displayName: v.house.displayName, reason: v.reason! }));
  }
  if (!stops.length) throw new HttpError(400, "Add at least one stop.");

  const waypoints = [body.home, ...stops, ...(body.loop ? [{ ...body.home, label: "Back home" }] : [])];
  try {
    const route = await planSafeRoute(waypoints, zones);
    return NextResponse.json({ route, suggestionNotes });
  } catch (err) {
    throw new HttpError(422, (err as Error).message);
  }
});
