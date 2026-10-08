import { HttpError } from "./errors";
import { exerciseImageUrl, getExercise } from "./exercises";
import { isMuscleId, muscleLabel, type MuscleId } from "./muscles";
import type { ExerciseInput } from "./validation";

export const CIRCUIT_LEVELS = ["beginner", "intermediate"] as const;
export type CircuitLevel = (typeof CIRCUIT_LEVELS)[number];

export const LEVEL_PLAN: Record<
  CircuitLevel,
  { rounds: number; exerciseRest: number; roundRest: number; repBonus: number; timeBonus: number }
> = {
  beginner: { rounds: 2, exerciseRest: 20, roundRest: 60, repBonus: 0, timeBonus: 0 },
  intermediate: { rounds: 3, exerciseRest: 20, roundRest: 45, repBonus: 4, timeBonus: 10 },
};

const REP_SECONDS = 3;
const ROUND_LIMIT = 5;

export type StationSpec = {
  libraryId: string;
  reps?: number;
  seconds?: number;
};

export type Circuit = {
  id: string;
  name: string;
  summary: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  stations: StationSpec[];
};

export const CIRCUITS: Circuit[] = [
  {
    id: "lower-abs",
    name: "Lower Abs",
    summary: "Floor leg raises and reverse crunches. No equipment.",
    primary: ["lower_abs"],
    secondary: ["hip_flexors", "upper_abs"],
    stations: [
      { libraryId: "Dead_Bug", seconds: 30 },
      { libraryId: "Reverse_Crunch", reps: 12 },
      { libraryId: "Flat_Bench_Lying_Leg_Raise", reps: 10 },
      { libraryId: "Decline_Reverse_Crunch", reps: 10 },
      { libraryId: "Bent-Knee_Hip_Raise", reps: 12 },
    ],
  },
  {
    id: "upper-abs",
    name: "Upper Abs",
    summary: "Sit-ups, a crunch variation, and a plank for the top of the core.",
    primary: ["upper_abs"],
    secondary: ["lower_abs"],
    stations: [
      { libraryId: "3_4_Sit-Up", reps: 12 },
      { libraryId: "Cocoons", reps: 10 },
      { libraryId: "Air_Bike", seconds: 30 },
      { libraryId: "Bottoms_Up", reps: 10 },
      { libraryId: "Plank", seconds: 30 },
    ],
  },
  {
    id: "full-abs",
    name: "Full Abs",
    summary: "A full core circuit: dead bug, plank, bikes, and crunches.",
    primary: ["upper_abs", "lower_abs", "obliques"],
    secondary: ["hip_flexors"],
    stations: [
      { libraryId: "Dead_Bug", seconds: 30 },
      { libraryId: "Plank", seconds: 30 },
      { libraryId: "Air_Bike", seconds: 30 },
      { libraryId: "Reverse_Crunch", reps: 12 },
      { libraryId: "Oblique_Crunches", reps: 12 },
      { libraryId: "3_4_Sit-Up", reps: 12 },
    ],
  },
  {
    id: "obliques",
    name: "Obliques",
    summary: "Side crunches and bikes for the waist. All on the floor.",
    primary: ["obliques"],
    secondary: ["upper_abs", "lower_abs"],
    stations: [
      { libraryId: "Oblique_Crunches", reps: 12 },
      { libraryId: "Air_Bike", seconds: 30 },
      { libraryId: "Decline_Oblique_Crunch", reps: 10 },
      { libraryId: "Cocoons", reps: 10 },
      { libraryId: "Dead_Bug", seconds: 30 },
    ],
  },
  {
    id: "arms",
    name: "Arms",
    summary: "Backpack curls and chair dips. A loaded backpack stands in for the dumbbell.",
    primary: ["biceps", "triceps"],
    secondary: ["forearms"],
    stations: [
      { libraryId: "Dumbbell_Bicep_Curl", reps: 10 },
      { libraryId: "Bench_Dips", reps: 10 },
      { libraryId: "Hammer_Curls", reps: 8 },
      { libraryId: "Dips_-_Triceps_Version", reps: 8 },
      { libraryId: "Alternate_Hammer_Curl", reps: 8 },
    ],
  },
  {
    id: "chest",
    name: "Chest",
    summary: "Wide-hand, incline, and decline push-ups, then a backpack press and fly.",
    primary: ["mid_chest", "upper_chest", "lower_chest"],
    secondary: ["front_delts", "triceps"],
    stations: [
      { libraryId: "Pushups", reps: 10 },
      { libraryId: "Incline_Push-Up", reps: 10 },
      { libraryId: "Decline_Push-Up", reps: 8 },
      { libraryId: "Isometric_Wipers", reps: 8 },
      { libraryId: "Dumbbell_Bench_Press", reps: 8 },
      { libraryId: "Dumbbell_Flyes", reps: 10 },
    ],
  },
  {
    id: "upper-chest",
    name: "Upper Chest",
    summary: "Incline push-ups and a backpack press and fly for the upper chest.",
    primary: ["upper_chest"],
    secondary: ["mid_chest", "front_delts"],
    stations: [
      { libraryId: "Incline_Push-Up", reps: 12 },
      { libraryId: "Incline_Push-Up_Medium", reps: 10 },
      { libraryId: "Incline_Dumbbell_Press", reps: 8 },
      { libraryId: "Incline_Dumbbell_Flyes", reps: 10 },
    ],
  },
  {
    id: "lower-chest",
    name: "Lower Chest",
    summary: "Feet-up push-ups and a backpack fly for the lower chest.",
    primary: ["lower_chest"],
    secondary: ["mid_chest", "triceps"],
    stations: [
      { libraryId: "Decline_Push-Up", reps: 12 },
      { libraryId: "Decline_Dumbbell_Flyes", reps: 10 },
      { libraryId: "Dumbbell_Flyes", reps: 8 },
      { libraryId: "Isometric_Chest_Squeezes", seconds: 20 },
    ],
  },
  {
    id: "chest-shoulders",
    name: "Chest & Shoulders",
    summary: "Push-ups from a few angles, plus a backpack raise for the delts.",
    primary: ["mid_chest", "upper_chest", "front_delts", "side_delts"],
    secondary: ["lower_chest", "triceps"],
    stations: [
      { libraryId: "Incline_Push-Up", reps: 10 },
      { libraryId: "Pushups", reps: 8 },
      { libraryId: "Decline_Push-Up", reps: 6 },
      { libraryId: "Isometric_Chest_Squeezes", seconds: 20 },
      { libraryId: "Side_Lateral_Raise", reps: 10 },
      { libraryId: "Kneeling_Arm_Drill", seconds: 20 },
    ],
  },
  {
    id: "back",
    name: "Back",
    summary: "A table row, a backpack row, and back extensions. Chin-ups if you have a bar.",
    primary: ["mid_back", "lower_back", "lats"],
    secondary: ["rear_delts", "traps", "biceps"],
    stations: [
      { libraryId: "Inverted_Row", reps: 8 },
      { libraryId: "One-Arm_Dumbbell_Row", reps: 8 },
      { libraryId: "Hyperextensions_Back_Extensions", reps: 10 },
      { libraryId: "Reverse_Flyes", reps: 10 },
      { libraryId: "Chin-Up", reps: 4 },
    ],
  },
  {
    id: "legs-glutes",
    name: "Legs & Glutes",
    summary: "Squats, lunges, and bridges. Bodyweight, at home.",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "abductors", "calves"],
    stations: [
      { libraryId: "Bodyweight_Squat", reps: 12 },
      { libraryId: "Bodyweight_Walking_Lunge", reps: 10 },
      { libraryId: "Butt_Lift_Bridge", reps: 12 },
      { libraryId: "Glute_Kickback", reps: 10 },
      { libraryId: "Step-up_with_Knee_Raise", reps: 8 },
      { libraryId: "Side_Leg_Raises", reps: 12 },
    ],
  },
  {
    id: "full-body",
    name: "Full Body",
    summary: "The home session: squats, push-ups, a row, curls, chair dips, and a plank.",
    primary: ["quads", "glutes", "mid_chest", "mid_back", "upper_abs", "lower_abs", "biceps", "triceps"],
    secondary: ["front_delts", "hamstrings", "lats"],
    stations: [
      { libraryId: "Bodyweight_Squat", reps: 12 },
      { libraryId: "Pushups", reps: 8 },
      { libraryId: "Inverted_Row", reps: 8 },
      { libraryId: "Reverse_Crunch", reps: 12 },
      { libraryId: "Bench_Dips", reps: 10 },
      { libraryId: "Dumbbell_Bicep_Curl", reps: 10 },
      { libraryId: "Butt_Lift_Bridge", reps: 12 },
      { libraryId: "Plank", seconds: 30 },
    ],
  },
];

