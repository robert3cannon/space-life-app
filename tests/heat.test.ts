import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { closeDb, getSql } from "../lib/db";
import { heatBucket, HEAT_TARGET, weeklyMuscleHeat } from "../lib/heat";
import { getExercise } from "../lib/exercises";
import { logSession } from "../lib/services/routines";
import { muscleCoverage } from "../lib/services/workouts";
import { migrate } from "../scripts/migrate";

function lift(partial: {
  id?: string;
  title?: string;
  status?: string;
  completed?: number;
  primary: string[];
  secondary?: string[];
  ratings?: Record<string, number>;
}) {
  const completed = partial.completed ?? 1;
  return {
    id: partial.id ?? "session",
    title: partial.title ?? "Session",
    status: partial.status ?? "done",
    exercises: [
      {
        sets: Array.from({ length: completed }, () => ({ completed: true })),
        primary: partial.primary,
        secondary: partial.secondary ?? [],
        ratings: partial.ratings ?? {},
      },
    ],
  };
}

describe("weekly muscle heat", () => {
  it("keeps one top-rated set in the light bucket", () => {
    assert.equal(heatBucket(0), 0);
    assert.equal(heatBucket(1), 1);
    assert.equal(heatBucket(2.9), 1);
    assert.equal(heatBucket(3), 2);
    assert.equal(heatBucket(5.9), 2);
    assert.equal(heatBucket(6), 3);
    assert.equal(heatBucket(HEAT_TARGET - 0.1), 3);
    assert.equal(heatBucket(HEAT_TARGET), 4);
    assert.equal(heatBucket(14), 4);

    const heat = weeklyMuscleHeat([
      lift({ primary: ["mid_chest"], ratings: { mid_chest: 5 } }),
    ]);
    assert.equal(heat.mid_chest.volume, 1);
    assert.equal(heat.mid_chest.sets, 1);
    assert.equal(heat.mid_chest.bucket, 1);
    assert.equal(heat.calves.volume, 0);
    assert.equal(heat.calves.bucket, 0);
    assert.notEqual(heat.mid_chest.bucket, 4);
  });

  it("weights primary sets at 1, secondary at 0.5, and scales by rating", () => {
    const heat = weeklyMuscleHeat([
      lift({
        completed: 2,
        primary: ["lats"],
        secondary: ["biceps", "lats"],
        ratings: { lats: 5, biceps: 4 },
      }),
    ]);
    assert.equal(heat.lats.volume, 2);
    assert.equal(heat.lats.sets, 2);
    assert.equal(heat.biceps.volume, 0.8);
    assert.equal(heat.biceps.sets, 2);
    assert.equal(heat.biceps.bucket, 1);
  });

  it("ignores planned sessions and unfinished sets", () => {
    const heat = weeklyMuscleHeat([
      lift({ id: "planned", status: "planned", primary: ["quads"], ratings: { quads: 5 }, completed: 10 }),
      {
        id: "partial",
        title: "Partial",
        status: "done",
        exercises: [
          {
            sets: [{ completed: true }, { completed: false }],
            primary: ["quads"],
            secondary: [],
            ratings: { quads: 5 },
          },
        ],
      },
    ]);
    assert.equal(heat.quads.volume, 1);
    assert.equal(heat.quads.sets, 1);
    assert.equal(heat.quads.sessions.length, 1);
    assert.equal(heat.quads.sessions[0]?.title, "Partial");
  });

  it("reaches the top bucket only around ten weighted sets and lists the sessions", () => {
    const heat = weeklyMuscleHeat([
      lift({ id: "a", title: "Pull", completed: 6, primary: ["lats"], ratings: { lats: 5 } }),
      lift({ id: "b", title: "Row", completed: 4, primary: ["lats"], secondary: ["biceps"], ratings: { lats: 5, biceps: 2 } }),
    ]);
    assert.equal(heat.lats.volume, 10);
    assert.equal(heat.lats.bucket, 4);
    assert.deepEqual(
      heat.lats.sessions.map((session) => session.title),
      ["Pull", "Row"],
    );
    assert.equal(heat.biceps.volume, 0.8);
    assert.equal(heat.biceps.bucket, 1);
  });
});

describe("coverage heat", () => {
  before(async () => {
    await migrate();
    const sql = getSql();
    await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, saved_workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
  });

  after(async () => {
    await closeDb();
  });

  it("scores this week's logged sessions, including a single exercise", async () => {
    const pushups = getExercise("Pushups");
    assert.ok(pushups);
    await logSession({
      title: "Pushups",
      durationSeconds: 180,
      exercises: [
        {
          name: "Pushups",
          libraryId: "Pushups",
          sets: [
            { reps: 12, completed: true },
            { reps: 10, completed: true },
            { reps: 8, completed: true },
          ],
        },
      ],
    });
    const coverage = await muscleCoverage();
    const chest = coverage.heat.mid_chest;
    assert.equal(chest.volume, 2.4);
    assert.equal(chest.bucket, 1);
    assert.equal(chest.sets, 3);
    assert.equal(chest.sessions[0]?.title, "Pushups");
    assert.equal(coverage.heat.calves.bucket, 0);
    assert.ok(coverage.primary.includes("mid_chest"));
    assert.ok(coverage.neglected.includes("calves"));
  });
});
