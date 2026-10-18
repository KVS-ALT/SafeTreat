"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import Icon from "./Icon";
import Logo from "./Logo";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"PARENT" | "HOMEOWNER">(params.get("role") === "homeowner" ? "HOMEOWNER" : "PARENT");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const user = await api<{ role: string }>(`/api/auth/${mode}`, { method: "POST", body: mode === "signup" ? { username, password, role } : { username, password } });
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : user.role === "HOMEOWNER" ? "/homeowner" : "/plan");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-8">
      <form onSubmit={submit} className="card space-y-5 !p-7">
        <div className="flex flex-col items-start gap-3"><Logo size={40} /><h1 className="display-lg">{mode === "login" ? "Welcome back" : "Join SafeTreat"}</h1></div>
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-2">
            {([["PARENT", "user", "Parent", "Plan routes, get alerts"], ["HOMEOWNER", "house", "Homeowner", "List your treats, get verified"]] as const).map(([r, e, t, d]) => (
              <button type="button" key={r} onClick={() => setRole(r)} aria-pressed={role === r} style={{ borderWidth: "var(--border-w)" }}
                className={`well border p-3 text-left transition-colors ${role === r ? "!border-accent !bg-accent/10" : "border-line hover:border-line-strong"}`}>
                <Icon name={e} size={20} className="text-accent-text" />
                <div className="mt-2 text-sm font-semibold">{t}</div>
                <div className="text-xs text-muted">{d}</div>
              </button>
            ))}
          </div>
        )}
        <div>
          <label className="label" htmlFor="u">Username</label>
          <input id="u" className="input" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p">Password</label>
          <input id="p" className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required
            minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : mode === "login" ? "Log in" : "Create account"}</button>
        <p className="text-center text-sm text-muted">
          {mode === "login" ? <>New here? <Link className="text-accent-text" href="/signup">Sign up</Link></> : <>Have an account? <Link className="text-accent-text" href="/login">Log in</Link></>}
        </p>
      </form>
    </div>
  );
}
