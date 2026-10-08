import { z } from "zod";
import { GEAR_IDS } from "./equipment";
import { EVENT_TYPES, HABIT_AUTOS, MEALS, WORKOUT_STATUSES } from "./types";

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeField = z.string().regex(/^\d{2}:\d{2}$/);

export const eventCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(EVENT_TYPES),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  date: dateField.optional(),
  startTime: timeField.optional(),
  endTime: timeField.optional(),
  location: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(1440).nullable().optional(),
});

export const eventPatchSchema = eventCreateSchema.partial();

export const foodCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  meal: z.enum(MEALS),
  calories: z.number().int().min(0).max(20000),
  proteinG: z.number().min(0).max(2000).optional(),
  carbsG: z.number().min(0).max(2000).optional(),
  fatG: z.number().min(0).max(2000).optional(),
  loggedAt: z.string().min(1).optional(),
  date: dateField.optional(),
  time: timeField.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const foodPatchSchema = foodCreateSchema.partial();

export const mealItemWriteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(80).nullable().optional(),
  calories: z.number().int().min(0).max(20000),
  proteinG: z.number().min(0).max(2000).optional(),
  carbsG: z.number().min(0).max(2000).optional(),
  fatG: z.number().min(0).max(2000).optional(),
  grams: z.number().min(0).max(20000).nullable().optional(),
  quantity: z.number().positive().max(100).optional(),
  servingLabel: z.string().trim().max(120).nullable().optional(),
  sourceId: z.string().trim().max(180).nullable().optional(),
});

export const mealCreateSchema = z.object({
  place: z.string().trim().min(1).max(80),
  meal: z.enum(MEALS).optional(),
  loggedAt: z.string().min(1).optional(),
  date: dateField.optional(),
  time: timeField.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(mealItemWriteSchema).min(1).max(30),
});

export const mealPatchSchema = mealCreateSchema.partial().extend({
  items: z.array(mealItemWriteSchema).min(1).max(30).optional(),
});

export const mealItemPatchSchema = mealItemWriteSchema.omit({ id: true }).partial();

const setSchema = z.object({
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  weight: z.number().min(0).max(5000).nullable().optional(),
  weightUnit: z.enum(["lb", "kg"]).optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).nullable().optional(),
  completed: z.boolean().optional(),
});

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  libraryId: z.string().trim().min(1).max(160).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  sets: z.array(setSchema).max(30).optional(),
});

export const exerciseAppendSchema = z
  .object({
    libraryId: z.string().trim().min(1).max(160).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    sets: z.array(setSchema).max(30).optional(),
  })
  .refine((value) => Boolean(value.libraryId || value.name), "Provide a library exercise or a name");

export const circuitScheduleSchema = z.object({
  date: dateField,
  time: timeField,
  difficulty: z.enum(["beginner", "intermediate"]).optional(),
  rounds: z.number().int().min(1).max(5).optional(),
});

export const circuitCompleteSchema = z.object({
  difficulty: z.enum(["beginner", "intermediate"]).optional(),
  rounds: z.number().int().min(1).max(5).optional(),
});

export const workoutCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  scheduledAt: z.string().min(1).nullable().optional(),
  date: dateField.optional(),
  time: timeField.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(1440).nullable().optional(),
  exercises: z.array(exerciseSchema).max(40).optional(),
});

export const workoutPatchSchema = workoutCreateSchema.partial().extend({
  status: z.enum(WORKOUT_STATUSES).optional(),
  setCompleted: z
    .object({
      setId: z.string().uuid(),
      completed: z.boolean(),
    })
    .optional(),
});

export const reminderCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(240).optional(),
  fireAt: z.string().min(1).optional(),
  date: dateField.optional(),
  time: timeField.optional(),
});

export const reminderPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().max(240).optional(),
  fireAt: z.string().min(1).optional(),
  date: dateField.optional(),
  time: timeField.optional(),
  status: z.enum(["pending", "cancelled"]).optional(),
});

export const feedSchema = z.object({
  message: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(40).optional(),
});

