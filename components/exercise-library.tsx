"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { muscleLabel } from "@/lib/muscles";
import type { AppSettings } from "@/lib/types";
import { useLoad } from "./use-load";
import { BodyMap } from "./body-map";
import { ExerciseSetup } from "./exercise-setup";
import { RatingDots } from "./rating-dots";
import { ErrorNote, Loading, PageTitle } from "./ui";

const BOARD_IDS = new Set(["Pushups", "Isometric_Wipers"]);

type Row = {
  id: string;
  name: string;
  equipment: string;
  level: string;
  mechanic?: string;
  primary: string[];
  secondary: string[];
  ratings?: Record<string, { score: number; why: string }>;
};

export function ExerciseLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const muscle = params.get("muscle");
  const addTo = params.get("addTo");
  const [q, setQ] = useState("");
  const [equipment, setEquipment] = useState<string>("");
  const [starting, setStarting] = useState<Row | null>(null);
  const settings = useLoad<AppSettings>("/api/settings");
  const gear = settings.data?.equipment.gear ?? ["bodyweight", "pushup_board", "dumbbells"];
  const chips = [
    { id: "", label: "My gear" },
    ...(gear.includes("bodyweight") || gear.includes("pushup_board") ? [{ id: "bodyweight", label: "Bodyweight" }] : []),
    ...(gear.includes("dumbbells") ? [{ id: "dumbbell", label: "Dumbbell" }] : []),
    { id: "all", label: "Full catalog" },
  ];
  const query = equipment === "all"
    ? "/api/exercises?limit=200&all=1"
    : equipment
      ? `/api/exercises?limit=200&equipment=${equipment}`
      : "/api/exercises?limit=200";
  const { data, error, loading, reload } = useLoad<{ exercises: Row[] }>(query);

  const exercises = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (data?.exercises ?? []).filter((exercise) => {
      if (muscle && !exercise.primary.includes(muscle) && !exercise.secondary.includes(muscle)) return false;
      if (!needle) return true;
      return exercise.name.toLowerCase().includes(needle);
    });
    if (!muscle) return rows;
    return [...rows].sort((a, b) => {
      const diff = (b.ratings?.[muscle]?.score ?? 0) - (a.ratings?.[muscle]?.score ?? 0);
      if (diff !== 0) return diff;
      const aPrimary = a.primary.includes(muscle) ? 0 : 1;
      const bPrimary = b.primary.includes(muscle) ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return a.name.localeCompare(b.name);
    });
  }, [data, q, muscle]);

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
      <h1 className="display">Exercises</h1>
      <p className="sub">Search the library, or tap a muscle to see what trains it, best first.</p>
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
      <div className="chips" style={{ marginBottom: 14 }} role="group" aria-label="Equipment">
        {chips.map((item) => (
          <button key={item.id || "mine"} type="button" className={`chip ${equipment === item.id ? "on" : ""}`} onClick={() => setEquipment(item.id)}>
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
              const rating = muscle ? exercise.ratings?.[muscle] : undefined;
              return (
                <article key={exercise.id} className="card exercise-card">
                  <Link href={href} className="exercise-open">
                    <div className="spread">
                      <strong>{exercise.name}</strong>
                      {rating ? <RatingDots score={rating.score} label={`${rating.score} out of 5 for ${muscleLabel(muscle ?? "")}`} /> : (
                        <span className="pill" data-type="workout">{exercise.equipment}</span>
                      )}
                    </div>
                    <p className="faint" style={{ margin: "6px 0 0" }}>
                      {rating ? `${primaryHit ? "Primary" : "Secondary"} · ${muscleLabel(muscle ?? "")}` : exercise.primary.map(muscleLabel).join(", ")}
                      {!rating && exercise.secondary.length ? ` · also ${exercise.secondary.slice(0, 3).map(muscleLabel).join(", ")}` : ""}
                    </p>
                    {rating ? <p className="faint" style={{ margin: "4px 0 0" }}>{rating.why}</p> : null}
                    {gear.includes("pushup_board") && BOARD_IDS.has(exercise.id) ? (
                      <p className="station-note" style={{ margin: "4px 0 0" }}>Push-up board hand positions are on the detail page.</p>
                    ) : null}
                  </Link>
                  <button className="btn" type="button" aria-label={`Start ${exercise.name}`} onClick={() => setStarting(exercise)}>
                    Start
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      <ExerciseSetup exercise={starting} open={Boolean(starting)} onClose={() => setStarting(null)} />
    </main>
  );
}