const byId = new Map(CIRCUITS.map((circuit) => [circuit.id, circuit]));

export function isCircuitLevel(value: string): value is CircuitLevel {
  return (CIRCUIT_LEVELS as readonly string[]).includes(value);
}

export function getCircuit(id: string) {
  return byId.get(id) ?? null;
}

export function stationWork(station: StationSpec, level: CircuitLevel) {
  const plan = LEVEL_PLAN[level];
  if (station.seconds != null) return { reps: null, seconds: station.seconds + plan.timeBonus };
  return { reps: (station.reps ?? 10) + plan.repBonus, seconds: null };
}

export function workLabel(work: { reps: number | null; seconds: number | null }) {
  if (work.seconds != null) return `${work.seconds}s`;
  if (work.reps != null) return `${work.reps} reps`;
  return "";
}

export function circuitDurationSeconds(circuit: Circuit, level: CircuitLevel, rounds = LEVEL_PLAN[level].rounds) {
  const plan = LEVEL_PLAN[level];
  const work = circuit.stations.reduce((sum, station) => {
    const dose = stationWork(station, level);
    return sum + (dose.seconds ?? (dose.reps ?? 0) * REP_SECONDS);
  }, 0);
  const exerciseRests = Math.max(0, circuit.stations.length - 1) * plan.exerciseRest;
  return rounds * (work + exerciseRests) + Math.max(0, rounds - 1) * plan.roundRest;
}

