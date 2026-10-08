"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { formatTime, formatWeight, formatDuration } from "@/lib/format";
import { muscleLabel } from "@/lib/muscles";
import { getZonedParts } from "@/lib/time";
import type { WorkoutDto } from "@/lib/types";
import { BodyMap } from "./body-map";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Board = { today: string; upcoming: WorkoutDto[]; history: WorkoutDto[] };
type Coverage = { primary: string[]; secondary: string[]; neglected: string[] };
type SetDraft = { reps: string; weight: string; duration: string };
type ExDraft = { name: string; libraryId?: string; sets: SetDraft[] };
type LibraryHit = { id: string; name: string; equipment: string; primary: string[] };

const newSet = (): SetDraft => ({ reps: "8", weight: "", duration: "" });

export function WorkoutsView() {
  const { data, error, loading, reload } = useLoad<Board>("/api/workouts");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Push");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [reminder, setReminder] = useState("30");
  const [exercises, setExercises] = useState<ExDraft[]>([{ name: "", sets: [newSet()] }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [hits, setHits] = useState<LibraryHit[]>([]);
  const toast = useToast();
  const router = useRouter();
  const coverage = useLoad<Coverage>("/api/workouts/coverage");

  function startNew() {
    const parts = getZonedParts(new Date());
    setTitle("Workout");
    setDate(data?.today || parts.date);
    setTime("18:00");
    setReminder("30");
    setExercises([{ name: "", sets: [newSet()] }]);
    setLookup("");
    setHits([]);
    setFormError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const needle = lookup.trim();
    if (needle.length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      void api<{ exercises: LibraryHit[] }>(`/api/exercises?q=${encodeURIComponent(needle)}&limit=6`)
        .then((result) => setHits(result.exercises))
        .catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(handle);
  }, [lookup, open]);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await api("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          title,
          date,
          time,
          reminderMinutesBefore: reminder === "" ? null : Number(reminder),
          exercises: exercises
            .filter((exercise) => exercise.name.trim())
            .map((exercise) => ({
              name: exercise.name,
              libraryId: exercise.libraryId ?? null,
              sets: exercise.sets.map((set) => ({
                reps: set.reps === "" ? null : Number(set.reps),
                weight: set.weight === "" ? null : Number(set.weight),
                weightUnit: "lb",
                durationSeconds: set.duration === "" ? null : Number(set.duration),
              })),
            })),
        }),
      });
      setOpen(false);
      toast("Workout planned");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <PageTitle title="Train" />
      <p className="kicker">Training</p>
      <h1 className="display" style={{ fontSize: 32 }}>Workouts</h1>
      <p className="sub">Plan the session, check off sets, and see which muscles you trained.</p>
      <Link href="/exercises" className="btn-ghost" style={{ display: "block", textAlign: "center", marginBottom: 16 }}>Exercise library</Link>
      {coverage.data ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>This week</strong>
          <BodyMap
            primary={coverage.data.primary}
            secondary={coverage.data.secondary}
            neglected={coverage.data.neglected}
            onSelect={(muscle) => router.push(`/exercises?muscle=${muscle}`)}
            label="Muscles trained this week"
          />
          {coverage.data.neglected.length ? (
            <p className="faint">Quiet so far: {coverage.data.neglected.slice(0, 6).map(muscleLabel).join(", ")}</p>
          ) : <p className="faint">Every muscle group got some work.</p>}
        </section>
      ) : null}
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="section-title"><h2>Coming up</h2></div>
          <div className="stack">
            {data.upcoming.length === 0 ? <p className="muted">Nothing planned. Add a session.</p> : null}
            {data.upcoming.map((workout) => <WorkoutRow key={workout.id} workout={workout} />)}
          </div>
          <div className="section-title"><h2>History</h2></div>
          <div className="stack">
            {data.history.length === 0 ? <p className="muted">Completed sessions land here.</p> : null}
            {data.history.map((workout) => <WorkoutRow key={workout.id} workout={workout} />)}
          </div>
        </>
      ) : null}
      <button className="fab" type="button" onClick={startNew} aria-label="Plan workout">+</button>
      <Sheet open={open} title="Plan workout" onClose={() => setOpen(false)}>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <div className="grid-2">
            <label className="field"><span>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          </div>
          <label className="field">
            <span>Reminder</span>
            <select value={reminder} onChange={(event) => setReminder(event.target.value)}>
              <option value="">No reminder</option>
              <option value="15">15 min before</option>
              <option value="30">30 min before</option>
              <option value="60">1 hour before</option>
            </select>
          </label>
          <label className="field">
            <span>From the library</span>
            <input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Search exercises" />
          </label>
          {hits.length ? (
            <div className="stack" style={{ marginBottom: 12 }}>
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setExercises((current) => [...current.filter((exercise) => exercise.name.trim()), { name: hit.name, libraryId: hit.id, sets: [newSet(), newSet(), newSet()] }]);
                    setLookup("");
                    setHits([]);
                  }}
                >
                  {hit.name}
                </button>
              ))}
            </div>
          ) : null}
          {exercises.map((exercise, index) => (
            <fieldset key={index} className="card" style={{ marginBottom: 12 }}>
              <label className="field"><span>Exercise</span><input value={exercise.name} onChange={(event) => updateExercise(setExercises, index, { ...exercise, name: event.target.value })} placeholder="Bench press" /></label>
              {exercise.sets.map((set, setIndex) => (
                <div key={setIndex} className="grid-3">
                  <label className="field"><span>Reps</span><input inputMode="numeric" value={set.reps} onChange={(event) => updateSet(setExercises, index, setIndex, { ...set, reps: event.target.value })} /></label>
                  <label className="field"><span>Lb</span><input inputMode="decimal" value={set.weight} onChange={(event) => updateSet(setExercises, index, setIndex, { ...set, weight: event.target.value })} /></label>
                  <label className="field"><span>Sec</span><input inputMode="numeric" value={set.duration} onChange={(event) => updateSet(setExercises, index, setIndex, { ...set, duration: event.target.value })} /></label>
                </div>
              ))}
              <button className="text-btn" type="button" onClick={() => updateExercise(setExercises, index, { ...exercise, sets: [...exercise.sets, newSet()] })}>Add set</button>
            </fieldset>
          ))}
          <button className="btn-ghost" type="button" style={{ marginBottom: 12 }} onClick={() => setExercises([...exercises, { name: "", sets: [newSet()] }])}>Add exercise</button>
          {formError ? <p className="err">{formError}</p> : null}
          <button className="btn" disabled={saving} type="submit">{saving ? "Saving…" : "Save workout"}</button>
        </form>
      </Sheet>
    </main>
  );
}

