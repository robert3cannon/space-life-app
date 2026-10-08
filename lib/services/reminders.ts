import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "../db";
import { events, reminders, workouts } from "../db/schema";
import { HttpError } from "../errors";
import { formatTime } from "../format";
import { deliverPush, type PushPayload } from "../push";
import { addCalendarDays, todayDateString, zonedDateTimeToUtc } from "../time";
import type { ReminderCreate, ReminderPatch } from "../validation";
import { serializeReminder } from "./dto";
import { getSettings } from "./settings";

type EventRow = typeof events.$inferSelect;
type WorkoutRow = typeof workouts.$inferSelect;

function payloadFor(row: typeof reminders.$inferSelect): PushPayload {
  const url =
    row.kind === "meal"
      ? "/food"
      : row.kind === "workout" && row.relatedId
        ? `/workouts/${row.relatedId}`
        : row.kind === "event"
          ? "/schedule"
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
    due: due.length,
    sent,
    held,
    delivered,
    failed,
    removed,
  };
}
