"use client";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_CENTER } from "@/lib/client";
import { TILE_ATTRIBUTION, TILE_URL } from "@/lib/themes";
import { allergenLabel } from "@/lib/allergens";

export type ReportPin = {
  id: string; type: "CANDY" | "INCIDENT" | string; title: string; placeName: string; lat: number; lng: number;
  severity: number; aiSummary: string; category: string; candyDescription?: string | null; createdAt: string;
};
export type ZonePin = { reportId: string; lat: number; lng: number; radiusM: number; type: string };
export type HousePin = {
  id: string; displayName: string; address: string; lat: number; lng: number; verified: boolean; nonFoodTreats: boolean;
  candies: { name: string; wrapped: boolean; homemade: boolean }[]; allergenFree: string[]; hoursStart: string; hoursEnd: string; safetyFlag: string;
  addressMatchesId?: boolean;
  /** planner annotations */
  dimReason?: string | null; selected?: boolean;
};
export type LL = { lat: number; lng: number };

type Props = {
  className?: string;
  center?: [number, number];
  zoom?: number;
  reports?: ReportPin[];
  zones?: ZonePin[];
  houses?: HousePin[];
  route?: [number, number][]; // [lat, lng]
  plannedRoute?: [number, number][];
  track?: [number, number][];
  waypoints?: (LL & { label: string })[];
  pick?: LL | null;
  me?: LL | null;
  highlight?: LL | null;
  onMapClick?: (p: LL) => void;
  onHouseClick?: (id: string) => void;
  /** Change this value to re-fit the map to the route / waypoints / track / fitTo points. */
  fitKey?: string | number;
  /** Extra points to include when fitting (e.g. all reports on first load). */
  fitTo?: LL[];
};

const divIcon = (html: string, size: number, anchorY = size / 2) =>
  L.divIcon({ className: "pin", html, iconSize: [size, size], iconAnchor: [size / 2, anchorY], popupAnchor: [0, -anchorY] });

// Small inline glyphs for pins (pins are raw HTML, so no React components here).
const CANDY_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 8.5a5 5 0 1 1 7 7 5 5 0 0 1-7-7Z"/><path d="M8.5 8.5 7.5 4 4 7.5l4.5 1M15.5 15.5l1 4.5 3.5-3.5-4.5-1"/></svg>';
const ALERT_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v9M12 18.5h.01"/></svg>';
const HOUSE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 12 4l8 7M6 10v10h12V10"/></svg>';
const CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 9.5 17 19 7"/></svg>';
const X_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const PIN_SVG = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s-7.5-6.6-7.5-12.2a7.5 7.5 0 0 1 15 0C19.5 15.4 12 22 12 22Z"/><circle cx="12" cy="9.8" r="2.8" fill="var(--bg)"/></svg>';

const reportIcon = (r: ReportPin) => {
  const size = 20 + r.severity * 2;
  return divIcon(`<span class="pin-report ${r.type === "CANDY" ? "pin-candy" : "pin-incident"}">${r.type === "CANDY" ? CANDY_SVG : ALERT_SVG}</span>`, size);
};

const houseIcon = (h: HousePin) => {
  const cls = ["pin-house", h.verified && "is-verified", h.safetyFlag === "REPORTED" && "is-reported", h.selected && "is-selected", h.dimReason && !h.selected && "is-dim"].filter(Boolean).join(" ");
  const glyph = h.safetyFlag === "REPORTED" ? X_SVG : h.verified ? CHECK_SVG : HOUSE_SVG;
  return divIcon(`<span class="${cls}">${glyph}${h.nonFoodTreats ? '<span class="teal-dot"></span>' : ""}</span>`, 22);
};

const stopIcon = (n: number) => divIcon(`<span class="pin-stop">${n}</span>`, 24);
const homeIcon = divIcon(`<span class="pin-home">${HOUSE_SVG.replace('width="12" height="12"', 'width="16" height="16"')}</span>`, 30);
const pickIcon = divIcon(`<span class="pin-pick">${PIN_SVG}</span>`, 34, 32);
const meIcon = divIcon('<span class="pin-me" style="display:block"></span>', 18);