function updateExercise(setExercises: React.Dispatch<React.SetStateAction<ExDraft[]>>, index: number, next: ExDraft) {
  setExercises((current) => current.map((exercise, i) => (i === index ? next : exercise)));
}
function updateSet(setExercises: React.Dispatch<React.SetStateAction<ExDraft[]>>, index: number, setIndex: number, next: SetDraft) {
  setExercises((current) => current.map((exercise, i) => i === index ? { ...exercise, sets: exercise.sets.map((set, j) => (j === setIndex ? next : set)) } : exercise));
}

function WorkoutRow({ workout }: { workout: WorkoutDto }) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  const done = sets.filter((set) => set.completed).length;
  const preview = workout.exercises.slice(0, 2).map((exercise) => exercise.name).join(", ");
  return (
    <Link href={`/workouts/${workout.id}`} className="card" style={{ display: "block" }}>
      <div className="spread">
        <strong>{workout.title}</strong>
        <span className="pill" data-type="workout">{workout.status}</span>
      </div>
      <p className="muted" style={{ margin: "6px 0 0" }}>
        {workout.scheduledAt ? formatTime(workout.scheduledAt) : "Unscheduled"}
        {sets.length ? ` · ${done}/${sets.length} sets` : ""}
      </p>
      {preview ? <p className="faint" style={{ margin: "4px 0 0" }}>{preview}</p> : null}
      <SetPreview workout={workout} />
    </Link>
  );
}

function SetPreview({ workout }: { workout: WorkoutDto }) {
  const first = workout.exercises[0]?.sets[0];
  if (!first) return null;
  const bits = [first.reps ? `${first.reps} reps` : "", formatWeight(first.weight, first.weightUnit), formatDuration(first.durationSeconds)].filter(Boolean);
  return bits.length ? <p className="faint" style={{ margin: "4px 0 0" }}>{bits.join(" · ")}</p> : null;
}
