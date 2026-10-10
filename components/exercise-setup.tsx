"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_EQUIPMENT } from "@/lib/equipment";
import { defaultPrescription, saveSessionPlan } from "@/lib/session-plan";
import type { AppSettings } from "@/lib/types";
import { Sheet } from "./sheet";
import { useLoad } from "./use-load";

type SetupExercise = {
  id: string;
  name: string;
  equipment: string;
  mechanic?: string | null;
};

export function ExerciseSetup({
  exercise,
  open,
  onClose,
}: {
  exercise: SetupExercise | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const settings = useLoad<AppSettings>("/api/settings");
  const [sets, setSets] = useState("3");
  const [mode, setMode] = useState<"reps" | "time">("reps");
  const [reps, setReps] = useState("8");
  const [seconds, setSeconds] = useState("30");
  const [weight, setWeight] = useState("");
  const [rest, setRest] = useState("60");
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !exercise) {
      applied.current = null;
      return;
    }
    if (applied.current === exercise.id) return;
    if (settings.loading && !settings.data) return;
    applied.current = exercise.id;
    const preset = defaultPrescription(exercise, settings.data?.equipment ?? DEFAULT_EQUIPMENT);
    setSets(String(preset.sets));
    setMode(preset.durationSeconds != null ? "time" : "reps");
    setReps(preset.reps == null ? "8" : String(preset.reps));
    setSeconds(preset.durationSeconds == null ? "30" : String(preset.durationSeconds));
    setWeight(preset.weight == null ? "" : String(preset.weight));
    setRest(String(preset.restSeconds));
  }, [open, exercise, settings.data, settings.loading]);

  function start() {
    if (!exercise) return;
    const count = Math.min(30, Math.max(1, Number(sets) || 1));
    const timed = mode === "time";
    saveSessionPlan({
      title: exercise.name,
      restSeconds: Math.min(600, Math.max(0, Number(rest) || 0)),
      exercises: [
        {
          libraryId: exercise.id,
          name: exercise.name,
          sets: count,
          reps: timed ? null : Math.max(0, Number(reps) || 0),
          durationSeconds: timed ? Math.max(1, Number(seconds) || 30) : null,
          weight: weight.trim() === "" ? null : Number(weight),
        },
      ],
    });
    onClose();
    router.push("/sessions/play");
  }

  return (
    <Sheet open={open && Boolean(exercise)} title="Set up the exercise" onClose={onClose}>
      {exercise ? (
        <form
          data-testid="setup-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <p className="kicker">One exercise</p>
          <h2 className="player-title" style={{ marginTop: 0 }}>{exercise.name}</h2>
          <div className="grid-2">
            <label className="field">
              <span>Sets</span>
              <input inputMode="numeric" value={sets} onChange={(event) => setSets(event.target.value)} required />
            </label>
            <label className="field">
              <span>Rest (sec)</span>
              <input inputMode="numeric" value={rest} onChange={(event) => setRest(event.target.value)} required />
            </label>
          </div>
          <div className="chips" role="group" aria-label="Count the set by" style={{ marginBottom: 12 }}>
            <button type="button" className={`chip ${mode === "reps" ? "on" : ""}`} aria-pressed={mode === "reps"} onClick={() => setMode("reps")}>
              Reps
            </button>
            <button type="button" className={`chip ${mode === "time" ? "on" : ""}`} aria-pressed={mode === "time"} onClick={() => setMode("time")}>
              Time
            </button>
          </div>
          {mode === "reps" ? (
            <label className="field">
              <span>Reps</span>
              <input inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} required />
            </label>
          ) : (
            <label className="field">
              <span>Seconds</span>
              <input inputMode="numeric" value={seconds} onChange={(event) => setSeconds(event.target.value)} required />
            </label>
          )}
          <label className="field">
            <span>Weight (lb)</span>
            <input inputMode="decimal" value={weight} placeholder="Bodyweight" onChange={(event) => setWeight(event.target.value)} />
          </label>
          <button className="btn" type="submit" data-testid="setup-start">Start</button>
        </form>
      ) : null}
    </Sheet>
  );
}
