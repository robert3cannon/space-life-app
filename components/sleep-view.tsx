"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatHours, formatLongDate, formatTime, formatWeekday, formatWhen } from "@/lib/format";
import { addCalendarDays, getZonedParts } from "@/lib/time";
import type { SleepDto } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type SleepDay = {
  date: string;
  today: string;
  log: SleepDto | null;
  week: {
    startDate: string;
    days: { date: string; durationMinutes: number | null; quality: number | null }[];
    averageMinutes: number | null;
    trendMinutes: number | null;
  };
};

type Draft = {
  mode: "times" | "duration";
  bedtime: string;
  wakeTime: string;
  hours: string;
  minutes: string;
  quality: number | null;
};

const emptyDraft = (): Draft => ({
  mode: "times",
  bedtime: "01:30",
  wakeTime: "11:00",
  hours: "9",
  minutes: "30",
  quality: null,
});

function trendCopy(week: SleepDay["week"]) {
  if (week.averageMinutes == null) return "No sleep logged this week yet.";
  const avg = formatHours(week.averageMinutes);
  if (week.trendMinutes == null) return `Averaging ${avg} this week.`;
  if (week.trendMinutes === 0) return `Averaging ${avg}, same as last week.`;
  const direction = week.trendMinutes > 0 ? "up" : "down";
  return `Averaging ${avg}, ${direction} ${formatHours(Math.abs(week.trendMinutes))} from last week.`;
}

