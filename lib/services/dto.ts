import { round1 } from "../format";
import type { events, foodLogs, reminders, workoutExercises, workoutSets, workouts } from "../db/schema";
import type { EventDto, ExerciseDto, FoodDto, ReminderDto, SetDto, WorkoutDto } from "../types";

export function serializeEvent(row: typeof events.$inferSelect): EventDto {
  return {
    id: row.id,
    title: row.title,
    type: row.type as EventDto["type"],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    location: row.location,
    notes: row.notes,
    reminderMinutesBefore: row.reminderMinutesBefore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeFood(row: typeof foodLogs.$inferSelect): FoodDto {
  return {
    id: row.id,
    name: row.name,
    meal: row.meal as FoodDto["meal"],
    calories: row.calories,
    proteinG: round1(row.proteinG),
    carbsG: round1(row.carbsG),
    fatG: round1(row.fatG),
    loggedAt: row.loggedAt.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSet(row: typeof workoutSets.$inferSelect): SetDto {
  return {
    id: row.id,
    position: row.position,
    reps: row.reps,
    weight: row.weight == null ? null : round1(row.weight),
    weightUnit: row.weightUnit === "kg" ? "kg" : "lb",
    durationSeconds: row.durationSeconds,
    completed: row.completed,
  };
}

export function serializeExercise(
  row: typeof workoutExercises.$inferSelect,
  sets: SetDto[],
): ExerciseDto {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    notes: row.notes,
    sets,
  };
}

export function serializeWorkout(
  row: typeof workouts.$inferSelect,
  exercises: ExerciseDto[],
): WorkoutDto {
  return {
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    status: row.status as WorkoutDto["status"],
    notes: row.notes,
    reminderMinutesBefore: row.reminderMinutesBefore,
    exercises,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeReminder(row: typeof reminders.$inferSelect): ReminderDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    fireAt: row.fireAt.toISOString(),
    kind: row.kind as ReminderDto["kind"],
    relatedId: row.relatedId,
    status: row.status as ReminderDto["status"],
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