export function durationMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

export function levelLabel(level: CircuitLevel) {
  return level === "beginner" ? "Beginner" : "Intermediate";
}

function trainedMuscles(circuit: Circuit) {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const station of circuit.stations) {
    const exercise = getExercise(station.libraryId);
    if (!exercise) continue;
    for (const id of exercise.primary) primary.add(id);
    for (const id of exercise.secondary) secondary.add(id);
  }
  return { primary, secondary };
}

export function circuitTrains(circuit: Circuit, muscle: MuscleId) {
  return circuit.primary.includes(muscle) || circuit.secondary.includes(muscle);
}

export function assertCircuitCatalog() {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const circuit of CIRCUITS) {
    if (ids.has(circuit.id)) problems.push(`duplicate circuit ${circuit.id}`);
    ids.add(circuit.id);
    if (!circuit.stations.length) problems.push(`${circuit.id} has no exercises`);
    const trained = trainedMuscles(circuit);
    for (const muscle of [...circuit.primary, ...circuit.secondary]) {
      if (!isMuscleId(muscle)) problems.push(`${circuit.id} has unknown muscle ${muscle}`);
      else if (!trained.primary.has(muscle) && !trained.secondary.has(muscle)) {
        problems.push(`${circuit.id} targets ${muscle} but no exercise trains it`);
      }
    }
    for (const station of circuit.stations) {
      const exercise = getExercise(station.libraryId);
      if (!exercise) {
        problems.push(`${circuit.id} references unknown exercise ${station.libraryId}`);
        continue;
      }
      const hasReps = station.reps != null;
      const hasTime = station.seconds != null;
      if (hasReps === hasTime) problems.push(`${circuit.id} ${station.libraryId} needs reps or seconds`);
      for (const muscle of [...exercise.primary, ...exercise.secondary]) {
        if (!isMuscleId(muscle)) problems.push(`${exercise.id} has unknown muscle ${muscle}`);
      }
    }
  }
  return problems;
}

