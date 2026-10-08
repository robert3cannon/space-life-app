"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { muscleLabel } from "@/lib/muscles";
import { useLoad } from "./use-load";
import { BodyMap } from "./body-map";
import { ErrorNote, Loading, PageTitle } from "./ui";

const EQUIPMENT: { id: string; label: string }[] = [
  { id: "", label: "All gear" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "barbell", label: "Barbell" },
  { id: "machine", label: "Machine" },
  { id: "cable", label: "Cable" },
];

type Row = {
  id: string;
  name: string;
  equipment: string;
  level: string;
  primary: string[];
  secondary: string[];
};

export function ExerciseLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const muscle = params.get("muscle");
  const addTo = params.get("addTo");
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState<string>("");
  const { data, error, loading, reload } = useLoad<{ exercises: Row[] }>("/api/exercises?limit=200");

  const exercises = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.exercises ?? []).filter((exercise) => {
      if (equipment && exercise.equipment !== equipment) return false;
      if (muscle && !exercise.primary.includes(muscle) && !exercise.secondary.includes(muscle)) return false;
      if (!needle) return true;
      return exercise.name.toLowerCase().includes(needle);
    });
  }, [data, q, equipment, muscle]);

  function pickMuscle(id: string) {
    const next = new URLSearchParams(params.toString());
    if (muscle === id) next.delete("muscle");
    else next.set("muscle", id);
    const query = next.toString();
    router.replace(query ? `/exercises?${query}` : "/exercises");
  }

  function clearMuscle() {
    const next = new URLSearchParams(params.toString());
    next.delete("muscle");
    const query = next.toString();
    router.replace(query ? `/exercises?${query}` : "/exercises");
  }

  return (
    <main className="page">
      <PageTitle title="Exercise library" />
      <Link href={addTo ? `/workouts/${addTo}` : "/workouts"} className="text-btn">Back</Link>
      <p className="kicker" style={{ marginTop: 12 }}>Library</p>
      <h1 className="display" style={{ fontSize: 32 }}>Exercises</h1>
      <p className="sub">Search the library, or tap a muscle to see what trains it.</p>
      <BodyMap
        selected={muscle}
        onSelect={pickMuscle}
        label={muscle ? `Body map, ${muscleLabel(muscle)} selected` : "Body map. Tap a muscle to filter exercises."}
      />
      {muscle ? (
        <button className="chip on" type="button" onClick={clearMuscle} style={{ margin: "8px 0 12px" }}>
          {muscleLabel(muscle)} · clear
        </button>
      ) : null}
      <label className="field">
        <span>Search</span>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Bench, row, squat…" />
      </label>
      <div className="chips" style={{ marginBottom: 14 }}>
        {EQUIPMENT.map((item) => (
          <button key={item.label} type="button" className={`chip ${equipment === item.id ? "on" : ""}`} onClick={() => setEquipment(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <p className="faint">{exercises.length} exercises</p>
          <div className="stack">
            {exercises.length === 0 ? <p className="muted">Nothing matches that filter.</p> : null}
            {exercises.map((exercise) => {
              const href = addTo ? `/exercises/${encodeURIComponent(exercise.id)}?addTo=${encodeURIComponent(addTo)}` : `/exercises/${encodeURIComponent(exercise.id)}`;
              const primaryHit = muscle && exercise.primary.includes(muscle);
              return (
                <Link key={exercise.id} href={href} className="card" style={{ display: "block" }}>
                  <div className="spread">
                    <strong>{exercise.name}</strong>
                    <span className="pill" data-type="workout">{exercise.equipment}</span>
                  </div>
                  <p className="faint" style={{ margin: "6px 0 0" }}>
                    {exercise.primary.map(muscleLabel).join(", ")}
                    {exercise.secondary.length ? ` · also ${exercise.secondary.slice(0, 3).map(muscleLabel).join(", ")}` : ""}
                  </p>
                  {muscle ? <p className="muted" style={{ margin: "4px 0 0" }}>{primaryHit ? "Primary" : "Secondary"}</p> : null}
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </main>
  );
}
