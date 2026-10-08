"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { formatLongDate } from "@/lib/format";
import { calendarWeekday } from "@/lib/time";
import type { HabitAuto, HabitSummary } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Board = { date: string; today: string; habits: HabitSummary[] };
type MonthDay = { date: string; scheduled: boolean; done: boolean; source: "manual" | "auto" | "skip" | null };
type MonthPayload = { habit: HabitSummary; month: string; today: string; days: MonthDay[] };

const WEEK = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

const AUTO_OPTIONS: { value: "" | HabitAuto; label: string }[] = [
  { value: "", label: "I'll check it" },
  { value: "protein", label: "Hit protein goal" },
  { value: "water", label: "Hit water goal" },
  { value: "workout", label: "Finish a workout" },
  { value: "steps", label: "10,000 steps" },
];

function scheduleLabel(days: number[] | null) {
  if (!days) return "Every day";
  return WEEK.filter((item) => days.includes(item.day)).map((item) => item.label).join(" ");
}

function autoLabel(auto: HabitAuto | null) {
  if (auto === "protein") return "Fills in from protein";
  if (auto === "water") return "Fills in from water";
  if (auto === "workout") return "Fills in from a workout";
  if (auto === "steps") return "Fills in at 10,000 steps";
  return null;
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function streakLabel(count: number) {
  return count === 1 ? "1 day" : `${count} days`;
}

export function HabitsView() {
  const board = useLoad<Board>("/api/habits");
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const toast = useToast();
  const activeMonth = month ?? board.data?.today.slice(0, 7) ?? "";

  async function toggle(habit: HabitSummary) {
    const before = habit.currentStreak;
    try {
      const next = await api<HabitSummary>(`/api/habits/${habit.id}/check`, {
        method: "POST",
        body: JSON.stringify({ done: !habit.done, date: board.data?.today }),
      });
      if (next.currentStreak > before) setBurst(habit.id);
      setRev((value) => value + 1);
      await board.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update that habit");
    }
  }

  function openCreate() {
    setFormError(null);
    setDraft({ name: "", daily: true, days: [1, 2, 3, 4, 5], auto: "", remind: false });
  }

  function openEdit(habit: HabitSummary) {
    setFormError(null);
    setDraft({
      id: habit.id,
      name: habit.name,
      daily: habit.days == null,
      days: habit.days ?? [1, 2, 3, 4, 5],
      auto: habit.auto ?? "",
      remind: habit.remind,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError("Name the habit");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      name: draft.name.trim(),
      days: draft.daily ? null : draft.days,
      auto: draft.auto || null,
      remind: draft.remind,
    };
    try {
      if (draft.id) await api(`/api/habits/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/habits", { method: "POST", body: JSON.stringify(payload) });
      setDraft(null);
      toast(draft.id ? "Updated" : "Habit added");
      setRev((value) => value + 1);
      await board.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/habits/${id}`, { method: "DELETE" });
      if (selected === id) setSelected(null);
      setDraft(null);
      toast("Deleted");
      await board.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 520);
    return () => window.clearTimeout(timer);
  }, [burst]);

  return (
    <main className="page with-fab">
      <PageTitle title="Habits" />
      <p className="kicker">Habits</p>
      <h1 className="display">Habits</h1>
      <p className="sub">{board.data ? formatLongDate(board.data.today) : "Streaks and the month"}</p>

      {board.loading && !board.data ? <Loading /> : null}
      {board.error ? <ErrorNote message={board.error} onRetry={board.reload} /> : null}
      {board.data ? (
        <div className="stack" style={{ marginTop: 16 }}>
          {board.data.habits.length === 0 ? <p className="muted">No habits yet. Add protein, stretching, reading, or anything you want to keep.</p> : null}
          {board.data.habits.map((habit) => (
            <article key={habit.id} className="card habit-card">
              <div className="habit-row">
                <button
                  className="check-btn"
                  type="button"
                  aria-pressed={habit.done}
                  aria-label={habit.done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                  disabled={!habit.scheduled}
                  onClick={() => void toggle(habit)}
                >
                  <span className={`check-mark ${habit.done ? "on" : ""}`} aria-hidden>{habit.done ? "✓" : ""}</span>
                </button>
                <button className="habit-open" type="button" aria-expanded={selected === habit.id} onClick={() => setSelected(selected === habit.id ? null : habit.id)}>
                  <strong>{habit.name}</strong>
                  <span className="faint">
                    {scheduleLabel(habit.days)}
                    {habit.scheduled ? "" : " · not today"}
                    {autoLabel(habit.auto) ? ` · ${autoLabel(habit.auto)}` : ""}
                  </span>
                </button>
                <p className={`streak ${burst === habit.id ? "streak-pop" : ""}`} aria-live="polite">
                  <strong>{streakLabel(habit.currentStreak)}</strong>
                  <span className="faint">Best {habit.bestStreak}</span>
                </p>
              </div>
              {selected === habit.id && activeMonth && board.data ? (
                <HabitMonth
                  key={`${habit.id}-${activeMonth}-${rev}`}
                  id={habit.id}
                  month={activeMonth}
                  today={board.data.today}
                  onMonth={setMonth}
                  onEdit={() => openEdit(habit)}
                  onChanged={() => {
                    setRev((value) => value + 1);
                    void board.reload();
                  }}
                />
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <button className="fab" type="button" aria-label="Add habit" onClick={openCreate}>+</button>

      <Sheet open={Boolean(draft)} title={draft?.id ? "Edit habit" : "New habit"} onClose={() => setDraft(null)}>
        {draft ? (
          <form onSubmit={(event) => void save(event)}>
            <label className="field">
              <span>Name</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
            </label>
            <div className="chips" role="group" aria-label="Schedule">
              <button type="button" className={`chip ${draft.daily ? "on" : ""}`} onClick={() => setDraft({ ...draft, daily: true })}>Daily</button>
              {WEEK.map((item) => (
                <button
                  key={item.day}
                  type="button"
                  className={`chip ${!draft.daily && draft.days.includes(item.day) ? "on" : ""}`}
                  onClick={() => {
                    const days = draft.days.includes(item.day) ? draft.days.filter((day) => day !== item.day) : [...draft.days, item.day];
                    setDraft({ ...draft, daily: false, days: days.length ? days : [item.day] });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              <span>Auto-complete</span>
              <select value={draft.auto} onChange={(event) => setDraft({ ...draft, auto: event.target.value as Draft["auto"] })}>
                {AUTO_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Evening reminder</span>
              <select value={draft.remind ? "yes" : "no"} onChange={(event) => setDraft({ ...draft, remind: event.target.value === "yes" })}>
                <option value="no">Off</option>
                <option value="yes">Include if still open</option>
              </select>
            </label>
            <p className="faint">The evening time is in Settings. It never fires in the morning.</p>
            {formError ? <p className="err">{formError}</p> : null}
            <button className="btn" type="submit" disabled={saving}>Save</button>
            {draft.id ? (
              <button className="btn-danger" type="button" style={{ marginTop: 10 }} onClick={() => void remove(draft.id!)}>Delete habit</button>
            ) : null}
          </form>
        ) : null}
      </Sheet>
    </main>
  );
}

type Draft = {
  id?: string;
  name: string;
  daily: boolean;
  days: number[];
  auto: "" | HabitAuto;
  remind: boolean;
};

function HabitMonth({
  id,
  month,
  today,
  onMonth,
  onEdit,
  onChanged,
}: {
  id: string;
  month: string;
  today: string;
  onMonth: (month: string) => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const history = useLoad<MonthPayload>(`/api/habits/${id}?month=${month}`);
  const toast = useToast();
  const data = history.data;
  const lead = data ? (calendarWeekday(data.days[0]?.date ?? `${month}-01`) + 6) % 7 : 0;

  async function toggleDay(day: MonthDay) {
    if (!data || day.date > data.today || !day.scheduled) return;
    try {
      await api(`/api/habits/${id}/check`, {
        method: "POST",
        body: JSON.stringify({ date: day.date, done: !day.done }),
      });
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update that day");
    }
  }

  if (history.loading && !data) return <Loading rows={1} />;
  if (history.error) return <ErrorNote message={history.error} onRetry={history.reload} />;
  if (!data) return null;
  return (
    <div className="habit-history">
      <div className="spread">
        <button className="text-btn" type="button" onClick={() => onMonth(shiftMonth(data.month, -1))}>Prev</button>
        <strong>{monthTitle(data.month)}</strong>
        <button className="text-btn" type="button" onClick={() => onMonth(shiftMonth(data.month, 1))}>Next</button>
      </div>
      <div className="cal" aria-label={`${data.habit.name} in ${monthTitle(data.month)}`}>
        {WEEK.map((item) => (
          <span key={item.label} className="dow">{item.label}</span>
        ))}
        {Array.from({ length: lead }, (_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {data.days.map((day) => {
          const future = day.date > data.today;
          if (!day.scheduled) return <span key={day.date} className="off">{Number(day.date.slice(8))}</span>;
          const missed = !day.done && !future && day.date < data.today;
          return (
            <button
              key={day.date}
              type="button"
              className={`${day.done ? "done" : ""} ${missed ? "missed" : ""} ${day.date === today ? "today" : ""}`}
              disabled={future}
              aria-pressed={day.done}
              aria-label={`${formatLongDate(day.date)}, ${day.done ? "done" : "not done"}`}
              onClick={() => void toggleDay(day)}
            >
              {Number(day.date.slice(8))}
            </button>
          );
        })}
      </div>
      <button className="btn-ghost" type="button" onClick={onEdit}>Edit habit</button>
    </div>
  );
}
