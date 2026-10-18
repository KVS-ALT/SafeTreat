"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";
import DesignPicker from "./DesignPicker";
import { api, type Me } from "@/lib/client";

type AlertsResp = { unread: number; alerts: { id: string; message: string; report: { title: string } }[] };

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    api<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => setMe(null));
  }, [path]);

  // Poll for alerts; show a browser notification for alerts we haven't seen before.
  useEffect(() => {
    if (!me) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<AlertsResp>("/api/alerts?unread=1");
        if (stop) return;
        setUnread(r.unread);
        const ids = new Set(r.alerts.map((a) => a.id));
        if (seen.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const a of r.alerts) if (!seen.current.has(a.id)) new Notification(`SafeTreat: ${a.report.title}`, { body: a.message });
        }
        seen.current = ids;
      } catch {}
    };
    tick();
    const t = setInterval(tick, 30000);
    window.addEventListener("safetreat:alerts", tick);
    return () => { stop = true; clearInterval(t); window.removeEventListener("safetreat:alerts", tick); };
  }, [me]);

  useEffect(() => setOpen(false), [path]);

  const links: { href: string; label: string; icon: IconName; show: boolean }[] = [
    { href: "/", label: "Safety map", icon: "map", show: true },
    { href: "/report", label: "Report", icon: "flag", show: true },
    { href: "/plan", label: "Plan a route", icon: "route", show: me?.role !== "HOMEOWNER" },
    { href: "/trips", label: "My trips", icon: "clock", show: !!me && me.role === "PARENT" },
    { href: "/homeowner", label: "My house", icon: "house", show: me?.role === "HOMEOWNER" },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="mr-3 flex items-center gap-2.5" aria-label="SafeTreat home">
          <Logo size={30} />
          <span className="display-sm text-ink">SafeTreat</span>
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {links.filter((l) => l.show).map((l) => (
            <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}
              className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active(l.href) ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}>
              <Icon name={l.icon} size={16} className={active(l.href) ? "text-accent-text" : ""} />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <DesignPicker />
          {me && (
            <Link href="/alerts" aria-label={`Alerts, ${unread} unread`} className="btn-quiet relative px-2.5">
              <Icon name="bell" size={19} />
              {unread > 0 && (
                <span className="num absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>
              )}
            </Link>
          )}
          {me === null && (
            <>
              <Link href="/login" className="btn-quiet hidden sm:inline-flex">Log in</Link>
              <Link href="/signup" className="btn-primary">Sign up</Link>
            </>
          )}
          {me && (
            <div className="hidden items-center gap-1 sm:flex">
              <span className="inline-flex items-center gap-1.5 px-2 text-sm text-muted">
                <Icon name={me.role === "HOMEOWNER" ? "house" : "user"} size={15} /> {me.username}
              </span>
              <button onClick={logout} className="btn-quiet px-2.5" title="Log out" aria-label="Log out"><Icon name="logout" /></button>
            </div>
          )}
          <button className="btn-quiet px-2.5 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Mobile">
          {links.filter((l) => l.show).map((l) => (
            <Link key={l.href} href={l.href} className={`inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active(l.href) ? "bg-surface-2" : "hover:bg-surface-2"}`}>
              <Icon name={l.icon} size={16} /> {l.label}
            </Link>
          ))}
          {me && <button onClick={logout} className="inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted hover:bg-surface-2"><Icon name="logout" size={16} /> Log out ({me.username})</button>}
          {me === null && <Link href="/login" className="rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2">Log in</Link>}
        </nav>
      )}
    </header>
  );
}
