"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import Severity from "@/components/Severity";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

// 2×2 OpenStreetMap tiles around the demo area in Brampton (z16), restyled per design by --tile-filter.
const TILES = [[18247, 23909], [18248, 23909], [18247, 23910], [18248, 23910]];

export default function DesignsPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="eyebrow mb-2">Design directions</p>
        <h1 className="display-xl">Four ways SafeTreat could look</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          Each design is an OpenDesign-format package in <code className="num text-ink">design-systems/</code> (a{" "}
          <code className="num text-ink">DESIGN.md</code> brand contract plus <code className="num text-ink">tokens.css</code>). The previews below
          are live components, not screenshots. Pick one to switch the whole app; you can change it any time from the palette menu.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-2">
        {THEMES.map((t) => (
          <section key={t.id} className="space-y-3" aria-labelledby={`t-${t.id}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id={`t-${t.id}`} className="display-md">{t.name}</h2>
                <p className="text-sm text-muted">{t.tagline}</p>
              </div>
              {theme === t.id ? (
                <span className="chip chip-on"><Icon name="check" size={14} /> In use</span>
              ) : (
                <button className="btn-primary" onClick={() => setTheme(t.id)}>Use this design</button>
              )}
            </div>
            <Preview id={t.id} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted">
              <dt>Built from</dt><dd className="text-ink">OpenDesign <span className="num">{t.basedOn}</span>{t.id === "pixel" && ", inspired by spideytracker.net"}</dd>
              <dt>Type</dt><dd className="text-ink">{t.fonts}</dd>
              <dt>Palette</dt>
              <dd className="flex gap-1">{t.swatches.map((c) => <span key={c} title={c} className="h-4 w-6 rounded border border-line" style={{ background: c }} />)}</dd>
              <dt>Spec</dt><dd className="num text-ink">design-systems/{t.id}/DESIGN.md</dd>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A miniature SafeTreat home screen rendered entirely from one design's tokens. */
function Preview({ id }: { id: ThemeId }) {
  return (
    <div data-theme={id} className="preview-screen relative overflow-hidden rounded-2xl border border-line" style={{ fontFamily: "var(--ff-body)" }}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3" style={{ background: "color-mix(in oklab, var(--bg) 85%, transparent)" }}>
        <Logo size={22} />
        <span className="display-sm text-ink">SafeTreat</span>
        <span className="ml-4 hidden items-center gap-3 text-xs text-muted sm:flex">
          <span className="inline-flex items-center gap-1.5 text-ink"><Icon name="map" size={13} className="text-accent-text" /> Safety map</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="flag" size={13} /> Report</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="route" size={13} /> Plan</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          <Icon name="bell" size={16} className="text-muted" />
          <span className="btn-primary !min-h-0 !px-3 !py-1.5 !text-xs">Sign up</span>
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.05fr]">
        <div className="space-y-3">
          <p className="eyebrow">Halloween night</p>
          <h3 className="display text-ink" style={{ fontSize: "calc(2rem * var(--display-scale))" }}>
            Trick-or-treat, <span className="text-accent-text">safely.</span>
          </h3>
          <p className="text-[13px] leading-relaxed text-muted">Live reports from neighbours, routes that steer around them, and a warning if something turns up later.</p>
          <div className="flex flex-wrap gap-2">
            <span className="btn-danger !min-h-0 !px-3 !py-2 !text-xs"><Icon name="flag" size={13} /> Report</span>
            <span className="btn-primary !min-h-0 !px-3 !py-2 !text-xs"><Icon name="route" size={13} /> Plan a route</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip chip-on !min-h-0 !py-1 !text-[11px]">All</span>
            <span className="chip !min-h-0 !py-1 !text-[11px]"><Icon name="candy" size={11} className="text-danger" /> Candy</span>
            <span className="chip !min-h-0 !py-1 !text-[11px]"><Icon name="alert" size={11} className="text-warn" /> Incidents</span>
          </div>
          <div className="card space-y-1 !p-2">
            {[
              { t: "Pinhole in chocolate wrapper", p: "42 Elizabeth St N", s: 5, c: true },
              { t: "Car speeding past kids", p: "Main St S & Wellington", s: 4, c: false },
              { t: "Broken porch steps", p: "18 Ellen St", s: 2, c: false },
            ].map((r) => (
              <div key={r.t} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <Icon name={r.c ? "candy" : "alert"} size={14} className={r.c ? "text-danger" : "text-warn"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-ink">{r.t}</span>
                  <span className="block truncate text-[10.5px] text-muted">{r.p}</span>
                </span>
                <Severity n={r.s} />
              </div>
            ))}
          </div>
        </div>

        <div className="frame h-72 sm:h-auto sm:min-h-72">
          <div className="absolute inset-0 grid grid-cols-2" style={{ width: 512, height: 512, left: "50%", top: "50%", transform: "translate(-43%, -53%)" }}>
            {TILES.map(([x, y]) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${x}-${y}`} src={`https://tile.openstreetmap.org/16/${x}/${y}.png`} alt="" width={256} height={256}
                style={{ filter: "var(--tile-filter)", imageRendering: "var(--tile-rendering)" as React.CSSProperties["imageRendering"] }} />
            ))}
          </div>
          <span className="absolute left-[38%] top-[34%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
            style={{ borderColor: "var(--danger)", background: "color-mix(in oklab, var(--danger) 16%, transparent)" }} />
          <span className="pin-report pin-candy absolute left-[38%] top-[34%] !h-7 !w-7 -translate-x-1/2 -translate-y-1/2"><Icon name="candy" size={13} /></span>
          <span className="pin-report pin-incident absolute left-[70%] top-[62%] !h-6 !w-6 -translate-x-1/2 -translate-y-1/2"><Icon name="alert" size={12} /></span>
          {[[20, 64, "is-verified"], [54, 22, "is-verified"], [80, 30, ""], [44, 78, ""]].map(([l, tp, c]) => (
            <span key={`${l}`} className={`pin-house ${c} absolute -translate-x-1/2 -translate-y-1/2`} style={{ left: `${l}%`, top: `${tp}%` }}>
              <Icon name={c ? "check" : "house"} size={11} />
            </span>
          ))}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points="12,88 20,64 30,58 54,22 80,30 88,52" fill="none" stroke="var(--bg)" strokeWidth="2.6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 8 }} />
            <polyline points="12,88 20,64 30,58 54,22 80,30 88,52" fill="none" stroke="var(--accent)" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 4 }} />
          </svg>
          <span className="pin-home absolute left-[12%] top-[88%] -translate-x-1/2 -translate-y-1/2 !h-7 !w-7"><Icon name="house" size={14} /></span>
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2">
            <span className="eyebrow inline-block whitespace-nowrap border-line-strong bg-surface px-2.5 py-1 !text-[10px] text-ink"
              style={{ borderWidth: "var(--border-w)", borderRadius: "var(--r-sm)", clipPath: "var(--clip)" }}>Live safety map</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="blink inline-block h-1.5 w-1.5 bg-danger" style={{ borderRadius: "var(--r-pill)" }} /> 9 reports tonight</span>
        <Link href="/" className="hover:text-ink">safetreat.local</Link>
      </div>
    </div>
  );
}
