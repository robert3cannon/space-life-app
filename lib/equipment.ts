import type { MuscleId } from "./muscles";

export const GEAR_IDS = ["bodyweight", "pushup_board", "dumbbells"] as const;
export type GearId = (typeof GEAR_IDS)[number];

export const GEAR_OPTIONS: { id: GearId; label: string }[] = [
  { id: "bodyweight", label: "Bodyweight" },
  { id: "pushup_board", label: "Push-up board" },
  { id: "dumbbells", label: "Dumbbells" },
];

export type EquipmentProfile = {
  gear: GearId[];
  dumbbellLb: number;
  dumbbellCount: number;
};

export const DEFAULT_EQUIPMENT: EquipmentProfile = {
  gear: ["bodyweight", "pushup_board", "dumbbells"],
  dumbbellLb: 15,
  dumbbellCount: 2,
};

export const BOARD_ZONE_IDS = ["chest", "shoulders", "back", "triceps"] as const;
export type BoardZoneId = (typeof BOARD_ZONE_IDS)[number];

export type BoardZone = {
  id: BoardZoneId;
  color: string;
  zone: string;
  hands: string;
  muscles: MuscleId[];
};

/** Usual color-coded board: blue chest, red shoulders, yellow back, green triceps. */
export const BOARD_ZONES: Record<BoardZoneId, BoardZone> = {
  chest: {
    id: "chest",
    color: "Blue",
    zone: "Chest",
    hands: "Wide, handles angled slightly out",
    muscles: ["mid_chest", "upper_chest", "lower_chest"],
  },
  shoulders: {
    id: "shoulders",
    color: "Red",
    zone: "Shoulders",
    hands: "Shoulder width, slightly forward",
    muscles: ["front_delts", "side_delts"],
  },
  back: {
    id: "back",
    color: "Yellow",
    zone: "Back",
    hands: "Wide, handles angled in. Pinch the shoulder blades at the top",
    muscles: ["lats", "mid_back"],
  },
  triceps: {
    id: "triceps",
    color: "Green",
    zone: "Triceps",
    hands: "Narrow, elbows close to the ribs",
    muscles: ["triceps"],
  },
};

export function isGearId(value: string): value is GearId {
  return (GEAR_IDS as readonly string[]).includes(value);
}

export function isBoardZone(value: string): value is BoardZoneId {
  return (BOARD_ZONE_IDS as readonly string[]).includes(value);
}

export function cleanGear(gear: readonly string[]): GearId[] {
  const seen = new Set<GearId>();
  for (const id of gear) {
    if (isGearId(id)) seen.add(id);
  }
  return GEAR_IDS.filter((id) => seen.has(id));
}

export function libraryEquipment(profile: EquipmentProfile): Array<"bodyweight" | "dumbbell"> {
  const owned: Array<"bodyweight" | "dumbbell"> = [];
  if (profile.gear.includes("bodyweight") || profile.gear.includes("pushup_board")) owned.push("bodyweight");
  if (profile.gear.includes("dumbbells")) owned.push("dumbbell");
  return owned;
}

export function equipmentSummary(profile: EquipmentProfile) {
  const parts: string[] = [];
  if (profile.gear.includes("bodyweight")) parts.push("bodyweight");
  if (profile.gear.includes("pushup_board")) parts.push("push-up board");
  if (profile.gear.includes("dumbbells")) parts.push(`${profile.dumbbellCount} × ${profile.dumbbellLb} lb dumbbells`);
  return parts.join(", ");
}

export function boardNote(zone: BoardZoneId) {
  const position = BOARD_ZONES[zone];
  return `Push-up board · ${position.color} · ${position.zone}. ${position.hands}.`;
}

export function dumbbellNote(pounds: number) {
  return `${pounds} lb each · 2 seconds down`;
}

const PUSHUP_IDS = new Set(["Pushups", "Isometric_Wipers"]);

export function pushupBoardZones(exerciseId: string): BoardZone[] | null {
  if (!PUSHUP_IDS.has(exerciseId)) return null;
  return BOARD_ZONE_IDS.map((id) => BOARD_ZONES[id]);
}
