"use client";

import { useState } from "react";
import { MEAL_META } from "@/lib/constants";
import { api } from "@/lib/client";
import { dayNumber, formatLongDate, formatTime, formatWeekday } from "@/lib/format";
import { addCalendarDays, getZonedParts } from "@/lib/time";
import type { FoodDto, MealType, Targets } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, Meter, PageTitle, Ring } from "./ui";

type DayPayload = {
  today: string;
  date: string;
  targets: Targets;
  totals: Targets;
  logs: FoodDto[];
  recent: FoodDto[];
};

type WeekPayload = {
  dates: string[];
  days: Array<Targets & { date: string }>;
  totals: Targets;
  targets: Targets;
};

type Draft = {
  id?: string;
  name: string;
  meal: MealType;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  time: string;
};

const blank = (meal: MealType): Draft => ({
  name: "",
  meal,
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  time: getZonedParts(new Date()).time,
});

export function FoodView() {
  const [date, setDate] = useState<string | null>(null);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const dayPath = date ? `/api/food?date=${date}` : "/api/food";
  const day = useLoad<DayPayload>(dayPath);
  const active = day.data?.date ?? date ?? "";
  const week = useLoad<WeekPayload>(active ? `/api/food/summary?date=${active}` : "/api/food/summary");

  function openNew(meal: MealType = "snack") {
    setFormError(null);
    setConfirmDelete(false);
    setDraft(blank(meal));
  }

  function openEdit(log: FoodDto) {
    setFormError(null);
    setConfirmDelete(false);
    setDraft({
      id: log.id,
      name: log.name,
      meal: log.meal,
      calories: String(log.calories),
      proteinG: String(log.proteinG),
      carbsG: String(log.carbsG),
      fatG: String(log.fatG),
      time: getZonedParts(new Date(log.loggedAt)).time,
    });
  }

  async function relog(food: FoodDto) {
    try {
      await api("/api/food", {
        method: "POST",
        body: JSON.stringify({
          name: food.name,
          meal: food.meal,
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
        }),
      });
      toast(`Logged ${food.name}`);
      await day.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't log");
    }
  }

  async function save() {
    if (!draft || !day.data) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      name: draft.name,
      meal: draft.meal,
      calories: Number(draft.calories),
      proteinG: Number(draft.proteinG || 0),
      carbsG: Number(draft.carbsG || 0),
      fatG: Number(draft.fatG || 0),
      date: day.data.date,
      time: draft.time,
    };
    if ([payload.calories, payload.proteinG, payload.carbsG, payload.fatG].some((value) => Number.isNaN(value))) {
      setFormError("Use numbers for calories and macros");
      setSaving(false);
      return;
    }
    try {
      if (draft.id) await api(`/api/food/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/api/food", { method: "POST", body: JSON.stringify(payload) });
      setDraft(null);
      toast(draft.id ? "Updated" : "Logged");
      await day.reload();
      if (mode === "week") await week.reload();
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
    await api(`/api/food/${draft.id}`, { method: "DELETE" });
    setDraft(null);
    toast("Removed");
    await day.reload();
  }

  const maxBar = Math.max(1, ...(week.data?.days.map((item) => item.calories) ?? [1]));

  return (
    <main className="page">
      <PageTitle title="Food" />
      <p className="kicker">Intake</p>
      <div className="spread">
        <h1 className="display" style={{ fontSize: 32 }}>{active ? formatLongDate(active).split(",")[0] : "Food"}</h1>
        <div className="row">
          <button className="btn-ghost" style={{ width: 44, padding: 0 }} type="button" aria-label="Previous day" onClick={() => active && setDate(addCalendarDays(active, -1))}>‹</button>
          <button className="btn-ghost" style={{ width: 44, padding: 0 }} type="button" aria-label="Next day" onClick={() => active && setDate(addCalendarDays(active, 1))}>›</button>
        </div>
      </div>
      <p className="sub">{active ? formatLongDate(active) : ""}</p>
      <div className="seg" style={{ marginTop: 14 }}>
        <button type="button" className={mode === "day" ? "on" : undefined} onClick={() => setMode("day")}>Day</button>
        <button type="button" className={mode === "week" ? "on" : undefined} onClick={() => setMode("week")}>Week</button>
      </div>
      {day.loading && !day.data ? <Loading /> : null}
      {day.error ? <ErrorNote message={day.error} onRetry={day.reload} /> : null}
      {day.data && mode === "day" ? (
        <>
          <section className="card">
            <div className="fuel">
              <Ring value={day.data.totals.calories} max={day.data.targets.calories} />
              <div>
                <Meter label="Protein" value={day.data.totals.proteinG} max={day.data.targets.proteinG} unit="g" tone="protein" />
                <Meter label="Carbs" value={day.data.totals.carbsG} max={day.data.targets.carbsG} unit="g" tone="carbs" />
                <Meter label="Fat" value={day.data.totals.fatG} max={day.data.targets.fatG} unit="g" tone="fat" />
              </div>
            </div>
          </section>
          {day.data.recent.length ? (
            <>
              <div className="section-title"><h2>Recent</h2></div>
              <div className="chips">
                {day.data.recent.map((food) => (
                  <button key={food.id} className="chip" type="button" onClick={() => void relog(food)}>
                    {food.name} · {food.calories}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => {
            const logs = day.data!.logs.filter((log) => log.meal === meal);
            return (
              <section key={meal}>
                <div className="section-title">
                  <h2>{MEAL_META[meal].label}</h2>
                  <button className="text-btn" type="button" onClick={() => openNew(meal)}>Add</button>
                </div>
                <div className="stack">
                  {logs.length === 0 ? <p className="faint">Nothing yet.</p> : null}
                  {logs.map((log) => (
                    <button key={log.id} className="event" type="button" onClick={() => openEdit(log)}>
                      <time className="num">{log.calories}</time>
                      <div>
                        <strong>{log.name}</strong>
                        <span>{log.proteinG}p · {log.carbsG}c · {log.fatG}f · {formatTime(log.loggedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
      {mode === "week" && week.data ? (
        <section className="card">
          <p className="kicker">This week</p>
          <h2 style={{ margin: "8px 0" }} className="num">{week.data.totals.calories} kcal</h2>
          <div className="bars" aria-hidden>
            {week.data.days.map((item) => (
              <div key={item.date}>
                <i style={{ height: `${Math.max(6, (item.calories / maxBar) * 100)}%` }} />
                <em>{formatWeekday(item.date).slice(0, 1)}</em>
              </div>
            ))}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {week.data.days.map((item) => (
              <button key={item.date} className="spread list-btn" type="button" onClick={() => { setDate(item.date); setMode("day"); }}>
                <span>{formatWeekday(item.date)} {dayNumber(item.date)}</span>
                <b className="num">{item.calories}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {mode === "week" && week.error ? <ErrorNote message={week.error} onRetry={week.reload} /> : null}
      <button className="fab" type="button" onClick={() => openNew("snack")} aria-label="Log food">+</button>
      <Sheet open={Boolean(draft)} title={draft?.id ? "Edit food" : "Log food"} onClose={() => setDraft(null)}>
        {draft ? (
          <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <label className="field"><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
            <label className="field">
              <span>Meal</span>
              <select value={draft.meal} onChange={(event) => setDraft({ ...draft, meal: event.target.value as MealType })}>
                {Object.entries(MEAL_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label className="field"><span>Calories</span><input inputMode="numeric" value={draft.calories} onChange={(event) => setDraft({ ...draft, calories: event.target.value })} required /></label>
              <label className="field"><span>Time</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} required /></label>
            </div>
            <div className="grid-2">
              <label className="field"><span>Protein (g)</span><input inputMode="decimal" value={draft.proteinG} onChange={(event) => setDraft({ ...draft, proteinG: event.target.value })} /></label>
              <label className="field"><span>Carbs (g)</span><input inputMode="decimal" value={draft.carbsG} onChange={(event) => setDraft({ ...draft, carbsG: event.target.value })} /></label>
            </div>
            <label className="field"><span>Fat (g)</span><input inputMode="decimal" value={draft.fatG} onChange={(event) => setDraft({ ...draft, fatG: event.target.value })} /></label>
            {formError ? <p className="err">{formError}</p> : null}
            <button className="btn" disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</button>
            {draft.id ? <button className="btn-danger" style={{ marginTop: 8 }} type="button" onClick={() => void remove()}>{confirmDelete ? "Tap again to delete" : "Delete"}</button> : null}
          </form>
        ) : null}
      </Sheet>
    </main>
  );
}
