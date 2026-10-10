import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "../db";
import { events, reminders, workouts } from "../db/schema";
import { HttpError } from "../errors";
import { formatTime } from "../format";
import { deliverPush, type PushPayload } from "../push";
import { outfitNudge } from "./closet";
import { addCalendarDays, getZonedParts, todayDateString, zonedDateTimeToUtc } from "../time";
import type { ReminderCreate, ReminderPatch } from "../validation";
import { serializeReminder } from "./dto";
import { openRemindedHabits } from "./habits";
import { getSettings } from "./settings";
import { waterTotalOn } from "./water";

type EventRow = typeof events.$inferSelect;
type WorkoutRow = typeof workouts.$inferSelect;

function payloadFor(row: typeof reminders.$inferSelect): PushPayload {
  const url =
    row.kind === "water"
      ? "/water"
      : row.kind === "sleep"
        ? "/sleep"
        : row.kind === "habit"
          ? "/habits"
          : row.kind === "meal"
            ? "/food"
            : row.kind === "workout" && row.relatedId
              ? `/workouts/${row.relatedId}`
              : row.kind === "event"
                ? "/schedule"
                : row.kind === "outfit"
                  ? "/outfits"
                  : "/reminders";
  return {
    title: row.title,
    body: row.body || row.title,
    url,
    tag: row.id,
  };
}

export async function clearPendingReminder(dedupeKey: string) {
  const db = getDb();
  await db.delete(reminders).where(and(eq(reminders.dedupeKey, dedupeKey), eq(reminders.status, "pending")));
}

async function upsertPendingReminder(input: {
  dedupeKey: string;
  title: string;
  body: string;
  fireAt: Date;
  kind: "event" | "workout";
  relatedId: string;
}) {
  const db = getDb();
  const existing = await db.select().from(reminders).where(eq(reminders.dedupeKey, input.dedupeKey));
  if (!existing.length) {
    await db.insert(reminders).values({ ...input, status: "pending" });
    return;
  }
  const row = existing[0];
  if (row.status === "sent" && row.fireAt.getTime() === input.fireAt.getTime()) return;
  await db
    .update(reminders)
    .set({
      title: input.title,
      body: input.body,
      fireAt: input.fireAt,
      kind: input.kind,
      relatedId: input.relatedId,
      status: "pending",
      sentAt: null,
    })
    .where(eq(reminders.id, row.id));
}

export async function syncEventReminder(event: EventRow, now = new Date()) {
  const key = `event:${event.id}`;
  if (event.reminderMinutesBefore == null || event.startsAt.getTime() <= now.getTime()) {
    await clearPendingReminder(key);
    return;
  }
  let fireAt = new Date(event.startsAt.getTime() - event.reminderMinutesBefore * 60_000);
  if (fireAt.getTime() < now.getTime()) fireAt = now;
  const when = formatTime(event.startsAt.toISOString());
  const body = event.location ? `Starts at ${when} · ${event.location}` : `Starts at ${when}`;
  await upsertPendingReminder({
    dedupeKey: key,
    title: event.title,
    body,
    fireAt,
    kind: "event",
    relatedId: event.id,
  });
}

export async function syncWorkoutReminder(workout: WorkoutRow, now = new Date()) {
  const key = `workout:${workout.id}`;
  if (
    workout.status !== "planned" ||
    workout.reminderMinutesBefore == null ||
    !workout.scheduledAt ||
    workout.scheduledAt.getTime() <= now.getTime()
  ) {
    await clearPendingReminder(key);
    return;
  }
  let fireAt = new Date(workout.scheduledAt.getTime() - workout.reminderMinutesBefore * 60_000);
  if (fireAt.getTime() < now.getTime()) fireAt = now;
  await upsertPendingReminder({
    dedupeKey: key,
    title: workout.title,
    body: `Starts at ${formatTime(workout.scheduledAt.toISOString())}`,
    fireAt,
    kind: "workout",
    relatedId: workout.id,
  });
}

export async function ensureMealReminders(now = new Date()) {
  const prefs = await getSettings();
  const today = todayDateString(now);
  const db = getDb();
  let created = 0;
  for (const offset of [0, 1, 2]) {
    const date = addCalendarDays(today, offset);
    for (const meal of prefs.mealReminders) {
      if (!meal.enabled) continue;
      const fireAt = zonedDateTimeToUtc(date, meal.time);
      if (fireAt.getTime() < now.getTime() - 10 * 60_000) continue;
      const dedupeKey = `meal:${date}:${meal.id}:${meal.time}`;
      const existing = await db
        .select({ id: reminders.id })
        .from(reminders)
        .where(eq(reminders.dedupeKey, dedupeKey));
      if (existing.length) continue;
      await db.insert(reminders).values({
        title: meal.label,
        body: `Time for ${meal.label.toLowerCase()} — log it when you eat.`,
        fireAt,
        kind: "meal",
        dedupeKey,
        status: "pending",
      });
      created += 1;
    }
  }
  return created;
}

