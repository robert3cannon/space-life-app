import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db";
import { foodLogs } from "../db/schema";
import { HttpError } from "../errors";
import { round1 } from "../format";
import { getZonedParts, todayDateString, zonedDateTimeToUtc, zonedWeekRange } from "../time";
import { blankToNull } from "../text";
import type { FoodDto, Targets } from "../types";
import type { FoodCreate, FoodPatch } from "../validation";
import { serializeFood } from "./dto";
import { getSettings } from "./settings";

function emptyTotals(): Targets {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

export function sumFood(logs: FoodDto[]): Targets {
  return logs.reduce<Targets>((totals, log) => {
    totals.calories += log.calories;
    totals.proteinG = round1(totals.proteinG + log.proteinG);
    totals.carbsG = round1(totals.carbsG + log.carbsG);
    totals.fatG = round1(totals.fatG + log.fatG);
    return totals;
  }, emptyTotals());
}

function resolveLoggedAt(input: { loggedAt?: string; date?: string; time?: string }, fallback?: Date) {
  if (input.date || input.time) {
    const now = new Date();
    const date = input.date ?? (fallback ? getZonedParts(fallback).date : todayDateString(now));
    const time = input.time ?? (fallback ? getZonedParts(fallback).time : getZonedParts(now).time);
    return zonedDateTimeToUtc(date, time);
  }
  if (input.loggedAt) {
    const date = new Date(input.loggedAt);
    if (Number.isNaN(date.getTime())) throw new HttpError("Invalid loggedAt", 400);
    return date;
  }
  return fallback ?? new Date();
}

export async function listFood(from: Date, to: Date) {
  const db = getDb();
  const rows = await db
    .select()
    .from(foodLogs)
    .where(and(gte(foodLogs.loggedAt, from), lt(foodLogs.loggedAt, to)))
    .orderBy(asc(foodLogs.loggedAt));
  return rows.map(serializeFood);
}

export async function recentFoods(limit = 12) {
  const db = getDb();
  const rows = await db.select().from(foodLogs).orderBy(desc(foodLogs.loggedAt)).limit(80);
  const seen = new Set<string>();
  const recent: FoodDto[] = [];
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(serializeFood(row));
    if (recent.length >= limit) break;
  }
  return recent;
}

export async function getFoodLog(id: string) {
  const db = getDb();
  const [row] = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
  if (!row) throw new HttpError("Food log not found", 404);
  return serializeFood(row);
}

export async function createFood(input: FoodCreate) {
  const db = getDb();
  const [row] = await db
    .insert(foodLogs)
    .values({
      name: input.name,
      meal: input.meal,
      calories: input.calories,
      proteinG: input.proteinG ?? 0,
      carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0,
      loggedAt: resolveLoggedAt(input),
      notes: blankToNull(input.notes),
    })
    .returning();
  return serializeFood(row);
}

export async function updateFood(id: string, patch: FoodPatch) {
  const db = getDb();
  const [current] = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
  if (!current) throw new HttpError("Food log not found", 404);
  const [row] = await db
    .update(foodLogs)
    .set({
      name: patch.name ?? current.name,
      meal: patch.meal ?? current.meal,
      calories: patch.calories ?? current.calories,
      proteinG: patch.proteinG ?? current.proteinG,
      carbsG: patch.carbsG ?? current.carbsG,
      fatG: patch.fatG ?? current.fatG,
      loggedAt: patch.loggedAt || patch.date || patch.time ? resolveLoggedAt(patch, current.loggedAt) : current.loggedAt,
      notes: "notes" in patch ? blankToNull(patch.notes) : current.notes,
    })
    .where(eq(foodLogs.id, id))
    .returning();
  return serializeFood(row);
}

export async function deleteFood(id: string) {
  const db = getDb();
  const [current] = await db.select({ id: foodLogs.id }).from(foodLogs).where(eq(foodLogs.id, id));
  if (!current) throw new HttpError("Food log not found", 404);
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
  return { ok: true };
}

export async function foodSummary(date: string) {
  const prefs = await getSettings();
  const week = zonedWeekRange(date);
  const logs = await listFood(week.from, week.to);
  const days = week.dates.map((day) => {
    const totals = sumFood(logs.filter((log) => getZonedParts(new Date(log.loggedAt)).date === day));
    return { date: day, ...totals };
  });
  return {
    timezone: prefs.timezone,
    startDate: week.startDate,
    dates: week.dates,
    targets: prefs.targets,
    days,
    totals: sumFood(logs),
  };
}
