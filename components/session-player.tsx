"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { countdownCue, transitionCue, type CueName } from "@/lib/circuit-cues";
import { buildStraightSteps, readSessionPlan, type SessionPlan, type StraightStep } from "@/lib/session-plan";
import type { AppSettings } from "@/lib/types";
import { playCue, setCuePrefs, unlockCue } from "./circuit-cue";
import { useLoad } from "./use-load";
import { PageTitle } from "./ui";

type Actual = { reps: string; weight: string; seconds: string; touched: boolean };
type Detail = { id: string; steps: string[]; images: string[] };

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes <= 0) return String(Math.max(0, seconds));
  return `${minutes}:${String(remain).padStart(2, "0")}`;
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

function blankActuals(plan: SessionPlan): Actual[][] {
  return plan.exercises.map((exercise) =>
    Array.from({ length: exercise.sets }, () => ({
      reps: exercise.reps == null ? "" : String(exercise.reps),
      weight: exercise.weight == null ? "" : String(exercise.weight),
      seconds: exercise.durationSeconds == null ? "" : String(exercise.durationSeconds),
      touched: false,
    })),
  );
}

export function SessionPlayer() {
  const plan = useMemo(() => readSessionPlan(), []);
  const steps = useMemo(() => (plan ? buildStraightSteps(plan.exercises, plan.restSeconds) : []), [plan]);
  const settings = useLoad<AppSettings>("/api/settings");
  const [catalog, setCatalog] = useState<Record<string, Detail>>({});
  const [cursor, setCursor] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(true);
  const [loggedId, setLoggedId] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolume] = useState(70);
  const [actuals, setActuals] = useState<Actual[][]>(() => (plan ? blankActuals(plan) : []));
  const cursorRef = useRef(0);
  const leftRef = useRef(0);
  const runningRef = useRef(true);
  const saved = useRef(false);
  const primed = useRef(false);
  const startedAt = useRef(Date.now());
  const saveAudio = useRef<number | null>(null);
  const audioDraft = useRef<{ enabled: boolean; volume: number } | null>(null);
  const audioTouched = useRef(false);
  const actualsRef = useRef(actuals);
  actualsRef.current = actuals;

  useEffect(() => {
    if (!plan) return;
    const ids = [...new Set(plan.exercises.map((exercise) => exercise.libraryId).filter((id): id is string => Boolean(id)))];
    let gone = false;
    void Promise.all(
      ids.map(async (id) => {
        const detail = await api<Detail>(`/api/exercises/${encodeURIComponent(id)}`);
        return [id, detail] as const;
      }),
    )
      .then((rows) => {
        if (gone) return;
        setCatalog(Object.fromEntries(rows));
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [plan]);

  useEffect(() => {
    if (!settings.data || audioTouched.current) return;
    setSoundOn(settings.data.circuitAudio.enabled);
    setVolume(settings.data.circuitAudio.volume);
    setCuePrefs({ enabled: settings.data.circuitAudio.enabled, volume: settings.data.circuitAudio.volume / 100 });
  }, [settings.data]);

  function persistAudio(enabled: boolean, nextVolume: number) {
    audioTouched.current = true;
    audioDraft.current = { enabled, volume: nextVolume };
    setCuePrefs({ enabled, volume: nextVolume / 100 });
    if (saveAudio.current) window.clearTimeout(saveAudio.current);
    saveAudio.current = window.setTimeout(() => {
      const draft = audioDraft.current;
      audioDraft.current = null;
      if (!draft) return;
      void api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ circuitAudio: draft }),
      }).catch(() => undefined);
    }, 250);
  }

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    async function acquire() {
      try {
        if (!("wakeLock" in navigator) || gone) return;
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* Wake lock is optional. */
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
      if (saveAudio.current) window.clearTimeout(saveAudio.current);
      const draft = audioDraft.current;
      audioDraft.current = null;
      if (draft) {
        void api("/api/settings", {
          method: "PATCH",
          body: JSON.stringify({ circuitAudio: draft }),
        }).catch(() => undefined);
      }
    };
  }, []);

  function patchActual(exercise: number, set: number, patch: Partial<Actual>) {
    const next = actualsRef.current.map((row) => row.map((item) => ({ ...item })));
    const current = next[exercise]?.[set];
    if (!current) return;
    next[exercise][set] = { ...current, ...patch, touched: true };
    actualsRef.current = next;
    setActuals(next);
  }

  function markElapsed() {
    if (!plan) return;
    const step = steps[cursorRef.current];
    if (!step || step.kind !== "work") return;
    const exercise = plan.exercises[step.exercise];
    if (!exercise || exercise.durationSeconds == null || exercise.reps != null) return;
    const row = actualsRef.current[step.exercise]?.[step.set];
    if (!row || row.touched) return;
    const elapsed = leftRef.current <= 0 ? exercise.durationSeconds : Math.max(1, exercise.durationSeconds - leftRef.current);
    const next = actualsRef.current.map((sets) => sets.map((item) => ({ ...item })));
    next[step.exercise][step.set] = { ...row, seconds: String(elapsed) };
    actualsRef.current = next;
    setActuals(next);
  }

  async function finish() {
    if (!plan || saved.current) return;
    saved.current = true;
    setFinishing(true);
    setFinishError(null);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    try {
      const workout = await api<{ id: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: plan.title,
          durationSeconds,
          exercises: plan.exercises.map((exercise, index) => ({
            name: exercise.name,
            libraryId: exercise.libraryId,
            sets: (actualsRef.current[index] ?? []).map((actual) => {
              const timed = exercise.durationSeconds != null && exercise.reps == null;
              return {
                reps: timed ? null : Number(actual.reps === "" ? exercise.reps ?? 0 : actual.reps),
                weight: actual.weight.trim() === "" ? null : Number(actual.weight),
                weightUnit: "lb",
                durationSeconds: timed ? Number(actual.seconds === "" ? exercise.durationSeconds : actual.seconds) : null,
                completed: true,
              };
            }),
          })),
        }),
      });
      setLoggedId(workout.id);
    } catch (err) {
      saved.current = false;
      setFinishError(err instanceof Error ? err.message : "Couldn't log the workout");
    } finally {
      setFinishing(false);
    }
  }

  function go(index: number, cue: CueName | null) {
    if (!plan || !steps.length) return;
    if (index >= steps.length) {
      cursorRef.current = index;
      setCursor(index);
      runningRef.current = false;
      setRunning(false);
      if (cue) playCue(cue);
      void finish();
      return;
    }
    const step = steps[index];
    const exerciseIndex = step.kind === "work" ? step.exercise : step.upcomingExercise;
    const seconds = step.kind === "rest" ? step.seconds : plan.exercises[exerciseIndex]?.durationSeconds ?? 0;
    cursorRef.current = index;
    leftRef.current = seconds;
    setCursor(index);
    setLeft(seconds);
    if (cue) playCue(cue);
  }

  useEffect(() => {
    if (!plan || !steps.length) return;
    if (!primed.current) {
      primed.current = true;
      const first = steps[0];
      const seconds = first.kind === "rest" ? first.seconds : plan.exercises[first.exercise]?.durationSeconds ?? 0;
      leftRef.current = seconds;
      setLeft(seconds);
      unlockCue();
    }
    const timer = window.setInterval(() => {
      if (!runningRef.current) return;
      const step = steps[cursorRef.current];
      if (!step) return;
      const exercise = plan.exercises[step.kind === "work" ? step.exercise : step.upcomingExercise];
      const timed = step.kind === "rest" || Boolean(exercise?.durationSeconds != null && exercise.reps == null);
      if (!timed) return;
      if (leftRef.current <= 1) {
        if (step.kind === "work") markElapsed();
        const finishing = cursorRef.current + 1 >= steps.length;
        go(cursorRef.current + 1, transitionCue(step.kind, finishing, "timer"));
      } else {
        leftRef.current -= 1;
        setLeft(leftRef.current);
        if (countdownCue(leftRef.current)) playCue("tick", leftRef.current);
      }
    }, 1000);
    return () => window.clearInterval(timer);
    // The interval reads the latest step through refs, matching the circuit player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, steps]);

  function togglePause() {
    unlockCue();
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
  }

  function toggleSound() {
    unlockCue();
    const next = !soundOn;
    setSoundOn(next);
    persistAudio(next, volume);
    if (next) playCue("tick", 1);
  }

  if (!plan) {
    return (
      <main className="page player">
        <PageTitle title="Workout" />
        <p className="kicker">Train</p>
        <h1 className="display">Nothing queued</h1>
        <p className="sub">Pick an exercise or build a quick workout, then start it.</p>
        <Link href="/workouts" className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>Back to Train</Link>
      </main>
    );
  }

  const finished = cursor >= steps.length && steps.length > 0;
  const step = steps[cursor];
  const resting = step?.kind === "rest";
  const focusIndex = step ? (step.kind === "work" ? step.exercise : step.upcomingExercise) : 0;
  const focus = plan.exercises[focusIndex];
  const detail = focus?.libraryId ? catalog[focus.libraryId] : undefined;
  const timedWork = Boolean(focus && focus.durationSeconds != null && focus.reps == null);
  const logIndex = step?.kind === "rest" ? step.loggedExercise : step?.exercise ?? 0;
  const logSet = step?.kind === "rest" ? step.loggedSet : step?.set ?? 0;
  const loggedExercise = plan.exercises[logIndex];
  const actual = actuals[logIndex]?.[logSet];
  const logTimed = Boolean(loggedExercise && loggedExercise.durationSeconds != null && loggedExercise.reps == null);

  const soundControls = (
    <div className="player-sound">
      <button type="button" className={`chip ${soundOn ? "on" : ""}`} aria-pressed={soundOn} onClick={toggleSound}>
        {soundOn ? "Sound on" : "Sound off"}
      </button>
      <label className="sound-volume">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          aria-label="Volume"
          onInput={(event) => {
            const next = Number(event.currentTarget.value);
            setVolume(next);
            setCuePrefs({ enabled: soundOn, volume: next / 100 });
          }}
          onChange={(event) => persistAudio(soundOn, Number(event.target.value))}
        />
      </label>
    </div>
  );

  function logFields() {
    if (!actual || !loggedExercise) return null;
    return (
      <div className="session-log">
        {logTimed ? (
          <label className="field">
            <span>Seconds</span>
            <input inputMode="numeric" aria-label="Actual seconds" value={actual.seconds} onChange={(event) => patchActual(logIndex, logSet, { seconds: event.target.value })} />
          </label>
        ) : (
          <label className="field">
            <span>Reps</span>
            <input inputMode="numeric" aria-label="Actual reps" value={actual.reps} onChange={(event) => patchActual(logIndex, logSet, { reps: event.target.value })} />
          </label>
        )}
        <label className="field">
          <span>Weight (lb)</span>
          <input inputMode="decimal" aria-label="Actual weight" placeholder="Bodyweight" value={actual.weight} onChange={(event) => patchActual(logIndex, logSet, { weight: event.target.value })} />
        </label>
      </div>
    );
  }

  function jump(index: number, reason: "back" | "skip") {
    unlockCue();
    if (reason === "skip" && steps[cursor]?.kind === "work") markElapsed();
    go(index, transitionCue(steps[cursor]?.kind === "rest" ? "rest" : "work", index >= steps.length, reason));
  }

  return (
    <main className={`page player${resting ? " player-rest" : ""}`} data-testid="session-player">
      <PageTitle title={plan.title} />
      <div className="player-bar">
        <Link href="/workouts" className="text-btn">End</Link>
        {soundControls}
      </div>
      {finished ? (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="kicker">Done</p>
          <h1 className="display player-title">{plan.title}</h1>
          <p className="sub">{finishing ? "Saving it to history…" : "Logged as a completed workout."}</p>
          {finishError ? <p className="err">{finishError}</p> : null}
          {finishError ? (
            <button className="btn" type="button" onClick={() => void finish()}>Try again</button>
          ) : null}
          {loggedId ? (
            <Link href={`/workouts/${loggedId}`} className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>
              View workout
            </Link>
          ) : null}
          <Link href="/workouts" className="btn-ghost" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
            Back to Train
          </Link>
        </section>
      ) : null}
      {step && focus && resting ? (
        <RestScreen
          step={step}
          focus={focus}
          plan={plan}
          left={left}
          running={running}
          images={detail?.images ?? []}
          stepsText={detail?.steps ?? []}
          onPause={togglePause}
          onAddRest={() => {
            unlockCue();
            leftRef.current += 15;
            setLeft(leftRef.current);
          }}
          onBack={() => {
            let index = cursor - 1;
            while (index > 0 && steps[index]?.kind === "rest") index -= 1;
            if (index >= 0) jump(index, "back");
          }}
          onSkip={() => jump(cursor + 1, "skip")}
          backDisabled={cursor === 0}
          logFields={logFields()}
        />
      ) : null}
      {step && focus && !resting && step.kind === "work" ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>
            {`Set ${step.set + 1} of ${focus.sets} · ${step.exercise + 1} of ${plan.exercises.length}`}
          </p>
          <h1 className="display player-title">{focus.name}</h1>
          <Demo images={detail?.images ?? []} name={focus.name} />
          {timedWork ? (
            <p className="timer-readout" aria-live="polite">{clock(left)}</p>
          ) : (
            <p className="timer-readout" aria-live="polite">{focus.reps}</p>
          )}
          <p className="muted timer-caption">{timedWork ? "Hold" : "Reps · tap Done set when you finish"}</p>
          {logFields()}
          <button
            className="btn"
            type="button"
            data-testid="done-set"
            style={{ marginTop: 12 }}
            onClick={() => {
              unlockCue();
              markElapsed();
              go(cursor + 1, transitionCue("work", cursor + 1 >= steps.length, "done"));
            }}
          >
            Done set
          </button>
          <div className="player-actions">
            <button className="btn-ghost" type="button" disabled={cursor === 0} onClick={() => {
              let index = cursor - 1;
              while (index > 0 && steps[index]?.kind === "rest") index -= 1;
              if (index >= 0) jump(index, "back");
            }}>Back</button>
            <button className="btn-ghost" type="button" onClick={togglePause}>{running ? "Pause" : "Resume"}</button>
            <button className="btn-ghost" type="button" onClick={() => jump(cursor + 1, "skip")}>Skip</button>
          </div>
          {detail?.steps.length ? (
            <section className="card">
              <strong>How to</strong>
              <ol className="steps">
                {detail.steps.slice(0, 4).map((line) => <li key={line}>{line}</li>)}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function RestScreen({
  step,
  focus,
  plan,
  left,
  running,
  images,
  stepsText,
  onPause,
  onAddRest,
  onBack,
  onSkip,
  backDisabled,
  logFields,
}: {
  step: Extract<StraightStep, { kind: "rest" }>;
  focus: SessionPlan["exercises"][number];
  plan: SessionPlan;
  left: number;
  running: boolean;
  images: string[];
  stepsText: string[];
  onPause: () => void;
  onAddRest: () => void;
  onBack: () => void;
  onSkip: () => void;
  backDisabled: boolean;
  logFields: ReactNode;
}) {
  const sameExercise = step.loggedExercise === step.upcomingExercise;
  return (
    <>
      <p className="kicker" style={{ marginTop: 8 }}>{sameExercise ? "Rest · next set" : "Rest · up next"}</p>
      <h1 className="display player-title">{focus.name}</h1>
      <p className="rest-dose">
        <span className="faint">
          {focus.durationSeconds != null && focus.reps == null ? `${focus.durationSeconds}s` : `${focus.reps} reps`}
          {` · set ${step.upcomingSet + 1} of ${focus.sets}`}
        </span>
      </p>
      <Demo images={images} name={focus.name} />
      <p className="timer-readout" aria-live="polite">{clock(left)}</p>
      <p className="muted timer-caption">Rest</p>
      <div className="player-actions quad">
        <button className="btn-ghost" type="button" disabled={backDisabled} onClick={onBack}>Back</button>
        <button className="btn-ghost" type="button" onClick={onPause}>{running ? "Pause" : "Resume"}</button>
        <button className="btn-ghost" type="button" onClick={onAddRest}>+15s</button>
        <button className="btn-ghost" type="button" onClick={onSkip}>Skip</button>
      </div>
      <section className="card rest-steps">
        <strong>This set</strong>
        <p className="faint" style={{ margin: "4px 0 0" }}>{plan.exercises[step.loggedExercise]?.name}</p>
        {logFields}
      </section>
      {stepsText.length ? (
        <section className="card">
          <strong>How to</strong>
          <ol className="steps">
            {stepsText.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </section>
      ) : null}
    </>
  );
}
