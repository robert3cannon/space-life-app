/**
 * Build data/exercises.json from the Unlicense free-exercise-db snapshot.
 * Source: https://github.com/yuhonas/free-exercise-db
 * Commit: f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5
 *
 * Usage: EXERCISE_SOURCE=/tmp/exercises.json npx tsx scripts/build-exercises.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Raw = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  images: string[];
};

type Equipment = "bodyweight" | "dumbbell" | "barbell" | "machine" | "cable" | "other";

const SOURCE_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";

const ALIASES: Record<string, string[]> = {
  "Barbell_Bench_Press_-_Medium_Grip": ["bench press"],
  Standing_Military_Press: ["overhead press", "military press"],
  Incline_Dumbbell_Press: ["incline dumbbell press"],
  Plank: ["plank"],
  "Wide-Grip_Lat_Pulldown": ["lat pulldown", "lat pull down"],
  Seated_Cable_Rows: ["seated row", "seated cable row"],
  Face_Pull: ["face pull"],
  Dumbbell_Bicep_Curl: ["dumbbell curl", "dumbbell bicep curl"],
  Barbell_Squat: ["back squat", "barbell squat"],
  Romanian_Deadlift: ["romanian deadlift", "rdl"],
  Barbell_Walking_Lunge: ["walking lunge"],
  Standing_Calf_Raises: ["calf raise", "standing calf raise"],
};

const EXTRA_IDS = [
  "Pushups",
  "Pullups",
  "Dumbbell_Bench_Press",
  "Leg_Press",
  "Hanging_Leg_Raise",
  "Cable_Rear_Delt_Fly",
  "Decline_Barbell_Bench_Press",
  "Reverse_Crunch",
  "Oblique_Crunches",
  "Side_Lateral_Raise",
  "Front_Dumbbell_Raise",
  "Barbell_Deadlift",
  "Lying_Leg_Curls",
  "Leg_Extensions",
  "Dumbbell_Flyes",
  "Triceps_Pushdown",
  "Hammer_Curls",
  "Barbell_Shrug",
  "Hyperextensions_Back_Extensions",
  "Butt_Lift_Bridge",
  "Cable_Crossover",
  "Dips_-_Chest_Version",
  "Dips_-_Triceps_Version",
  "Hip_Flexion_with_Band",
  "Thigh_Adductor",
  "Thigh_Abductor",
  "Seated_Calf_Raise",
  "One-Arm_Dumbbell_Row",
  "Bent_Over_Barbell_Row",
  "Cable_Wrist_Curl",
  "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench",
  "Dumbbell_Rear_Delt_Row",
  "Standing_Dumbbell_Upright_Row",
  "Cable_Incline_Pushdown",
  "Side_Leg_Raises",
  "Cable_Hip_Adduction",
  "Band_Hip_Adductions",
];

function clean(text: string) {
  return text.replace(/\s+/g, " ").replace(/([.!?])([A-Z])/g, "$1 $2").trim();
}

function bucket(equipment: string | null, name: string): Equipment {
  const value = (equipment || "").toLowerCase();
  if (value === "dumbbell") return "dumbbell";
  if (value === "barbell" || value === "e-z curl bar") return "barbell";
  if (value === "machine") return "machine";
  if (value === "cable") return "cable";
  if (value === "body only" || value === "") return "bodyweight";
  if (/push-up|pull-up|pullup|plank|squat|lunge|crunch/.test(name.toLowerCase()) && !value) return "bodyweight";
  return "other";
}

function absSplit(name: string): { primary: string[]; secondary: string[] } {
  if (/oblique|wood\s?chop|side bend|russian twist|pallof|windshield/.test(name)) {
    return { primary: ["obliques"], secondary: ["upper_abs"] };
  }
  if (/leg raise|reverse crunch|toes to bar|knee raise|flutter/.test(name)) {
    return { primary: ["lower_abs", "hip_flexors"], secondary: ["upper_abs"] };
  }
  if (/crunch|sit-up|sit up|situp/.test(name)) {
    return { primary: ["upper_abs"], secondary: ["lower_abs"] };
  }
  if (/plank|rollout|ab wheel|dead bug|hollow/.test(name)) {
    return { primary: ["upper_abs", "lower_abs"], secondary: ["obliques"] };
  }
  return { primary: ["upper_abs", "lower_abs"], secondary: ["obliques"] };
}

function shoulderSplit(name: string): { primary: string[]; secondary: string[] } {
  if (/face pull|rear delt|reverse fly|bent over fly|rear lateral/.test(name)) {
    return { primary: ["rear_delts"], secondary: ["side_delts", "traps"] };
  }
  if (/lateral raise|side raise|upright row/.test(name)) {
    return { primary: ["side_delts"], secondary: ["front_delts", "traps"] };
  }
  if (/front raise/.test(name)) {
    return { primary: ["front_delts"], secondary: ["side_delts"] };
  }
  if (/overhead|military|shoulder press|push press|arnold/.test(name)) {
    return { primary: ["front_delts", "side_delts"], secondary: ["traps"] };
  }
  return { primary: ["front_delts", "side_delts"], secondary: ["traps"] };
}

function chestSplit(name: string): { primary: string[]; secondary: string[] } {
  if (/incline/.test(name)) return { primary: ["upper_chest"], secondary: ["mid_chest"] };
  if (/decline|dip/.test(name)) return { primary: ["lower_chest"], secondary: ["mid_chest"] };
  return { primary: ["mid_chest"], secondary: ["upper_chest", "lower_chest"] };
}

const COARSE: Record<string, string> = {
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearms",
  lats: "lats",
  traps: "traps",
  "middle back": "mid_back",
  "lower back": "lower_back",
  glutes: "glutes",
  quadriceps: "quads",
  hamstrings: "hamstrings",
  calves: "calves",
  adductors: "adductors",
  abductors: "abductors",
  neck: "traps",
};

function refine(name: string, primaryMuscles: string[], secondaryMuscles: string[]) {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  const lower = name.toLowerCase();

  const place = (muscle: string, dest: Set<string>, isPrimary: boolean) => {
    if (muscle === "abdominals") {
      const split = absSplit(lower);
      if (isPrimary) {
        for (const id of split.primary) dest.add(id);
        for (const id of split.secondary) secondary.add(id);
      } else {
        for (const id of split.primary) dest.add(id);
      }
      return;
    }
    if (muscle === "shoulders") {
      const split = shoulderSplit(lower);
      const ids = isPrimary ? split.primary : ["front_delts"];
      for (const id of ids) dest.add(id);
      if (isPrimary) for (const id of split.secondary) secondary.add(id);
      return;
    }
    if (muscle === "chest") {
      const split = chestSplit(lower);
      for (const id of isPrimary ? split.primary : split.secondary) dest.add(id);
      if (isPrimary) for (const id of split.secondary) secondary.add(id);
      return;
    }
    const mapped = COARSE[muscle];
    if (mapped) dest.add(mapped);
  };

  for (const muscle of primaryMuscles) place(muscle, primary, true);
  for (const muscle of secondaryMuscles) place(muscle, secondary, false);
  if (/hip flexor|hip flexion/.test(lower)) {
    primary.add("hip_flexors");
    primary.delete("quads");
    secondary.add("quads");
  }
  if (/side leg raise|thigh abductor|monster walk|hip abduction/.test(lower)) {
    primary.add("abductors");
    primary.delete("adductors");
  }
  if (/hip adduction|thigh adductor/.test(lower)) {
    primary.add("adductors");
    primary.delete("quads");
  }
  for (const id of primary) secondary.delete(id);
  return { primary: [...primary], secondary: [...secondary] };
}

function mistakes(name: string, primary: string[]) {
  const lower = name.toLowerCase();
  const out: string[] = [];
  if (/squat/.test(lower)) out.push("Letting the knees cave in as you drive up.");
  if (/deadlift|romanian|good morning/.test(lower)) out.push("Rounding the lower back to reach the bar.");
  if (/bench|press|push-up|pushup|dip/.test(lower)) out.push("Flaring the elbows and bouncing through the bottom.");
  if (/curl/.test(lower)) out.push("Swinging the torso to start the rep.");
  if (/row|pulldown|pull-up|pullup|chin/.test(lower)) out.push("Shrugging and yanking with momentum instead of the back.");
  if (/lunge|split squat/.test(lower)) out.push("Collapsing the torso and letting the front knee slam inward.");
  if (/plank|dead bug|hollow/.test(lower)) out.push("Letting the hips sag or pike up.");
  if (primary.some((id) => id.endsWith("abs") || id === "obliques")) {
    out.push("Yanking the neck or holding the breath through the rep.");
  }
  if (out.length < 2) out.push("Rushing the lowering phase.");
  if (out.length < 3) out.push("Cutting the range short at the top or the bottom.");
  return [...new Set(out)].slice(0, 3);
}

function score(item: { level: string | null; mechanic: string | null; name: string; equipment: Equipment; steps: string[] }) {
  let value = 0;
  if (item.level === "beginner") value += 3;
  if (item.level === "intermediate") value += 2;
  if (item.mechanic === "compound") value += 2;
  if (item.steps.length >= 3) value += 1;
  if (item.name.length < 28) value += 2;
  else if (item.name.length < 42) value += 1;
  if (item.equipment !== "other") value += 2;
  return value;
}

function main() {
  const sourcePath = process.env.EXERCISE_SOURCE || "/tmp/exercises.json";
  const raw = JSON.parse(readFileSync(sourcePath, "utf8")) as Raw[];
  const prepared = raw
    .filter((item) => (item.images || []).length >= 2)
    .filter((item) => item.category !== "stretching" || item.id === "Side_Leg_Raises")
    .filter((item) => !/stretch|foam roll/i.test(item.name))
    .filter((item) => (item.equipment || "").toLowerCase() !== "foam roll")
    .map((item) => {
      const muscles = refine(item.name, item.primaryMuscles || [], item.secondaryMuscles || []);
      const steps = (item.instructions || []).map(clean).filter(Boolean);
      const equipment = bucket(item.equipment, item.name);
      return {
        id: item.id,
        name: item.name,
        aliases: ALIASES[item.id] ?? [],
        equipment,
        level: item.level || "intermediate",
        mechanic: item.mechanic || "compound",
        category: item.category || "strength",
        primary: muscles.primary,
        secondary: muscles.secondary,
        steps,
        mistakes: mistakes(item.name, muscles.primary),
        images: item.images.slice(0, 2),
      };
    })
    .filter((item) => item.primary.length > 0 && item.steps.length > 0);

  const byId = new Map(prepared.map((item) => [item.id, item]));
  const picked = new Map<string, (typeof prepared)[number]>();
  const force = [...Object.keys(ALIASES), ...EXTRA_IDS];
  const missing = force.filter((id) => !byId.has(id));
  for (const id of force) {
    const item = byId.get(id);
    if (item) picked.set(id, item);
  }

  const muscles = [
    "upper_abs", "lower_abs", "obliques", "biceps", "triceps", "forearms",
    "front_delts", "side_delts", "rear_delts", "upper_chest", "mid_chest", "lower_chest",
    "lats", "traps", "mid_back", "lower_back", "glutes", "quads", "hamstrings", "calves",
    "adductors", "abductors", "hip_flexors",
  ];
  const ranked = [...prepared].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  for (const muscle of muscles) {
    let added = 0;
    for (const item of ranked) {
      if (added >= 4) break;
      if (picked.has(item.id)) continue;
      if (!item.primary.includes(muscle)) continue;
      picked.set(item.id, item);
      added += 1;
    }
  }
  for (const equipment of ["bodyweight", "dumbbell", "barbell", "machine", "cable"] as Equipment[]) {
    const have = [...picked.values()].filter((item) => item.equipment === equipment).length;
    let added = 0;
    for (const item of ranked) {
      if (have + added >= 20) break;
      if (picked.has(item.id) || item.equipment !== equipment) continue;
      picked.set(item.id, item);
      added += 1;
    }
  }

  const forced = new Set(Object.keys(ALIASES));
  let exercises = [...picked.values()];
  if (exercises.length > 165) {
    const extra = exercises
      .filter((item) => !forced.has(item.id))
      .sort((a, b) => score(a) - score(b));
    const drop = new Set<string>();
    for (const item of extra) {
      if (exercises.length - drop.size <= 155) break;
      const stillCovers = (muscle: string) =>
        exercises.some((other) => other.id !== item.id && !drop.has(other.id) && other.primary.includes(muscle));
      if (item.primary.every(stillCovers)) drop.add(item.id);
    }
    exercises = exercises.filter((item) => !drop.has(item.id));
  }
  exercises.sort((a, b) => a.name.localeCompare(b.name));

  const counts: Record<string, number> = {};
  const equip: Record<string, number> = {};
  for (const item of exercises) {
    equip[item.equipment] = (equip[item.equipment] || 0) + 1;
    for (const muscle of item.primary) counts[muscle] = (counts[muscle] || 0) + 1;
  }
  const payload = {
    source: {
      name: "free-exercise-db",
      author: "yuhonas",
      url: "https://github.com/yuhonas/free-exercise-db",
      license: "Unlicense",
      commit: SOURCE_COMMIT,
      imageBase: `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SOURCE_COMMIT}/exercises/`,
    },
    exercises,
  };
  const out = path.join(process.cwd(), "data", "exercises.json");
  writeFileSync(out, JSON.stringify(payload));
  console.log(`wrote ${exercises.length} exercises to ${out}`);
  console.log("equipment", equip);
  console.log("primary counts", counts);
  const uncovered = muscles.filter((muscle) => !counts[muscle]);
  if (uncovered.length) console.log("no primary", uncovered);
  if (missing.length) console.log("missing force ids", missing);
}

main();
