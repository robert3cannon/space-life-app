"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { muscleLabel } from "@/lib/muscles";
import { getZonedParts } from "@/lib/time";
import { BodyMap } from "./body-map";
import { unlockCue } from "./circuit-cue";
import { useToast } from "./toast";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Level = "beginner" | "intermediate";
type Work = { reps: number | null; seconds: number | null };
type Station = {
  libraryId: string;
  name: string;
  equipment: string;
  steps: string[];
  work: Record<Level, Work>;
};
type Detail = {
  id: string;
  name: string;
  summary: string;
  exerciseCount: number;
  rounds: Record<Level, number>;
  durationMinutes: Record<Level, number>;
  restSeconds: Record<Level, { exercise: number; round: number }>;
  primary: string[];
  secondary: string[];
  stations: Station[];
};

function estimateMinutes(data: Detail, level: Level, rounds: number) {
  const rest = data.restSeconds[level];
  const work = data.stations.reduce((sum, station) => {
    const dose = station.work[level];
    return sum + (dose.seconds ?? (dose.reps ?? 0) * 3);
  }, 0);
  const exerciseRests = Math.max(0, data.stations.length - 1) * rest.exercise;
  const total = rounds * (work + exerciseRests) + Math.max(0, rounds - 1) * rest.round;
  return Math.max(1, Math.round(total / 60));
}

function doseLabel(work: Work) {
  if (work.seconds != null) return `${work.seconds}s`;
  if (work.reps != null) return `${work.reps} reps`;
  return "";
}

export function CircuitDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad<Detail>(`/api/circuits/${encodeURIComponent(id)}`);
  const [level, setLevel] = useState<Level>("beginner");
  const [rounds, setRounds] = useState<number | null>(null);
  const [date, setDate] = useState(() => getZonedParts(new Date()).date);
  const [time, setTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const chosenRounds = rounds ?? data?.rounds[level] ?? 2;

  function chooseLevel(next: Level) {
    setLevel(next);
    setRounds(null);
  }

  async function schedule() {
    setSaving(true);
    setFormError(null);
    try {
      await api(`/api/circuits/${encodeURIComponent(id)}/schedule`, {
        method: "POST",
        body: JSON.stringify({ date, time, difficulty: level, rounds: chosenRounds }),
      });
      toast("Saved to your day");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const rest = data?.restSeconds[level];

  return (
    <main className="page">
      <PageTitle title={data?.name ?? "Circuit"} />
      <Link href="/circuits" className="text-btn">Circuits</Link>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data && rest ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>Circuit</p>
          <h1 className="display">{data.name}</h1>
          <p className="sub">{data.summary}</p>
          <BodyMap primary={data.primary} secondary={data.secondary} label={`${data.name} muscles`} />
          <p className="faint">
            {data.primary.map(muscleLabel).join(", ")}
            {data.secondary.length ? ` · also ${data.secondary.map(muscleLabel).join(", ")}` : ""}
          </p>
          <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Difficulty">
            {(["beginner", "intermediate"] as Level[]).map((value) => (
              <button key={value} type="button" className={`chip ${level === value ? "on" : ""}`} onClick={() => chooseLevel(value)}>
                {value === "beginner" ? "Beginner" : "Intermediate"}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Rounds">
            {[2, 3, 4].map((value) => (
              <button key={value} type="button" className={`chip ${chosenRounds === value ? "on" : ""}`} onClick={() => setRounds(value)}>
                {value} rounds
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            About {estimateMinutes(data, level, chosenRounds)} min · {rest.exercise}s between exercises · {rest.round}s between rounds.
          </p>
          <div className="stack" style={{ marginTop: 14 }}>
            {data.stations.map((station, index) => (
              <Link key={station.libraryId} href={`/exercises/${encodeURIComponent(station.libraryId)}`} className="card circuit-step">
                <span className="step-index">{index + 1}</span>
                <span>
                  <strong>{station.name}</strong>
                  <span className="faint">{doseLabel(station.work[level])} · {station.equipment}</span>
                </span>
              </Link>
            ))}
          </div>
          <button
            className="btn"
            type="button"
            style={{ marginTop: 16 }}
            onClick={() => {
              unlockCue();
              router.push(`/circuits/${encodeURIComponent(id)}/play?difficulty=${level}&rounds=${chosenRounds}`);
            }}
          >
            Start
          </button>
          <section className="card" style={{ marginTop: 16 }}>
            <strong>Save to a day</strong>
            <p className="faint" style={{ margin: "6px 0 0" }}>It shows on Today and Schedule, with the usual workout reminder.</p>
            <form onSubmit={(event) => { event.preventDefault(); void schedule(); }}>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <label className="field"><span>Day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label className="field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
              </div>
              {formError ? <p className="err">{formError}</p> : null}
              <button className="btn-ghost" type="submit" disabled={saving}>{saving ? "Saving…" : "Add to my day"}</button>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
