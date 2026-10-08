import { json } from "../api";
import { HttpError } from "../errors";
import { detailExercise, getExercise, listExercise, searchExercises } from "../exercises";

function readLimit(url: URL, fallback: number) {
  const raw = url.searchParams.get("limit");
  if (!raw) return fallback;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new HttpError("limit must be 1–200", 400);
  }
  return limit;
}

export async function getExercises(req: Request) {
  const url = new URL(req.url);
  const exercises = searchExercises({
    q: url.searchParams.get("q") || undefined,
    muscle: url.searchParams.get("muscle") || undefined,
    equipment: url.searchParams.get("equipment") || undefined,
    limit: readLimit(url, 200),
  });
  return json({ count: exercises.length, exercises: exercises.map(listExercise) });
}

export async function getBotExercises(req: Request) {
  const url = new URL(req.url);
  const exercises = searchExercises({
    q: url.searchParams.get("q") || undefined,
    muscle: url.searchParams.get("muscle") || undefined,
    equipment: url.searchParams.get("equipment") || undefined,
    limit: readLimit(url, 40),
  });
  return json({ count: exercises.length, exercises: exercises.map(detailExercise) });
}

export async function getExerciseById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const exercise = getExercise(decodeURIComponent(id));
  if (!exercise) throw new HttpError("Exercise not found", 404);
  return json(detailExercise(exercise));
}
