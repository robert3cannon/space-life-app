import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { AppSettings, RoutineExercise } from "../types";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
  location: text("location"),
  notes: text("notes"),
  reminderMinutesBefore: integer("reminder_minutes_before"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const foodLogs = pgTable("food_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  meal: text("meal").notNull(),
  calories: integer("calories").notNull(),
  proteinG: doublePrecision("protein_g").notNull().default(0),
  carbsG: doublePrecision("carbs_g").notNull().default(0),
  fatG: doublePrecision("fat_g").notNull().default(0),
  loggedAt: timestamp("logged_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const meals = pgTable("meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  place: text("place"),
  meal: text("meal").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const mealItems = pgTable("meal_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  mealId: uuid("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand"),
  calories: integer("calories").notNull(),
  proteinG: doublePrecision("protein_g").notNull().default(0),
  carbsG: doublePrecision("carbs_g").notNull().default(0),
  fatG: doublePrecision("fat_g").notNull().default(0),
  grams: doublePrecision("grams"),
  quantity: doublePrecision("quantity").notNull().default(1),
  servingLabel: text("serving_label"),
  sourceId: text("source_id"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  reminderMinutesBefore: integer("reminder_minutes_before"),
  healthKey: text("health_key").unique(),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const savedWorkouts = pgTable("saved_workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  restSeconds: integer("rest_seconds").notNull().default(60),
  exercises: jsonb("exercises").$type<RoutineExercise[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const workoutExercises = pgTable("workout_exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  workoutId: uuid("workout_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
  libraryId: text("library_id"),
});

export const workoutSets = pgTable("workout_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id").notNull(),
  position: integer("position").notNull().default(0),
  reps: integer("reps"),
  weight: doublePrecision("weight"),
  weightUnit: text("weight_unit").notNull().default("lb"),
  durationSeconds: integer("duration_seconds"),
  completed: boolean("completed").notNull().default(false),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  fireAt: timestamp("fire_at", { withTimezone: true, mode: "date" }).notNull(),
  kind: text("kind").notNull(),
  relatedId: uuid("related_id"),
  dedupeKey: text("dedupe_key"),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  author: text("author"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<AppSettings>().notNull(),
});

export const foodCache = pgTable("food_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const waterLogs = pgTable("water_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ounces: doublePrecision("ounces").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const sleepLogs = pgTable("sleep_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  wakeDate: text("wake_date").notNull(),
  bedtime: timestamp("bedtime", { withTimezone: true, mode: "date" }),
  wakeAt: timestamp("wake_at", { withTimezone: true, mode: "date" }),
  durationMinutes: integer("duration_minutes").notNull(),
  quality: integer("quality"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  days: jsonb("days").$type<number[] | null>(),
  auto: text("auto"),
  remind: boolean("remind").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const healthDays = pgTable("health_days", {
  date: text("date").primaryKey(),
  steps: integer("steps"),
  activeKcal: doublePrecision("active_kcal"),
  restingKcal: doublePrecision("resting_kcal"),
  exerciseMinutes: doublePrecision("exercise_minutes"),
  restingHr: doublePrecision("resting_hr"),
  dietaryWaterOz: doublePrecision("dietary_water_oz"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const healthWeights = pgTable("health_weights", {
  id: uuid("id").primaryKey().defaultRandom(),
  measuredAt: timestamp("measured_at", { withTimezone: true, mode: "date" }).notNull().unique(),
  pounds: doublePrecision("pounds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const healthSync = pgTable("health_sync", {
  id: text("id").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull(),
  summary: jsonb("summary").notNull(),
});

export const healthTokens = pgTable("health_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const healthExports = pgTable(
  "health_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    sourceId: uuid("source_id").notNull(),
    exportedAt: timestamp("exported_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("health_exports_kind_source").on(table.kind, table.sourceId)],
);

export const closetCategories = pgTable("closet_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slot: text("slot").notNull(),
  position: integer("position").notNull().default(0),
});

export const closetItems = pgTable("closet_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").notNull(),
  colors: jsonb("colors").$type<string[]>().notNull(),
  warmth: integer("warmth").notNull().default(3),
  tags: jsonb("tags").$type<string[]>().notNull(),
  inLaundry: boolean("in_laundry").notNull().default(false),
  imageType: text("image_type"),
  blobPathname: text("blob_pathname"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const outfits = pgTable("outfits", {
  id: uuid("id").primaryKey().defaultRandom(),
  wearDate: text("wear_date").notNull(),
  reason: text("reason").notNull().default(""),
  source: text("source").notNull().default("rules"),
  wornAt: timestamp("worn_at", { withTimezone: true, mode: "date" }),
  weather: jsonb("weather").$type<{ tempF: number; code: number; label: string; live: boolean } | null>(),
  generation: integer("generation").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const outfitSlots = pgTable("outfit_slots", {
  outfitId: uuid("outfit_id").notNull(),
  slot: text("slot").notNull(),
  itemId: uuid("item_id").notNull(),
});

export const habitChecks = pgTable("habit_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  habitId: uuid("habit_id").notNull(),
  date: text("date").notNull(),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
