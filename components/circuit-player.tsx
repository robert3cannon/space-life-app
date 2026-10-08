"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { playCue, unlockCue } from "./circuit-cue";
import { useLoad } from "./use-load";
import { ErrorNote, Loading, PageTitle } from "./ui";

type Level = "beginner" | "intermediate";
type Work = { reps: number | null; seconds: number | null };
type Station = {
  libraryId: string;
  name: string;
  steps: string[];
  images: string[];
  note: string;
  work: Record<Level, Work>;
};
type Detail = {
  id: string;
  name: string;
  restSeconds: Record<Level, { exercise: number; round: number }>;
  stations: Station[];
};
type WorkStep = { kind: "work"; round: number; index: number };
type RestStep = { kind: "rest"; seconds: number; upcomingRound: number; upcomingIndex: number; betweenRounds: boolean };
type Step = WorkStep | RestStep;

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes <= 0) return String(Math.max(0, seconds));
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function buildSteps(data: Detail, level: Level, rounds: number): Step[] {
  const rest = data.restSeconds[level];
  const steps: Step[] = [];
  for (let round = 0; round < rounds; round += 1) {
    data.stations.forEach((_, index) => {
      steps.push({ kind: "work", round, index });
      const lastStation = index === data.stations.length - 1;
      const lastRound = round === rounds - 1;
      if (lastStation && lastRound) return;
      if (lastStation) {
        steps.push({
          kind: "rest",
          seconds: rest.round,
          upcomingRound: round + 1,
          upcomingIndex: 0,
          betweenRounds: true,
        });
      } else {
        steps.push({
          kind: "rest",
          seconds: rest.exercise,
          upcomingRound: round,
          upcomingIndex: index + 1,
          betweenRounds: false,
        });
      }
    });
  }
  return steps;
}

