"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { DEFAULT_EQUIPMENT } from "@/lib/equipment";
import { muscleLabel, MUSCLES } from "@/lib/muscles";
import { defaultPrescription, saveSessionPlan, type PlannedExercise } from "@/lib/session-plan";
import type { AppSettings, RoutineDto } from "@/lib/types";
import { RatingDots } from "./rating-dots";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Row = {
  id: string;
  name: string;
  equipment: string;
  mechanic?: string;
  primary: string[];
  secondary: string[];
  ratings?: Record<string, { score: number; why: string }>;
};

type Draft = {
  key: string;
  libraryId: string | null;
  name: string;
  sets: string;
  mode: "reps" | "time";
  reps: string;
  seconds: string;
  weight: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function draftFromPreset(exercise: { id: string; name: string; equipment?: string; mechanic?: string }, gear = DEFAULT_EQUIPMENT): Draft {
  const preset = defaultPrescription(exercise, gear);
  return {
    key: newKey(),
    libraryId: exercise.id,
    name: exercise.name,
    sets: String(preset.sets),
    mode: preset.durationSeconds != null ? "time" : "reps",
    reps: preset.reps == null ? "8" : String(preset.reps),
    seconds: preset.durationSeconds == null ? "30" : String(preset.durationSeconds),
    weight: preset.weight == null ? "" : String(preset.weight),
  };
}

function draftFromRoutine(exercise: RoutineDto["exercises"][number]): Draft {
  const timed = exercise.durationSeconds != null && exercise.reps == null;
  return {
    key: newKey(),
    libraryId: exercise.libraryId,
    name: exercise.name,
    sets: String(exercise.sets),
    mode: timed ? "time" : "reps",
    reps: exercise.reps == null ? "8" : String(exercise.reps),
    seconds: exercise.durationSeconds == null ? "30" : String(exercise.durationSeconds),
    weight: exercise.weight == null ? "" : String(exercise.weight),
  };
}

export function QuickWorkout() {
  const params = useSearchParams();
  const editing = params.get("id");
  const router = useRouter();
  const toast = useToast();
  const settings = useLoad<AppSettings>("/api/settings");
  const saved = useLoad<{ routines: RoutineDto[] }>("/api/routines");
  const library = useLoad<{ exercises: Row[] }>("/api/exercises?limit=200");
  const [title, setTitle] = useState("Quick workout");
  const [rest, setRest] = useState("60");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const filled = useRef<string | null>(null);

  useEffect(() => {
    if (!editing || !saved.data) return;
    if (filled.current === editing) return;
    const routine = saved.data.routines.find((item) => item.id === editing);
    if (!routine) return;
    filled.current = editing;
    setTitle(routine.title);
    setRest(String(routine.restSeconds));
    setDrafts(routine.exercises.map(draftFromRoutine));
  }, [editing, saved.data]);

  const gear = settings.data?.equipment ?? DEFAULT_EQUIPMENT;

  const picks = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (library.data?.exercises ?? []).filter((exercise) => {
      if (muscle && !exercise.primary.includes(muscle) && !exercise.secondary.includes(muscle)) return false;
      if (!needle) return true;
      return exercise.name.toLowerCase().includes(needle);
    });
    return [...rows].sort((a, b) => {
      const score = (exercise: Row) => {
        if (muscle) return exercise.ratings?.[muscle]?.score ?? 0;
        return Math.max(0, ...Object.values(exercise.ratings ?? {}).map((rating) => rating.score));
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      if (muscle) {
        const aPrimary = a.primary.includes(muscle) ? 0 : 1;
        const bPrimary = b.primary.includes(muscle) ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      }
      return a.name.localeCompare(b.name);
    }).slice(0, 12);
  }, [library.data, q, muscle]);

  function planned(): PlannedExercise[] {
    return drafts.map((draft) => {
      const timed = draft.mode === "time";
      return {
        libraryId: draft.libraryId,
        name: draft.name,
        sets: Math.min(30, Math.max(1, Number(draft.sets) || 1)),
        reps: timed ? null : Math.max(0, Number(draft.reps) || 0),
        durationSeconds: timed ? Math.max(1, Number(draft.seconds) || 30) : null,
        weight: draft.weight.trim() === "" ? null : Number(draft.weight),
      };
    });
  }

  function start(exercises = planned(), name = title, restSeconds = Number(rest) || 0) {
    if (!exercises.length) {
      setFormError("Add at least one exercise");
      return;
    }
    saveSessionPlan({
      title: name.trim() || "Quick workout",
      restSeconds: Math.min(600, Math.max(0, restSeconds)),
      exercises,
    });
    router.push("/sessions/play");
  }

  async function save() {
    const exercises = planned();
    if (!exercises.length) {
      setFormError("Add at least one exercise");
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      title: title.trim() || "Quick workout",
      restSeconds: Math.min(600, Math.max(0, Number(rest) || 60)),
      exercises: exercises.map((exercise) => ({
        libraryId: exercise.libraryId,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        durationSeconds: exercise.durationSeconds,
        weight: exercise.weight,
        weightUnit: "lb" as const,
      })),
    };
    try {
      if (editing) {
        await api(`/api/routines/${editing}`, { method: "PATCH", body: JSON.stringify(body) });
        toast("Workout updated");
      } else {
        const created = await api<RoutineDto>("/api/routines", { method: "POST", body: JSON.stringify(body) });
        toast("Workout saved");
        router.replace(`/workouts/quick?id=${created.id}`);
        filled.current = created.id;
      }
      await saved.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/routines/${id}`, { method: "DELETE" });
      toast("Workout deleted");
      setConfirmDelete(null);
      if (editing === id) {
        filled.current = null;
        setTitle("Quick workout");
        setDrafts([]);
        router.replace("/workouts/quick");
      }
      await saved.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  function move(index: number, delta: number) {
    setDrafts((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  return (
    <main className="page" data-testid="quick-builder">
      <PageTitle title="Quick workout" />
      <Link href="/workouts" className="text-btn">Train</Link>
      <p className="kicker" style={{ marginTop: 12 }}>Build your own</p>
      <h1 className="display">Quick workout</h1>
      <p className="sub">Add exercises in order. They run as straight sets, one exercise at a time.</p>

      <section className="card" style={{ marginBottom: 16 }}>
        <strong>Saved</strong>
        {saved.loading && !saved.data ? <Loading rows={1} /> : null}
        {saved.error ? <ErrorNote message={saved.error} onRetry={saved.reload} /> : null}
        {saved.data && saved.data.routines.length === 0 ? <p className="muted">None yet. Build one below and save it.</p> : null}
        <div className="stack" style={{ marginTop: 10 }}>
          {saved.data?.routines.map((routine) => (
            <div key={routine.id} className="card">
              <strong>{routine.title}</strong>
              <p className="faint" style={{ margin: "4px 0 8px" }}>
                {routine.exercises.map((exercise) => exercise.name).join(", ")}
              </p>
              <button className="btn" type="button" onClick={() => start(routine.exercises.map((exercise) => ({
                libraryId: exercise.libraryId,
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                durationSeconds: exercise.durationSeconds,
                weight: exercise.weight,
              })), routine.title, routine.restSeconds)}>Start</button>
              <div className="inline-actions">
                <Link href={`/workouts/quick?id=${routine.id}`} className="text-btn">Edit</Link>
                {confirmDelete === routine.id ? (
                  <button className="text-btn" type="button" onClick={() => void remove(routine.id)}>Delete it</button>
                ) : (
                  <button className="text-btn" type="button" onClick={() => setConfirmDelete(routine.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <label className="field">
        <span>Name</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>Rest between sets (sec)</span>
        <input inputMode="numeric" value={rest} onChange={(event) => setRest(event.target.value)} />
      </label>

      <div className="stack" style={{ marginBottom: 12 }}>
        {drafts.map((draft, index) => (
          <fieldset key={draft.key} className="card">
            <strong>{draft.name}</strong>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <label className="field">
                <span>Sets</span>
                <input inputMode="numeric" value={draft.sets} onChange={(event) => updateDraft(setDrafts, index, { sets: event.target.value })} />
              </label>
              {draft.mode === "time" ? (
                <label className="field">
                  <span>Seconds</span>
                  <input inputMode="numeric" value={draft.seconds} onChange={(event) => updateDraft(setDrafts, index, { seconds: event.target.value })} />
                </label>
              ) : (
                <label className="field">
                  <span>Reps</span>
                  <input inputMode="numeric" value={draft.reps} onChange={(event) => updateDraft(setDrafts, index, { reps: event.target.value })} />
                </label>
              )}
            </div>
            <label className="field">
              <span>Weight (lb)</span>
              <input inputMode="decimal" placeholder="Bodyweight" value={draft.weight} onChange={(event) => updateDraft(setDrafts, index, { weight: event.target.value })} />
            </label>
            <div className="chips" role="group" aria-label={`${draft.name} count`}>
              <button type="button" className={`chip ${draft.mode === "reps" ? "on" : ""}`} onClick={() => updateDraft(setDrafts, index, { mode: "reps" })}>Reps</button>
              <button type="button" className={`chip ${draft.mode === "time" ? "on" : ""}`} onClick={() => updateDraft(setDrafts, index, { mode: "time" })}>Time</button>
            </div>
            <div className="inline-actions">
              <button className="text-btn" type="button" disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
              <button className="text-btn" type="button" disabled={index === drafts.length - 1} onClick={() => move(index, 1)}>Down</button>
              <button className="text-btn" type="button" onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}>Remove</button>
            </div>
          </fieldset>
        ))}
      </div>

      <label className="field">
        <span>Search</span>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Bench, row, plank…" />
      </label>
      <label className="field">
        <span>Muscle</span>
        <select value={muscle} onChange={(event) => setMuscle(event.target.value)}>
          <option value="">Any muscle</option>
          {MUSCLES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      {library.loading && !library.data ? <Loading rows={2} /> : null}
      {library.error ? <ErrorNote message={library.error} onRetry={library.reload} /> : null}
      <div className="stack" style={{ marginBottom: 14 }}>
        {picks.map((exercise) => {
          const rating = muscle
            ? exercise.ratings?.[muscle]
              ? { score: exercise.ratings[muscle].score, muscle }
              : null
            : bestRating(exercise);
          return (
            <div key={exercise.id} className="picker-row card">
              <div>
                <strong>{exercise.name}</strong>
                {rating ? (
                  <div className="row" style={{ marginTop: 4 }}>
                    <RatingDots score={rating.score} label={`${rating.score} out of 5`} />
                    <span className="faint">{muscle ? muscleLabel(muscle) : muscleLabel(rating.muscle)}</span>
                  </div>
                ) : null}
              </div>
              <button className="btn inline" type="button" onClick={() => setDrafts((current) => [...current, draftFromPreset(exercise, gear)])}>
                Add
              </button>
            </div>
          );
        })}
      </div>
      {formError ? <p className="err">{formError}</p> : null}
      <button className="btn" type="button" disabled={!drafts.length} onClick={() => start()}>Start workout</button>
      <button className="btn-ghost" type="button" style={{ marginTop: 10 }} disabled={saving || !drafts.length} onClick={() => void save()}>
        {saving ? "Saving…" : editing ? "Save changes" : "Save workout"}
      </button>
    </main>
  );
}

function bestRating(exercise: Row) {
  let top: { score: number; muscle: string } | null = null;
  for (const [id, rating] of Object.entries(exercise.ratings ?? {})) {
    if (!top || rating.score > top.score) top = { score: rating.score, muscle: id };
  }
  return top;
}

function updateDraft(setDrafts: Dispatch<SetStateAction<Draft[]>>, index: number, patch: Partial<Draft>) {
  setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
}