function requireCircuit(id: string) {
  const circuit = getCircuit(id);
  if (!circuit) throw new HttpError("Circuit not found", 404);
  return circuit;
}

export function resolvePlan(id: string, level?: string, rounds?: number) {
  const circuit = requireCircuit(id);
  const difficulty: CircuitLevel = level && isCircuitLevel(level) ? level : "beginner";
  if (level && !isCircuitLevel(level)) throw new HttpError("difficulty must be beginner or intermediate", 400);
  const chosen = rounds ?? LEVEL_PLAN[difficulty].rounds;
  if (!Number.isInteger(chosen) || chosen < 1 || chosen > ROUND_LIMIT) {
    throw new HttpError(`rounds must be 1–${ROUND_LIMIT}`, 400);
  }
  return {
    circuit,
    difficulty,
    rounds: chosen,
    notes: `Guided circuit · ${levelLabel(difficulty)} · ${chosen} rounds`,
  };
}

export function circuitExercises(id: string, level: CircuitLevel, rounds: number, completed: boolean): ExerciseInput[] {
  const circuit = requireCircuit(id);
  return circuit.stations.map((station) => {
    const exercise = getExercise(station.libraryId);
    if (!exercise) throw new HttpError("Exercise not found", 404);
    const dose = stationWork(station, level);
    return {
      name: exercise.name,
      libraryId: exercise.id,
      sets: Array.from({ length: rounds }, () => ({
        reps: dose.reps,
        durationSeconds: dose.seconds,
        completed,
      })),
    };
  });
}

function stationDetail(station: StationSpec) {
  const exercise = getExercise(station.libraryId);
  if (!exercise) throw new HttpError("Exercise not found", 404);
  return {
    libraryId: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    primary: exercise.primary,
    secondary: exercise.secondary,
    steps: exercise.steps,
    images: exercise.images.map(exerciseImageUrl),
    work: {
      beginner: stationWork(station, "beginner"),
      intermediate: stationWork(station, "intermediate"),
    },
  };
}

export function summarizeCircuit(circuit: Circuit) {
  const beginner = durationMinutes(circuitDurationSeconds(circuit, "beginner"));
  const intermediate = durationMinutes(circuitDurationSeconds(circuit, "intermediate"));
  return {
    id: circuit.id,
    name: circuit.name,
    summary: circuit.summary,
    exerciseCount: circuit.stations.length,
    levels: [...CIRCUIT_LEVELS],
    rounds: { beginner: LEVEL_PLAN.beginner.rounds, intermediate: LEVEL_PLAN.intermediate.rounds },
    durationMinutes: { beginner, intermediate },
    primary: circuit.primary,
    secondary: circuit.secondary,
    musclesLabel: circuit.primary.map(muscleLabel).join(", "),
  };
}

export function circuitDetail(id: string) {
  const circuit = requireCircuit(id);
  return {
    ...summarizeCircuit(circuit),
    restSeconds: {
      beginner: { exercise: LEVEL_PLAN.beginner.exerciseRest, round: LEVEL_PLAN.beginner.roundRest },
      intermediate: { exercise: LEVEL_PLAN.intermediate.exerciseRest, round: LEVEL_PLAN.intermediate.roundRest },
    },
    stations: circuit.stations.map(stationDetail),
  };
}

export function listCircuits(muscle?: string) {
  if (muscle && !isMuscleId(muscle)) {
    throw new HttpError("Unknown muscle", 400);
  }
  const selected = muscle && isMuscleId(muscle) ? muscle : undefined;
  const rows = selected ? CIRCUITS.filter((circuit) => circuitTrains(circuit, selected)) : CIRCUITS;
  return rows.map(summarizeCircuit);
}
