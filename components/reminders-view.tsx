"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";
import { getZonedParts } from "@/lib/time";
import type { ReminderDto } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Payload = { upcoming: ReminderDto[]; recentSent: ReminderDto[] };

export function RemindersView() {
  const { data, error, loading, reload } = useLoad<Payload>("/api/reminders");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  function start() {
    const parts = getZonedParts(new Date());
    setTitle("");
    setBody("");
    setDate(parts.date);
    setTime("21:00");
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await api("/api/reminders", { method: "POST", body: JSON.stringify({ title, body, date, time }) });
      setOpen(false);
      toast("Reminder set");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/reminders/${id}`, { method: "DELETE" });
    toast("Reminder cleared");
    await reload();
  }

  return (
    <main className="page">
      <PageTitle title="Reminders" />
      <p className="kicker">Nudges</p>
      <h1 className="display" style={{ fontSize: 32 }}>Reminders</h1>
      <p className="sub">Before blocks, meals, and workouts — plus anything you add.</p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="section-title"><h2>Upcoming</h2></div>
          <div className="stack">
            {data.upcoming.length === 0 ? <p className="muted">Nothing pending.</p> : null}
            {data.upcoming.map((reminder) => (
              <article key={reminder.id} className="card">
                <div className="spread">
                  <span className="pill" data-type={reminder.kind === "meal" ? "meal-kind" : reminder.kind}>{reminder.kind}</span>
                  <button className="text-btn" type="button" onClick={() => void remove(reminder.id)}>Clear</button>
                </div>
                <strong style={{ display: "block", marginTop: 8 }}>{reminder.title}</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>{reminder.body}</p>
                <p className="faint" style={{ margin: "6px 0 0" }}>{formatWhen(reminder.fireAt)}</p>
              </article>
            ))}
          </div>
          <div className="section-title"><h2>Sent</h2></div>
          <div className="stack">
            {data.recentSent.length === 0 ? <p className="muted">Delivered reminders show up here.</p> : null}
            {data.recentSent.map((reminder) => (
              <article key={reminder.id} className="event">
                <time>{reminder.sentAt ? formatWhen(reminder.sentAt) : ""}</time>
                <div>
                  <strong>{reminder.title}</strong>
                  <span>{reminder.body}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
      <button className="fab" type="button" aria-label="Add reminder" onClick={start}>+</button>
      <Sheet open={open} title="New reminder" onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label className="field"><span>Note</span><textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="grid-2">
            <label className="field"><span>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          </div>
          {formError ? <p className="err">{formError}</p> : null}
          <button className="btn" disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</button>
        </form>
      </Sheet>
    </main>
  );
}
