export const EVENT_TYPES = ["class", "work", "study", "workout", "meal", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEALS)[number];

export const WORKOUT_STATUSES = ["planned", "done", "skipped"] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const REMINDER_KINDS = ["event", "meal", "workout", "custom"] as const;
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

export type AppSettings = {
  timezone: string;
  targets: Targets;
  mealReminders: MealReminderSetting[];
  defaultEventReminderMinutes: number;
  defaultWorkoutReminderMinutes: number;
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
  name: string;
  meal: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string;
  notes: string | null;
  createdAt: string;
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
  exercises: ExerciseDto[];
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
  };
  workouts: WorkoutDto[];
  nextWorkout: WorkoutDto | null;
  reminders: ReminderDto[];
  activity: ActivityDto[];
};
