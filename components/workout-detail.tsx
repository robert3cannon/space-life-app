"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { formatDuration, formatTime, formatWeight, formatLongDate, eventDay } from "@/lib/format";
import type { WorkoutDto } from "@/lib/types";
import { BodyMap } from "./body-map";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

export function WorkoutDetail({ id }: { id: string }) {
  const { data, error, loading, reload, setData } = useLoad<WorkoutDto>(`/api/workouts/${id}`);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function toggle(setId: string, completed: boolean) {
    if (!data) return;
    const next = {
      ...data,
      exercises: data.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => (set.id === setId ? { ...set, completed } : set)),
      })),
    };
    setData(next);
    try {
      const saved = await api<WorkoutDto>(`/api/workouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ setCompleted: { setId, completed } }),
      });
      setData(saved);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update the set");
      await reload();
    }
  }

  async function setStatus(status: "done" | "planned" | "skipped") {
    setBusy(true);
    try {
      const saved = await api<WorkoutDto>(`/api/workouts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setData(saved);
      toast(status === "done" ? "Marked done" : status === "skipped" ? "Skipped" : "Back to planned");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <PageTitle title={data?.title ?? "Workout"} />
      <Link href="/workouts" className="text-btn">Back</Link>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>{data.status}</p>
          <h1 className="display" style={{ fontSize: 32 }}>{data.title}</h1>
          <p className="sub">
            {data.scheduledAt ? `${formatLongDate(eventDay(data.scheduledAt))} · ${formatTime(data.scheduledAt)}` : "Unscheduled"}
          </p>
          <BodyMap primary={data.muscles.primary} secondary={data.muscles.secondary} label={`${data.title} muscles`} />
          <div className="stack" style={{ marginTop: 16 }}>
            {data.exercises.map((exercise) => (
              <section key={exercise.id} className="card">
                {exercise.catalogId ? (
                  <Link href={`/exercises/${encodeURIComponent(exercise.catalogId)}`}><strong>{exercise.name}</strong></Link>
                ) : <strong>{exercise.name}</strong>}
                <div className="stack" style={{ marginTop: 8 }}>
                  {exercise.sets.map((set, index) => (
                    <button key={set.id} type="button" className={`check ${set.completed ? "on" : ""}`} onClick={() => void toggle(set.id, !set.completed)}>
                      <i>{set.completed ? "✓" : ""}</i>
                      <span>
                        Set {index + 1}
                        <span className="faint">
                          {" "}
                          {[set.reps != null ? `${set.reps} reps` : "", formatWeight(set.weight, set.weightUnit), formatDuration(set.durationSeconds)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {data.notes ? <p className="muted">{data.notes}</p> : null}
          <Link href={`/exercises?addTo=${data.id}`} className="btn-ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>Add from library</Link>
          <div className="stack" style={{ marginTop: 16 }}>
            {data.status !== "done" ? <button className="btn" type="button" disabled={busy} onClick={() => void setStatus("done")}>Mark done</button> : null}
            {data.status === "done" ? <button className="btn-ghost" type="button" disabled={busy} onClick={() => void setStatus("planned")}>Mark as not done</button> : null}
            {data.status === "planned" ? <button className="btn-ghost" type="button" disabled={busy} onClick={() => void setStatus("skipped")}>Skip</button> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
