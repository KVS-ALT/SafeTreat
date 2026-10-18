import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db, parseJson } from "@/lib/db";
import { handler } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";
import { matchTripToReports, polishAlerts } from "@/lib/matching";

type Ctx = { params: Promise<{ id: string }> };

async function ownTrip(id: string, userId: string) {
  const trip = await db.trip.findUnique({ where: { id } });
  if (!trip || trip.userId !== userId) throw new HttpError(404, "Trip not found.");
  return trip;
}

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const trip = await ownTrip(id, user.id);
  const [points, alerts] = await Promise.all([
    db.trackPoint.findMany({ where: { tripId: id }, orderBy: { recordedAt: "asc" }, select: { lat: true, lng: true, recordedAt: true } }),
    db.alert.findMany({ where: { tripId: id }, include: { report: { select: { lat: true, lng: true, title: true, placeName: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    trip: { ...trip, plannedRoute: parseJson(trip.plannedRoute, null), waypoints: parseJson(trip.waypoints, []) },
    points,
    alerts,
  });
});

const Patch = z.object({ action: z.enum(["start", "finish", "reset"]) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const trip = await ownTrip(id, user.id);
  const { action } = Patch.parse(await req.json());
  if (action === "start") {
    if (trip.status === "DONE") throw new HttpError(409, "This trip is finished. Reset it to record again.");
    await db.trip.update({ where: { id }, data: { status: "ACTIVE", startedAt: trip.startedAt ?? new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === "reset") {
    await db.$transaction([
      db.trackPoint.deleteMany({ where: { tripId: id } }),
      db.alert.deleteMany({ where: { tripId: id } }),
      db.trip.update({ where: { id }, data: { status: "PLANNED", startedAt: null, endedAt: null } }),
    ]);
    return NextResponse.json({ ok: true });
  }
  await db.trip.update({ where: { id }, data: { status: "DONE", endedAt: new Date() } });
  const alerts = await matchTripToReports(id);
  if (alerts.length) after(() => polishAlerts(alerts));
  return NextResponse.json({ ok: true, alertsCreated: alerts.length });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await ownTrip(id, user.id);
  await db.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
