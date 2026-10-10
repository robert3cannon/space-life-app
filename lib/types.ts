import type { EquipmentProfile } from "./equipment";

export const EVENT_TYPES = ["class", "work", "study", "workout", "meal", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEALS)[number];

export const WORKOUT_STATUSES = ["planned", "done", "skipped"] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const REMINDER_KINDS = ["event", "meal", "workout", "custom", "water", "sleep", "habit", "outfit"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_STATUSES = ["pending", "sent", "cancelled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export type Targets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealReminderSetting = {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
};

export type WaterReminderSetting = {
  enabled: boolean;
  times: string[];
};

export type ClockReminderSetting = {
  enabled: boolean;
  time: string;
};

export const HABIT_AUTOS = ["protein", "water", "workout", "steps"] as const;
export type HabitAuto = (typeof HABIT_AUTOS)[number];

export type OutfitReminderSetting = {
  enabled: boolean;
  time: string;
};

export type CircuitAudioSetting = {
  enabled: boolean;
  /** 0–100. Short cues mix with other audio. */
  volume: number;
};

export type AppSettings = {
  timezone: string;
  targets: Targets;
  mealReminders: MealReminderSetting[];
  defaultEventReminderMinutes: number;
  defaultWorkoutReminderMinutes: number;
  waterGoalOz: number;
  waterReminders: WaterReminderSetting;
  sleepReminder: ClockReminderSetting;
  habitReminder: ClockReminderSetting;
  outfitReminder: OutfitReminderSetting;
  equipment: EquipmentProfile;
  circuitAudio: CircuitAudioSetting;
};

export type EventDto = {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
  reminderMinutesBefore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FoodDto = {
  id: string;
  mealId: string;
  name: string;
  brand: string | null;
  meal: MealType;
  place: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  grams: number | null;
  quantity: number;
  servingLabel: string | null;
  sourceId: string | null;
  loggedAt: string;
  notes: string | null;
  createdAt: string;
};

export type MealItemDto = {
  id: string;
  name: string;
  brand: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  grams: number | null;
  quantity: number;
  servingLabel: string | null;
  sourceId: string | null;
  position: number;
};

export type MealDto = {
  id: string;
  place: string | null;
  meal: MealType;
  loggedAt: string;
  notes: string | null;
  createdAt: string;
  itemCount: number;
  totals: Targets;
  items: MealItemDto[];
};

export type SetDto = {
  id: string;
  position: number;
  reps: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
  durationSeconds: number | null;
  completed: boolean;
};

export type ExerciseDto = {
  id: string;
  name: string;
  libraryId: string | null;
  catalogId: string | null;
  position: number;
  notes: string | null;
  sets: SetDto[];
};

export type WorkoutDto = {
  id: string;
  title: string;
  scheduledAt: string | null;
  completedAt: string | null;
  status: WorkoutStatus;
  notes: string | null;
  reminderMinutesBefore: number | null;
  durationSeconds: number | null;
  exercises: ExerciseDto[];
  muscles: { primary: string[]; secondary: string[] };
  createdAt: string;
  updatedAt: string;
};

export type RoutineExercise = {
  libraryId: string | null;
  name: string;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  weight: number | null;
  weightUnit: "lb" | "kg";
};

export type RoutineDto = {
  id: string;
  title: string;
  restSeconds: number;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
};

export type ReminderDto = {
  id: string;
  title: string;
  body: string;
  fireAt: string;
  kind: ReminderKind;
  relatedId: string | null;
  status: ReminderStatus;
  sentAt: string | null;
  createdAt: string;
};

export type ActivityDto = {
  id: string;
  source: "bot" | "user" | "system";
  author: string | null;
  message: string;
  createdAt: string;
};

export type WaterDto = {
  id: string;
  ounces: number;
  loggedAt: string;
  createdAt: string;
};

export type SleepDto = {
  id: string;
  wakeDate: string;
  bedtime: string | null;
  wakeAt: string | null;
  durationMinutes: number;
  quality: number | null;
  notes: string | null;
  source: "manual" | "health";
};

export type HabitSummary = {
  id: string;
  name: string;
  days: number[] | null;
  auto: HabitAuto | null;
  remind: boolean;
  scheduled: boolean;
  done: boolean;
  source: "manual" | "auto" | "skip" | null;
  currentStreak: number;
  bestStreak: number;
};

export type TodayPayload = {
  timezone: string;
  now: string;
  date: string;
  greeting: string;
  place: string;
  events: EventDto[];
  focus: {
    label: string;
    title: string;
    detail: string;
    eventId: string | null;
  } | null;
  food: {
    targets: Targets;
    totals: Targets;
    logs: FoodDto[];
    meals: MealDto[];
  };
  workouts: WorkoutDto[];
  nextWorkout: WorkoutDto | null;
  reminders: ReminderDto[];
  activity: ActivityDto[];
  water: {
    goalOz: number;
    totalOz: number;
  };
  sleep: {
    log: SleepDto | null;
    weekAverageMinutes: number | null;
    trendMinutes: number | null;
  };
  habits: HabitSummary[];
  health: {
    steps: number | null;
    activeKcal: number | null;
    exerciseMinutes: number | null;
    dietaryWaterOz: number | null;
  } | null;
};

export type ClosetSlotName = "top" | "bottom" | "layer" | "shoes" | "extra";
export type OutfitSlotName = "top" | "bottom" | "layer" | "shoes";

export type ClosetCategoryDto = {
  id: string;
  name: string;
  slot: ClosetSlotName;
  position: number;
};

export type ClosetItemDto = {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  slot: ClosetSlotName;
  colors: string[];
  warmth: number;
  tags: string[];
  inLaundry: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutfitItemDto = ClosetItemDto & { slot: OutfitSlotName };

export type OutfitDto = {
  id: string;
  date: string;
  reason: string;
  source: "rules" | "bot";
  wornAt: string | null;
  weather: { tempF: number; label: string; place: string; live: boolean } | null;
  items: OutfitItemDto[];
};
