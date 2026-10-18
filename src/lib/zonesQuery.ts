import { db } from "./db";
import { buildDangerZones } from "./dangerZones";

/** Active, non-expired, non-spam reports. */
export function activeReportWhere() {
  return { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

export async function loadDangerZones() {
  const reports = await db.report.findMany({
    where: activeReportWhere(),
    select: { id: true, type: true, lat: true, lng: true, severity: true, title: true, placeName: true },
  });
  return buildDangerZones(reports);
}
