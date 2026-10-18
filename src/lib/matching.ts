import { db } from "./db";
import { bboxAround, distanceToSegment, haversine, type LatLng } from "./geo";
import { fallbackAlert, gemmaTriage, writeAlert, type AlertContext } from "./gemma";

/** A track passing within this distance of a candy report triggers an alert. */
export const MATCH_RADIUS_M = 50;
/** Only count passes from 3 days before the reported time up to 12 h after it. */
const WINDOW_BEFORE_MS = 3 * 24 * 3600 * 1000;
const WINDOW_AFTER_MS = 12 * 3600 * 1000;

export type TimedPoint = LatLng & { recordedAt: Date };
export type Pass = { distanceM: number; passedAt: Date };

/**
 * Closest approach of a GPS track to a spot, checking the segments between points too
 * (points are ~15 s apart, so a kid can walk right past a house between two fixes).
 */
export function closestPass(track: TimedPoint[], spot: LatLng, occurredAt: Date, radiusM = MATCH_RADIUS_M): Pass | null {
  const from = occurredAt.getTime() - WINDOW_BEFORE_MS;
  const to = occurredAt.getTime() + WINDOW_AFTER_MS;
  const pts = [...track].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let best: Pass | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = p.recordedAt.getTime();
    if (t < from || t > to) continue;
    let d = haversine(p, spot);
    const next = pts[i + 1];
    if (next && next.recordedAt.getTime() <= to) d = Math.min(d, distanceToSegment(spot, p, next));
    if (d <= radiusM && (!best || d < best.distanceM)) best = { distanceM: d, passedAt: p.recordedAt };
  }
  return best;
}

type ReportRow = {
  id: string; type: string; lat: number; lng: number; title: string; placeName: string; aiSummary: string;
  candyDescription: string | null; category: string; severity: number; occurredAt: Date; status: string;
};

export type CreatedAlert = { id: string; context: AlertContext };

/**
 * Create the alert right away with template text, so a warning never waits on the model.
 * Call polishAlerts() afterwards to swap in Gemma's wording.
 */
async function createAlert(trip: { id: string; userId: string; name: string }, report: ReportRow, pass: Pass): Promise<CreatedAlert | null> {
  const existing = await db.alert.findUnique({ where: { tripId_reportId: { tripId: trip.id, reportId: report.id } } });
  if (existing) return null;
  const context: AlertContext = {
    tripName: trip.name, placeName: report.placeName, passedAt: pass.passedAt, distanceM: pass.distanceM,
    reportTitle: report.title, reportSummary: report.aiSummary, candyDescription: report.candyDescription,
    category: report.category, severity: report.severity,
  };
  try {
    const alert = await db.alert.create({
      data: { userId: trip.userId, tripId: trip.id, reportId: report.id, distanceM: pass.distanceM, passedAt: pass.passedAt, message: fallbackAlert(context) },
    });
    return { id: alert.id, context };
  } catch {
    return null; // lost a race with another matcher; unique(tripId, reportId) kept us at one alert
  }
}

/** Rewrite alert messages with Gemma. Safe to run in the background; failures keep the template text. */
export async function polishAlerts(alerts: CreatedAlert[]) {
  for (const a of alerts) {
    const message = await writeAlert(a.context);
    await db.alert.update({ where: { id: a.id }, data: { message } }).catch(() => {});
  }
}

/** New candy report → alert everyone whose recorded track went past it. */
export async function matchReportToTrips(report: ReportRow) {
  if (report.type !== "CANDY" || report.status !== "ACTIVE") return [];
  const box = bboxAround(report, MATCH_RADIUS_M + 150); // + slack for segment checks between sparse points
  const near = await db.trackPoint.findMany({
    where: { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } },
    select: { tripId: true },
    distinct: ["tripId"],
  });
  const created: CreatedAlert[] = [];
  for (const { tripId } of near) {
    const trip = await db.trip.findUnique({ where: { id: tripId }, include: { points: true } });
    if (!trip) continue;
    const pass = closestPass(trip.points, report, report.occurredAt);
    const alert = pass && (await createAlert(trip, report, pass));
    if (alert) created.push(alert);
  }
  return created;
}

/** Finished trip → check candy reports that already existed along the way. */
export async function matchTripToReports(tripId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId }, include: { points: true } });
  if (!trip || trip.points.length === 0) return [];
  const lats = trip.points.map((p) => p.lat), lngs = trip.points.map((p) => p.lng);
  const pad = bboxAround({ lat: Math.min(...lats), lng: Math.min(...lngs) }, MATCH_RADIUS_M);
  const pad2 = bboxAround({ lat: Math.max(...lats), lng: Math.max(...lngs) }, MATCH_RADIUS_M);
  const reports = await db.report.findMany({
    where: {
      type: "CANDY", status: "ACTIVE",
      lat: { gte: pad.minLat, lte: pad2.maxLat }, lng: { gte: pad.minLng, lte: pad2.maxLng },
    },
  });
  const created: CreatedAlert[] = [];
  for (const r of reports) {
    const pass = closestPass(trip.points, r, r.occurredAt);
    const alert = pass && (await createAlert(trip, r, pass));
    if (alert) created.push(alert);
  }
  return created;
}

/** Flag registered houses near a candy report so planners skip them. */
export async function flagHousesNear(report: { type: string; lat: number; lng: number; status: string }, radiusM = 30) {
  if (report.type !== "CANDY" || report.status !== "ACTIVE") return 0;
  const box = bboxAround(report, radiusM);
  const houses = await db.house.findMany({
    where: { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } },
  });
  const hits = houses.filter((h) => haversine(h, report) <= radiusM);
  if (hits.length) await db.house.updateMany({ where: { id: { in: hits.map((h) => h.id) } }, data: { safetyFlag: "REPORTED" } });
  return hits.length;
}

/**
 * Background step after a report is posted: let Gemma re-grade it, hide it if it's spam
 * (withdrawing any alerts it caused), then reword the alerts.
 */
export async function reviewReport(reportId: string, alerts: CreatedAlert[]) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) return;
  const t = await gemmaTriage({ ...report, type: report.type === "CANDY" ? "CANDY" : "INCIDENT" });
  if (t) {
    await db.report.update({
      where: { id: reportId },
      data: { severity: t.severity, category: t.category, aiSummary: t.summary, aiFlaggedSpam: t.isSpam, aiSource: "gemma", ...(t.isSpam ? { status: "HIDDEN" } : {}) },
    });
    if (t.isSpam) {
      await db.alert.deleteMany({ where: { reportId } });
      await unflagHousesNear(report);
      return;
    }
    for (const a of alerts) Object.assign(a.context, { reportSummary: t.summary, category: t.category, severity: t.severity });
  }
  await polishAlerts(alerts);
}

/** Undo flagHousesNear for houses with no other active candy report close by. */
async function unflagHousesNear(report: { lat: number; lng: number }, radiusM = 30) {
  const box = bboxAround(report, radiusM);
  const houses = await db.house.findMany({
    where: { safetyFlag: "REPORTED", lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } },
  });
  for (const h of houses) {
    const b = bboxAround(h, radiusM);
    const others = await db.report.findMany({
      where: { type: "CANDY", status: "ACTIVE", lat: { gte: b.minLat, lte: b.maxLat }, lng: { gte: b.minLng, lte: b.maxLng } },
    });
    if (!others.some((r) => haversine(r, h) <= radiusM)) await db.house.update({ where: { id: h.id }, data: { safetyFlag: "OK" } });
  }
}
