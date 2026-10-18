import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { loadDangerZones } from "@/lib/zonesQuery";
import { centerOf } from "@/lib/dangerZones";

/** Danger zones as simple circles for the map. */
export const GET = handler(async () => {
  const zones = (await loadDangerZones()).map((z) => {
    const [lng, lat] = centerOf(z);
    return { reportId: z.properties.reportId, type: z.properties.type, lat, lng, radiusM: z.properties.radiusM };
  });
  return NextResponse.json({ zones });
});