async function ensureSlot(input: {
  dedupeKey: string;
  title: string;
  body: string;
  fireAt: Date;
  kind: "water" | "sleep" | "habit" | "outfit";
  now: Date;
}) {
  if (input.fireAt.getTime() < input.now.getTime() - 10 * 60_000) return 0;
  const db = getDb();
  const existing = await db.select().from(reminders).where(eq(reminders.dedupeKey, input.dedupeKey));
  if (!existing.length) {
    await db.insert(reminders).values({
      title: input.title,
      body: input.body,
      fireAt: input.fireAt,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      status: "pending",
    });
    return 1;
  }
  const row = existing[0];
  if (row.status !== "pending") return 0;
  if (row.title !== input.title || row.body !== input.body || row.fireAt.getTime() !== input.fireAt.getTime()) {
    await db
      .update(reminders)
      .set({ title: input.title, body: input.body, fireAt: input.fireAt })
      .where(eq(reminders.id, row.id));
  }
  return 0;
}

export async function ensureWellnessReminders(now = new Date()) {
  const prefs = await getSettings();
  const today = todayDateString(now);
  let created = 0;
  const waterMet = prefs.waterReminders.enabled ? (await waterTotalOn(today)) >= prefs.waterGoalOz : false;

  if (prefs.waterReminders.enabled) {
    for (const offset of [0, 1, 2]) {
      const date = addCalendarDays(today, offset);
      if (offset === 0 && waterMet) {
        for (const time of prefs.waterReminders.times) {
          await clearPendingReminder(`water:${date}:${time}`);
        }
        continue;
      }
      for (const time of prefs.waterReminders.times) {
        if (time < "11:00") continue;
        created += await ensureSlot({
          dedupeKey: `water:${date}:${time}`,
          title: "Water",
          body: `Have a glass. The goal is ${prefs.waterGoalOz} oz.`,
          fireAt: zonedDateTimeToUtc(date, time),
          kind: "water",
          now,
        });
      }
    }
  }

  if (prefs.sleepReminder.enabled) {
    const time = prefs.sleepReminder.time;
    const late = time >= "20:00" || time <= "04:00";
    if (late) {
      for (const offset of [0, 1, 2]) {
        const date = addCalendarDays(today, offset);
        created += await ensureSlot({
          dedupeKey: `sleep:${date}:${time}`,
          title: "Wind down",
          body: "Log sleep when you get up.",
          fireAt: zonedDateTimeToUtc(date, time),
          kind: "sleep",
          now,
        });
      }
    }
  }

  if (prefs.habitReminder.enabled && prefs.habitReminder.time >= "17:00") {
    for (const offset of [0, 1]) {
      const date = addCalendarDays(today, offset);
      const open = await openRemindedHabits(date);
      const key = `habit:${date}:${prefs.habitReminder.time}`;
      if (!open.length) {
        await clearPendingReminder(key);
        continue;
      }
      const names = open
        .slice(0, 3)
        .map((habit) => habit.name)
        .join(", ");
      const extra = open.length > 3 ? ` +${open.length - 3}` : "";
      created += await ensureSlot({
        dedupeKey: key,
        title: "Habits still open",
        body: `${names}${extra}`,
        fireAt: zonedDateTimeToUtc(date, prefs.habitReminder.time),
        kind: "habit",
        now,
      });
    }
  }

  return created;
}

/** The daily cron is on the hour. A 10:30 nudge still goes out that morning if the run is within 90 minutes. */
export function outfitReminderIsDue(fireAt: Date, now: Date, fireDate: string, today: string) {
  if (fireAt.getTime() <= now.getTime()) return true;
  if (fireDate !== today) return false;
  return fireAt.getTime() - now.getTime() <= 90 * 60_000;
}

export async function ensureOutfitReminder(now = new Date()) {
  const prefs = await getSettings();
  const today = todayDateString(now);
  if (!prefs.outfitReminder.enabled) {
    for (const offset of [0, 1]) {
      await clearPendingReminder(`outfit:${addCalendarDays(today, offset)}:${prefs.outfitReminder.time}`);
    }
    return 0;
  }
  const nudge = await outfitNudge(now);
  if (!nudge) return 0;
  let created = 0;
  for (const offset of [0, 1]) {
    const date = addCalendarDays(today, offset);
    const fireAt = zonedDateTimeToUtc(date, prefs.outfitReminder.time);
    created += await ensureSlot({
      dedupeKey: `outfit:${date}:${prefs.outfitReminder.time}`,
      title: nudge.title,
      body: offset === 0 ? nudge.body : "Your outfit is ready.",
      fireAt,
      kind: "outfit",
      now,
    });
  }
  const db = getDb();
  const pending = await db.select().from(reminders).where(and(eq(reminders.kind, "outfit"), eq(reminders.status, "pending")));
  for (const row of pending) {
    const fireDate = getZonedParts(row.fireAt).date;
    if (!outfitReminderIsDue(row.fireAt, now, fireDate, today)) continue;
    if (row.fireAt.getTime() > now.getTime()) {
      await db.update(reminders).set({ fireAt: now, body: nudge.body, title: nudge.title }).where(eq(reminders.id, row.id));
    } else if (fireDate === today && row.body !== nudge.body) {
      await db.update(reminders).set({ body: nudge.body, title: nudge.title }).where(eq(reminders.id, row.id));
    }
  }
  return created;
}

