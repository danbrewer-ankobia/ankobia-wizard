"use client";

import { useEffect, useState } from "react";
import { LibraryPanel } from "./LibraryPanel";
import { ModelsPanel } from "./ModelsPanel";

type Session = { configured: boolean; authenticated: boolean };
type Tab = "models" | "library";

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("models");

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then(setSession);
  }, []);

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setSession((s) => (s ? { ...s, authenticated: false } : s));
  }

  if (!session) return <p className="py-16 text-center text-muted">Loading…</p>;

  if (!session.configured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="card">
          <h1 className="mb-2 text-xl font-bold text-navy">Admin isn&apos;t set up yet</h1>
          <p className="text-sm text-muted">
            Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SECRET</code> (16+ random characters) in the server environment, then
            restart the app. See the README for details.
          </p>
        </div>
      </div>
    );
  }

  if (!session.authenticated) return <Login onDone={() => setSession({ ...session, authenticated: true })} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Admin settings</h1>
          <p className="text-sm text-muted">Manage AI providers, models, and the prompt library.</p>
        </div>
        <button type="button" className="btn" onClick={logout}>
          Sign out
        </button>
      </div>
      <div role="tablist" className="mb-6 flex gap-1 border-b border-line">
        {(
          [
            ["models", "AI models & keys"],
            ["library", "Prompt library"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === id ? "border-teal text-navy" : "border-transparent text-muted hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "models" ? <ModelsPanel /> : <LibraryPanel />}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else setError((await res.json().catch(() => ({}))).error ?? "Sign-in failed.");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="text-xl font-bold text-navy">Admin sign-in</h1>
        <div>
          <label className="label" htmlFor="pw">
            Password
          </label>
          <input
            id="pw"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
