import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const GET = handler(async () => {
  const user = await requireUser();
  const trips = await db.trip.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, status: true, startedAt: true, endedAt: true, createdAt: true,
      _count: { select: { points: true, alerts: true } },
    },
  });
  return NextResponse.json({ trips });
});

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  plannedRoute: z.object({ type: z.literal("Feature"), geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.array(z.number())) }) }).passthrough(),
  waypoints: z.array(z.object({ lat: z.number(), lng: z.number(), label: z.string(), houseId: z.string().optional() })),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = Body.parse(await req.json());
  const trip = await db.trip.create({
    data: { userId: user.id, name: body.name, plannedRoute: JSON.stringify(body.plannedRoute), waypoints: JSON.stringify(body.waypoints) },
  });
  return NextResponse.json({ trip: { id: trip.id } });
});
