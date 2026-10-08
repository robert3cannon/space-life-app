import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { POST as login } from "../app/api/auth/login/route";
import { GET as botList, } from "../app/api/bot/circuits/route";
import { GET as botOne } from "../app/api/bot/circuits/[id]/route";
import { POST as botSchedule } from "../app/api/bot/circuits/[id]/schedule/route";
import { POST as completeCircuitRoute } from "../app/api/circuits/[id]/complete/route";
import { closeDb } from "../lib/db";
import {
  CIRCUITS,
  assertCircuitCatalog,
  circuitDurationSeconds,
  getCircuit,
} from "../lib/circuits";
import { getExercise } from "../lib/exercises";
import { isMuscleId } from "../lib/muscles";
import { listReminders } from "../lib/services/reminders";
import { muscleCoverage } from "../lib/services/workouts";
import { migrate } from "../scripts/migrate";
import { getSql } from "../lib/db";

const ctx = undefined as never;
const bot = { authorization: "Bearer test-bot-token-value" };
const names = [
  "Lower Abs",
  "Upper Abs",
  "Full Abs",
  "Obliques",
  "Arms",
  "Chest & Shoulders",
  "Back",
  "Legs & Glutes",
  "Full Body",
];

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

async function sessionCookie() {
  const right = await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "test-passcode" }),
    }),
  );
  const cookie = right.headers.get("set-cookie") ?? "";
  const token = cookie.split(";")[0]?.split("=")[1];
  assert.ok(token);
  return `orbit_session=${token}`;
}

