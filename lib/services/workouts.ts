import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { getDb } from "../db";
import { workoutExercises, workoutSets, workouts } from "../db/schema";
import { HttpError } from "../errors";
import { getZonedParts, todayDateString, zonedDateTimeToUtc } from "../time";
import { blankToNull } from "../text";
import type { WorkoutDto } from "../types";
import type { ExerciseInput, WorkoutCreate, WorkoutPatch } from "../validation";
import { serializeExercise, serializeSet, serializeWorkout } from "./dto";
import { clearPendingReminder, syncWorkoutReminder } from "./reminders";
import { getSettings } from "./settings";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function resolveScheduled(
  input: { scheduledAt?: string | null; date?: string; time?: string },
  fallback?: Date | null,
) {
  if (input.scheduledAt === null) return null;
  if (input.date || input.time) {
    const date = input.date ?? (fallback ? getZonedParts(fallback).date : undefined);
    const time = input.time ?? (fallback ? getZonedParts(fallback).time : undefined);
    if (!date || !time) throw new HttpError("Provide date and time", 400);
    return zonedDateTimeToUtc(date, time);
  }
  if (input.scheduledAt) {
    const date = new Date(input.scheduledAt);
    if (Number.isNaN(date.getTime())) throw new HttpError("Invalid scheduledAt", 400);
    return date;
  }
  return fallback ?? null;
}

async function insertExercises(tx: Tx, workoutId: string, exercises: ExerciseInput[]) {
  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index];
    const sets = exercise.sets ?? [];
    for (const set of sets) {
      if (set.reps == null && set.durationSeconds == null) {
        throw new HttpError(`Add reps or a duration for ${exercise.name}`, 400);
      }
    }
    const [created] = await tx
      .insert(workoutExercises)
      .values({
        workoutId,
        name: exercise.name,
        position: index,
        notes: blankToNull(exercise.notes),
      })
      .returning();
    if (!sets.length) continue;
    await tx.insert(workoutSets).values(
      sets.map((set, setIndex) => ({
        exerciseId: created.id,
        position: setIndex,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: set.weightUnit ?? "lb",
        durationSeconds: set.durationSeconds ?? null,
        completed: set.completed ?? false,
      })),
    );
  }
}

async function hydrate(rows: Array<typeof workouts.$inferSelect>): Promise<WorkoutDto[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((row) => row.id);
  const exercises = await db
    .select()
    .from(workoutExercises)
    .where(inArray(workoutExercises.workoutId, ids))
    .orderBy(asc(workoutExercises.position));
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const sets = exerciseIds.length
    ? await db
        .select()
        .from(workoutSets)
        .where(inArray(workoutSets.exerciseId, exerciseIds))
        .orderBy(asc(workoutSets.position))
    : [];
  return rows.map((row) =>
    serializeWorkout(
      row,
      exercises
        .filter((exercise) => exercise.workoutId === row.id)
        .map((exercise) =>
          serializeExercise(
            exercise,
            sets.filter((set) => set.exerciseId === exercise.id).map(serializeSet),
          ),
        ),
    ),
  );
}

export async function getWorkout(id: string) {
  const db = getDb();
  const [row] = await db.select().from(workouts).where(eq(workouts.id, id));
  if (!row) return null;
  const [workout] = await hydrate([row]);
  return workout;
}

export async function listWorkoutsInRange(from: Date, to: Date) {
  const db = getDb();
  const rows = await db
    .select()
    .from(workouts)
    .where(and(gte(workouts.scheduledAt, from), lt(workouts.scheduledAt, to)))
    .orderBy(asc(workouts.scheduledAt));
  return hydrate(rows);
}

export async function workoutBoard(now = new Date()) {
  const db = getDb();
  const start = zonedDateTimeToUtc(todayDateString(now), "00:00");
  const upcomingRows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.status, "planned"), or(isNull(workouts.scheduledAt), gte(workouts.scheduledAt, start))))
    .orderBy(asc(workouts.scheduledAt))
    .limit(30);
  const historyRows = await db
    .select()
    .from(workouts)
    .where(or(ne(workouts.status, "planned"), lt(workouts.scheduledAt, start)))
    .orderBy(desc(workouts.scheduledAt))
    .limit(20);
  const [upcoming, history] = await Promise.all([hydrate(upcomingRows), hydrate(historyRows)]);
  return { upcoming, history };
}

