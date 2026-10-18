"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { HousePin, ReportPin, ZonePin } from "./MapView";

/** Reports, danger zones and registered houses, refreshed every minute. */
export function useSafetyData({ houses = true } = {}) {
  const [reports, setReports] = useState<ReportPin[]>([]);
  const [zones, setZones] = useState<ZonePin[]>([]);
  const [houseList, setHouses] = useState<HousePin[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [r, z, h] = await Promise.all([
      api<{ reports: ReportPin[] }>("/api/reports"),
      api<{ zones: ZonePin[] }>("/api/zones"),
      houses ? api<{ houses: HousePin[] }>("/api/houses") : Promise.resolve({ houses: [] }),
    ]);
    setReports(r.reports);
    setZones(z.zones);
    setHouses(h.houses);
    setLoaded(true);
  }, [houses]);

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
    const t = setInterval(() => refresh().catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [refresh]);

  return { reports, zones, houses: houseList, loaded, refresh };
}
