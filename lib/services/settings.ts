import { eq, and, ne, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { reminders, settings } from "../db/schema";
import { DEFAULT_SETTINGS } from "../defaults";
import { cleanGear, DEFAULT_EQUIPMENT } from "../equipment";
import { TIMEZONE } from "../constants";
import type { AppSettings } from "../types";
import type { settingsPatchSchema } from "../validation";
import type { z } from "zod";

const KEY = "app";

function normalize(value: AppSettings): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    timezone: TIMEZONE,
    targets: { ...DEFAULT_SETTINGS.targets, ...value.targets },
    mealReminders: value.mealReminders?.length ? value.mealReminders : DEFAULT_SETTINGS.mealReminders,
    waterGoalOz: value.waterGoalOz ?? DEFAULT_SETTINGS.waterGoalOz,
    waterReminders: {
      ...DEFAULT_SETTINGS.waterReminders,
      ...value.waterReminders,
      times: value.waterReminders?.times?.length ? value.waterReminders.times : DEFAULT_SETTINGS.waterReminders.times,
    },
    sleepReminder: { ...DEFAULT_SETTINGS.sleepReminder, ...value.sleepReminder },
    habitReminder: { ...DEFAULT_SETTINGS.habitReminder, ...value.habitReminder },
    outfitReminder: { ...DEFAULT_SETTINGS.outfitReminder, ...value.outfitReminder },
    equipment: {
      ...DEFAULT_EQUIPMENT,
      ...value.equipment,
      gear: value.equipment?.gear ? cleanGear(value.equipment.gear) : DEFAULT_EQUIPMENT.gear,
      dumbbellLb: value.equipment?.dumbbellLb ?? DEFAULT_EQUIPMENT.dumbbellLb,
      dumbbellCount: value.equipment?.dumbbellCount ?? DEFAULT_EQUIPMENT.dumbbellCount,
    },
    circuitAudio: {
      enabled: typeof value.circuitAudio?.enabled === "boolean" ? value.circuitAudio.enabled : DEFAULT_SETTINGS.circuitAudio.enabled,
      volume: clampVolume(value.circuitAudio?.volume),
    },
  };
}

function clampVolume(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return DEFAULT_SETTINGS.circuitAudio.volume;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, KEY));
  if (!rows.length) {
    await db.insert(settings).values({ key: KEY, value: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }
  return normalize(rows[0].value);
}

export async function updateSettings(patch: z.infer<typeof settingsPatchSchema>) {
  const current = await getSettings();
  const next = normalize({
    ...current,
    ...patch,
    targets: patch.targets ?? current.targets,
    mealReminders: patch.mealReminders ?? current.mealReminders,
    waterReminders: patch.waterReminders ?? current.waterReminders,
    sleepReminder: patch.sleepReminder ?? current.sleepReminder,
    habitReminder: patch.habitReminder ?? current.habitReminder,
    outfitReminder: patch.outfitReminder ?? current.outfitReminder,
    equipment: patch.equipment ?? current.equipment,
    circuitAudio: patch.circuitAudio ?? current.circuitAudio,
  });
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  if (patch.mealReminders) {
    await db.delete(reminders).where(and(eq(reminders.kind, "meal"), ne(reminders.status, "sent")));
  }
  if (patch.waterReminders || patch.sleepReminder || patch.habitReminder || patch.waterGoalOz != null) {
    await db
      .delete(reminders)
      .where(and(inArray(reminders.kind, ["water", "sleep", "habit"]), ne(reminders.status, "sent")));
  }
  if (patch.outfitReminder) {
    await db.delete(reminders).where(and(eq(reminders.kind, "outfit"), ne(reminders.status, "sent")));
  }
  return next;
}