async function loadRow(id: string) {
  const db = getDb();
  const [row] = await db.select().from(workouts).where(eq(workouts.id, id));
  return row ?? null;
}

export async function createWorkout(input: WorkoutCreate) {
  const prefs = await getSettings();
  const reminder =
    input.reminderMinutesBefore === undefined ? prefs.defaultWorkoutReminderMinutes : input.reminderMinutesBefore;
  const scheduledAt = resolveScheduled(input, null);
  const db = getDb();
  const createdId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(workouts)
      .values({
        title: input.title,
        scheduledAt,
        notes: blankToNull(input.notes),
        reminderMinutesBefore: reminder,
        status: "planned",
      })
      .returning();
    if (input.exercises?.length) await insertExercises(tx, row.id, input.exercises);
    return row.id;
  });
  const row = await loadRow(createdId);
  if (row) await syncWorkoutReminder(row);
  const workout = await getWorkout(createdId);
  if (!workout) throw new HttpError("Workout not found", 404);
  return workout;
}

export async function updateWorkout(id: string, patch: WorkoutPatch) {
  const current = await loadRow(id);
  if (!current) throw new HttpError("Workout not found", 404);
  const scheduledAt =
    patch.scheduledAt !== undefined || patch.date || patch.time
      ? resolveScheduled(patch, current.scheduledAt)
      : current.scheduledAt;
  const reminder =
    "reminderMinutesBefore" in patch ? (patch.reminderMinutesBefore ?? null) : current.reminderMinutesBefore;
  let status = current.status;
  let completedAt = current.completedAt;
  if (patch.status) {
    status = patch.status;
    if (status === "done") completedAt = current.completedAt ?? new Date();
    else completedAt = null;
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(workouts)
      .set({
        title: patch.title ?? current.title,
        notes: "notes" in patch ? blankToNull(patch.notes) : current.notes,
        scheduledAt,
        reminderMinutesBefore: reminder,
        status,
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(workouts.id, id));

    if (patch.exercises) {
      await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, id));
      if (patch.exercises.length) await insertExercises(tx, id, patch.exercises);
    }

    if (patch.setCompleted) {
      const [set] = await tx.select().from(workoutSets).where(eq(workoutSets.id, patch.setCompleted.setId));
      if (!set) throw new HttpError("Set not found", 404);
      const [exercise] = await tx
        .select()
        .from(workoutExercises)
        .where(eq(workoutExercises.id, set.exerciseId));
      if (!exercise || exercise.workoutId !== id) throw new HttpError("Set not found", 404);
      await tx.update(workoutSets).set({ completed: patch.setCompleted.completed }).where(eq(workoutSets.id, set.id));
    }

    if (status === "done") {
      const exerciseRows = await tx
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .where(eq(workoutExercises.workoutId, id));
      if (exerciseRows.length) {
        await tx
          .update(workoutSets)
          .set({ completed: true })
          .where(
            inArray(
              workoutSets.exerciseId,
              exerciseRows.map((exercise) => exercise.id),
            ),
          );
      }
    }
  });

  const row = await loadRow(id);
  if (row) await syncWorkoutReminder(row);
  const workout = await getWorkout(id);
  if (!workout) throw new HttpError("Workout not found", 404);
  return workout;
}

export async function deleteWorkout(id: string) {
  const current = await loadRow(id);
  if (!current) throw new HttpError("Workout not found", 404);
  const db = getDb();
  await db.delete(workouts).where(eq(workouts.id, id));
  await clearPendingReminder(`workout:${id}`);
  return { ok: true };
}

export async function workoutsOnDay(from: Date, to: Date) {
  return listWorkoutsInRange(from, to);
}

export async function nextPlannedWorkout(now: Date) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.status, "planned"), gte(workouts.scheduledAt, now)))
    .orderBy(asc(workouts.scheduledAt))
    .limit(1);
  if (!row) return null;
  const [workout] = await hydrate([row]);
  return workout;
}
