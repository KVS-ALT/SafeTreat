"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Loading from "@/components/Loading";
import { useRequireMe } from "@/components/useMe";
import { api } from "@/lib/client";

type St = { status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "FAILED"; note: string | null; verifiedName: string | null; idDocumentType: string | null; available: boolean };
type Result = { status: "VERIFIED" | "FAILED"; note: string | null; verifiedName: string | null; checks: { label: string; ok: boolean }[]; attemptsLeft: number };

export default function VerifyPage() {
  const me = useRequireMe();
  const [st, setSt] = useState<St | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const refresh = useCallback(() => api<St>("/api/verify").then(setSt).catch((e) => setErr(e.message)), []);
  useEffect(() => { if (me?.role === "HOMEOWNER") refresh(); }, [me, refresh]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File | null) {
    setErr("");
    setResult(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("id", file);
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The ID check failed.");
      pick(null); // clears the photo from memory
      setResult(data);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!me || !st) return err ? <p className="text-danger">{err}</p> : <Loading />;

  return (
    <div className="mx-auto max-w-xl space-y-4 pt-2">
      <div className="card space-y-5 !p-6">
        <span className="well grid h-12 w-12 place-items-center text-gold"><Icon name="seal" size={24} /></span>
        <div>
          <p className="eyebrow mb-2">Homeowner</p>
          <h1 className="display-lg">Check your ID</h1>
        </div>
        <p className="text-sm text-muted">
          Upload a photo of the front of your driver&apos;s licence, Ontario Photo Card or passport. Gemma reads the name and expiry date
          and we check them against the legal name on your house. You get a gold &ldquo;ID checked&rdquo; badge, and route suggestions rank you first.
        </p>
        <ul className="well space-y-1.5 p-3 text-xs text-muted">
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-safe" /> The photo is read once and thrown away. It&apos;s never saved, and we don&apos;t read your ID number or birth date.</li>
          <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-safe" /> Parents only see the badge, never your legal name.</li>
          <li className="flex gap-2"><Icon name="alert" size={14} className="mt-0.5 text-warn" /> This is an AI document read, not a bank-grade identity check: it can&apos;t detect forgeries or confirm the photo is you.</li>
        </ul>

        {st.status === "VERIFIED" && !result && (
          <p className="flex items-center gap-2 font-semibold text-gold"><Icon name="seal" /> ID checked: {st.verifiedName}</p>
        )}
        {!st.available && <p className="well border border-warn p-3 text-sm" style={{ borderWidth: "var(--border-w)" }}>ID checks aren&apos;t available on this server (Gemma isn&apos;t configured).</p>}

        {st.status !== "VERIFIED" && st.available && (
          <div className="space-y-3">
            <label className="label" htmlFor="idphoto">Photo of your ID</label>
            <input id="idphoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink" />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview of the ID photo you selected" className="max-h-64 w-full rounded-xl border border-line object-contain" />
            )}
            <p className="text-xs text-muted">Lay the card flat in good light with all four corners visible. JPEG, PNG or WebP, up to 8 MB.</p>
            <button className="btn-primary w-full" onClick={submit} disabled={!file || busy}>
              <Icon name="seal" size={16} /> {busy ? "Gemma is reading your ID… (up to a minute)" : "Check my ID"}
            </button>
          </div>
        )}

        {err && <p className="text-sm text-danger">{err}</p>}

        {result && (
          <div className={`well space-y-2 border p-4 ${result.status === "VERIFIED" ? "!border-gold" : "!border-danger"}`} style={{ borderWidth: "var(--border-w)" }}>
            <p className={`flex items-center gap-2 font-semibold ${result.status === "VERIFIED" ? "text-gold" : "text-danger"}`}>
              <Icon name={result.status === "VERIFIED" ? "seal" : "alert"} />
              {result.status === "VERIFIED" ? `ID checked: ${result.verifiedName}` : "That didn't pass"}
            </p>
            {result.note && <p className="text-sm">{result.note}</p>}
            <ul className="space-y-1 text-sm">
              {result.checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <Icon name={c.ok ? "check" : "x"} size={14} className={c.ok ? "text-safe" : "text-danger"} /> {c.label}
                </li>
              ))}
            </ul>
            {result.status === "FAILED" && <p className="text-xs text-muted">{result.attemptsLeft} attempt{result.attemptsLeft === 1 ? "" : "s"} left today.</p>}
          </div>
        )}

        <Link href="/homeowner" className="btn-ghost"><Icon name="back" size={15} /> Back to my house</Link>
      </div>
    </div>
  );
}
