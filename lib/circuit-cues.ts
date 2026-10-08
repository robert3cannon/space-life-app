export type CueName = "tick" | "finish" | "complete";
export type CueReason = "timer" | "done" | "skip" | "back";

/** A countdown beep while the clock is showing 3, 2, or 1. */
export function countdownCue(secondsLeft: number): CueName | null {
  if (secondsLeft >= 1 && secondsLeft <= 3) return "tick";
  return null;
}

/** Rising pitches so the last three seconds are distinct. */
export function tickFrequency(secondsLeft: number) {
  if (secondsLeft >= 3) return 392;
  if (secondsLeft === 2) return 523;
  return 784;
}

/**
 * The set chime plays when work actually finishes.
 * The last station plays the longer finale instead.
 * Rest already announced itself with the 3-2-1 ticks.
 */
export function transitionCue(kind: "work" | "rest", finishing: boolean, reason: CueReason): CueName | null {
  if (reason === "skip" || reason === "back") return null;
  if (kind === "rest") return null;
  return finishing ? "complete" : "finish";
}
