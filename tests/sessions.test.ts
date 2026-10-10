import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET as botGetRoutine, PATCH as botPatchRoutine, DELETE as botDeleteRoutine } from "../app/api/bot/routines/[id]/route";
import { POST as botSchedule } from "../app/api/bot/routines/[id]/schedule/route";
import { GET as botRoutines, POST as botCreateRoutine } from "../app/api/bot/routines/route";
import { GET as botGetSession } from "../app/api/bot/sessions/[id]/route";
import { GET as botSessions, POST as botLogSession } from "../app/api/bot/sessions/route";
import { closeDb, getSql } from "../lib/db";
import { DEFAULT_EQUIPMENT } from "../lib/equipment";
import { EXERCISES, getExercise } from "../lib/exercises";
import { formatExerciseLog } from "../lib/format";
import { createHabit, listHabits } from "../lib/services/habits";
import { getRoutine, logSession } from "../lib/services/routines";
import { muscleCoverage, workoutBoard } from "../lib/services/workouts";
import { buildStraightSteps, defaultPrescription } from "../lib/session-plan";
import { migrate } from "../scripts/migrate";

const ctx = undefined as never;
const bot = {
  authorization: "Bearer test-bot-token-value",
  "content-type": "application/json",
};

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, saved_workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

describe("standalone workouts", () => {
  before(async () => {
    await migrate();
    await reset();
  });

  after(async () => {
    await closeDb();
  });

  it("picks a hold for planks and the dumbbell weight for curls", () => {
    const plank = EXERCISES.find((exercise) => exercise.id === "Plank");
    assert.ok(plank);
    const hold = defaultPrescription(plank, DEFAULT_EQUIPMENT);
    assert.equal(hold.reps, null);
    assert.equal(hold.durationSeconds, 30);
    assert.equal(hold.weight, null);
    assert.equal(hold.sets, 3);

    const curl = getExercise("Alternate_Hammer_Curl");
    assert.ok(curl);
    const loaded = defaultPrescription(curl, DEFAULT_EQUIPMENT);
    assert.equal(loaded.reps, 8);
    assert.equal(loaded.durationSeconds, null);
    assert.equal(loaded.weight, 15);

    const pushups = getExercise("Pushups");
    assert.ok(pushups);
    assert.equal(defaultPrescription(pushups, DEFAULT_EQUIPMENT).weight, null);
    assert.equal(
      formatExerciseLog("Pushups", [
        { reps: 12, weight: null, weightUnit: "lb", durationSeconds: null },
        { reps: 12, weight: null, weightUnit: "lb", durationSeconds: null },
      ]),
      "Pushups · 2 × 12 × bodyweight",
    );
  });

  it("runs straight sets instead of rotating exercises", () => {
    const steps = buildStraightSteps([{ sets: 2 }, { sets: 2 }], 60);
    const work = steps.filter((step) => step.kind === "work").map((step) => [step.exercise, step.set]);
    assert.deepEqual(work, [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
    assert.equal(steps.filter((step) => step.kind === "rest").length, 3);
    assert.equal(buildStraightSteps([{ sets: 2 }], 0).filter((step) => step.kind === "rest").length, 0);
  });

  it("logs a single exercise into history, coverage, and the workout habit", async () => {
    await createHabit({ name: "Lift", auto: "workout" });
    const logged = await logSession({
      title: "Pushups",
      durationSeconds: 300,
      exercises: [
        {
          name: "Pushups",
          libraryId: "Pushups",
          sets: [
            { reps: 12, weight: null, completed: true },
            { reps: 10, weight: 0, completed: true },
          ],
        },
      ],
    });
    assert.equal(logged.status, "done");
    assert.equal(logged.durationSeconds, 300);
    assert.equal(logged.exercises[0]?.sets[0]?.reps, 12);
    assert.equal(logged.exercises[0]?.sets[1]?.reps, 10);
    assert.equal(logged.exercises[0]?.sets[0]?.completed, true);
    const board = await workoutBoard();
    assert.ok(board.history.some((workout) => workout.id === logged.id));
    assert.equal(board.upcoming.some((workout) => workout.id === logged.id), false);
    const habits = await listHabits();
    const habit = habits.habits.find((item) => item.name === "Lift");
    assert.equal(habit?.done, true);
    assert.ok((habit?.currentStreak ?? 0) >= 1);
    const coverage = await muscleCoverage();
    assert.ok(coverage.primary.includes("mid_chest"));
  });

  it("saves, edits, schedules, and deletes a custom workout from the bot API", async () => {
    const denied = await botCreateRoutine(
      new Request("http://localhost/api/bot/routines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Nope" }),
      }),
      ctx,
    );
    assert.equal(denied.status, 401);

    const created = await botCreateRoutine(
      new Request("http://localhost/api/bot/routines", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({
          title: "Push",
          restSeconds: 75,
          exercises: [
            { libraryId: "Pushups", name: "Pushups", sets: 3, reps: 12, weight: null },
            { libraryId: "Plank", name: "Plank", sets: 2, durationSeconds: 30, weight: null },
          ],
        }),
      }),
      ctx,
    );
    assert.equal(created.status, 201);
    const routine = await created.json();
    assert.equal(routine.title, "Push");
    assert.equal(routine.restSeconds, 75);
    assert.equal(routine.exercises[1].durationSeconds, 30);
    assert.equal(routine.exercises[1].reps, null);

    const listed = await botRoutines(new Request("http://localhost/api/bot/routines", { headers: bot }), ctx);
    assert.equal(listed.status, 200);
    const list = await listed.json();
    assert.ok(list.routines.some((item: { id: string }) => item.id === routine.id));

    const one = await botGetRoutine(new Request(`http://localhost/api/bot/routines/${routine.id}`, { headers: bot }), {
      params: Promise.resolve({ id: routine.id }),
    });
    assert.equal(one.status, 200);

    const patched = await botPatchRoutine(
      new Request(`http://localhost/api/bot/routines/${routine.id}`, {
        method: "PATCH",
        headers: bot,
        body: JSON.stringify({
          title: "Push day",
          restSeconds: 60,
          exercises: [{ libraryId: "Pushups", name: "Pushups", sets: 4, reps: 8, weight: null }],
        }),
      }),
      { params: Promise.resolve({ id: routine.id }) },
    );
    assert.equal(patched.status, 200);
    assert.equal((await patched.json()).title, "Push day");

    const scheduled = await botSchedule(
      new Request(`http://localhost/api/bot/routines/${routine.id}/schedule`, {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: "2026-12-02", time: "18:00" }),
      }),
      { params: Promise.resolve({ id: routine.id }) },
    );
    assert.equal(scheduled.status, 201);
    const planned = await scheduled.json();
    assert.equal(planned.status, "planned");
    assert.equal(planned.title, "Push day");
    assert.equal(planned.exercises.length, 1);
    assert.equal(planned.exercises[0].sets.length, 4);
    assert.equal(planned.exercises[0].sets[0].reps, 8);

    const logged = await botLogSession(
      new Request("http://localhost/api/bot/sessions", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({
          title: "Push day",
          durationSeconds: 900,
          exercises: [
            {
              name: "Pushups",
              libraryId: "Pushups",
              sets: [
                { reps: 8, weight: null },
                { reps: 6, weight: null },
              ],
            },
          ],
        }),
      }),
      ctx,
    );
    assert.equal(logged.status, 201);
    const session = await logged.json();
    assert.equal(session.status, "done");
    assert.equal(session.durationSeconds, 900);
    assert.equal(session.exercises[0].sets[1].reps, 6);

    const sessions = await botSessions(new Request("http://localhost/api/bot/sessions", { headers: bot }), ctx);
    const sessionList = await sessions.json();
    assert.ok(sessionList.sessions.some((item: { id: string }) => item.id === session.id));

    const fetched = await botGetSession(new Request(`http://localhost/api/bot/sessions/${session.id}`, { headers: bot }), {
      params: Promise.resolve({ id: session.id }),
    });
    assert.equal(fetched.status, 200);
    assert.equal((await fetched.json()).durationSeconds, 900);

    const removed = await botDeleteRoutine(
      new Request(`http://localhost/api/bot/routines/${routine.id}`, { method: "DELETE", headers: bot }),
      { params: Promise.resolve({ id: routine.id }) },
    );
    assert.equal(removed.status, 200);
    assert.equal(await getRoutine(routine.id), null);
  });
});
