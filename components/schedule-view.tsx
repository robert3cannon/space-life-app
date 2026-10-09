"use client";

import { useMemo, useState } from "react";
import { EVENT_META } from "@/lib/constants";
import { api } from "@/lib/client";
import { dayNumber, eventDay, formatTime, formatWeekday } from "@/lib/format";
import { addCalendarDays, getZonedParts, weekStartDate } from "@/lib/time";
import type { EventDto, EventType } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Board = {
  today: string;
  startDate: string | null;
  dates: string[];
  events: EventDto[];
};

type Draft = {
  id?: string;
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  reminder: string;
};

const empty = (date: string): Draft => ({
  title: "",
  type: "study",
  date,
  startTime: "16:00",
  endTime: "17:30",
  location: "",
  notes: "",
  reminder: "30",
});

export function ScheduleView() {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const path = anchor ? `/api/events?weekOf=${anchor}` : "/api/events";
  const { data, error, loading, reload } = useLoad<Board>(path);

  const today = data?.today ?? "";
  const active = selected ?? data?.today ?? "";
  const dates = data?.dates?.length ? data.dates : data?.startDate ? Array.from({ length: 7 }, (_, i) => addCalendarDays(data.startDate as string, i)) : [];
  const dayEvents = useMemo(() => (data?.events ?? []).filter((event) => eventDay(event.startsAt) === active), [data, active]);

  function shiftWeek(delta: number) {
    const base = anchor ?? data?.startDate ?? data?.today;
    if (!base) return;
    const next = addCalendarDays(weekStartDate(base), delta);
    setAnchor(next);
    setSelected(next);
  }

  function openNew() {
    setConfirmDelete(false);
    setFormError(null);
    setDraft(empty(active || today));
  }

  function openEdit(event: EventDto) {
    const start = getZonedParts(new Date(event.startsAt));
    const end = getZonedParts(new Date(event.endsAt));
    setConfirmDelete(false);
    setFormError(null);
    setDraft({
      id: event.id,
      title: event.title,
      type: event.type,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      location: event.location ?? "",
      notes: event.notes ?? "",
      reminder: event.reminderMinutesBefore == null ? "" : String(event.reminderMinutesBefore),
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      title: draft.title,
      type: draft.type,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      location: draft.location,
      notes: draft.notes,
      reminderMinutesBefore: draft.reminder === "" ? null : Number(draft.reminder),
    };
    try {
      if (draft.id) await api(`/api/events/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/events", { method: "POST", body: JSON.stringify(payload) });
      setDraft(null);
      toast(draft.id ? "Block updated" : "Block added");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/events/${draft.id}`, { method: "DELETE" });
      setDraft(null);
      toast("Block deleted");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page with-fab">
      <PageTitle title="Schedule" />
      <div className="day-nav" data-testid="day-nav">
        <div>
          <p className="kicker">Eastern time</p>
          <h1 className="display">Schedule</h1>
        </div>
        <div className="row">
          <button className="btn-ghost icon-btn" type="button" onClick={() => shiftWeek(-7)} aria-label="Previous week">‹</button>
          <button className="btn-ghost icon-btn" type="button" onClick={() => shiftWeek(7)} aria-label="Next week">›</button>
        </div>
      </div>
      <div className="seg" style={{ marginTop: 14 }}>
        <button type="button" className={mode === "day" ? "on" : undefined} onClick={() => setMode("day")}>Day</button>
        <button type="button" className={mode === "week" ? "on" : undefined} onClick={() => setMode("week")}>Week</button>
      </div>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data && mode === "day" ? (
        <>
          <div className="week">
            {dates.map((date) => (
              <button key={date} type="button" className={`day-btn ${date === active ? "on" : ""} ${date === today ? "today" : ""}`} onClick={() => setSelected(date)}>
                <em>{formatWeekday(date)}</em>
                <b>{dayNumber(date)}</b>
              </button>
            ))}
          </div>
          <div className="stack">
            {dayEvents.length === 0 ? <p className="muted">Open day. Add a block if you want one.</p> : null}
            {dayEvents.map((event) => (
              <button key={event.id} type="button" className="event" onClick={() => openEdit(event)}>
                <time>{formatTime(event.startsAt)}</time>
                <div>
                  <strong>{event.title}</strong>
                  <span>
                    <i className="pill" data-type={event.type}>{EVENT_META[event.type].label}</i>
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : null}
      {data && mode === "week" ? (
        <div className="stack">
          {dates.map((date) => {
            const items = data.events.filter((event) => eventDay(event.startsAt) === date);
            return (
              <section key={date} className="card">
                <button type="button" className="list-btn" onClick={() => { setSelected(date); setMode("day"); }}>
                  <div className="spread">
                    <strong>{formatWeekday(date)} {dayNumber(date)}</strong>
                    <span className="faint">{items.length ? `${items.length}` : "—"}</span>
                  </div>
                </button>
                <div className="stack" style={{ marginTop: 8 }}>
                  {items.map((event) => (
                    <button key={event.id} type="button" className="event" onClick={() => openEdit(event)}>
                      <time>{formatTime(event.startsAt)}</time>
                      <div>
                        <strong>{event.title}</strong>
                        <span>{EVENT_META[event.type].label}{event.location ? ` · ${event.location}` : ""}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      <button className="fab" type="button" onClick={openNew} aria-label="Add block">+</button>
      <Sheet open={Boolean(draft)} title={draft?.id ? "Edit block" : "New block"} onClose={() => setDraft(null)}>
        {draft ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="field"><span>Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
            <label className="field">
              <span>Type</span>
              <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as EventType })}>
                {Object.entries(EVENT_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </select>
            </label>
            <label className="field"><span>Day</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label>
            <div className="grid-2">
              <label className="field"><span>Start</span><input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} required /></label>
              <label className="field"><span>End</span><input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} required /></label>
            </div>
            <label className="field"><span>Place</span><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Optional" /></label>
            <label className="field"><span>Notes</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <label className="field">
              <span>Remind me</span>
              <select value={draft.reminder} onChange={(event) => setDraft({ ...draft, reminder: event.target.value })}>
                <option value="">No reminder</option>
                <option value="15">15 min before</option>
                <option value="30">30 min before</option>
                <option value="45">45 min before</option>
                <option value="60">1 hour before</option>
                <option value="90">90 min before</option>
              </select>
            </label>
            {formError ? <p className="err">{formError}</p> : null}
            <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            {draft.id ? (
              <button className="btn-danger" type="button" style={{ marginTop: 8 }} onClick={() => void remove()} disabled={saving}>
                {confirmDelete ? "Tap again to delete" : "Delete"}
              </button>
            ) : null}
          </form>
        ) : null}
      </Sheet>
    </main>
  );
}
