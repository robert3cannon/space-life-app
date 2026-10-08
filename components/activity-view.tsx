"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatAgo } from "@/lib/format";
import type { ActivityDto } from "@/lib/types";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

export function ActivityView() {
  const { data, error, loading, reload } = useLoad<{ activity: ActivityDto[] }>("/api/feed?limit=50");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/feed", { method: "POST", body: JSON.stringify({ message }) });
      setMessage("");
      toast("Note added");
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <PageTitle title="Activity" />
      <p className="kicker">Feed</p>
      <h1 className="display">Activity</h1>
      <p className="sub">Notes from you and from the bots that share this app.</p>
      <form onSubmit={(event) => void send(event)} style={{ marginTop: 16 }}>
        <label className="field">
          <span>Leave a note</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} required />
        </label>
        <button className="btn" disabled={saving || !message.trim()} type="submit">{saving ? "Posting…" : "Post"}</button>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        {loading && !data ? <Loading rows={2} /> : null}
        {error ? <ErrorNote message={error} onRetry={reload} /> : null}
        {data?.activity.map((item) => (
          <article key={item.id} className="card">
            <div className="spread">
              <strong>{item.author || "Orbit"}</strong>
              <span className="faint">{formatAgo(item.createdAt)} · {item.source}</span>
            </div>
            <p style={{ margin: "8px 0 0" }}>{item.message}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
