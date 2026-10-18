"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LazyMap from "@/components/LazyMap";
import AddressSearch from "@/components/AddressSearch";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import Icon from "@/components/Icon";
import MapFrame from "@/components/MapFrame";
import { api, ApiError, DEFAULT_CENTER } from "@/lib/client";
import { ALLERGENS, CANDY_ALLERGENS, NON_FOOD, allergenLabel, type Candy } from "@/lib/allergens";
import type { MyHouse } from "@/lib/houseTypes";

type Conflict = { candy: string; allergen: string };
const QUICK = Object.keys(CANDY_ALLERGENS).filter((k) => !NON_FOOD.has(k));

export default function HouseForm() {
  const me = useRequireMe();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState({
    displayName: "", legalName: "", address: "", lat: 0, lng: 0, hoursStart: "17:00", hoursEnd: "20:30",
    nonFoodTreats: false, active: true,
  });
  const [candies, setCandies] = useState<Candy[]>([]);
  const [allergenFree, setAllergenFree] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wasVerified, setWasVerified] = useState(false);
  const [orig, setOrig] = useState({ legalName: "", address: "" });

  useEffect(() => {
    if (me?.role !== "HOMEOWNER") return;
    api<{ house: MyHouse | null }>("/api/houses/mine").then(({ house: h }) => {
      if (h) {
        setF({ displayName: h.displayName, legalName: h.legalName, address: h.address, lat: h.lat, lng: h.lng,
          hoursStart: h.hoursStart, hoursEnd: h.hoursEnd, nonFoodTreats: h.nonFoodTreats, active: h.active });
        setCandies(h.candies);
        setAllergenFree(h.allergenFree);
        setCenter([h.lat, h.lng]);
        setWasVerified(h.verificationStatus === "VERIFIED");
        setOrig({ legalName: h.legalName, address: h.address });
      }
      setLoaded(true);
    });
  }, [me]);

  if (!me || !loaded) return <Loading />;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const hasCandy = (n: string) => candies.some((c) => c.name.toLowerCase() === n.toLowerCase());
  const toggleCandy = (n: string) =>
    setCandies((cs) => (hasCandy(n) ? cs.filter((c) => c.name.toLowerCase() !== n.toLowerCase()) : [...cs, { name: n, wrapped: true, homemade: false }]));
  const toggleAllergen = (a: string) => setAllergenFree((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));
  const reverify = wasVerified && (f.legalName !== orig.legalName || f.address !== orig.address);

  async function save(ack = false) {
    if (!f.lat) return setErr("Search your address or tap your house on the map.");
    setBusy(true);
    setErr("");
    try {
      await api("/api/houses/mine", { method: "PUT", body: { ...f, candies, allergenFree, acknowledgeConflicts: ack } });
      router.push("/homeowner");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflicts((e.data as { conflicts: Conflict[] }).conflicts);
      else setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <form className="card space-y-6 !p-6" onSubmit={(e) => { e.preventDefault(); setConflicts([]); save(); }}>
        <div><p className="eyebrow mb-2">Homeowner</p><h1 className="display-lg">Your house</h1></div>

        <section className="space-y-3">
          <div>
            <label className="label" htmlFor="dn">Name shown to parents</label>
            <input id="dn" className="input" required value={f.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="The Garcias" />
          </div>
          <div>
            <label className="label" htmlFor="ln">Your legal name (as on your ID)</label>
            <input id="ln" className="input" required value={f.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Maria Elena Garcia" />
            <p className="mt-1 text-xs text-muted">Private. Only used to match your ID — never shown on the map.</p>
          </div>
          <div>
            <label className="label">Address</label>
            <AddressSearch placeholder="Your street address…" onPick={(r) => { setF((s) => ({ ...s, address: r.label.split(",").slice(0, 4).join(","), lat: r.lat, lng: r.lng })); setCenter([r.lat, r.lng]); }} />
            <input className="input mt-2" required value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Address text" />
            <p className="mt-1 text-xs text-muted">{f.lat ? `Pinned at ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)} — tap the map to adjust` : "Search, then tap your front door on the map."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="hs">From</label><input id="hs" type="time" className="input" value={f.hoursStart} onChange={(e) => set("hoursStart", e.target.value)} /></div>
            <div><label className="label" htmlFor="he">Until</label><input id="he" type="time" className="input" value={f.hoursEnd} onChange={(e) => set("hoursEnd", e.target.value)} /></div>
          </div>
        </section>

        <section>
          <label className="label">Treats you&apos;re handing out</label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((n) => <button type="button" key={n} onClick={() => toggleCandy(n)} className={`chip ${hasCandy(n) ? "chip-on" : ""}`}>{n}</button>)}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else (e.g. homemade cookies)" />
            <button type="button" className="btn-ghost shrink-0" onClick={() => { if (custom.trim() && !hasCandy(custom.trim())) setCandies((c) => [...c, { name: custom.trim(), wrapped: true, homemade: /homemade|baked/i.test(custom) }]); setCustom(""); }}>Add</button>
          </div>
          {candies.length > 0 && (
            <ul className="mt-3 space-y-1">
              {candies.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
                  <span className="flex-1">{c.name}</span>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.wrapped} onChange={(e) => setCandies((cs) => cs.map((x, j) => j === i ? { ...x, wrapped: e.target.checked } : x))} /> factory-wrapped</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.homemade} onChange={(e) => setCandies((cs) => cs.map((x, j) => j === i ? { ...x, homemade: e.target.checked } : x))} /> homemade</label>
                  <button type="button" className="text-muted hover:text-danger" onClick={() => setCandies((cs) => cs.filter((_, j) => j !== i))} aria-label={`Remove ${c.name}`}><Icon name="x" size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.nonFoodTreats} onChange={(e) => set("nonFoodTreats", e.target.checked)} />
            <Icon name="star" size={15} className="text-teal" /> I also offer non-food treats (Teal Pumpkin: glow sticks, stickers…)
          </label>
        </section>

        <section>
          <label className="label">Everything I hand out is free of…</label>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => <button type="button" key={a.code} onClick={() => toggleAllergen(a.code)} className={`chip ${allergenFree.includes(a.code) ? "chip-on" : ""}`}>{a.label}</button>)}
          </div>
          <p className="mt-1 text-xs text-muted">Only tick what you&apos;re sure of. We double-check against your treat list.</p>
        </section>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> I&apos;m handing out treats this year
        </label>

        {conflicts.length > 0 && (
          <div className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm">
            <p className="font-semibold text-danger">Heads up — these treats usually contain allergens you marked as avoided:</p>
            <ul className="list-inside list-disc">
              {conflicts.map((c, i) => <li key={i}>{c.candy} contains {allergenLabel(c.allergen).toLowerCase()}</li>)}
            </ul>
            <p className="text-muted">Untick the allergen or remove the treat. Parents of allergic kids rely on this.</p>
            <button type="button" className="text-xs text-muted underline" onClick={() => save(true)}>I&apos;ve checked the labels — save anyway</button>
          </div>
        )}
        {reverify && <p className="text-sm text-accent-text">Changing your legal name or address removes your verified badge until you verify again.</p>}
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Checking allergens…" : "Save"}</button>
      </form>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <MapFrame className="h-[50vh] lg:h-[calc(100dvh-8rem)]" title="Tap your front door">
          <LazyMap className="h-full w-full" center={center} zoom={17}
            pick={f.lat ? { lat: f.lat, lng: f.lng } : null} onMapClick={(p) => setF((s) => ({ ...s, lat: p.lat, lng: p.lng }))} />
        </MapFrame>
      </div>
    </div>
  );
}
