import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { fallbackTriage } from "@/lib/gemma";
import { flagHousesNear, matchReportToTrips, reviewReport } from "@/lib/matching";
import { activeReportWhere } from "@/lib/zonesQuery";

export const GET = handler(async () => {
  const reports = await db.report.findMany({
    where: activeReportWhere(),
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, type: true, title: true, description: true, lat: true, lng: true, placeName: true,
      candyDescription: true, severity: true, category: true, aiSummary: true, aiSource: true, occurredAt: true, createdAt: true,
    },
  });
  return NextResponse.json({ reports });
});

const Body = z.object({
  type: z.enum(["CANDY", "INCIDENT"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
  placeName: z.string().trim().min(2).max(160),
  candyDescription: z.string().trim().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  occurredAt: z.string().datetime().optional(),
});

/** Incidents (traffic, a loose dog…) fade from the map after this long; candy reports stay. */
const INCIDENT_TTL_MS = Number(process.env.INCIDENT_TTL_HOURS ?? 6) * 3600 * 1000;

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const user = await getCurrentUser();
  // Instant keyword triage so the report (and any warnings) go out right away; Gemma re-grades it in the background.
  const triage = fallbackTriage(body);
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const report = await db.report.create({
    data: {
      type: body.type, title: body.title, description: body.description, placeName: body.placeName,
      candyDescription: body.type === "CANDY" ? body.candyDescription || null : null,
      lat: body.lat, lng: body.lng, occurredAt,
      severity: triage.severity, category: triage.category, aiSummary: triage.summary,
      aiFlaggedSpam: triage.isSpam, aiSource: "fallback",
      status: triage.isSpam ? "HIDDEN" : "ACTIVE",
      reporterId: user?.id ?? null,
      expiresAt: body.type === "INCIDENT" ? new Date(Date.now() + INCIDENT_TTL_MS) : null,
    },
  });
  const [alerts, housesFlagged] = await Promise.all([matchReportToTrips(report), flagHousesNear(report)]);
  if (report.status === "ACTIVE") after(() => reviewReport(report.id, alerts));
  return NextResponse.json({ report, alertsCreated: alerts.length, housesFlagged });
});
