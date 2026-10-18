/**
 * The frame around every map. Under Pixel Patrol it becomes the handheld-device bezel
 * (thick stepped border + title plate); in other designs it is a quiet bordered panel.
 */
export default function MapFrame({ children, title, className = "", legend }: { children: React.ReactNode; title?: string; className?: string; legend?: React.ReactNode }) {
  return (
    <div className={`frame ${className}`}>
      {title && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2">
          <span className="eyebrow inline-block whitespace-nowrap border-line-strong bg-surface px-3 py-1.5 text-ink shadow-lg"
            style={{ borderWidth: "var(--border-w)", borderRadius: "var(--r-sm)", clipPath: "var(--clip)" }}>
            {title}
          </span>
        </div>
      )}
      {children}
      {legend && <div className="pointer-events-none absolute bottom-3 left-3 z-[500]">{legend}</div>}
    </div>
  );
}

export function MapLegend({ houses = true, route = false, track = false }: { houses?: boolean; route?: boolean; track?: boolean }) {
  const Dot = ({ c, square }: { c: string; square?: boolean }) => (
    <span className="inline-block h-2.5 w-2.5" style={{ background: c, borderRadius: square ? "var(--r-sm)" : "var(--r-pill)", clipPath: "var(--clip)" }} />
  );
  return (
    <div className="card pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 !p-2.5 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5"><Dot c="var(--danger)" /> Candy</span>
      <span className="inline-flex items-center gap-1.5"><Dot c="var(--warn)" /> Incident</span>
      {houses && <span className="inline-flex items-center gap-1.5"><Dot c="var(--gold)" square /> ID-checked host</span>}
      {houses && <span className="inline-flex items-center gap-1.5"><Dot c="var(--teal)" /> Teal pumpkin</span>}
      {route && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-4" style={{ background: "var(--accent)" }} /> Route</span>}
      {track && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1 w-4" style={{ background: "var(--safe)" }} /> Walked</span>}
    </div>
  );
}
