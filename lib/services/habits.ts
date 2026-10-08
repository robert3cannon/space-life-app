import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "../db";
import { foodLogs, habitChecks, habits, healthDays, waterLogs, workouts } from "../db/schema";
import { HttpError } from "../errors";
import { round1 } from "../format";
import { STEPS_AUTO_GOAL } from "../health-activity";
import { habitStreaks, isScheduled, scheduledDays } from "../streaks";
import { addCalendarDays, getZonedParts, todayDateString, zonedDayRange } from "../time";
import type { HabitAuto, HabitSummary } from "../types";
import type { HabitCheckInput, HabitCreate, HabitPatch } from "../validation";
import { getSettings } from "./settings";

const HISTORY_DAYS = 180;

type HabitRow = typeof habits.$inferSelect;
type CheckRow = typeof habitChecks.$inferSelect;

function asAuto(value: string | null): HabitAuto | null {
  if (value === "protein" || value === "water" || value === "workout" || value === "steps") return value;
  return null;
}

function asSource(value: string | null | undefined): HabitSummary["source"] {
  if (value === "manual" || value === "auto" || value === "skip") return value;
  return null;
}

function checkedSource(source: string) {
  return source === "manual" || source === "auto";
}

async function loadHabit(id: string) {
  const db = getDb();
  const [row] = await db.select().from(habits).where(eq(habits.id, id));
  if (!row) throw new HttpError("Habit not found", 404);
  return row;
}

export async function reconcileAutoHabits(through = todayDateString()) {
  const db = getDb();
  const rows = await db.select().from(habits);
  const autos = rows.filter((row) => asAuto(row.auto));
  if (!autos.length) return;
  const fromDate = addCalendarDays(through, -(HISTORY_DAYS - 1));
  const range = {
    from: zonedDayRange(fromDate).from,
    to: zonedDayRange(addCalendarDays(through, 1)).from,
  };
  const prefs = await getSettings();
  const [foodRows, waterRows, workoutRows, checkRows, healthRows] = await Promise.all([
    db
      .select({ proteinG: foodLogs.proteinG, loggedAt: foodLogs.loggedAt })
      .from(foodLogs)
      .where(and(gte(foodLogs.loggedAt, range.from), lt(foodLogs.loggedAt, range.to))),
    db
      .select({ ounces: waterLogs.ounces, loggedAt: waterLogs.loggedAt })
      .from(waterLogs)
      .where(and(gte(waterLogs.loggedAt, range.from), lt(waterLogs.loggedAt, range.to))),
    db
      .select({ status: workouts.status, scheduledAt: workouts.scheduledAt, completedAt: workouts.completedAt })
      .from(workouts)
      .where(and(gte(workouts.scheduledAt, range.from), lt(workouts.scheduledAt, range.to))),
    db
      .select()
      .from(habitChecks)
      .where(inArray(habitChecks.habitId, autos.map((row) => row.id))),
    db
      .select({ date: healthDays.date, steps: healthDays.steps, dietaryWaterOz: healthDays.dietaryWaterOz })
      .from(healthDays)
      .where(and(gte(healthDays.date, fromDate), lt(healthDays.date, addCalendarDays(through, 1)))),
  ]);

  const protein = new Map<string, number>();
  for (const row of foodRows) {
    const key = getZonedParts(row.loggedAt).date;
    protein.set(key, round1((protein.get(key) ?? 0) + row.proteinG));
  }
  const ounces = new Map<string, number>();
  for (const row of waterRows) {
    const key = getZonedParts(row.loggedAt).date;
    ounces.set(key, round1((ounces.get(key) ?? 0) + row.ounces));
  }
  const healthSteps = new Map<string, number>();
  const healthWater = new Map<string, number>();
  for (const row of healthRows) {
    if (row.steps != null) healthSteps.set(row.date, row.steps);
    if (row.dietaryWaterOz != null) healthWater.set(row.date, row.dietaryWaterOz);
  }
  const trained = new Set<string>();
  for (const row of workoutRows) {
    if (row.status !== "done") continue;
    const when = row.scheduledAt ?? row.completedAt;
    if (when) trained.add(getZonedParts(when).date);
  }
  const checks = new Map(checkRows.map((row) => [`${row.habitId}:${row.date}`, row]));
  const toInsert: { habitId: string; date: string; source: "auto" }[] = [];
  const toDelete: string[] = [];

  for (const habit of autos) {
    const auto = asAuto(habit.auto);
    if (!auto) continue;
    for (let date = fromDate; date <= through; date = addCalendarDays(date, 1)) {
      if (!isScheduled(habit.days, date)) continue;
      const met =
        auto === "protein"
          ? (protein.get(date) ?? 0) >= prefs.targets.proteinG
          : auto === "water"
            ? Math.max(ounces.get(date) ?? 0, healthWater.get(date) ?? 0) >= prefs.waterGoalOz
            : auto === "steps"
              ? (healthSteps.get(date) ?? 0) >= STEPS_AUTO_GOAL
              : trained.has(date);
      const existing = checks.get(`${habit.id}:${date}`);
      if (met) {
        if (!existing) toInsert.push({ habitId: habit.id, date, source: "auto" });
      } else if (existing?.source === "auto") {
        toDelete.push(existing.id);
      }
    }
  }

  if (toInsert.length) await db.insert(habitChecks).values(toInsert).onConflictDoNothing();
  if (toDelete.length) await db.delete(habitChecks).where(inArray(habitChecks.id, toDelete));
}

