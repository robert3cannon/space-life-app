import { MUSCLE_IDS, type MuscleId } from "./muscles";

/** Weighted sets that fill the brightest bucket. One set stays well below this. */
export const HEAT_TARGET = 10;

export type HeatBucket = 0 | 1 | 2 | 3 | 4;

export const HEAT_LEGEND: { bucket: HeatBucket; label: string }[] = [
  { bucket: 0, label: "None" },
  { bucket: 1, label: "Light" },
  { bucket: 2, label: "Moderate" },
  { bucket: 3, label: "High" },
  { bucket: 4, label: "Max" },
];

export type HeatSession = {
  id: string;
  title: string;
  sets: number;
  volume: number;
};

export type MuscleHeat = {
  volume: number;
  sets: number;
  bucket: HeatBucket;
  sessions: HeatSession[];
};

type HeatExercise = {
  sets: Array<{ completed?: boolean }>;
  primary: readonly string[];
  secondary: readonly string[];
  ratings?: Record<string, { score: number } | number>;
};

export type HeatWorkout = {
  id: string;
  title: string;
  status: string;
  exercises: HeatExercise[];
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function scoreOf(ratings: HeatExercise["ratings"], muscle: string) {
  const rating = ratings?.[muscle];
  if (typeof rating === "number") return rating;
  if (rating && typeof rating.score === "number") return rating.score;
  return 3;
}

/** 0 is untrained. 10 or more weighted sets is the top glow. */
export function heatBucket(volume: number): HeatBucket {
  if (volume <= 0) return 0;
  if (volume < 3) return 1;
  if (volume < 6) return 2;
  if (volume < HEAT_TARGET) return 3;
  return 4;
}

/**
 * Weekly volume for each muscle. A completed set adds 1.0 on a primary muscle
 * and 0.5 on a secondary one, times that exercise's 1–5 rating divided by 5.
 */
export function weeklyMuscleHeat(workouts: HeatWorkout[]): Record<MuscleId, MuscleHeat> {
  const volume = new Map<string, number>();
  const sets = new Map<string, number>();
  const sessions = new Map<string, Map<string, { title: string; sets: number; volume: number }>>();

  for (const workout of workouts) {
    if (workout.status !== "done") continue;
    for (const exercise of workout.exercises) {
      const completed = exercise.sets.filter((set) => set.completed === true).length;
      if (!completed) continue;
      const primary = exercise.primary.filter((id, index) => exercise.primary.indexOf(id) === index);
      const secondary = exercise.secondary.filter((id) => !primary.includes(id));
      const touches = [
        ...primary.map((id) => ({ id, role: 1 })),
        ...secondary.map((id) => ({ id, role: 0.5 })),
      ];
      for (const touch of touches) {
        const credit = round1(completed * touch.role * (scoreOf(exercise.ratings, touch.id) / 5));
        volume.set(touch.id, round1((volume.get(touch.id) ?? 0) + credit));
        sets.set(touch.id, (sets.get(touch.id) ?? 0) + completed);
        const bySession = sessions.get(touch.id) ?? new Map();
        const current = bySession.get(workout.id) ?? { title: workout.title, sets: 0, volume: 0 };
        current.sets += completed;
        current.volume = round1(current.volume + credit);
        bySession.set(workout.id, current);
        sessions.set(touch.id, bySession);
      }
    }
  }

  const heat = {} as Record<MuscleId, MuscleHeat>;
  for (const id of MUSCLE_IDS) {
    const amount = round1(volume.get(id) ?? 0);
    const logged = [...(sessions.get(id)?.entries() ?? [])]
      .map(([sessionId, row]) => ({ id: sessionId, title: row.title, sets: row.sets, volume: row.volume }))
      .filter((row) => row.volume > 0)
      .sort((a, b) => b.volume - a.volume || a.title.localeCompare(b.title));
    heat[id] = {
      volume: amount,
      sets: sets.get(id) ?? 0,
      bucket: heatBucket(amount),
      sessions: logged,
    };
  }
  return heat;
}