export const settingsPatchSchema = z.object({
  targets: z
    .object({
      calories: z.number().int().min(0).max(20000),
      proteinG: z.number().min(0).max(2000),
      carbsG: z.number().min(0).max(2000),
      fatG: z.number().min(0).max(2000),
    })
    .optional(),
  mealReminders: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(40),
        time: timeField,
        enabled: z.boolean(),
      }),
    )
    .max(8)
    .optional(),
  defaultEventReminderMinutes: z.number().int().min(0).max(1440).optional(),
  defaultWorkoutReminderMinutes: z.number().int().min(0).max(1440).optional(),
  waterGoalOz: z.number().int().min(8).max(400).optional(),
  waterReminders: z
    .object({
      enabled: z.boolean(),
      times: z.array(timeField).max(6),
    })
    .superRefine((value, ctx) => {
      if (!value.enabled) return;
      if (!value.times.length) {
        ctx.addIssue({ code: "custom", message: "Add at least one water reminder" });
      }
      if (value.times.some((time) => time < "11:00")) {
        ctx.addIssue({ code: "custom", message: "Water reminders stay at 11:00 or later" });
      }
    })
    .optional(),
  sleepReminder: z
    .object({
      enabled: z.boolean(),
      time: timeField,
    })
    .superRefine((value, ctx) => {
      if (!value.enabled) return;
      const late = value.time >= "20:00" || value.time <= "04:00";
      if (!late) {
        ctx.addIssue({ code: "custom", message: "Wind-down should be late evening or after midnight" });
      }
    })
    .optional(),
  habitReminder: z
    .object({
      enabled: z.boolean(),
      time: timeField,
    })
    .superRefine((value, ctx) => {
      if (!value.enabled) return;
      if (value.time < "17:00") {
        ctx.addIssue({ code: "custom", message: "The habit reminder should be in the evening" });
      }
    })
    .optional(),
  equipment: z
    .object({
      gear: z.array(z.enum(GEAR_IDS)).max(GEAR_IDS.length),
      dumbbellLb: z.number().int().min(1).max(150),
      dumbbellCount: z.number().int().min(1).max(2),
    })
    .optional(),
  circuitAudio: z
    .object({
      enabled: z.boolean(),
      volume: z.number().int().min(0).max(100),
    })
    .optional(),
});

export const waterCreateSchema = z.object({
  ounces: z.number().min(0.5).max(200),
  loggedAt: z.string().min(1).optional(),
  date: dateField.optional(),
  time: timeField.optional(),
});

export const sleepLogSchema = z
  .object({
    date: dateField.optional(),
    bedtime: timeField.optional(),
    bedtimeDate: dateField.optional(),
    wakeTime: timeField.optional(),
    durationMinutes: z.number().int().min(1).max(960).optional(),
    quality: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Boolean(value.bedtime && value.wakeTime) || value.durationMinutes != null, {
    message: "Provide bedtime and wake time, or a duration",
  });

export const habitCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  days: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  auto: z.enum(HABIT_AUTOS).nullable().optional(),
  remind: z.boolean().optional(),
});

export const habitPatchSchema = habitCreateSchema.partial();

export const habitCheckSchema = z.object({
  date: dateField.optional(),
  done: z.boolean(),
});

export const notifySchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  url: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value.startsWith("/") && !value.startsWith("//"), "url must be an app path")
    .optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

export const healthAckSchema = z.object({
  food: z.array(z.string().uuid()).max(200).optional(),
  water: z.array(z.string().uuid()).max(200).optional(),
});

export const healthTokenSchema = z.object({
  action: z.enum(["generate", "revoke"]),
});

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export type EventCreate = z.infer<typeof eventCreateSchema>;
export type EventPatch = z.infer<typeof eventPatchSchema>;
export type FoodCreate = z.infer<typeof foodCreateSchema>;
export type FoodPatch = z.infer<typeof foodPatchSchema>;
export type MealItemWrite = z.infer<typeof mealItemWriteSchema>;
export type MealCreate = z.infer<typeof mealCreateSchema>;
export type MealPatch = z.infer<typeof mealPatchSchema>;
export type MealItemPatch = z.infer<typeof mealItemPatchSchema>;
export type CircuitSchedule = z.infer<typeof circuitScheduleSchema>;
export type CircuitComplete = z.infer<typeof circuitCompleteSchema>;
export type WorkoutCreate = z.infer<typeof workoutCreateSchema>;
export type WorkoutPatch = z.infer<typeof workoutPatchSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type ExerciseAppend = z.infer<typeof exerciseAppendSchema>;
export type ReminderCreate = z.infer<typeof reminderCreateSchema>;
export type ReminderPatch = z.infer<typeof reminderPatchSchema>;
export type WaterCreate = z.infer<typeof waterCreateSchema>;
export type SleepLogInput = z.infer<typeof sleepLogSchema>;
export type HabitCreate = z.infer<typeof habitCreateSchema>;
export type HabitPatch = z.infer<typeof habitPatchSchema>;
export type HabitCheckInput = z.infer<typeof habitCheckSchema>;
export type HealthAck = z.infer<typeof healthAckSchema>;
export type HealthTokenAction = z.infer<typeof healthTokenSchema>;
