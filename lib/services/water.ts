import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db";
import { healthDays, waterLogs } from "../db/schema";
import { HttpError } from "../errors";
import { round1 } from "../format";
import { getZonedParts, todayDateString, zonedDateTimeToUtc, zonedDayRange, zonedWeekRange } from "../time";
import type { WaterDto } from "../types";
import type { WaterCreate } from "../validation";
import { getSettings } from "./settings";

function resolveLoggedAt(input: { loggedAt?: string; date?: string; time?: string }) {
  if (input.date || input.time) {
    const now = new Date();
    const date = input.date ?? todayDateString(now);
    const time = input.time ?? getZonedParts(now).time;
    return zonedDateTimeToUtc(date, time);
  }
  if (input.loggedAt) {
    const date = new Date(input.loggedAt);
    if (Number.isNaN(date.getTime())) throw new HttpError("Invalid loggedAt", 400);
    return date;
  }
  return new Date();
}

function serialize(row: typeof waterLogs.$inferSelect): WaterDto {
  return {
    id: row.id,
    ounces: round1(row.ounces),
    loggedAt: row.loggedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function sumOunces(logs: { ounces: number }[]) {
  return round1(logs.reduce((total, log) => total + log.ounces, 0));
}

export async function listWaterBetween(from: Date, to: Date) {
  const db = getDb();
  const rows = await db
    .select()
    .from(waterLogs)
    .where(and(gte(waterLogs.loggedAt, from), lt(waterLogs.loggedAt, to)))
    .orderBy(asc(waterLogs.loggedAt));
  return rows.map(serialize);
}

export async function waterTotalOn(date: string) {
  const day = zonedDayRange(date);
  const logs = await listWaterBetween(day.from, day.to);
  return sumOunces(logs);
}

export async function getWaterDay(date = todayDateString()) {
  const prefs = await getSettings();
  const db = getDb();
  const day = zonedDayRange(date);
  const week = zonedWeekRange(date);
  const [logs, weekLogs, health] = await Promise.all([
    listWaterBetween(day.from, day.to),
    listWaterBetween(week.from, week.to),
    db.select({ dietaryWaterOz: healthDays.dietaryWaterOz }).from(healthDays).where(eq(healthDays.date, date)),
  ]);
  const byDate = new Map<string, number>();
  for (const log of weekLogs) {
    const key = getZonedParts(new Date(log.loggedAt)).date;
    byDate.set(key, round1((byDate.get(key) ?? 0) + log.ounces));
  }
  return {
    date,
    goalOz: prefs.waterGoalOz,
    totalOz: sumOunces(logs),
    logs,
    healthOz: health[0]?.dietaryWaterOz == null ? null : round1(health[0].dietaryWaterOz),
    week: {
      startDate: week.startDate,
      days: week.dates.map((item) => ({ date: item, ounces: byDate.get(item) ?? 0 })),
    },
  };
}

export async function createWater(input: WaterCreate) {
  const db = getDb();
  const [row] = await db
    .insert(waterLogs)
    .values({ ounces: input.ounces, loggedAt: resolveLoggedAt(input) })
    .returning();
  return serialize(row);
}

export async function deleteWater(id: string) {
  const db = getDb();
  const [row] = await db.delete(waterLogs).where(eq(waterLogs.id, id)).returning();
  if (!row) throw new HttpError("Water log not found", 404);
  return { ok: true };
}