function Demo({ images, name }: { images: string[]; name: string }) {
  if (images.length >= 2) {
    return (
      <div className="demo" role="img" aria-label={`${name}, start and finish`}>
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

export function CircuitPlayer({ id }: { id: string }) {
  const params = useSearchParams();
  const level: Level = params.get("difficulty") === "intermediate" ? "intermediate" : "beginner";
  const requestedRounds = Number(params.get("rounds"));
  const { data, error, loading, reload } = useLoad<Detail>(`/api/circuits/${encodeURIComponent(id)}`);
  const rounds = Number.isInteger(requestedRounds) && requestedRounds >= 1 && requestedRounds <= 5
    ? requestedRounds
    : level === "intermediate" ? 3 : 2;
  const steps = useMemo(() => (data ? buildSteps(data, level, rounds) : []), [data, level, rounds]);
  const [cursor, setCursor] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(true);
  const [loggedId, setLoggedId] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const cursorRef = useRef(0);
  const leftRef = useRef(0);
  const runningRef = useRef(true);
  const saved = useRef(false);
  const primed = useRef(false);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    async function acquire() {
      try {
        if (!("wakeLock" in navigator) || gone) return;
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* Wake lock is optional. Older iOS ignores it. */
      }
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  async function finish() {
    if (saved.current) return;
    saved.current = true;
    setFinishing(true);
    setFinishError(null);
    try {
      const workout = await api<{ id: string }>(`/api/circuits/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        body: JSON.stringify({ difficulty: level, rounds }),
      });
      setLoggedId(workout.id);
    } catch (err) {
      saved.current = false;
      setFinishError(err instanceof Error ? err.message : "Couldn't log the workout");
    } finally {
      setFinishing(false);
    }
  }

  function go(index: number, cue: boolean) {
    if (!steps.length) return;
    if (index >= steps.length) {
      cursorRef.current = index;
      setCursor(index);
      runningRef.current = false;
      setRunning(false);
      if (cue) playCue();
      void finish();
      return;
    }
    const step = steps[index];
    const station = data?.stations[step.kind === "work" ? step.index : step.upcomingIndex];
    const seconds = step.kind === "rest"
      ? step.seconds
      : station?.work[level].seconds ?? 0;
    cursorRef.current = index;
    leftRef.current = seconds;
    setCursor(index);
    setLeft(seconds);
    if (cue) playCue();
  }

  useEffect(() => {
    if (!steps.length || !data) return;
    if (!primed.current) {
      primed.current = true;
      const first = steps[0];
      const station = data.stations[first.kind === "work" ? first.index : first.upcomingIndex];
      const seconds = first.kind === "rest" ? first.seconds : station.work[level].seconds ?? 0;
      leftRef.current = seconds;
      setLeft(seconds);
      unlockCue();
    }
    const timer = window.setInterval(() => {
      if (!runningRef.current) return;
      const step = steps[cursorRef.current];
      if (!step) return;
      const station = data?.stations[step.kind === "work" ? step.index : 0];
      const timed = step.kind === "rest" || Boolean(station?.work[level].seconds);
      if (!timed) return;
      if (leftRef.current <= 1) go(cursorRef.current + 1, true);
      else {
        leftRef.current -= 1;
        setLeft(leftRef.current);
      }
    }, 1000);
    return () => window.clearInterval(timer);
    // go closes over the latest steps via the interval recreated when steps or level change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, data, level]);

  function togglePause() {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
  }

  const finished = cursor >= steps.length && steps.length > 0;
  const step = steps[cursor];
  const station = data && step
    ? data.stations[step.kind === "work" ? step.index : step.upcomingIndex]
    : null;
  const work = station?.work[level];
  const timedWork = Boolean(work?.seconds);
  const upNext = (() => {
    if (!data || !step) return null;
    if (step.kind === "rest") return data.stations[step.upcomingIndex];
    const following = steps.slice(cursor + 1).find((item) => item.kind === "work");
    return following && following.kind === "work" ? data.stations[following.index] : null;
  })();

  return (
    <main className="page player">
      <PageTitle title={data ? `${data.name} circuit` : "Circuit"} />
      <Link href={`/circuits/${encodeURIComponent(id)}`} className="text-btn">End</Link>
      {loading && !data ? <Loading rows={2} /> : null}
      {error ? <ErrorNote message={error} onRetry={reload} /> : null}
      {data && finished ? (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="kicker">Done</p>
          <h1 className="display player-title">{data.name}</h1>
          <p className="sub">{finishing ? "Saving it to history…" : "Logged as a completed workout."}</p>
          {finishError ? <p className="err">{finishError}</p> : null}
          {finishError ? <button className="btn" type="button" onClick={() => void finish()}>Try again</button> : null}
          {loggedId ? <Link href={`/workouts/${loggedId}`} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>View workout</Link> : null}
          <Link href="/workouts" className="btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>Back to Train</Link>
        </section>
      ) : null}
      {data && step && station && work ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>
            {step.kind === "rest"
              ? step.betweenRounds ? "Rest · next round" : "Rest"
              : `Round ${step.round + 1} of ${rounds} · ${step.index + 1} of ${data.stations.length}`}
          </p>
          <h1 className="display player-title">{step.kind === "rest" ? "Rest" : station.name}</h1>
          {step.kind === "work" && station.note ? <p className="sub station-cue">{station.note}</p> : null}
          {step.kind === "work" ? <Demo images={station.images} name={station.name} /> : null}
          {step.kind === "rest" || timedWork ? (
            <p className="timer-readout" aria-live="polite">{clock(left)}</p>
          ) : (
            <p className="timer-readout" aria-live="polite">{work.reps}</p>
          )}
          <p className="muted timer-caption">
            {step.kind === "rest" ? "Breathe. Next one is coming up." : timedWork ? "Work" : "Reps · tap Done when you finish"}
          </p>
          {step.kind === "work" && !timedWork ? (
            <button className="btn" type="button" onClick={() => go(cursor + 1, true)}>Done</button>
          ) : null}
          <div className="player-actions">
            <button className="btn-ghost" type="button" disabled={cursor === 0} onClick={() => {
              let index = cursor - 1;
              while (index > 0 && steps[index]?.kind === "rest") index -= 1;
              if (index >= 0) go(index, false);
            }}>Back</button>
            <button className="btn-ghost" type="button" onClick={togglePause}>{running ? "Pause" : "Resume"}</button>
            <button className="btn-ghost" type="button" onClick={() => go(cursor + 1, true)}>Skip</button>
          </div>
          {upNext ? (
            <section className="card up-next">
              <p className="kicker">{step.kind === "rest" && step.betweenRounds ? "Next round" : "Up next"}</p>
              <strong>{upNext.name}</strong>
              <span className="faint">{upNext.work[level].seconds != null ? `${upNext.work[level].seconds}s` : `${upNext.work[level].reps} reps`}</span>
              {upNext.note ? <span className="station-note">{upNext.note}</span> : null}
            </section>
          ) : null}
          {step.kind === "work" && station.steps.length ? (
            <section className="card">
              <strong>How to</strong>
              <ol className="steps">
                {station.steps.slice(0, 4).map((line) => <li key={line}>{line}</li>)}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
