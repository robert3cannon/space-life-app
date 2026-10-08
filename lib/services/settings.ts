import { eq, and, ne } from "drizzle-orm";
import { getDb } from "../db";
import { reminders, settings } from "../db/schema";
import { DEFAULT_SETTINGS } from "../defaults";
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
  };
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
  });
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  if (patch.mealReminders) {
    await db.delete(reminders).where(and(eq(reminders.kind, "meal"), ne(reminders.status, "sent")));
  }
  return next;
}
