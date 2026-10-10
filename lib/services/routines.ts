import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { savedWorkouts, workouts } from "../db/schema";
import { HttpError } from "../errors";
import { getExercise } from "../exercises";
import { getZonedParts } from "../time";
import type { RoutineDto, RoutineExercise } from "../types";
import type { RoutineSchedule, RoutineWrite, SessionLog } from "../validation";
import { createWorkout, getWorkout, listDoneWorkouts, updateWorkout } from "./workouts";

function cleanExercises(exercises: RoutineWrite["exercises"]): RoutineExercise[] {
  return exercises.map((exercise) => {
    const libraryId = exercise.libraryId ?? null;
    const catalog = libraryId ? getExercise(libraryId) : null;
    if (libraryId && !catalog) throw new HttpError("Exercise not found", 404);
    const reps = exercise.reps ?? null;
    const durationSeconds = exercise.durationSeconds ?? null;
    if ((reps == null) === (durationSeconds == null)) {
      throw new HttpError(`Use reps or a hold time for ${exercise.name}`, 400);
    }
    return {
      libraryId: catalog?.id ?? null,
      name: (exercise.name.trim() || catalog?.name || "").trim(),
      sets: exercise.sets,
      reps,
      durationSeconds,
      weight: exercise.weight ?? null,
      weightUnit: exercise.weightUnit ?? "lb",
    };
  });
}

function serialize(row: typeof savedWorkouts.$inferSelect): RoutineDto {
  return {
    id: row.id,
    title: row.title,
    restSeconds: row.restSeconds,
    exercises: row.exercises ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadRoutine(id: string) {
  const db = getDb();
  const [row] = await db.select().from(savedWorkouts).where(eq(savedWorkouts.id, id));
  return row ?? null;
}

export async function listRoutines() {
  const db = getDb();
  const rows = await db.select().from(savedWorkouts).orderBy(desc(savedWorkouts.updatedAt), asc(savedWorkouts.title));
  return rows.map(serialize);
}

export async function getRoutine(id: string) {
  const row = await loadRoutine(id);
  return row ? serialize(row) : null;
}

export async function createRoutine(input: RoutineWrite) {
  const exercises = cleanExercises(input.exercises);
  const db = getDb();
  const [row] = await db
    .insert(savedWorkouts)
    .values({
      title: input.title.trim(),
      restSeconds: input.restSeconds ?? 60,
      exercises,
    })
    .returning();
  return serialize(row);
}

export async function updateRoutine(id: string, input: RoutineWrite) {
  const current = await loadRoutine(id);
  if (!current) throw new HttpError("Workout not found", 404);
  const exercises = cleanExercises(input.exercises);
  const db = getDb();
  const [row] = await db
    .update(savedWorkouts)
    .set({
      title: input.title.trim(),
      restSeconds: input.restSeconds ?? current.restSeconds,
      exercises,
      updatedAt: new Date(),
    })
    .where(eq(savedWorkouts.id, id))
    .returning();
  return serialize(row);
}

export async function deleteRoutine(id: string) {
  const current = await loadRoutine(id);
  if (!current) throw new HttpError("Workout not found", 404);
  const db = getDb();
  await db.delete(savedWorkouts).where(eq(savedWorkouts.id, id));
  return { ok: true };
}

function expand(exercise: RoutineExercise, completed: boolean) {
  return {
    name: exercise.name,
    libraryId: exercise.libraryId,
    sets: Array.from({ length: exercise.sets }, () => ({
      reps: exercise.reps,
      weight: exercise.weight,
      weightUnit: exercise.weightUnit,
      durationSeconds: exercise.durationSeconds,
      completed,
    })),
  };
}

export async function scheduleRoutine(id: string, input: RoutineSchedule) {
  const routine = await getRoutine(id);
  if (!routine) throw new HttpError("Workout not found", 404);
  return createWorkout({
    title: routine.title,
    date: input.date,
    time: input.time,
    exercises: routine.exercises.map((exercise) => expand(exercise, false)),
  });
}

export async function logSession(input: SessionLog, now = new Date()) {
  const started = input.startedAt ? new Date(input.startedAt) : now;
  if (Number.isNaN(started.getTime())) throw new HttpError("Invalid startedAt", 400);
  const parts = getZonedParts(started);
  const duration =
    input.durationSeconds ?? Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));
  const planned = await createWorkout({
    title: input.title,
    date: parts.date,
    time: parts.time,
    reminderMinutesBefore: null,
    exercises: input.exercises.map((exercise) => ({
      name: exercise.name,
      libraryId: exercise.libraryId ?? null,
      notes: exercise.notes ?? null,
      sets: (exercise.sets ?? []).map((set) => ({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: set.weightUnit ?? "lb",
        durationSeconds: set.durationSeconds ?? null,
        completed: true,
      })),
    })),
  });
  const db = getDb();
  await db.update(workouts).set({ durationSeconds: duration }).where(eq(workouts.id, planned.id));
  const workout = await updateWorkout(planned.id, { status: "done" });
  return workout;
}

export async function listSessions(limit = 30) {
  return listDoneWorkouts(limit);
}

export async function getSession(id: string) {
  const workout = await getWorkout(id);
  if (!workout || workout.status !== "done") return null;
  return workout;
}
