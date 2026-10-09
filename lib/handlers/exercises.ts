import { json } from "../api";
import { libraryEquipment, pushupBoardZones } from "../equipment";
import { HttpError } from "../errors";
import { EQUIPMENT, detailExercise, getExercise, isEquipment, listExercise, searchExercises, type CatalogExercise } from "../exercises";
import { getSettings } from "../services/settings";

function readLimit(url: URL, fallback: number) {
  const raw = url.searchParams.get("limit");
  if (!raw) return fallback;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new HttpError("limit must be 1–200", 400);
  }
  return limit;
}

async function ownedExercises(req: Request, fallbackLimit: number) {
  const url = new URL(req.url);
  const profile = (await getSettings()).equipment;
  const owned = libraryEquipment(profile);
  const requested = url.searchParams.get("equipment") || undefined;
  const showAll = url.searchParams.get("all") === "1";
  if (requested && !isEquipment(requested)) {
    throw new HttpError(`Unknown equipment. Use ${EQUIPMENT.join(", ")}`, 400);
  }
  if (requested && !showAll && !owned.includes(requested as "bodyweight" | "dumbbell")) {
    return { profile, exercises: [] as CatalogExercise[] };
  }
  const exercises = searchExercises({
    q: url.searchParams.get("q") || undefined,
    muscle: url.searchParams.get("muscle") || undefined,
    equipment: requested,
    sort: url.searchParams.get("sort") || undefined,
  }).filter((exercise) => showAll || owned.includes(exercise.equipment as "bodyweight" | "dumbbell"));
  return { profile, exercises: exercises.slice(0, readLimit(url, fallbackLimit)) };
}

export async function getExercises(req: Request) {
  const { exercises } = await ownedExercises(req, 200);
  return json({ count: exercises.length, exercises: exercises.map(listExercise) });
}

export async function getBotExercises(req: Request) {
  const { exercises } = await ownedExercises(req, 40);
  return json({ count: exercises.length, exercises: exercises.map(detailExercise) });
}

export async function getExerciseById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const exercise = getExercise(decodeURIComponent(id));
  if (!exercise) throw new HttpError("Exercise not found", 404);
  const profile = (await getSettings()).equipment;
  const board = profile.gear.includes("pushup_board") ? pushupBoardZones(exercise.id) : null;
  return json({ ...detailExercise(exercise), board });
}