function summary(row: HabitRow, date: string, checks: CheckRow[], today: string): HabitSummary {
  const days = scheduledDays(row.days);
  const from = addCalendarDays(today, -(HISTORY_DAYS - 1));
  const doneDates = new Set(checks.filter((check) => checkedSource(check.source)).map((check) => check.date));
  const streaks = habitStreaks({ days, checked: doneDates, today, from });
  const todayCheck = checks.find((check) => check.date === date);
  const source = asSource(todayCheck?.source);
  return {
    id: row.id,
    name: row.name,
    days,
    auto: asAuto(row.auto),
    remind: row.remind,
    scheduled: isScheduled(days, date),
    done: source === "manual" || source === "auto",
    source,
    currentStreak: streaks.current,
    bestStreak: streaks.best,
  };
}

async function checksFor(ids: string[]) {
  if (!ids.length) return [];
  const db = getDb();
  return db.select().from(habitChecks).where(inArray(habitChecks.habitId, ids));
}

export async function listHabits(date = todayDateString()) {
  const today = todayDateString();
  await reconcileAutoHabits(today);
  const db = getDb();
  const rows = (await db.select().from(habits)).sort(ascCreated);
  const checks = await checksFor(rows.map((row) => row.id));
  return {
    date,
    today,
    habits: rows.map((row) => summary(row, date, checks.filter((check) => check.habitId === row.id), today)),
  };
}

function ascCreated(a: HabitRow, b: HabitRow) {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name);
}

export async function habitsDue(date = todayDateString()) {
  const board = await listHabits(date);
  return board.habits.filter((habit) => habit.scheduled);
}

export async function openRemindedHabits(date: string) {
  const board = await listHabits(date);
  return board.habits
    .filter((habit) => habit.remind && habit.scheduled && !habit.done)
    .map((habit) => ({ id: habit.id, name: habit.name }));
}

export async function createHabit(input: HabitCreate) {
  const db = getDb();
  const [row] = await db
    .insert(habits)
    .values({
      name: input.name,
      days: scheduledDays(input.days ?? null),
      auto: input.auto ?? null,
      remind: input.remind ?? false,
    })
    .returning();
  const board = await listHabits();
  return board.habits.find((habit) => habit.id === row.id) ?? summary(row, todayDateString(), [], todayDateString());
}

export async function updateHabit(id: string, patch: HabitPatch) {
  const current = await loadHabit(id);
  const db = getDb();
  await db
    .update(habits)
    .set({
      name: patch.name ?? current.name,
      days: patch.days === undefined ? scheduledDays(current.days) : scheduledDays(patch.days),
      auto: patch.auto === undefined ? current.auto : patch.auto,
      remind: patch.remind ?? current.remind,
    })
    .where(eq(habits.id, id));
  const board = await listHabits();
  const habit = board.habits.find((item) => item.id === id);
  if (!habit) throw new HttpError("Habit not found", 404);
  return habit;
}

export async function deleteHabit(id: string) {
  await loadHabit(id);
  const db = getDb();
  await db.delete(habits).where(eq(habits.id, id));
  return { ok: true };
}

export async function setHabitCheck(id: string, input: HabitCheckInput) {
  const habit = await loadHabit(id);
  const today = todayDateString();
  const date = input.date ?? today;
  if (date > today) throw new HttpError("That day hasn't started yet", 400);
  if (!isScheduled(habit.days, date)) throw new HttpError("That habit isn't scheduled that day", 400);
  const db = getDb();
  if (input.done) {
    await db
      .insert(habitChecks)
      .values({ habitId: id, date, source: "manual" })
      .onConflictDoUpdate({
        target: [habitChecks.habitId, habitChecks.date],
        set: { source: "manual" },
      });
  } else if (asAuto(habit.auto)) {
    await db
      .insert(habitChecks)
      .values({ habitId: id, date, source: "skip" })
      .onConflictDoUpdate({
        target: [habitChecks.habitId, habitChecks.date],
        set: { source: "skip" },
      });
  } else {
    await db.delete(habitChecks).where(and(eq(habitChecks.habitId, id), eq(habitChecks.date, date)));
  }
  const board = await listHabits(date);
  const summaryRow = board.habits.find((item) => item.id === id);
  if (!summaryRow) throw new HttpError("Habit not found", 404);
  return summaryRow;
}

export async function habitMonth(id: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError("Invalid month", 400);
  const habit = await loadHabit(id);
  const today = todayDateString();
  await reconcileAutoHabits(today);
  const start = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
  const end = addCalendarDays(next, -1);
  const db = getDb();
  const checks = await db.select().from(habitChecks).where(eq(habitChecks.habitId, id));
  const byDate = new Map(checks.map((check) => [check.date, check]));
  const days = [];
  for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
    const check = byDate.get(date);
    days.push({
      date,
      scheduled: isScheduled(habit.days, date),
      done: check ? checkedSource(check.source) : false,
      source: asSource(check?.source),
    });
  }
  return {
    habit: summary(habit, today, checks, today),
    month,
    today,
    days,
  };
}
