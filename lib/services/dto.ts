import { round1 } from "../format";
import type { events, mealItems, meals, reminders, workoutExercises, workoutSets, workouts } from "../db/schema";
import type { EventDto, ExerciseDto, FoodDto, MealItemDto, MealType, ReminderDto, SetDto, WorkoutDto } from "../types";

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

export function serializeMealItem(row: typeof mealItems.$inferSelect): MealItemDto {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    calories: row.calories,
    proteinG: round1(row.proteinG),
    carbsG: round1(row.carbsG),
    fatG: round1(row.fatG),
    grams: row.grams == null ? null : round1(row.grams),
    quantity: round1(row.quantity),
    servingLabel: row.servingLabel,
    sourceId: row.sourceId,
    position: row.position,
  };
}

export function serializeFood(item: typeof mealItems.$inferSelect, meal: typeof meals.$inferSelect): FoodDto {
  return {
    id: item.id,
    mealId: meal.id,
    name: item.name,
    brand: item.brand,
    meal: meal.meal as MealType,
    place: meal.place,
    calories: item.calories,
    proteinG: round1(item.proteinG),
    carbsG: round1(item.carbsG),
    fatG: round1(item.fatG),
    grams: item.grams == null ? null : round1(item.grams),
    quantity: round1(item.quantity),
    servingLabel: item.servingLabel,
    sourceId: item.sourceId,
    loggedAt: meal.loggedAt.toISOString(),
    notes: meal.notes,
    createdAt: item.createdAt.toISOString(),
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
    libraryId: row.libraryId,
    catalogId: null,
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
    durationSeconds: row.durationSeconds,
    exercises,
    muscles: { primary: [], secondary: [] },
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