function ClickHandler({ onClick }: { onClick?: (p: LL) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Fit({ points, fitKey }: { points: [number, number][]; fitKey?: string | number }) {
  const map = useMap();
  useEffect(() => {
    if (fitKey === undefined || points.length === 0) return;
    if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 16));
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

/** Leaflet only measures its box once; redraw tiles when the container is resized. */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Recenter({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);
  return null;
}

export default function MapView(p: Props) {
  const fitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (p.route?.length) pts.push(...p.route);
    else if (p.plannedRoute?.length) pts.push(...p.plannedRoute);
    if (p.track?.length) pts.push(...p.track);
    p.waypoints?.forEach((w) => pts.push([w.lat, w.lng]));
    if (p.highlight) pts.push([p.highlight.lat, p.highlight.lng]);
    p.fitTo?.forEach((q) => pts.push([q.lat, q.lng]));
    return pts;
  }, [p.route, p.plannedRoute, p.track, p.waypoints, p.highlight, p.fitTo]);

  return (
    <MapContainer center={p.center ?? DEFAULT_CENTER} zoom={p.zoom ?? 15} className={p.className ?? "h-[60vh] w-full"} scrollWheelZoom>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={19} />
      <ClickHandler onClick={p.onMapClick} />
      <Fit points={fitPoints} fitKey={p.fitKey} />
      <Recenter center={p.center} />
      <AutoResize />

      {p.zones?.map((z) => (
        <Circle key={z.reportId} center={[z.lat, z.lng]} radius={z.radiusM} interactive={false}
          pathOptions={{ className: z.type === "CANDY" ? "zone-candy" : "zone-incident", weight: 1.5, dashArray: "4 4" }} />
      ))}

      {p.plannedRoute && p.plannedRoute.length > 1 && (
        <Polyline positions={p.plannedRoute} pathOptions={{ className: "planned-line", weight: 4, opacity: 0.7, dashArray: "6 8" }} />
      )}
      {p.route && p.route.length > 1 && (
        <>
          <Polyline positions={p.route} pathOptions={{ className: "route-casing", weight: 9, opacity: 0.85 }} />
          <Polyline positions={p.route} pathOptions={{ className: "route-line", weight: 5 }} />
        </>
      )}
      {p.track && p.track.length > 1 && <Polyline positions={p.track} pathOptions={{ className: "track-line", weight: 5 }} />}

      {p.houses?.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]} icon={houseIcon(h)} zIndexOffset={h.selected ? 500 : 0}
          eventHandlers={p.onHouseClick ? { click: () => p.onHouseClick!(h.id) } : undefined}>
          {!p.onHouseClick && (
            <Popup>
              <HousePopup h={h} />
            </Popup>
          )}
        </Marker>
      ))}

      {p.reports?.map((r) => (
        <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r)} zIndexOffset={1000}>
          <Popup>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`eyebrow ${r.type === "CANDY" ? "!text-danger" : "!text-warn"}`}>{r.type === "CANDY" ? "Unsafe candy" : "Incident"}</span>
                <span className="badge bg-surface-2 text-ink">{r.severity}/5</span>
              </div>
              <div className="text-[14px] font-semibold leading-snug">{r.title}</div>
              <div className="text-muted">{r.placeName}</div>
              {r.candyDescription && <div>Candy: {r.candyDescription}</div>}
              <div className="italic text-muted">{r.aiSummary}</div>
              <div className="num text-[11px] text-muted">{new Date(r.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {p.waypoints?.map((w, i) => (
        <Marker key={`${i}-${w.lat}-${w.lng}`} position={[w.lat, w.lng]} zIndexOffset={1500}
          icon={i === 0 ? homeIcon : stopIcon(i)}>
          <Popup>{i === 0 ? "Start" : `Stop ${i}`}: {w.label}</Popup>
        </Marker>
      ))}

      {p.pick && <Marker position={[p.pick.lat, p.pick.lng]} icon={pickIcon} zIndexOffset={2000} />}
      {p.me && (
        <Marker position={[p.me.lat, p.me.lng]} zIndexOffset={2000} icon={meIcon} />
      )}
    </MapContainer>
  );
}

export function HousePopup({ h }: { h: HousePin }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[14px] font-semibold">{h.displayName}</div>
      <div className="text-muted">{h.address}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        {h.verified ? <span className="font-semibold text-gold">✓ ID checked</span> : <span className="text-muted">ID not checked</span>}
        {h.addressMatchesId && <span className="text-gold">Address matches ID</span>}
        {h.nonFoodTreats && <span className="text-teal">Teal pumpkin</span>}
      </div>
      {h.safetyFlag === "REPORTED" && <div className="font-semibold text-danger">Unsafe candy reported here</div>}
      <div><span className="text-muted">Handing out:</span> {h.candies.map((c) => c.name).join(", ") || "—"}</div>
      <div><span className="text-muted">Free of:</span> {h.allergenFree.map(allergenLabel).join(", ") || "not stated"}</div>
      <div className="num text-[11px] text-muted">Open {h.hoursStart}–{h.hoursEnd}</div>
      {h.dimReason && <div className="text-[12px] text-danger">Skipped: {h.dimReason}</div>}
    </div>
  );
}
