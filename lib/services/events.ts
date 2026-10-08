import { and, asc, eq, gt, lt } from "drizzle-orm";
import { getDb } from "../db";
import { events } from "../db/schema";
import { HttpError } from "../errors";
import { getZonedParts, zonedDateTimeToUtc } from "../time";
import { blankToNull } from "../text";
import type { EventCreate, EventPatch } from "../validation";
import { serializeEvent } from "./dto";
import { clearPendingReminder, syncEventReminder } from "./reminders";
import { getSettings } from "./settings";

const MAX_BLOCK_MS = 18 * 60 * 60 * 1000;

function assertRange(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new HttpError("Invalid start or end time", 400);
  }
  if (endsAt <= startsAt) throw new HttpError("End time must be after start time", 400);
  if (endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_MS) {
    throw new HttpError("Blocks can't be longer than 18 hours", 400);
  }
}

export function resolveEventTimes(
  input: { startsAt?: string; endsAt?: string; date?: string; startTime?: string; endTime?: string },
  fallback?: { startsAt: Date; endsAt: Date },
) {
  if (input.date || input.startTime || input.endTime) {
    const date = input.date ?? (fallback ? getZonedParts(fallback.startsAt).date : undefined);
    const startTime = input.startTime ?? (fallback ? getZonedParts(fallback.startsAt).time : undefined);
    const endTime = input.endTime ?? (fallback ? getZonedParts(fallback.endsAt).time : undefined);
    if (!date || !startTime || !endTime) throw new HttpError("Provide date, startTime, and endTime", 400);
    const startsAt = zonedDateTimeToUtc(date, startTime);
    const endsAt = zonedDateTimeToUtc(date, endTime);
    assertRange(startsAt, endsAt);
    return { startsAt, endsAt };
  }
  if (input.startsAt || input.endsAt || fallback) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : fallback?.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : fallback?.endsAt;
    if (!startsAt || !endsAt) throw new HttpError("Provide startsAt and endsAt", 400);
    assertRange(startsAt, endsAt);
    return { startsAt, endsAt };
  }
  throw new HttpError("Provide startsAt and endsAt, or date, startTime, and endTime", 400);
}

export async function listEvents(from: Date, to: Date) {
  const db = getDb();
  const rows = await db
    .select()
    .from(events)
    .where(and(lt(events.startsAt, to), gt(events.endsAt, from)))
    .orderBy(asc(events.startsAt));
  return rows.map(serializeEvent);
}

export async function getEvent(id: string) {
  const db = getDb();
  const [row] = await db.select().from(events).where(eq(events.id, id));
  return row ?? null;
}

export async function createEvent(input: EventCreate) {
  const { startsAt, endsAt } = resolveEventTimes(input);
  const prefs = await getSettings();
  const reminder =
    input.reminderMinutesBefore === undefined ? prefs.defaultEventReminderMinutes : input.reminderMinutesBefore;
  const db = getDb();
  const [row] = await db
    .insert(events)
    .values({
      title: input.title,
      type: input.type,
      startsAt,
      endsAt,
      location: blankToNull(input.location),
      notes: blankToNull(input.notes),
      reminderMinutesBefore: reminder,
    })
    .returning();
  await syncEventReminder(row);
  return serializeEvent(row);
}

export async function updateEvent(id: string, patch: EventPatch) {
  const current = await getEvent(id);
  if (!current) throw new HttpError("Event not found", 404);
  const times = resolveEventTimes(patch, current);
  const reminder =
    "reminderMinutesBefore" in patch ? (patch.reminderMinutesBefore ?? null) : current.reminderMinutesBefore;
  const db = getDb();
  const [row] = await db
    .update(events)
    .set({
      title: patch.title ?? current.title,
      type: patch.type ?? current.type,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      location: "location" in patch ? blankToNull(patch.location) : current.location,
      notes: "notes" in patch ? blankToNull(patch.notes) : current.notes,
      reminderMinutesBefore: reminder,
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning();
  await syncEventReminder(row);
  return serializeEvent(row);
}

export async function deleteEvent(id: string) {
  const current = await getEvent(id);
  if (!current) throw new HttpError("Event not found", 404);
  const db = getDb();
  await db.delete(events).where(eq(events.id, id));
  await clearPendingReminder(`event:${id}`);
  return { ok: true };
}

export async function nextEvent(now: Date, until: Date) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(events)
    .where(and(gt(events.endsAt, now), lt(events.startsAt, until)))
    .orderBy(asc(events.startsAt))
    .limit(1);
  return row ? serializeEvent(row) : null;
}