function resolveFireAt(input: { fireAt?: string; date?: string; time?: string }, fallback?: Date) {
  if (input.date || input.time) {
    if (!input.date || !input.time) throw new HttpError("Provide both date and time", 400);
    return zonedDateTimeToUtc(input.date, input.time);
  }
  if (input.fireAt) {
    const date = new Date(input.fireAt);
    if (Number.isNaN(date.getTime())) throw new HttpError("Invalid fireAt", 400);
    return date;
  }
  if (fallback) return fallback;
  throw new HttpError("Provide fireAt, or date and time", 400);
}

export async function listReminders() {
  const db = getDb();
  const rows = await db.select().from(reminders).orderBy(asc(reminders.fireAt));
  const upcoming = rows.filter((row) => row.status === "pending").slice(0, 50).map(serializeReminder);
  const recentSent = rows
    .filter((row) => row.status === "sent")
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
    .slice(0, 20)
    .map(serializeReminder);
  return { upcoming, recentSent };
}

export async function createReminder(input: ReminderCreate) {
  const fireAt = resolveFireAt(input);
  const db = getDb();
  const [row] = await db
    .insert(reminders)
    .values({
      title: input.title,
      body: input.body?.trim() ?? "",
      fireAt,
      kind: "custom",
      status: "pending",
    })
    .returning();
  return serializeReminder(row);
}

export async function updateReminder(id: string, patch: ReminderPatch) {
  const db = getDb();
  const [current] = await db.select().from(reminders).where(eq(reminders.id, id));
  if (!current) throw new HttpError("Reminder not found", 404);
  const fireAt =
    patch.fireAt || patch.date || patch.time ? resolveFireAt(patch, current.fireAt) : current.fireAt;
  const [row] = await db
    .update(reminders)
    .set({
      title: patch.title ?? current.title,
      body: patch.body == null ? current.body : patch.body,
      fireAt,
      status: patch.status ?? current.status,
      sentAt: patch.status === "pending" ? null : current.sentAt,
    })
    .where(eq(reminders.id, id))
    .returning();
  return serializeReminder(row);
}

export async function deleteReminder(id: string) {
  const db = getDb();
  const [current] = await db.select().from(reminders).where(eq(reminders.id, id));
  if (!current) throw new HttpError("Reminder not found", 404);
  if (current.kind === "meal") {
    await db.update(reminders).set({ status: "cancelled" }).where(eq(reminders.id, id));
    return { ok: true };
  }
  if (current.kind === "event" && current.relatedId) {
    await db.update(events).set({ reminderMinutesBefore: null }).where(eq(events.id, current.relatedId));
  }
  if (current.kind === "workout" && current.relatedId) {
    await db
      .update(workouts)
      .set({ reminderMinutesBefore: null, updatedAt: new Date() })
      .where(eq(workouts.id, current.relatedId));
  }
  await db.delete(reminders).where(eq(reminders.id, id));
  return { ok: true };
}

export async function getReminder(id: string) {
  const db = getDb();
  const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
  if (!row) throw new HttpError("Reminder not found", 404);
  return serializeReminder(row);
}

export async function upcomingReminders(limit: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.status, "pending"))
    .orderBy(asc(reminders.fireAt))
    .limit(limit);
  return rows.map(serializeReminder);
}

export async function dispatchReminders(now = new Date()) {
  const mealRemindersCreated = await ensureMealReminders(now);
  const wellnessRemindersCreated = await ensureWellnessReminders(now);
  const outfitRemindersCreated = await ensureOutfitReminder(now);
  const db = getDb();
  const due = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, "pending"), lte(reminders.fireAt, now)))
    .orderBy(asc(reminders.fireAt));

  let sent = 0;
  let held = 0;
  let delivered = 0;
  let failed = 0;
  let removed = 0;

  for (const reminder of due) {
    const result = await deliverPush(payloadFor(reminder));
    delivered += result.delivered;
    failed += result.failed;
    removed += result.removed;
    if (!result.configured) {
      return {
        ok: false,
        reason: "push_not_configured" as const,
        mealRemindersCreated,
        wellnessRemindersCreated,
        outfitRemindersCreated,
        due: due.length,
        sent,
        held: due.length - sent,
        delivered,
        failed,
        removed,
      };
    }
    if (result.transient > 0 && result.delivered === 0) {
      held += 1;
      continue;
    }
    await db.update(reminders).set({ status: "sent", sentAt: now }).where(eq(reminders.id, reminder.id));
    sent += 1;
  }

  return {
    ok: true,
    mealRemindersCreated,
    wellnessRemindersCreated,
    outfitRemindersCreated,
    due: due.length,
    sent,
    held,
    delivered,
    failed,
    removed,
  };
}
