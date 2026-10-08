import { getExercise } from "./exercises";

export const STEPS_AUTO_GOAL = 10000;

/**
 * Health workout types only count toward the muscle map when a catalog
 * exercise trains the same muscles. Strength sessions stay in history
 * without a guessed split.
 */
export function healthActivityExercise(type: string): { name: string; libraryId: string | null } {
  const name = type.trim().slice(0, 120) || "Workout";
  const text = name.toLowerCase();
  let libraryId: string | null = null;
  if (/cycl|biking|\bbike\b|spin/.test(text)) libraryId = "Recumbent_Bike";
  else if (/\brow/.test(text)) libraryId = "Seated_Cable_Rows";
  else if (/run|walk|hik|elliptical|stair/.test(text)) libraryId = "Bodyweight_Walking_Lunge";
  else if (/core/.test(text)) libraryId = "Plank";
  if (libraryId && !getExercise(libraryId)) libraryId = null;
  return { name, libraryId };
}
