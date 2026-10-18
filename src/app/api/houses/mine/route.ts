import { NextResponse } from "next/server";
import { z } from "zod";
import { db, parseJson } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ALLERGEN_CODES, type Candy } from "@/lib/allergens";
import { checkAllergenClaims } from "@/lib/gemma";
import { bboxAround, haversine } from "@/lib/geo";

const Body = z.object({
  displayName: z.string().trim().min(2).max(60),
  legalName: z.string().trim().min(3).max(120),
  address: z.string().trim().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  candies: z.array(z.object({ name: z.string().trim().min(1).max(60), wrapped: z.boolean(), homemade: z.boolean() })).max(40),
  allergenFree: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])),
  nonFoodTreats: z.boolean(),
  hoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  hoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean(),
  /** true = save even though the allergen check found conflicts */
  acknowledgeConflicts: z.boolean().optional(),
});

async function mine(userId: string) {
  return db.house.findFirst({ where: { ownerId: userId } });
}

export const GET = handler(async () => {
  const user = await requireUser("HOMEOWNER");
  const house = await mine(user.id);
  if (!house) return NextResponse.json({ house: null, nearbyReports: [] });
  // Candy reports near this house, so the owner knows why it's flagged.
  const box = bboxAround(house, 60);
  const nearby = await db.report.findMany({
    where: { type: "CANDY", status: "ACTIVE", lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } },
    select: { id: true, title: true, aiSummary: true, lat: true, lng: true, createdAt: true },
  });
  return NextResponse.json({
    house: {
      ...house,
      candies: parseJson<Candy[]>(house.candies, []),
      allergenFree: parseJson<string[]>(house.allergenFree, []),
    },
    nearbyReports: nearby.filter((r) => haversine(r, house) <= 60),
  });
});

export const PUT = handler(async (req: Request) => {
  const user = await requireUser("HOMEOWNER");
  const body = Body.parse(await req.json());
  const conflicts = await checkAllergenClaims(body.candies, body.allergenFree);
  if (conflicts.length && !body.acknowledgeConflicts) {
    return NextResponse.json({ conflicts }, { status: 409 });
  }
  const { acknowledgeConflicts: _ack, ...fields } = body;
  void _ack;
  const data = { ...fields, candies: JSON.stringify(body.candies), allergenFree: JSON.stringify(body.allergenFree) };
  const existing = await mine(user.id);
  // Changing the legal name or moving the house invalidates the previous ID check.
  const resetVerification =
    existing && (existing.legalName !== body.legalName || existing.address !== body.address)
      ? { verificationStatus: "UNVERIFIED", verifiedName: null, verifiedAt: null, addressMatchesId: false, verificationNote: "Details changed — please verify again." }
      : {};
  const house = existing
    ? await db.house.update({ where: { id: existing.id }, data: { ...data, ...resetVerification } })
    : await db.house.create({ data: { ...data, ownerId: user.id } });
  return NextResponse.json({ house: { id: house.id }, conflicts });
});
