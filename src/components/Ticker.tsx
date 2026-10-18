import Icon from "./Icon";
import type { ReportPin } from "./MapView";

/** Marquee of the latest reports (the Pixel design's "tap to skip" bar, toned to each design). */
export default function Ticker({ reports }: { reports: ReportPin[] }) {
  if (!reports.length) return null;
  const items = reports.slice(0, 8);
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {items.map((r) => (
        <span key={r.id} className="inline-flex items-center gap-2 px-5 text-[13px]">
          <span className={r.type === "CANDY" ? "text-danger" : "text-warn"}><Icon name={r.type === "CANDY" ? "candy" : "alert"} size={14} /></span>
          <span className="font-semibold">{r.title}</span>
          <span className="text-muted">· {r.placeName.split(",")[0]}</span>
          <span className="ml-3 inline-block h-1.5 w-1.5 bg-line-strong" style={{ borderRadius: "var(--r-pill)" }} />
        </span>
      ))}
    </div>
  );
  return (
    <div className="well flex items-center gap-3 border-line py-2.5 pl-3" style={{ borderWidth: "var(--border-w)" }}>
      <span className="eyebrow inline-flex shrink-0 items-center gap-1.5 !text-danger">
        <span className="blink inline-block h-2 w-2 bg-danger" style={{ borderRadius: "var(--r-pill)" }} /> Live
      </span>
      <div className="ticker min-w-0 flex-1" role="marquee" aria-label="Latest reports">
        <div className="ticker-track">{row("a")}{row("b")}</div>
      </div>
    </div>
  );
}
