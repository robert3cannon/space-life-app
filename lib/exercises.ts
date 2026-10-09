import catalog from "@/data/exercises.json";
import { HttpError } from "./errors";
import { MUSCLE_IDS, isMuscleId, type MuscleId } from "./muscles";

export const EQUIPMENT = ["bodyweight", "dumbbell", "barbell", "machine", "cable", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type MuscleRating = { score: number; why: string };

export type CatalogExercise = {
  id: string;
  name: string;
  aliases: string[];
  equipment: Equipment;
  level: string;
  mechanic: string;
  category: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  /** 1–5 for each muscle in primary and secondary. 5 is top-tier for that muscle. */
  ratings: Record<string, MuscleRating>;
  steps: string[];
  mistakes: string[];
  images: string[];
};

type CatalogFile = {
  source: {
    name: string;
    author: string;
    url: string;
    license: string;
    commit: string;
    imageBase: string;
  };
  exercises: CatalogExercise[];
};

const file = catalog as unknown as CatalogFile;

export const EXERCISE_SOURCE = file.source;
export const EXERCISES: CatalogExercise[] = file.exercises;

const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
const byName = new Map<string, CatalogExercise>();

export function normalizeExerciseName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

for (const exercise of EXERCISES) {
  byName.set(normalizeExerciseName(exercise.name), exercise);
  for (const alias of exercise.aliases) byName.set(normalizeExerciseName(alias), exercise);
}

export function getExercise(id: string) {
  return byId.get(id) ?? null;
}

export function resolveExercise(libraryId: string | null | undefined, name: string) {
  if (libraryId) {
    const linked = byId.get(libraryId);
    if (linked) return linked;
  }
  return byName.get(normalizeExerciseName(name)) ?? null;
}

export function exerciseImageUrl(imagePath: string) {
  return `${EXERCISE_SOURCE.imageBase}${imagePath}`;
}

export function youtubeSearchUrl(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise form`)}`;
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}

export type ExerciseQuery = {
  q?: string;
  muscle?: string;
  equipment?: string;
  limit?: number;
  /** `rating` needs `muscle` and lists the best stimulus first. `name` is alphabetical. */
  sort?: string;
};

export function ratingFor(exercise: CatalogExercise, muscle: string) {
  return exercise.ratings[muscle] ?? null;
}

export function searchExercises(query: ExerciseQuery) {
  const muscle = query.muscle && isMuscleId(query.muscle) ? query.muscle : undefined;
  if (query.muscle && !muscle) {
    throw new HttpError(`Unknown muscle. Use ${MUSCLE_IDS.join(", ")}`, 400);
  }
  if (query.equipment && !isEquipment(query.equipment)) {
    throw new HttpError(`Unknown equipment. Use ${EQUIPMENT.join(", ")}`, 400);
  }
  if (query.sort && query.sort !== "rating" && query.sort !== "name") {
    throw new HttpError("sort must be rating or name", 400);
  }
  if (query.sort === "rating" && !muscle) {
    throw new HttpError("sort=rating needs a muscle", 400);
  }
  const needle = query.q ? normalizeExerciseName(query.q) : "";
  let rows = EXERCISES;
  if (query.equipment) rows = rows.filter((exercise) => exercise.equipment === query.equipment);
  if (muscle) {
    rows = rows.filter((exercise) => exercise.primary.includes(muscle) || exercise.secondary.includes(muscle));
  }
  if (needle) {
    rows = rows.filter((exercise) => {
      if (normalizeExerciseName(exercise.name).includes(needle)) return true;
      return exercise.aliases.some((alias) => normalizeExerciseName(alias).includes(needle));
    });
  }
  const sort = query.sort ?? (muscle ? "rating" : "name");
  const ranked = [...rows].sort((a, b) => {
    if (sort === "rating" && muscle) {
      const diff = (b.ratings[muscle]?.score ?? 0) - (a.ratings[muscle]?.score ?? 0);
      if (diff !== 0) return diff;
      const aPrimary = a.primary.includes(muscle) ? 0 : 1;
      const bPrimary = b.primary.includes(muscle) ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    }
    return a.name.localeCompare(b.name);
  });
  const limit = query.limit ?? ranked.length;
  return ranked.slice(0, limit);
}

export function listExercise(exercise: CatalogExercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    level: exercise.level,
    mechanic: exercise.mechanic,
    primary: exercise.primary,
    secondary: exercise.secondary,
    ratings: exercise.ratings,
  };
}

export function detailExercise(exercise: CatalogExercise) {
  return {
    ...listExercise(exercise),
    category: exercise.category,
    steps: exercise.steps,
    mistakes: exercise.mistakes,
    images: exercise.images.map(exerciseImageUrl),
    youtube: youtubeSearchUrl(exercise.name),
    source: {
      name: EXERCISE_SOURCE.name,
      author: EXERCISE_SOURCE.author,
      license: EXERCISE_SOURCE.license,
      url: EXERCISE_SOURCE.url,
    },
  };
}

export function combineMuscles(groups: Array<{ primary: readonly string[]; secondary: readonly string[] }>) {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const group of groups) {
    for (const id of group.primary) primary.add(id);
    for (const id of group.secondary) secondary.add(id);
  }
  for (const id of primary) secondary.delete(id);
  return {
    primary: MUSCLE_IDS.filter((id) => primary.has(id)),
    secondary: MUSCLE_IDS.filter((id) => secondary.has(id)),
  };
}
