import { DEFAULT_EQUIPMENT, type EquipmentProfile } from "./equipment";

const TIMED_NAME = /plank|hold|dead bug|wall sit|hollow|isometric/i;

export type PlannedExercise = {
  libraryId: string | null;
  name: string;
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  weight: number | null;
};

export type SessionPlan = {
  title: string;
  restSeconds: number;
  exercises: PlannedExercise[];
};

export type StraightStep =
  | { kind: "work"; exercise: number; set: number }
  | {
      kind: "rest";
      seconds: number;
      upcomingExercise: number;
      upcomingSet: number;
      loggedExercise: number;
      loggedSet: number;
    };

export const SESSION_PLAN_KEY = "orbit.sessionPlan";

export function isTimedMove(name: string, mechanic?: string | null) {
  if (mechanic && /isometric|static/i.test(mechanic)) return true;
  return TIMED_NAME.test(name);
}

export function defaultPrescription(
  exercise: { name: string; equipment?: string | null; mechanic?: string | null },
  gear: EquipmentProfile = DEFAULT_EQUIPMENT,
) {
  const timed = isTimedMove(exercise.name, exercise.mechanic);
  const dumbbell = exercise.equipment === "dumbbell" && gear.gear.includes("dumbbells");
  return {
    sets: 3,
    reps: timed ? null : 8,
    durationSeconds: timed ? 30 : null,
    weight: dumbbell ? gear.dumbbellLb : null,
    weightUnit: "lb" as const,
    restSeconds: timed ? 45 : 60,
  };
}

/** Every set of an exercise, then the next exercise. Rest sits between sets, not as a circuit. */
export function buildStraightSteps(exercises: Array<{ sets: number }>, restSeconds: number): StraightStep[] {
  const steps: StraightStep[] = [];
  for (let exercise = 0; exercise < exercises.length; exercise += 1) {
    const count = exercises[exercise]?.sets ?? 0;
    for (let set = 0; set < count; set += 1) {
      steps.push({ kind: "work", exercise, set });
      const lastExercise = exercise === exercises.length - 1;
      const lastSet = set === count - 1;
      if (lastExercise && lastSet) continue;
      if (restSeconds <= 0) continue;
      const nextSet = lastSet ? 0 : set + 1;
      const nextExercise = lastSet ? exercise + 1 : exercise;
      steps.push({
        kind: "rest",
        seconds: restSeconds,
        upcomingExercise: nextExercise,
        upcomingSet: nextSet,
        loggedExercise: exercise,
        loggedSet: set,
      });
    }
  }
  return steps;
}

export function saveSessionPlan(plan: SessionPlan) {
  sessionStorage.setItem(SESSION_PLAN_KEY, JSON.stringify(plan));
}

export function readSessionPlan(): SessionPlan | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_PLAN_KEY);
  if (!raw) return null;
  try {
    const plan = JSON.parse(raw) as SessionPlan;
    if (!plan || !Array.isArray(plan.exercises) || !plan.exercises.length) return null;
    if (typeof plan.title !== "string" || !plan.title.trim()) return null;
    return plan;
  } catch {
    return null;
  }
}
