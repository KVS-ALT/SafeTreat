"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import LazyMap from "@/components/LazyMap";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import Icon from "@/components/Icon";
import MapFrame from "@/components/MapFrame";
import { api, timeAgo } from "@/lib/client";
import { allergenLabel } from "@/lib/allergens";
import type { MyHouse, NearbyReport } from "@/lib/houseTypes";

export default function HomeownerDashboard() {
  const me = useRequireMe();
  const [data, setData] = useState<{ house: MyHouse | null; nearbyReports: NearbyReport[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (me?.role === "HOMEOWNER") api<typeof data>("/api/houses/mine").then(setData).catch((e) => setErr(e.message));
  }, [me]);

  if (me && me.role !== "HOMEOWNER") {
    return <div className="card mx-auto mt-8 max-w-md">This page is for homeowner accounts. <Link className="text-accent-text" href="/signup?role=homeowner">Create one</Link>.</div>;
  }
  if (err) return <p className="text-danger">{err}</p>;
  if (!data) return <Loading />;

  const h = data.house;
  if (!h) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-8 text-center">
        <span className="well mx-auto grid h-16 w-16 place-items-center text-accent-text"><Icon name="house" size={30} /></span>
        <h1 className="display-lg">Put your house on the map</h1>
        <p className="text-muted">Tell parents what treats you&apos;re handing out and which allergens you avoid. Verify your ID to get the gold verified badge — verified houses are recommended first in route plans.</p>
        <Link href="/homeowner/house" className="btn-primary">Register my house</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="card">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">Your house</p><h1 className="display-lg">{h.displayName}</h1>
              <p className="text-sm text-muted">{h.address}</p>
            </div>
            <Link href="/homeowner/house" className="btn-ghost"><Icon name="edit" size={15} /> Edit</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`chip ${h.active ? "border-safe text-safe" : ""}`}>{h.active ? "● Handing out treats" : "○ Not participating"}</span>
            <span className="chip num"><Icon name="clock" size={13} /> {h.hoursStart}–{h.hoursEnd}</span>
            {h.nonFoodTreats && <span className="chip border-teal text-teal"><Icon name="star" size={13} /> Teal pumpkin</span>}
            {h.safetyFlag === "REPORTED" && <span className="chip border-danger text-danger"><Icon name="alert" size={13} /> Report nearby, hidden from suggestions</span>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="label">Treats</div>
              <ul className="space-y-1 text-sm">
                {h.candies.map((c, i) => (
                  <li key={i} className="flex items-center gap-2"><Icon name="candy" size={14} className="text-muted" /> {c.name} <span className="text-xs text-muted">{c.homemade ? "· homemade" : c.wrapped ? "· wrapped" : "· unwrapped"}</span></li>
                ))}
                {!h.candies.length && <li className="text-muted">None listed</li>}
              </ul>
            </div>
            <div>
              <div className="label">Allergen-free</div>
              <div className="flex flex-wrap gap-1">
                {h.allergenFree.map((a) => <span key={a} className="chip">{allergenLabel(a)}</span>)}
                {!h.allergenFree.length && <span className="text-sm text-muted">Not stated</span>}
              </div>
            </div>
          </div>
        </div>

        {data.nearbyReports.length > 0 && (
          <div className="card border-danger/60">
            <h2 className="font-semibold text-danger">Reports near your house</h2>
            <p className="mb-2 text-sm text-muted">Parents can see these. If you think one is wrong, contact the organisers.</p>
            <ul className="space-y-2 text-sm">
              {data.nearbyReports.map((r) => <li key={r.id}><b>{r.title}</b> <span className="text-muted">· {timeAgo(r.createdAt)}</span><br />{r.aiSummary}</li>)}
            </ul>
          </div>
        )}

        <MapFrame className="h-[40vh]">
          <LazyMap className="h-full w-full" center={[h.lat, h.lng]} zoom={17} houses={[{ ...h, verified: h.verificationStatus === "VERIFIED" }]} />
        </MapFrame>
      </div>

      <aside className="space-y-4">
        <VerificationCard h={h} />
      </aside>
    </div>
  );
}

function VerificationCard({ h }: { h: MyHouse }) {
  const s = h.verificationStatus;
  return (
    <div className={`card space-y-3 ${s === "VERIFIED" ? "!border-gold" : ""}`}>
      <h2 className="font-semibold">ID check</h2>
      {s === "VERIFIED" && (
        <>
          <p className="flex items-center gap-2 font-semibold text-gold"><Icon name="seal" /> ID checked: {h.verifiedName}</p>
          {h.idDocumentType && <p className="text-xs text-muted">{h.idDocumentType}, read by Gemma</p>}
          {h.addressMatchesId
            ? <p className="flex items-center gap-2 text-sm text-gold"><Icon name="check" size={15} /> Address matches your ID</p>
            : <p className="text-xs text-muted">Your ID address didn&apos;t match this house (or wasn&apos;t on the ID). That&apos;s OK; the badge is about your name.</p>}
          <p className="text-xs text-muted">Parents see the gold badge, never your legal name.</p>
        </>
      )}
      {s === "FAILED" && <p className="text-sm text-danger">Last check didn&apos;t pass{h.verificationNote ? `: ${h.verificationNote}` : "."}</p>}
      {(s === "UNVERIFIED" || s === "PENDING") && (
        <p className="text-sm text-muted">{h.verificationNote ?? "Upload a photo of your photo ID so parents know a real, accountable neighbour is handing out treats."}</p>
      )}
      {s !== "VERIFIED" && <Link href="/homeowner/verify" className="btn-primary w-full"><Icon name="seal" size={16} /> {s === "FAILED" ? "Try again" : "Check my ID"}</Link>}
    </div>
  );
}
