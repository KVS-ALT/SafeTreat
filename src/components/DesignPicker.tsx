"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { useTheme } from "./ThemeProvider";
import { THEMES } from "@/lib/themes";

/** Dropdown to switch the whole app between the four designs. */
export default function DesignPicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button className="btn-quiet" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Change design">
        <Icon name="palette" />
        <span className="hidden lg:inline">{THEMES.find((t) => t.id === theme)?.name}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-full z-[1100] mt-2 w-72 p-2">
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={theme === t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 ${theme === t.id ? "bg-surface-2" : ""}`}>
              <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
                {t.swatches.slice(0, 4).map((c) => <span key={c} className="h-7 w-2.5" style={{ background: c }} />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t.name}</span>
                <span className="block truncate text-xs text-muted">{t.tagline}</span>
              </span>
              {theme === t.id && <Icon name="check" size={16} className="text-accent-text" />}
            </button>
          ))}
          <Link href="/designs" onClick={() => setOpen(false)} className="mt-1 flex items-center justify-between rounded-lg border-t border-line px-2.5 pt-2.5 pb-1.5 text-sm text-accent-text">
            Compare all designs <Icon name="arrow" size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