describe("circuits", () => {
  before(async () => {
    await migrate();
    await reset();
  });

  after(async () => {
    await closeDb();
  });

  it("keeps every circuit pointed at real exercises and muscles", () => {
    assert.deepEqual(assertCircuitCatalog(), []);
    for (const name of names) {
      assert.ok(CIRCUITS.some((circuit) => circuit.name === name), name);
    }
    for (const circuit of CIRCUITS) {
      assert.ok(circuit.primary.length > 0, circuit.id);
      assert.ok(circuitDurationSeconds(circuit, "beginner") > 0);
      assert.ok(circuitDurationSeconds(circuit, "intermediate") > circuitDurationSeconds(circuit, "beginner"));
      for (const station of circuit.stations) {
        const exercise = getExercise(station.libraryId);
        assert.ok(exercise, station.libraryId);
        assert.ok(exercise.steps.length > 0);
        assert.equal(exercise.images.length, 2);
        for (const muscle of [...exercise.primary, ...exercise.secondary, ...circuit.primary, ...circuit.secondary]) {
          assert.equal(isMuscleId(muscle), true, muscle);
        }
      }
    }
    const lower = getCircuit("lower-abs");
    assert.ok(lower);
    assert.equal(lower.primary.includes("lower_abs"), true);
    assert.ok(lower.stations.every((station) => getExercise(station.libraryId)?.primary.includes("lower_abs") || getExercise(station.libraryId)?.secondary.includes("lower_abs")));
  });

  it("lists and reads circuits for the bot", async () => {
    const denied = await botList(new Request("http://localhost/api/bot/circuits"), ctx);
    assert.equal(denied.status, 401);

    const badMuscle = await botList(
      new Request("http://localhost/api/bot/circuits?muscle=abs", { headers: bot }),
      ctx,
    );
    assert.equal(badMuscle.status, 400);

    const listed = await botList(
      new Request("http://localhost/api/bot/circuits?muscle=lower_abs", { headers: bot }),
      ctx,
    );
    assert.equal(listed.status, 200);
    const body = await listed.json();
    const ids = body.circuits.map((circuit: { id: string }) => circuit.id);
    assert.ok(ids.includes("lower-abs"));
    assert.equal(ids.includes("chest-shoulders"), false);
    assert.ok(body.circuits.every((circuit: { exerciseCount: number; primary: string[] }) => circuit.exerciseCount > 0 && circuit.primary.length > 0));

    const missing = await botOne(
      new Request("http://localhost/api/bot/circuits/nope", { headers: bot }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    assert.equal(missing.status, 404);

    const one = await botOne(
      new Request("http://localhost/api/bot/circuits/lower-abs", { headers: bot }),
      { params: Promise.resolve({ id: "lower-abs" }) },
    );
    assert.equal(one.status, 200);
    const detail = await one.json();
    assert.equal(detail.name, "Lower Abs");
    assert.equal(detail.stations.length, getCircuit("lower-abs")?.stations.length);
    assert.ok(detail.stations[0].steps.length > 0);
    assert.ok(String(detail.stations[0].images[0]).includes(".jpg"));
    assert.equal(detail.restSeconds.beginner.exercise, 20);
    assert.ok(detail.durationMinutes.beginner >= 1);
  });

  it("schedules a circuit onto a day with a workout reminder", async () => {
    const denied = await botSchedule(
      new Request("http://localhost/api/bot/circuits/lower-abs/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-12-01", time: "18:00" }),
      }),
      { params: Promise.resolve({ id: "lower-abs" }) },
    );
    assert.equal(denied.status, 401);

    const bad = await botSchedule(
      new Request("http://localhost/api/bot/circuits/lower-abs/schedule", {
        method: "POST",
        headers: { ...bot, "content-type": "application/json" },
        body: JSON.stringify({ time: "18:00" }),
      }),
      { params: Promise.resolve({ id: "lower-abs" }) },
    );
    assert.equal(bad.status, 400);

    const scheduled = await botSchedule(
      new Request("http://localhost/api/bot/circuits/arms/schedule", {
        method: "POST",
        headers: { ...bot, "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-12-01", time: "18:00", difficulty: "intermediate", rounds: 3 }),
      }),
      { params: Promise.resolve({ id: "arms" }) },
    );
    assert.equal(scheduled.status, 201);
    const workout = await scheduled.json();
    assert.equal(workout.title, "Arms");
    assert.equal(workout.status, "planned");
    assert.equal(workout.reminderMinutesBefore, 30);
    assert.match(workout.notes, /Intermediate/);
    assert.equal(workout.exercises.length, getCircuit("arms")?.stations.length);
    assert.ok(workout.exercises.every((exercise: { libraryId: string; sets: { completed: boolean; reps: number | null }[] }) => {
      return Boolean(getExercise(exercise.libraryId)) && exercise.sets.length === 3 && exercise.sets.every((set) => set.completed === false && set.reps != null);
    }));
    const reminders = await listReminders();
    assert.ok(reminders.upcoming.some((reminder) => reminder.kind === "workout" && reminder.relatedId === workout.id));
  });

  it("logs a finished circuit as a done workout that counts for coverage", async () => {
    const cookie = await sessionCookie();
    const denied = await completeCircuitRoute(
      new Request("http://localhost/api/circuits/lower-abs/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ difficulty: "beginner", rounds: 2 }),
      }),
      { params: Promise.resolve({ id: "lower-abs" }) },
    );
    assert.equal(denied.status, 401);

    const done = await completeCircuitRoute(
      new Request("http://localhost/api/circuits/lower-abs/complete", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ difficulty: "beginner", rounds: 2 }),
      }),
      { params: Promise.resolve({ id: "lower-abs" }) },
    );
    assert.equal(done.status, 201);
    const workout = await done.json();
    assert.equal(workout.status, "done");
    assert.equal(workout.title, "Lower Abs");
    assert.ok(workout.completedAt);
    assert.equal(workout.exercises.length, getCircuit("lower-abs")?.stations.length);
    for (const exercise of workout.exercises) {
      assert.equal(getExercise(exercise.libraryId)?.id, exercise.libraryId);
      assert.equal(exercise.sets.length, 2);
      assert.ok(exercise.sets.every((set: { completed: boolean }) => set.completed));
    }
    const coverage = await muscleCoverage();
    assert.ok(coverage.primary.includes("lower_abs"));
  });
});
