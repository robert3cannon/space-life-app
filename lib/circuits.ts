import { HttpError } from "./errors";
import {
  BOARD_ZONES,
  boardNote,
  dumbbellNote,
  type BoardZoneId,
  type EquipmentProfile,
  type GearId,
  isGearId,
} from "./equipment";
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
  /** Seconds to budget per rep. Dumbbell work uses 4 for a 2-second lower. */
  repSeconds?: number;
  /** Show the push-up board color when that gear is owned. */
  board?: BoardZoneId;
  /** Add the dumbbell weight and tempo note when dumbbells are owned. */
  load?: "dumbbell";
  note?: string;
};

export type Circuit = {
  id: string;
  name: string;
  summary: string;
  /** Gear that must be owned for the circuit to appear. */
  gear: GearId[];
  primary: MuscleId[];
  secondary: MuscleId[];
  stations: StationSpec[];
};

const slow = { load: "dumbbell" as const, repSeconds: 4 };

export const CIRCUITS: Circuit[] = [
  {
    id: "lower-abs",
    name: "Lower Abs",
    summary: "Floor leg raises and reverse crunches. No equipment.",
    gear: ["bodyweight"],
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
    summary: "Sit-ups, a crunch variation, and a plank for the top of the core. Hold a dumbbell on the sit-up when you want it heavier.",
    gear: ["bodyweight"],
    primary: ["upper_abs"],
    secondary: ["lower_abs"],
    stations: [
      { libraryId: "3_4_Sit-Up", reps: 12, load: "dumbbell" },
      { libraryId: "Cocoons", reps: 10 },
      { libraryId: "Air_Bike", seconds: 30 },
      { libraryId: "Bottoms_Up", reps: 10 },
      { libraryId: "Plank", seconds: 30 },
    ],
  },
  {
    id: "full-abs",
    name: "Full Abs",
    summary: "A full core circuit: dead bug, plank, bikes, and a sit-up you can load with one dumbbell.",
    gear: ["bodyweight"],
    primary: ["upper_abs", "lower_abs", "obliques"],
    secondary: ["hip_flexors"],
    stations: [
      { libraryId: "Dead_Bug", seconds: 30 },
      { libraryId: "Plank", seconds: 30 },
      { libraryId: "Air_Bike", seconds: 30 },
      { libraryId: "Reverse_Crunch", reps: 12 },
      { libraryId: "Oblique_Crunches", reps: 12 },
      { libraryId: "3_4_Sit-Up", reps: 12, load: "dumbbell", note: "Hold one dumbbell at your chest." },
    ],
  },
  {
    id: "obliques",
    name: "Obliques",
    summary: "Side crunches and bikes for the waist. All on the floor.",
    gear: ["bodyweight"],
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
    summary: "15 lb curls and chair dips. Lower the bells for 2 seconds.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["biceps", "triceps"],
    secondary: ["forearms"],
    stations: [
      { libraryId: "Dumbbell_Bicep_Curl", reps: 15, ...slow },
      { libraryId: "Bench_Dips", reps: 12 },
      { libraryId: "Hammer_Curls", reps: 12, ...slow },
      { libraryId: "Dips_-_Triceps_Version", reps: 10 },
      { libraryId: "Alternate_Hammer_Curl", reps: 12, ...slow },
    ],
  },
  {
    id: "dumbbell-arms",
    name: "Dumbbell Arms",
    summary: "Curls and a close press with the 15 lb pair. Higher reps, slow lower.",
    gear: ["dumbbells"],
    primary: ["biceps", "triceps"],
    secondary: ["forearms"],
    stations: [
      { libraryId: "Dumbbell_Bicep_Curl", reps: 15, ...slow },
      { libraryId: "Hammer_Curls", reps: 12, ...slow },
      { libraryId: "Alternate_Hammer_Curl", reps: 12, ...slow },
      { libraryId: "Close-Grip_Dumbbell_Press", reps: 12, ...slow, note: "Floor press is fine." },
    ],
  },
  {
    id: "dumbbell-shoulders",
    name: "Dumbbell Shoulders",
    summary: "Raises and rear flies with the 15 lb pair. Stop a rep early if the shoulder shrugs.",
    gear: ["dumbbells"],
    primary: ["front_delts", "side_delts", "rear_delts"],
    secondary: ["traps"],
    stations: [
      { libraryId: "Side_Lateral_Raise", reps: 10, ...slow },
      { libraryId: "Front_Dumbbell_Raise", reps: 10, ...slow },
      { libraryId: "Reverse_Flyes", reps: 12, ...slow },
      { libraryId: "Dumbbell_Raise", reps: 10, ...slow },
    ],
  },
  {
    id: "chest",
    name: "Chest",
    summary: "Wide-hand push-up on the blue chest pegs, plus incline and decline. Then a 15 lb press and fly.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["mid_chest", "upper_chest", "lower_chest"],
    secondary: ["front_delts", "triceps"],
    stations: [
      { libraryId: "Pushups", reps: 12, board: "chest" },
      { libraryId: "Incline_Push-Up", reps: 10 },
      { libraryId: "Decline_Push-Up", reps: 8 },
      { libraryId: "Isometric_Wipers", reps: 8 },
      { libraryId: "Dumbbell_Bench_Press", reps: 12, ...slow, note: "Floor press works." },
      { libraryId: "Dumbbell_Flyes", reps: 12, ...slow },
    ],
  },
  {
    id: "upper-chest",
    name: "Upper Chest",
    summary: "Incline push-ups, then a 15 lb incline press and fly.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["upper_chest"],
    secondary: ["mid_chest", "front_delts"],
    stations: [
      { libraryId: "Incline_Push-Up", reps: 12 },
      { libraryId: "Incline_Push-Up_Medium", reps: 10 },
      { libraryId: "Incline_Dumbbell_Press", reps: 12, ...slow },
      { libraryId: "Incline_Dumbbell_Flyes", reps: 12, ...slow },
    ],
  },
  {
    id: "lower-chest",
    name: "Lower Chest",
    summary: "Feet-up push-ups and 15 lb flies for the lower chest.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["lower_chest"],
    secondary: ["mid_chest", "triceps"],
    stations: [
      { libraryId: "Decline_Push-Up", reps: 12 },
      { libraryId: "Decline_Dumbbell_Flyes", reps: 12, ...slow },
      { libraryId: "Dumbbell_Flyes", reps: 12, ...slow },
      { libraryId: "Isometric_Chest_Squeezes", seconds: 20 },
    ],
  },
  {
    id: "pushup-board",
    name: "Push-up Board",
    summary: "One pass through the board: blue chest, red shoulders, yellow back, green triceps. Rounds repeat the colors.",
    gear: ["bodyweight", "pushup_board"],
    primary: ["mid_chest", "front_delts", "triceps", "lats"],
    secondary: ["side_delts", "mid_back", "upper_chest"],
    stations: [
      { libraryId: "Pushups", reps: 12, board: "chest" },
      { libraryId: "Pushups", reps: 10, board: "shoulders" },
      { libraryId: "Pushups", reps: 10, board: "back" },
      { libraryId: "Pushups", reps: 12, board: "triceps" },
    ],
  },
  {
    id: "chest-shoulders",
    name: "Chest & Shoulders",
    summary: "Push-ups from a few angles, the blue chest pegs, and 15 lb raises.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["mid_chest", "upper_chest", "front_delts", "side_delts"],
    secondary: ["lower_chest", "triceps"],
    stations: [
      { libraryId: "Incline_Push-Up", reps: 10 },
      { libraryId: "Pushups", reps: 10, board: "chest" },
      { libraryId: "Decline_Push-Up", reps: 8 },
      { libraryId: "Isometric_Chest_Squeezes", seconds: 20 },
      { libraryId: "Side_Lateral_Raise", reps: 10, ...slow },
      { libraryId: "Kneeling_Arm_Drill", seconds: 20 },
    ],
  },
  {
    id: "back",
    name: "Back",
    summary: "A table row, a 15 lb dumbbell row, and back extensions. Chin-ups if you have a bar.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["mid_back", "lower_back", "lats"],
    secondary: ["rear_delts", "traps", "biceps"],
    stations: [
      { libraryId: "Inverted_Row", reps: 8 },
      { libraryId: "One-Arm_Dumbbell_Row", reps: 12, ...slow },
      { libraryId: "Hyperextensions_Back_Extensions", reps: 12 },
      { libraryId: "Reverse_Flyes", reps: 12, ...slow },
      { libraryId: "Chin-Up", reps: 4 },
    ],
  },
  {
    id: "legs-glutes",
    name: "Legs & Glutes",
    summary: "Squats, lunges, and bridges. Bodyweight, at home.",
    gear: ["bodyweight"],
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "abductors", "calves"],
    stations: [
      { libraryId: "Bodyweight_Squat", reps: 15, load: "dumbbell", note: "Hold the bells at your sides, or go empty." },
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
    summary: "Squats, a board push-up, a row, 15 lb curls, chair dips, and a plank.",
    gear: ["bodyweight", "dumbbells"],
    primary: ["quads", "glutes", "mid_chest", "mid_back", "upper_abs", "lower_abs", "biceps", "triceps"],
    secondary: ["front_delts", "hamstrings", "lats"],
    stations: [
      { libraryId: "Bodyweight_Squat", reps: 15 },
      { libraryId: "Pushups", reps: 10, board: "chest" },
      { libraryId: "Inverted_Row", reps: 8 },
      { libraryId: "Reverse_Crunch", reps: 12 },
      { libraryId: "Bench_Dips", reps: 12 },
      { libraryId: "Dumbbell_Bicep_Curl", reps: 15, ...slow },
      { libraryId: "Butt_Lift_Bridge", reps: 12 },
      { libraryId: "Plank", seconds: 30 },
    ],
  },
  {
    id: "dumbbell-full-body",
    name: "Dumbbell Full Body",
    summary: "Press, row, raise, curl, squat, and a loaded sit-up with the 15 lb pair.",
    gear: ["dumbbells", "bodyweight"],
    primary: ["mid_chest", "mid_back", "side_delts", "biceps", "quads", "upper_abs"],
    secondary: ["front_delts", "lats", "glutes", "lower_abs", "triceps"],
    stations: [
      { libraryId: "Dumbbell_Bench_Press", reps: 12, ...slow, note: "Floor press works." },
      { libraryId: "One-Arm_Dumbbell_Row", reps: 12, ...slow },
      { libraryId: "Side_Lateral_Raise", reps: 10, ...slow },
      { libraryId: "Dumbbell_Bicep_Curl", reps: 15, ...slow },
      { libraryId: "Bodyweight_Squat", reps: 15, load: "dumbbell", note: "Bells at your sides." },
      { libraryId: "3_4_Sit-Up", reps: 12, load: "dumbbell", note: "One bell at your chest." },
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
    const perRep = station.repSeconds ?? REP_SECONDS;
    return sum + (dose.seconds ?? (dose.reps ?? 0) * perRep);
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
    if (exercise) {
      for (const id of exercise.primary) primary.add(id);
      for (const id of exercise.secondary) secondary.add(id);
    }
    if (station.board) {
      for (const id of BOARD_ZONES[station.board].muscles) primary.add(id);
    }
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
    if (!circuit.gear.length) problems.push(`${circuit.id} needs gear`);
    for (const gear of circuit.gear) {
      if (!isGearId(gear)) problems.push(`${circuit.id} has unknown gear ${gear}`);
    }
    if (!circuit.stations.length) problems.push(`${circuit.id} has no exercises`);
    if (/backpack/i.test(circuit.summary)) problems.push(`${circuit.id} still mentions a backpack`);
    if (circuit.gear.includes("pushup_board") && !circuit.stations.some((station) => station.board)) {
      problems.push(`${circuit.id} lists the push-up board but has no board station`);
    }
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
      if (exercise.equipment === "dumbbell" && !circuit.gear.includes("dumbbells")) {
        problems.push(`${circuit.id} uses ${exercise.id} without dumbbells in gear`);
      }
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

export function stationCue(station: StationSpec, equipment: EquipmentProfile) {
  const parts: string[] = [];
  if (station.board && equipment.gear.includes("pushup_board")) parts.push(boardNote(station.board));
  if (station.load === "dumbbell" && equipment.gear.includes("dumbbells")) parts.push(dumbbellNote(equipment.dumbbellLb));
  if (station.note) parts.push(station.note);
  return parts.join(" ");
}

export function circuitFits(circuit: Circuit, gear: readonly GearId[]) {
  return circuit.gear.every((id) => gear.includes(id));
}

export function circuitExercises(
  id: string,
  level: CircuitLevel,
  rounds: number,
  completed: boolean,
  equipment: EquipmentProfile,
): ExerciseInput[] {
  const circuit = requireCircuit(id);
  return circuit.stations.map((station) => {
    const exercise = getExercise(station.libraryId);
    if (!exercise) throw new HttpError("Exercise not found", 404);
    const dose = stationWork(station, level);
    const cue = stationCue(station, equipment);
    return {
      name: exercise.name,
      libraryId: exercise.id,
      notes: cue || null,
      sets: Array.from({ length: rounds }, () => ({
        reps: dose.reps,
        durationSeconds: dose.seconds,
        completed,
      })),
    };
  });
}

function stationDetail(station: StationSpec, equipment: EquipmentProfile) {
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
    note: stationCue(station, equipment),
    repSeconds: station.repSeconds ?? 3,
    work: {
      beginner: stationWork(station, "beginner"),
      intermediate: stationWork(station, "intermediate"),
    },
  };
}

/** Mean of each station's scores on the circuit's target muscles. Ratings ignore equipment. */
export function circuitTargetRating(circuit: Circuit) {
  const scores: number[] = [];
  for (const station of circuit.stations) {
    const exercise = getExercise(station.libraryId);
    if (!exercise) continue;
    const hits = circuit.primary
      .map((muscle) => exercise.ratings[muscle]?.score)
      .filter((score): score is number => typeof score === "number");
    if (hits.length) scores.push(hits.reduce((sum, score) => sum + score, 0) / hits.length);
  }
  if (!scores.length) return null;
  const average = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  return {
    average,
    muscle: circuit.primary.length === 1 ? circuit.primary[0] : null,
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
    gear: circuit.gear,
    primary: circuit.primary,
    secondary: circuit.secondary,
    musclesLabel: circuit.primary.map(muscleLabel).join(", "),
    targetRating: circuitTargetRating(circuit),
  };
}

export function circuitDetail(id: string, equipment: EquipmentProfile) {
  const circuit = requireCircuit(id);
  return {
    ...summarizeCircuit(circuit),
    restSeconds: {
      beginner: { exercise: LEVEL_PLAN.beginner.exerciseRest, round: LEVEL_PLAN.beginner.roundRest },
      intermediate: { exercise: LEVEL_PLAN.intermediate.exerciseRest, round: LEVEL_PLAN.intermediate.roundRest },
    },
    stations: circuit.stations.map((station) => stationDetail(station, equipment)),
  };
}

export function listCircuits(muscle: string | undefined, equipment: EquipmentProfile) {
  if (muscle && !isMuscleId(muscle)) {
    throw new HttpError("Unknown muscle", 400);
  }
  const selected = muscle && isMuscleId(muscle) ? muscle : undefined;
  const rows = CIRCUITS.filter((circuit) => circuitFits(circuit, equipment.gear));
  const matched = selected ? rows.filter((circuit) => circuitTrains(circuit, selected)) : rows;
  return matched.map(summarizeCircuit);
}
