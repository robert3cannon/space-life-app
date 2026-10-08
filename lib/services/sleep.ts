import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { sleepLogs } from "../db/schema";
import { HttpError } from "../errors";
import { resolveSleepWindow } from "../sleep-window";
import { blankToNull } from "../text";
import { addCalendarDays, todayDateString, zonedWeekRange } from "../time";
import type { SleepDto } from "../types";
import type { SleepLogInput } from "../validation";
function serialize(row: typeof sleepLogs.$inferSelect): SleepDto {
  return {
    id: row.id,
    wakeDate: row.wakeDate,
    bedtime: row.bedtime ? row.bedtime.toISOString() : null,
    wakeAt: row.wakeAt ? row.wakeAt.toISOString() : null,
    durationMinutes: row.durationMinutes,
    quality: row.quality,
    notes: row.notes,
  };
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export async function getSleep(date = todayDateString()) {
  const db = getDb();
  const week = zonedWeekRange(date);
  const previousStart = zonedWeekRange(addCalendarDays(week.startDate, -1)).startDate;
  const weekEnd = addCalendarDays(week.startDate, 6);
  const rows = await db
    .select()
    .from(sleepLogs)
    .where(and(gte(sleepLogs.wakeDate, previousStart), lte(sleepLogs.wakeDate, weekEnd)));
  const byDate = new Map(rows.map((row) => [row.wakeDate, row]));
  const current = week.dates.map((item) => byDate.get(item)?.durationMinutes).filter((value): value is number => value != null);
  const previousDates = Array.from({ length: 7 }, (_, index) => addCalendarDays(previousStart, index));
  const previous = previousDates.map((item) => byDate.get(item)?.durationMinutes).filter((value): value is number => value != null);
  const weekAverageMinutes = average(current);
  const previousAverageMinutes = average(previous);
  const log = byDate.get(date);
  return {
    date,
    log: log ? serialize(log) : null,
    week: {
      startDate: week.startDate,
      days: week.dates.map((item) => {
        const row = byDate.get(item);
        return {
          date: item,
          durationMinutes: row?.durationMinutes ?? null,
          quality: row?.quality ?? null,
        };
      }),
      averageMinutes: weekAverageMinutes,
      previousAverageMinutes,
      trendMinutes:
        weekAverageMinutes == null || previousAverageMinutes == null
          ? null
          : weekAverageMinutes - previousAverageMinutes,
    },
  };
}

export async function logSleep(input: SleepLogInput, now = new Date()) {
  const wakeDate = input.date ?? todayDateString(now);
  const window = resolveSleepWindow({
    wakeDate,
    bedtime: input.bedtime,
    bedtimeDate: input.bedtimeDate,
    wakeTime: input.wakeTime,
    durationMinutes: input.durationMinutes,
  });
  const db = getDb();
  const values = {
    wakeDate: window.wakeDate,
    bedtime: window.bedtime,
    wakeAt: window.wakeAt,
    durationMinutes: window.durationMinutes,
    quality: input.quality ?? null,
    notes: blankToNull(input.notes),
    updatedAt: new Date(),
  };
  const [existing] = await db.select().from(sleepLogs).where(eq(sleepLogs.wakeDate, window.wakeDate));
  if (!existing) {
    const [row] = await db.insert(sleepLogs).values(values).returning();
    return serialize(row);
  }
  const [row] = await db.update(sleepLogs).set(values).where(eq(sleepLogs.id, existing.id)).returning();
  return serialize(row);
}

export async function deleteSleep(id: string) {
  const db = getDb();
  const [row] = await db.delete(sleepLogs).where(eq(sleepLogs.id, id)).returning();
  if (!row) throw new HttpError("Sleep log not found", 404);
  return { ok: true };
}
