import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { routeId } from "../ids";
import { parseRange } from "../query";
import { appendWorkoutExercise, createWorkout, deleteWorkout, getWorkout, listWorkoutsInRange, muscleCoverage, updateWorkout, workoutBoard } from "../services/workouts";
import { todayDateString } from "../time";
import { HttpError } from "../errors";
import { exerciseAppendSchema, workoutCreateSchema, workoutPatchSchema } from "../validation";

export async function getWorkouts(req: Request) {
  const url = new URL(req.url);
  const today = todayDateString();
  if (url.searchParams.get("from") || url.searchParams.get("to")) {
    const range = parseRange(url);
    return json({
      timezone: TIMEZONE,
      today,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      workouts: await listWorkoutsInRange(range.from, range.to),
    });
  }
  const board = await workoutBoard();
  return json({ timezone: TIMEZONE, today, ...board });
}

export async function postWorkout(req: Request) {
  const input = workoutCreateSchema.parse(await readJson(req));
  return json(await createWorkout(input), 201);
}

export async function getWorkoutById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const workout = await getWorkout(await routeId(ctx));
  if (!workout) throw new HttpError("Workout not found", 404);
  return json(workout);
}

export async function patchWorkout(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = workoutPatchSchema.parse(await readJson(req));
  return json(await updateWorkout(await routeId(ctx), input));
}

export async function removeWorkout(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteWorkout(await routeId(ctx)));
}

export async function getCoverage(req: Request) {
  const date = new URL(req.url).searchParams.get("date") || undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("date must be YYYY-MM-DD", 400);
  return json(await muscleCoverage(date));
}

export async function postWorkoutExercise(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = exerciseAppendSchema.parse(await readJson(req));
  return json(await appendWorkoutExercise(await routeId(ctx), input), 201);
}