export function SleepView() {
  const [date, setDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const path = date ? `/api/sleep?date=${date}` : "/api/sleep";
  const day = useLoad<SleepDay>(path);
  const active = day.data?.date ?? date ?? "";

  function openLog() {
    const log = day.data?.log;
    if (log?.bedtime && log.wakeAt) {
      setDraft({
        mode: "times",
        bedtime: getZonedParts(new Date(log.bedtime)).time,
        wakeTime: getZonedParts(new Date(log.wakeAt)).time,
        hours: String(Math.floor(log.durationMinutes / 60)),
        minutes: String(log.durationMinutes % 60),
        quality: log.quality,
      });
    } else if (log) {
      setDraft({
        ...emptyDraft(),
        mode: "duration",
        hours: String(Math.floor(log.durationMinutes / 60)),
        minutes: String(log.durationMinutes % 60),
        quality: log.quality,
      });
    } else {
      setDraft(emptyDraft());
    }
    setFormError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !active) return;
    setSaving(true);
    setFormError(null);
    const payload =
      draft.mode === "times"
        ? { date: active, bedtime: draft.bedtime, wakeTime: draft.wakeTime, quality: draft.quality }
        : {
            date: active,
            durationMinutes: Number(draft.hours) * 60 + Number(draft.minutes),
            quality: draft.quality,
          };
    try {
      await api("/api/sleep", { method: "POST", body: JSON.stringify(payload) });
      setDraft(null);
      toast("Sleep logged");
      await day.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save sleep");
    } finally {
      setSaving(false);
    }
  }

  async function clearLog() {
    if (!day.data?.log) return;
    try {
      await api(`/api/sleep/${day.data.log.id}`, { method: "DELETE" });
      toast("Cleared");
      await day.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't clear sleep");
    }
  }

  const maxBar = Math.max(1, ...(day.data?.week.days.map((item) => item.durationMinutes ?? 0) ?? [1]));

  return (
    <main className="page">
      <PageTitle title="Sleep" />
      <p className="kicker">Sleep</p>
      <div className="spread">
        <h1 className="display">Sleep</h1>
        <div className="row">
          <button className="btn-ghost icon-btn" type="button" aria-label="Previous morning" onClick={() => active && setDate(addCalendarDays(active, -1))}>‹</button>
          <button className="btn-ghost icon-btn" type="button" aria-label="Next morning" disabled={Boolean(day.data && active >= day.data.today)} onClick={() => active && setDate(addCalendarDays(active, 1))}>›</button>
        </div>
      </div>
      <p className="sub">{active ? formatLongDate(active) : "The morning you woke up"}</p>

      {day.loading && !day.data ? <Loading /> : null}
      {day.error ? <ErrorNote message={day.error} onRetry={day.reload} /> : null}
      {day.data ? (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            {day.data.log ? (
              <>
                <p className="kicker">That morning</p>
                <p className="stat">{formatHours(day.data.log.durationMinutes)}</p>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {day.data.log.bedtime && day.data.log.wakeAt
                    ? `${formatWhen(day.data.log.bedtime)} to ${formatTime(day.data.log.wakeAt)}`
                    : "Duration only"}
                  {day.data.log.quality ? ` · ${day.data.log.quality} of 5` : ""}
                  {day.data.log.source === "health" ? " · Apple Health" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="kicker">Nothing logged</p>
                <p className="stat">Log last night</p>
                <p className="muted" style={{ margin: "8px 0 0" }}>A bedtime after midnight still belongs to this morning.</p>
              </>
            )}
            <div className="stack" style={{ marginTop: 14 }}>
              <button className="btn" type="button" onClick={openLog}>{day.data.log ? "Edit sleep" : "Log sleep"}</button>
              {day.data.log ? (
                <button className="btn-ghost" type="button" onClick={() => void clearLog()}>Clear this night</button>
              ) : null}
            </div>
          </section>

          <div className="section-title">
            <h2>This week</h2>
          </div>
          <section className="card">
            <p style={{ marginTop: 0 }}>{trendCopy(day.data.week)}</p>
            <div className="bars" aria-hidden>
              {day.data.week.days.map((item) => (
                <div key={item.date}>
                  <i style={{ height: `${item.durationMinutes ? Math.max(8, (item.durationMinutes / maxBar) * 100) : 0}%`, minHeight: item.durationMinutes ? 4 : 0 }} />
                  <em>{formatWeekday(item.date)}</em>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <Sheet open={Boolean(draft)} title="Log sleep" onClose={() => setDraft(null)}>
        {draft ? (
          <form onSubmit={(event) => void save(event)}>
            <div className="seg">
              <button type="button" className={draft.mode === "times" ? "on" : undefined} onClick={() => setDraft({ ...draft, mode: "times" })}>Bed and wake</button>
              <button type="button" className={draft.mode === "duration" ? "on" : undefined} onClick={() => setDraft({ ...draft, mode: "duration" })}>Duration</button>
            </div>
            {draft.mode === "times" ? (
              <div className="grid-2" style={{ marginTop: 14 }}>
                <label className="field">
                  <span>Bedtime</span>
                  <input type="time" value={draft.bedtime} onChange={(event) => setDraft({ ...draft, bedtime: event.target.value })} />
                </label>
                <label className="field">
                  <span>Wake</span>
                  <input type="time" value={draft.wakeTime} onChange={(event) => setDraft({ ...draft, wakeTime: event.target.value })} />
                </label>
              </div>
            ) : (
              <div className="grid-2" style={{ marginTop: 14 }}>
                <label className="field">
                  <span>Hours</span>
                  <input inputMode="numeric" value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} />
                </label>
                <label className="field">
                  <span>Minutes</span>
                  <input inputMode="numeric" value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: event.target.value })} />
                </label>
              </div>
            )}
            <p className="faint">If you went to bed after midnight, use that time. It still counts toward the morning you woke up. Defaults assume a 1:30 AM bedtime and an 11:00 AM wake.</p>
            <p className="field" style={{ marginBottom: 8 }}><span>Quality, optional</span></p>
            <div className="quality" role="group" aria-label="Sleep quality">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  className={draft.quality === score ? "on" : undefined}
                  aria-pressed={draft.quality === score}
                  onClick={() => setDraft({ ...draft, quality: draft.quality === score ? null : score })}
                >
                  {score}
                </button>
              ))}
            </div>
            {formError ? <p className="err">{formError}</p> : null}
            <button className="btn" type="submit" disabled={saving} style={{ marginTop: 14 }}>Save</button>
          </form>
        ) : null}
      </Sheet>
    </main>
  );
}
