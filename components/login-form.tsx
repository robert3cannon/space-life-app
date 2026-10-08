"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Mark } from "./mark";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      const next = new URLSearchParams(window.location.search).get("next");
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <Mark />
      <p className="kicker" style={{ marginTop: 18 }}>Orbit</p>
      <h1 className="display">Your day, in one place.</h1>
      <p className="sub">Robert · East Lansing</p>
      <form onSubmit={(event) => void submit(event)} style={{ marginTop: 28 }}>
        <label className="field">
          <span>Passcode</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Enter"}</button>
      </form>
    </main>
  );
}
