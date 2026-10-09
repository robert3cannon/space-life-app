"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatLongDate, formatTime, formatWeekday } from "@/lib/format";
import { addCalendarDays } from "@/lib/time";
import type { WaterDto } from "@/lib/types";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle, Ring } from "./ui";

type WaterDay = {
  date: string;
  today: string;
  goalOz: number;
  totalOz: number;
  logs: WaterDto[];
  healthOz: number | null;
  week: { startDate: string; days: { date: string; ounces: number }[] };
};

const QUICK = [8, 16, 24];

function oz(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function WaterView() {
  const [date, setDate] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("12");
  const [goal, setGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const path = date ? `/api/water?date=${date}` : "/api/water";
  const day = useLoad<WaterDay>(path);
  const active = day.data?.date ?? date ?? "";
  const goalValue = goal ?? (day.data ? String(day.data.goalOz) : "100");

  async function add(ounces: number, at = active) {
    setSaving(true);
    try {
      await api("/api/water", { method: "POST", body: JSON.stringify({ ounces, date: at, time: undefined }) });
      toast(`Added ${oz(ounces)} oz`);
      setCustom(false);
      await day.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't log water");
    } finally {
      setSaving(false);
    }
  }

  async function addCustom(event: React.FormEvent) {
    event.preventDefault();
    const ounces = Number(amount);
    if (!Number.isFinite(ounces) || ounces <= 0) {
      setFormError("Enter ounces greater than 0");
      return;
    }
    setFormError(null);
    await add(ounces);
  }

  async function remove(log: WaterDto) {
    try {
      await api(`/api/water/${log.id}`, { method: "DELETE" });
      toast("Removed");
      await day.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't remove that");
    }
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    const waterGoalOz = Number(goalValue);
    if (!Number.isInteger(waterGoalOz) || waterGoalOz < 8) {
      toast("Goal should be a whole number, at least 8 oz");
      return;
    }
    try {
      await api("/api/settings", { method: "PATCH", body: JSON.stringify({ waterGoalOz }) });
      toast("Goal saved");
      setGoal(null);
      await day.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the goal");
    }
  }

  const maxBar = Math.max(1, ...(day.data?.week.days.map((item) => item.ounces) ?? [1]));

  return (
    <main className="page">
      <PageTitle title="Water" />
      <p className="kicker">Water</p>
      <div className="day-nav" data-testid="day-nav">
        <h1 className="display">Water</h1>
        <div className="row">
          <button className="btn-ghost icon-btn" type="button" aria-label="Previous day" onClick={() => active && setDate(addCalendarDays(active, -1))}>‹</button>
          <button className="btn-ghost icon-btn" type="button" aria-label="Next day" disabled={Boolean(day.data && active >= day.data.today)} onClick={() => active && setDate(addCalendarDays(active, 1))}>›</button>
        </div>
      </div>
      <p className="sub">{active ? formatLongDate(active) : "Daily ounces"}</p>

      {day.loading && !day.data ? <Loading /> : null}
      {day.error ? <ErrorNote message={day.error} onRetry={day.reload} /> : null}
      {day.data ? (
        <>
          <section className="card" style={{ marginTop: 16 }}>
            <div className="fuel">
              <Ring value={Math.round(day.data.totalOz)} max={day.data.goalOz} />
              <div>
                <p className="kicker">Today</p>
                <p className="stat">{oz(day.data.totalOz)} oz</p>
                <p className="muted" style={{ margin: "6px 0 0" }}>of {day.data.goalOz} oz</p>
                {day.data.healthOz != null ? (
                  <p className="faint" style={{ margin: "6px 0 0" }}>
                    Apple Health has {oz(day.data.healthOz)} oz. The ring stays on what you log here, so an export does not double it.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Quick add">
            {QUICK.map((ounces) => (
              <button key={ounces} className="chip" type="button" disabled={saving} onClick={() => void add(ounces)}>
                {ounces} oz
              </button>
            ))}
            <button className="chip" type="button" onClick={() => { setFormError(null); setCustom(true); }}>
              Custom
            </button>
          </div>

          <div className="section-title">
            <h2>Logged</h2>
          </div>
          <div className="stack">
            {day.data.logs.length === 0 ? <p className="muted">Nothing logged this day.</p> : null}
            {day.data.logs.map((log) => (
              <div key={log.id} className="event">
                <time>{formatTime(log.loggedAt)}</time>
                <div className="spread">
                  <strong>{oz(log.ounces)} oz</strong>
                  <button className="text-btn" type="button" onClick={() => void remove(log)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title">
            <h2>This week</h2>
          </div>
          <section className="card">
            <div className="bars" role="img" aria-label={day.data.week.days.map((item) => `${formatWeekday(item.date)} ${oz(item.ounces)} ounces`).join(", ")}>
              {day.data.week.days.map((item) => (
                <div key={item.date}>
                  <i style={{ height: `${item.ounces ? Math.max(8, (item.ounces / maxBar) * 100) : 0}%`, minHeight: item.ounces ? 4 : 0 }} />
                  <em>{formatWeekday(item.date)}</em>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={(event) => void saveGoal(event)} style={{ marginTop: 12 }}>
            <section className="card">
              <label className="field">
                <span>Daily goal, ounces</span>
                <input inputMode="numeric" value={goalValue} onChange={(event) => setGoal(event.target.value)} />
              </label>
              <button className="btn" type="submit">Save goal</button>
            </section>
          </form>
        </>
      ) : null}

      <Sheet open={custom} title="Add water" onClose={() => setCustom(false)}>
        <form onSubmit={(event) => void addCustom(event)}>
          <label className="field">
            <span>Ounces</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
          </label>
          {formError ? <p className="err">{formError}</p> : null}
          <button className="btn" type="submit" disabled={saving}>Add</button>
        </form>
      </Sheet>
    </main>
  );
}
