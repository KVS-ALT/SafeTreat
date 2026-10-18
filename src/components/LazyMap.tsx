"use client";
import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map only renders in the browser. */
const LazyMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-64 w-full animate-pulse place-items-center bg-surface-2 text-sm text-muted">Loading map…</div>,
});

export default LazyMap;
