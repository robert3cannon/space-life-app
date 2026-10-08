import "./load-env";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { POST as postImport } from "../app/api/apple-health/import/route";
import { POST as postAck } from "../app/api/apple-health/export/ack/route";
import { GET as getExport } from "../app/api/apple-health/export/route";
import { POST as postHabit, GET as getHabits } from "../app/api/bot/habits/route";
import { POST as postSleep } from "../app/api/bot/sleep/route";
import { closeDb, getSql } from "../lib/db";
import { healthActivityExercise } from "../lib/health-activity";
import { parseHealthPayload, parseQuantity, parseShortcutDate } from "../lib/health-parse";
import { createFood } from "../lib/services/food";
import { generateHealthToken, revokeHealthToken } from "../lib/services/health";
import { muscleCoverage } from "../lib/services/workouts";
import { createWater } from "../lib/services/water";
import { todayDateString } from "../lib/time";
import { migrate } from "../scripts/migrate";

const ctx = undefined as never;
const healthHeaders = {
  authorization: "Bearer test-health-token-value",
  "content-type": "application/json",
};
const bot = {
  authorization: "Bearer test-bot-token-value",
  "content-type": "application/json",
};

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

function importRequest(body: unknown, authorization = healthHeaders.authorization) {
  return new Request("http://localhost/api/apple-health/import", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("shortcut health payloads", () => {
  it("reads a Detroit wall time from a Shortcuts date", () => {
    assert.equal(parseShortcutDate("10/8/2026, 1:30 AM")?.toISOString(), "2026-10-08T05:30:00.000Z");
    assert.equal(parseShortcutDate("October 8, 2026 at 1:30 AM")?.toISOString(), "2026-10-08T05:30:00.000Z");
    assert.equal(parseShortcutDate("2026-10-08 01:30")?.toISOString(), "2026-10-08T05:30:00.000Z");
    assert.equal(parseShortcutDate("10/8/2026 1:30 AM")?.toISOString(), "2026-10-08T05:30:00.000Z");
  });

  it("keeps the spring-forward morning on Eastern Standard Time", () => {
    assert.equal(parseShortcutDate("3/8/2026, 1:30 AM")?.toISOString(), "2026-03-08T06:30:00.000Z");
  });

  it("accepts numeric strings, missing fields, and spaced Health keys", () => {
    assert.equal(parseQuantity("8,421 steps")?.value, 8421);
    assert.equal(parseQuantity("1,234")?.value, 1234);
    assert.equal(parseQuantity({ Value: "412", Unit: "kcal" })?.value, 412);
    const parsed = parseHealthPayload({
      Date: "October 8, 2026",
      Steps: "8,421 steps",
      "Active Energy": "412 kcal",
      mood: "fine",
      Workouts: [
        {
          "Workout Type": "Running",
          "Start Date": "10/8/2026, 6:15 AM",
          "End Date": "10/8/2026, 7:02 AM",
          Duration: "47 min",
          "Total Energy Burned": "480",
          "Total Distance": "4.2 mi",
        },
        { "Workout Type": "Walking" },
      ],
      Sleep: [
        { state: "In Bed", start: "10/7/2026, 11:40 PM", end: "10/8/2026, 11:05 AM" },
        { state: "Asleep", start: "10/7/2026, 11:55 PM", end: "10/8/2026, 10:40 AM" },
      ],
    });
    assert.equal(parsed.days[0].date, "2026-10-08");
    assert.equal(parsed.days[0].steps, 8421);
    assert.equal(parsed.days[0].activeKcal, 412);
    assert.equal(parsed.days[0].present.restingKcal, false);
    assert.equal(parsed.workouts.length, 1);
    assert.equal(parsed.workouts[0].start.toISOString(), "2026-10-08T10:15:00.000Z");
    assert.equal(parsed.workouts[0].durationMinutes, 47);
    assert.equal(parsed.workouts[0].distance, "4.2 mi");
    assert.equal(parsed.nights.length, 1);
    assert.equal(parsed.nights[0].wakeDate, "2026-10-08");
    assert.equal(parsed.nights[0].durationMinutes, 645);
    assert.equal(parsed.nights[0].bedtime.toISOString(), "2026-10-08T03:55:00.000Z");
  });

  it("sums step samples and converts a kilogram weigh-in", () => {
    const parsed = parseHealthPayload(
      {
        date: "2026-10-08",
        steps: [
          { value: "3,000", start: "10/8/2026, 8:00 AM" },
          { value: "5,421", start: "10/8/2026, 12:00 PM" },
        ],
        weight: "78 kg",
      },
      new Date("2026-10-08T16:00:00.000Z"),
    );
    assert.equal(parsed.days[0].steps, 8421);
    assert.equal(parsed.weights[0].pounds, 172);
    assert.equal(parsed.weights[0].measuredAt.toISOString(), "2026-10-08T16:00:00.000Z");
  });

  it("maps cardio onto real library exercises and leaves strength unmapped", () => {
    assert.equal(healthActivityExercise("Outdoor Run").libraryId, "Bodyweight_Walking_Lunge");
    assert.equal(healthActivityExercise("Indoor Cycling").libraryId, "Recumbent_Bike");
    assert.equal(healthActivityExercise("Indoor Rowing").libraryId, "Seated_Cable_Rows");
    assert.equal(healthActivityExercise("Core Training").libraryId, "Plank");
    assert.equal(healthActivityExercise("Traditional Strength Training").libraryId, null);
    assert.equal(healthActivityExercise("Yoga").libraryId, null);
    assert.equal(healthActivityExercise("Swimming").libraryId, null);
  });
});

describe("apple health sync", () => {
  before(async () => {
    await migrate();
    await reset();
  });

  beforeEach(async () => {
    await reset();
  });

  after(async () => {
    await closeDb();
  });

  it("rejects a missing or wrong token", async () => {
    const missing = await postImport(importRequest({ steps: 100 }, ""), ctx);
    assert.equal(missing.status, 401);
    const wrong = await postImport(importRequest({ steps: 100 }, "Bearer nope"), ctx);
    assert.equal(wrong.status, 401);
  });

  it("updates the same day and workout instead of inserting another", async () => {
    const body = {
      date: "2026-10-08",
      steps: "8,421",
      activeEnergy: "412 kcal",
      restingEnergy: "1,680",
      exerciseMinutes: "32",
      restingHeartRate: "58 bpm",
      dietaryWater: "40 fl oz",
      workouts: [
        {
          type: "Running",
          start: "10/8/2026, 6:15 AM",
          end: "10/8/2026, 7:02 AM",
          calories: "480",
          distance: "4.2 mi",
        },
      ],
    };
    const first = await postImport(importRequest(body), ctx);
    assert.equal(first.status, 200);
    const second = await postImport(importRequest({ ...body, steps: "9,000" }), ctx);
    assert.equal(second.status, 200);
    const sql = getSql();
    const days = await sql`SELECT steps, active_kcal, dietary_water_oz FROM health_days WHERE date = '2026-10-08'`;
    assert.equal(days.length, 1);
    assert.equal(days[0].steps, 9000);
    assert.equal(Number(days[0].active_kcal), 412);
    assert.equal(Number(days[0].dietary_water_oz), 40);
    const sessions = await sql`SELECT title, health_key FROM workouts`;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].title, "Running");
    const exercises = await sql`SELECT library_id FROM workout_exercises`;
    assert.equal(exercises[0].library_id, "Bodyweight_Walking_Lunge");
    const coverage = await muscleCoverage("2026-10-08");
    assert.equal(coverage.primary.includes("quads"), true);
  });

  it("keeps a manual sleep log and fills an empty morning", async () => {
    const manual = await postSleep(
      new Request("http://localhost/api/bot/sleep", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: "2026-10-09", durationMinutes: 500 }),
      }),
      ctx,
    );
    assert.equal(manual.status, 201);
    const imported = await postImport(
      importRequest({
        sleep: [
          { state: "Asleep", start: "10/8/2026, 11:30 PM", end: "10/9/2026, 9:00 AM" },
          { state: "Asleep", start: "10/9/2026, 11:40 PM", end: "10/10/2026, 10:00 AM" },
        ],
      }),
      ctx,
    );
    const summary = await imported.json();
    assert.equal(summary.sleepNights, 1);
    assert.equal(summary.sleepSkippedManual, 1);
    const sql = getSql();
    const rows = await sql`SELECT wake_date, duration_minutes, source FROM sleep_logs ORDER BY wake_date`;
    assert.equal(rows.length, 2);
    assert.equal(rows[0].wake_date, "2026-10-09");
    assert.equal(rows[0].duration_minutes, 500);
    assert.equal(rows[0].source, "manual");
    assert.equal(rows[1].wake_date, "2026-10-10");
    assert.equal(rows[1].source, "health");
    await postImport(
      importRequest({
        sleep: [{ state: "Asleep", start: "10/9/2026, 11:40 PM", end: "10/10/2026, 10:00 AM" }],
      }),
      ctx,
    );
    const again = await sql`SELECT count(*)::int AS count FROM sleep_logs WHERE wake_date = '2026-10-10'`;
    assert.equal(again[0].count, 1);
  });

  it("completes a 10,000 step habit from the import", async () => {
    const today = todayDateString();
    const created = await postHabit(
      new Request("http://localhost/api/bot/habits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ name: "10k steps", auto: "steps" }),
      }),
      ctx,
    );
    assert.equal(created.status, 201);
    await postImport(importRequest({ date: today, steps: "10000" }), ctx);
    const listed = await getHabits(new Request("http://localhost/api/bot/habits", { headers: bot }), ctx);
    const habit = (await listed.json()).habits[0];
    assert.equal(habit.done, true);
    assert.equal(habit.source, "auto");
    assert.equal(habit.auto, "steps");
  });

  it("exports new food and water once, then hides them after ack", async () => {
    const today = todayDateString();
    const food = await createFood({ name: "Oats", meal: "breakfast", calories: 320, proteinG: 12, carbsG: 50, fatG: 8, date: today, time: "11:30" });
    const water = await createWater({ ounces: 16, date: today, time: "12:00" });
    const first = await getExport(new Request("http://localhost/api/apple-health/export", { headers: healthHeaders }), ctx);
    assert.equal(first.status, 200);
    const pending = await first.json();
    assert.equal(pending.food.length, 1);
    assert.equal(pending.food[0].id, food.id);
    assert.equal(pending.food[0].calories, 320);
    assert.equal(pending.water.length, 1);
    assert.equal(pending.water[0].id, water.id);
    const acked = await postAck(
      new Request("http://localhost/api/apple-health/export/ack", {
        method: "POST",
        headers: healthHeaders,
        body: JSON.stringify({ food: [food.id], water: [water.id] }),
      }),
      ctx,
    );
    assert.equal(acked.status, 200);
    const second = await getExport(new Request("http://localhost/api/apple-health/export", { headers: healthHeaders }), ctx);
    const empty = await second.json();
    assert.deepEqual(empty.food, []);
    assert.deepEqual(empty.water, []);
    const repeat = await postAck(
      new Request("http://localhost/api/apple-health/export/ack", {
        method: "POST",
        headers: healthHeaders,
        body: JSON.stringify({ food: [food.id], water: [water.id] }),
      }),
      ctx,
    );
    assert.equal(repeat.status, 200);
  });

  it("accepts a device token and stops accepting it after revoke", async () => {
    const minted = await generateHealthToken();
    const ok = await postImport(importRequest({ date: "2026-10-06", steps: 1200 }, `Bearer ${minted.token}`), ctx);
    assert.equal(ok.status, 200);
    await revokeHealthToken();
    const revoked = await postImport(importRequest({ date: "2026-10-06", steps: 1300 }, `Bearer ${minted.token}`), ctx);
    assert.equal(revoked.status, 401);
    const env = await postImport(importRequest({ date: "2026-10-06", steps: 1400 }), ctx);
    assert.equal(env.status, 200);
    const sql = getSql();
    const rows = await sql`SELECT steps FROM health_days WHERE date = '2026-10-06'`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].steps, 1400);
  });
});
