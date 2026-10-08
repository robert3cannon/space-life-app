export const MUSCLE_IDS = [
  "upper_abs",
  "lower_abs",
  "obliques",
  "biceps",
  "triceps",
  "forearms",
  "front_delts",
  "side_delts",
  "rear_delts",
  "upper_chest",
  "mid_chest",
  "lower_chest",
  "lats",
  "traps",
  "mid_back",
  "lower_back",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
  "adductors",
  "abductors",
  "hip_flexors",
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export const MUSCLES: { id: MuscleId; label: string; group: string }[] = [
  { id: "upper_chest", label: "Upper chest", group: "Chest" },
  { id: "mid_chest", label: "Mid chest", group: "Chest" },
  { id: "lower_chest", label: "Lower chest", group: "Chest" },
  { id: "front_delts", label: "Front delts", group: "Shoulders" },
  { id: "side_delts", label: "Side delts", group: "Shoulders" },
  { id: "rear_delts", label: "Rear delts", group: "Shoulders" },
  { id: "traps", label: "Traps", group: "Back" },
  { id: "lats", label: "Lats", group: "Back" },
  { id: "mid_back", label: "Mid back", group: "Back" },
  { id: "lower_back", label: "Lower back", group: "Back" },
  { id: "biceps", label: "Biceps", group: "Arms" },
  { id: "triceps", label: "Triceps", group: "Arms" },
  { id: "forearms", label: "Forearms", group: "Arms" },
  { id: "upper_abs", label: "Upper abs", group: "Core" },
  { id: "lower_abs", label: "Lower abs", group: "Core" },
  { id: "obliques", label: "Obliques", group: "Core" },
  { id: "glutes", label: "Glutes", group: "Legs" },
  { id: "quads", label: "Quads", group: "Legs" },
  { id: "hamstrings", label: "Hamstrings", group: "Legs" },
  { id: "calves", label: "Calves", group: "Legs" },
  { id: "adductors", label: "Adductors", group: "Legs" },
  { id: "abductors", label: "Abductors", group: "Legs" },
  { id: "hip_flexors", label: "Hip flexors", group: "Legs" },
];

const LABELS = new Map(MUSCLES.map((muscle) => [muscle.id, muscle.label]));

export function isMuscleId(value: string): value is MuscleId {
  return LABELS.has(value as MuscleId);
}

export function muscleLabel(id: string) {
  return LABELS.get(id as MuscleId) ?? id.replaceAll("_", " ");
}
