import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";

const Body = z.object({
  points: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), recordedAt: z.string().datetime() })).min(1).max(500),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.userId !== user.id) throw new HttpError(404, "Trip not found.");
  if (trip.status !== "ACTIVE") throw new HttpError(409, "Start the trip before recording.");
  const { points } = Body.parse(await req.json());
  await db.trackPoint.createMany({ data: points.map((p) => ({ tripId: id, lat: p.lat, lng: p.lng, recordedAt: new Date(p.recordedAt) })) });
  return NextResponse.json({ saved: points.length });
});
