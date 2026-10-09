import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { POST as login } from "../app/api/auth/login/route";
import { GET as botList, } from "../app/api/bot/circuits/route";
import { GET as botOne } from "../app/api/bot/circuits/[id]/route";
import { POST as botSchedule } from "../app/api/bot/circuits/[id]/schedule/route";
import { POST as completeCircuitRoute } from "../app/api/circuits/[id]/complete/route";
import { closeDb } from "../lib/db";
import { GET as botExercises } from "../app/api/bot/exercises/route";
import { GET as botSettings } from "../app/api/bot/settings/route";
import {
  CIRCUITS,
  assertCircuitCatalog,
  circuitDurationSeconds,
  circuitFits,
  circuitTargetRating,
  getCircuit,
  stationCue,
} from "../lib/circuits";
import { DEFAULT_EQUIPMENT } from "../lib/equipment";
import { getExercise } from "../lib/exercises";
import { isMuscleId } from "../lib/muscles";
import { listReminders } from "../lib/services/reminders";
import { getSettings, updateSettings } from "../lib/services/settings";
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
  "Dumbbell Arms",
  "Dumbbell Shoulders",
  "Chest",
  "Upper Chest",
  "Lower Chest",
  "Push-up Board",
  "Chest & Shoulders",
  "Back",
  "Legs & Glutes",
  "Full Body",
  "Dumbbell Full Body",
];

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
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
    assert.deepEqual(circuitTargetRating(lower), { average: 3.8, muscle: "lower_abs" });
    const chest = getCircuit("chest");
    const upperChest = getCircuit("upper-chest");
    const lowerChest = getCircuit("lower-chest");
    assert.ok(chest && upperChest && lowerChest);
    assert.deepEqual(chest.primary, ["mid_chest", "upper_chest", "lower_chest"]);
    assert.deepEqual(upperChest.primary, ["upper_chest"]);
    assert.deepEqual(lowerChest.primary, ["lower_chest"]);
    for (const id of ["Pushups", "Incline_Push-Up", "Decline_Push-Up", "Dumbbell_Bench_Press"]) {
      assert.ok(chest.stations.some((station) => station.libraryId === id), id);
    }
    assert.ok(lower.stations.every((station) => getExercise(station.libraryId)?.primary.includes("lower_abs") || getExercise(station.libraryId)?.secondary.includes("lower_abs")));
    assert.equal(CIRCUITS.some((circuit) => /backpack/i.test(circuit.summary)), false);
    const board = getCircuit("pushup-board");
    assert.ok(board);
    assert.deepEqual(board.stations.map((station) => station.board), ["chest", "shoulders", "back", "triceps"]);
    assert.ok(board.stations.every((station) => station.libraryId === "Pushups"));
    assert.match(stationCue(board.stations[0], DEFAULT_EQUIPMENT), /Blue/);
    assert.match(stationCue(board.stations[0], DEFAULT_EQUIPMENT), /Chest/);
    const curl = getCircuit("dumbbell-arms")?.stations.find((station) => station.libraryId === "Dumbbell_Bicep_Curl");
    const press = chest.stations.find((station) => station.libraryId === "Dumbbell_Bench_Press");
    assert.ok(curl && (curl.reps ?? 0) >= 15);
    assert.ok(press && (press.reps ?? 0) >= 12);
    assert.match(stationCue(curl, DEFAULT_EQUIPMENT), /15 lb/);
    const dumbbellArms = getCircuit("dumbbell-arms");
    const pushupBoard = getCircuit("pushup-board");
    assert.ok(dumbbellArms && pushupBoard);
    assert.equal(circuitFits(dumbbellArms, ["bodyweight", "pushup_board"]), false);
    assert.equal(circuitFits(pushupBoard, ["bodyweight", "dumbbells"]), false);
    assert.equal(circuitFits(lower, ["bodyweight"]), true);
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
    assert.equal(ids.includes("chest"), false);
    const upper = await botList(
      new Request("http://localhost/api/bot/circuits?muscle=upper_chest", { headers: bot }),
      ctx,
    );
    const upperIds = (await upper.json()).circuits.map((circuit: { id: string }) => circuit.id);
    assert.ok(upperIds.includes("upper-chest"));
    assert.ok(upperIds.includes("chest"));
    assert.equal(upperIds.includes("lower-chest"), false);
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

  it("defaults home equipment and filters circuits and the library", async () => {
    const settingsResponse = await botSettings(new Request("http://localhost/api/bot/settings", { headers: bot }), ctx);
    assert.equal(settingsResponse.status, 200);
    const settingsBody = await settingsResponse.json();
    assert.deepEqual(settingsBody.equipment.gear, ["bodyweight", "pushup_board", "dumbbells"]);
    assert.equal(settingsBody.equipment.dumbbellLb, 15);
    assert.equal(settingsBody.equipment.dumbbellCount, 2);

    const listed = await botList(new Request("http://localhost/api/bot/circuits", { headers: bot }), ctx);
    const ids = (await listed.json()).circuits.map((circuit: { id: string }) => circuit.id);
    for (const id of ["pushup-board", "dumbbell-arms", "dumbbell-shoulders", "dumbbell-full-body"]) {
      assert.ok(ids.includes(id), id);
    }

    const boardResponse = await botOne(
      new Request("http://localhost/api/bot/circuits/pushup-board", { headers: bot }),
      { params: Promise.resolve({ id: "pushup-board" }) },
    );
    const board = await boardResponse.json();
    assert.match(board.stations[0].note, /Blue/);
    assert.match(board.stations[0].note, /Chest/);
    assert.match(board.stations[1].note, /Red/);
    assert.match(board.stations[2].note, /Yellow/);
    assert.match(board.stations[3].note, /Green/);
    assert.ok(board.stations.every((station: { libraryId: string; images: string[] }) => station.libraryId === "Pushups" && station.images[0].includes("Pushups")));

    const armsResponse = await botOne(
      new Request("http://localhost/api/bot/circuits/dumbbell-arms", { headers: bot }),
      { params: Promise.resolve({ id: "dumbbell-arms" }) },
    );
    const arms = await armsResponse.json();
    assert.match(arms.stations[0].note, /15 lb/);
    assert.ok(arms.stations[0].work.beginner.reps >= 15);

    await updateSettings({ equipment: { gear: ["bodyweight", "pushup_board"], dumbbellLb: 15, dumbbellCount: 2 } });
    const filtered = await botList(new Request("http://localhost/api/bot/circuits", { headers: bot }), ctx);
    const filteredIds = (await filtered.json()).circuits.map((circuit: { id: string }) => circuit.id);
    assert.equal(filteredIds.includes("dumbbell-arms"), false);
    assert.equal(filteredIds.includes("chest"), false);
    assert.ok(filteredIds.includes("pushup-board"));
    assert.ok(filteredIds.includes("lower-abs"));

    const barbell = await botExercises(
      new Request("http://localhost/api/bot/exercises?equipment=barbell", { headers: bot }),
      ctx,
    );
    assert.equal((await barbell.json()).count, 0);
    const owned = await botExercises(new Request("http://localhost/api/bot/exercises?limit=200", { headers: bot }), ctx);
    const ownedBody = await owned.json();
    assert.ok(ownedBody.exercises.every((exercise: { equipment: string }) => exercise.equipment === "bodyweight" || exercise.equipment === "dumbbell"));
    const full = await botExercises(
      new Request("http://localhost/api/bot/exercises?limit=200&all=1", { headers: bot }),
      ctx,
    );
    assert.ok((await full.json()).exercises.some((exercise: { equipment: string }) => exercise.equipment === "barbell"));
    const unknown = await botExercises(
      new Request("http://localhost/api/bot/exercises?equipment=foam", { headers: bot }),
      ctx,
    );
    assert.equal(unknown.status, 400);

    const restored = await updateSettings({ equipment: DEFAULT_EQUIPMENT });
    assert.deepEqual((await getSettings()).equipment, restored.equipment);
    assert.deepEqual(restored.equipment.gear, DEFAULT_EQUIPMENT.gear);
  });

  it("stores circuit sound preferences and fills a missing key", async () => {
    const first = await getSettings();
    assert.equal(first.circuitAudio.enabled, true);
    assert.equal(first.circuitAudio.volume, 70);
    const sql = getSql();
    await sql`update settings set value = value - 'circuitAudio' where key = 'app'`;
    const filled = await getSettings();
    assert.deepEqual(filled.circuitAudio, { enabled: true, volume: 70 });
    const saved = await updateSettings({ circuitAudio: { enabled: false, volume: 25 } });
    assert.deepEqual(saved.circuitAudio, { enabled: false, volume: 25 });
    assert.deepEqual((await getSettings()).circuitAudio, { enabled: false, volume: 25 });
    await updateSettings({ circuitAudio: { enabled: true, volume: 70 } });
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
