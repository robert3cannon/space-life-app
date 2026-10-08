import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AppSettings } from "../types";

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

export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  reminderMinutesBefore: integer("reminder_minutes_before"),
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
