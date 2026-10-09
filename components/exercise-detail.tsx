"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { muscleLabel } from "@/lib/muscles";
import type { WorkoutDto } from "@/lib/types";
import { BodyMap } from "./body-map";
import { RatingDots } from "./rating-dots";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Detail = {
  id: string;
  name: string;
  equipment: string;
  level: string;
  mechanic: string;
  primary: string[];
  secondary: string[];
  ratings?: Record<string, { score: number; why: string }>;
  steps: string[];
  mistakes: string[];
  images: string[];
  youtube: string;
  source: { name: string; author: string; license: string; url: string };
  board: { id: string; color: string; zone: string; hands: string }[] | null;
};

type Board = { upcoming: WorkoutDto[] };

export function ExerciseDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const addTo = params.get("addTo");
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Detail>(`/api/exercises/${encodeURIComponent(id)}`);
  const board = useLoad<Board>("/api/workouts");
  const [saving, setSaving] = useState<string | null>(null);

  async function add(workoutId: string) {
    setSaving(workoutId);
    try {
      await api(`/api/workouts/${workoutId}/exercises`, {
        method: "POST",
        body: JSON.stringify({ libraryId: id }),
      });
      toast("Added to the workout");
      router.push(`/workouts/${workoutId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add it");
    } finally {
      setSaving(null);
    }
  }

  const upcoming = (board.data?.upcoming ?? []).slice(0, 6);

  return (
    <main className="page">
      <PageTitle title={data?.name ?? "Exercise"} />
      <Link href="/exercises" className="text-btn">Library</Link>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>{data.equipment} · {data.level}</p>
          <h1 className="display">{data.name}</h1>
          <Demo images={data.images} name={data.name} />
          <BodyMap primary={data.primary} secondary={data.secondary} label={`${data.name} muscles`} />
          <div className="stack" style={{ marginTop: 8 }}>
            <section className="card">
              <strong>Muscles</strong>
              <ul className="muscle-ratings">
                {[...data.primary.map((id) => ({ id, role: "Primary" })), ...data.secondary.map((id) => ({ id, role: "Also" }))].map((row) => {
                  const rating = data.ratings?.[row.id];
                  return (
                    <li key={row.id}>
                      <strong>{muscleLabel(row.id)}</strong>
                      {rating ? <RatingDots score={rating.score} label={`${rating.score} out of 5 for ${muscleLabel(row.id)}`} /> : null}
                      <span className="pill" data-type={row.role === "Primary" ? "workout" : "other"}>{row.role}</span>
                      {rating ? <p className="faint">{rating.why}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
            {data.board?.length ? (
              <section className="card">
                <strong>Push-up board</strong>
                <p className="faint" style={{ margin: "6px 0 0" }}>Same push-up. Move your hands to the color for the muscle you want.</p>
                <ul className="steps">
                  {data.board.map((zone) => (
                    <li key={zone.id}>{zone.color} · {zone.zone}. {zone.hands}.</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="card">
              <strong>How to</strong>
              <ol className="steps">
                {data.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>
            <section className="card">
              <strong>Watch for</strong>
              <ul className="steps">
                {data.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
              </ul>
            </section>
          </div>
          <p style={{ marginTop: 14 }}>
            <a className="text-btn" href={data.youtube} target="_blank" rel="noreferrer">Form videos on YouTube</a>
          </p>
          <section className="card" style={{ marginTop: 8 }}>
            <strong>Add to a workout</strong>
            {addTo ? (
              <button className="btn" type="button" style={{ marginTop: 12 }} disabled={saving === addTo} onClick={() => void add(addTo)}>
                {saving === addTo ? "Adding…" : "Add to this workout"}
              </button>
            ) : null}
            {upcoming.length === 0 && !board.loading ? <p className="muted">No upcoming session yet. Plan one from Train.</p> : null}
            <div className="stack" style={{ marginTop: 10 }}>
              {upcoming.filter((workout) => workout.id !== addTo).map((workout) => (
                <button key={workout.id} className="btn-ghost" type="button" disabled={saving === workout.id} onClick={() => void add(workout.id)}>
                  {saving === workout.id ? "Adding…" : `Add to ${workout.title}`}
                </button>
              ))}
            </div>
          </section>
          <p className="faint" style={{ marginTop: 14 }}>
            Demo frames from {data.source.name} by {data.source.author}, {data.source.license}.{" "}
            <a href={data.source.url} target="_blank" rel="noreferrer">Source</a>
          </p>
        </>
      ) : null}
    </main>
  );
}

function Demo({ images, name }: { images: string[]; name: string }) {
  if (images.length >= 2) {
    return (
      <div className="demo" role="img" aria-label={`${name}, start and finish`}>
        {/* External Unlicense frames. Skip the image optimizer so the crossfade stays two small requests. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="demo-b" src={images[1]} alt="" />
      </div>
    );
  }
  if (images.length === 1) {
    return (
      <div className="demo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt={`${name} position`} />
      </div>
    );
  }
  return null;
}
