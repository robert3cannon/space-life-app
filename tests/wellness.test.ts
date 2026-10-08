import "./load-env";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { POST as postHabit, GET as getHabits } from "../app/api/bot/habits/route";
import { POST as postCheck } from "../app/api/bot/habits/[id]/check/route";
import { GET as getSleep, POST as postSleep } from "../app/api/bot/sleep/route";
import { GET as getWater, POST as postWater } from "../app/api/bot/water/route";
import { closeDb, getSql } from "../lib/db";
import { createFood } from "../lib/services/food";
import { ensureWellnessReminders, listReminders } from "../lib/services/reminders";
import { updateSettings } from "../lib/services/settings";
import { assertCanSeed } from "../lib/seed-guard";
import { resolveSleepWindow } from "../lib/sleep-window";
import { habitStreaks } from "../lib/streaks";
import { addCalendarDays, getZonedParts, todayDateString, zonedDateTimeToUtc } from "../lib/time";
import { settingsPatchSchema } from "../lib/validation";
import { migrate } from "../scripts/migrate";

const ctx = undefined as never;
const bot = {
  authorization: "Bearer test-bot-token-value",
  "content-type": "application/json",
};

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, food_logs, water_logs, sleep_logs, habit_checks, habits, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

describe("sleep windows", () => {
  it("keeps a bedtime after midnight on the wake date", () => {
    const window = resolveSleepWindow({ wakeDate: "2026-10-08", bedtime: "01:30", wakeTime: "11:00" });
    assert.equal(window.durationMinutes, 570);
    assert.equal(window.bedtime?.toISOString(), "2026-10-08T05:30:00.000Z");
    assert.equal(window.wakeAt?.toISOString(), "2026-10-08T15:00:00.000Z");
    assert.equal(getZonedParts(window.bedtime!).date, "2026-10-08");
  });

  it("rolls an evening bedtime back to the previous night", () => {
    const window = resolveSleepWindow({ wakeDate: "2026-10-08", bedtime: "23:30", wakeTime: "11:00" });
    assert.equal(window.durationMinutes, 690);
    assert.equal(getZonedParts(window.bedtime!).date, "2026-10-07");
    assert.equal(window.bedtime?.toISOString(), "2026-10-08T03:30:00.000Z");
  });

  it("counts the lost hour when sleep crosses spring forward", () => {
    const window = resolveSleepWindow({ wakeDate: "2026-03-08", bedtime: "01:30", wakeTime: "11:00" });
    assert.equal(getZonedParts(window.bedtime!).date, "2026-03-08");
    assert.equal(window.durationMinutes, 510);
  });

  it("accepts a duration without clock times", () => {
    const window = resolveSleepWindow({ wakeDate: "2026-10-08", durationMinutes: 540 });
    assert.equal(window.durationMinutes, 540);
    assert.equal(window.bedtime, null);
    assert.equal(window.wakeAt, null);
  });
});

describe("habit streaks", () => {
  const today = "2026-10-08";
  const from = "2026-09-01";

  it("keeps a streak when today is still open", () => {
    const checked = new Set(["2026-10-05", "2026-10-06", "2026-10-07"]);
    const streaks = habitStreaks({ days: null, checked, today, from });
    assert.equal(streaks.current, 3);
    assert.equal(streaks.best, 3);
  });

  it("breaks on a missed scheduled day and remembers a longer best", () => {
    const checked = new Set([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-07",
    ]);
    const streaks = habitStreaks({ days: null, checked, today, from });
    assert.equal(streaks.current, 1);
    assert.equal(streaks.best, 5);
  });

  it("skips days that are not on the schedule", () => {
    const checked = new Set(["2026-10-05", "2026-10-07"]);
    const streaks = habitStreaks({ days: [1, 3, 5], checked, today, from });
    assert.equal(streaks.current, 2);
    assert.equal(streaks.best, 2);
  });

  it("includes today once it is checked", () => {
    const checked = new Set(["2026-10-07", "2026-10-08"]);
    const streaks = habitStreaks({ days: null, checked, today, from });
    assert.equal(streaks.current, 2);
    assert.equal(streaks.best, 2);
  });
});

describe("wellness API", () => {
  before(async () => {
    await migrate();
  });

  beforeEach(async () => {
    await reset();
  });

  after(async () => {
    await closeDb();
  });

  it("starts with an empty log and the default water goal", async () => {
    const water = await getWater(new Request("http://localhost/api/bot/water", { headers: bot }), ctx);
    const body = await water.json();
    assert.equal(body.goalOz, 100);
    assert.equal(body.totalOz, 0);
    assert.equal(body.logs.length, 0);
    const habits = await getHabits(new Request("http://localhost/api/bot/habits", { headers: bot }), ctx);
    const habitBody = await habits.json();
    assert.equal(habitBody.habits.length, 0);
  });

  it("logs water and stores an after-midnight sleep on the wake morning", async () => {
    const added = await postWater(
      new Request("http://localhost/api/bot/water", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ ounces: 16, date: "2026-10-08", time: "12:30" }),
      }),
      ctx,
    );
    assert.equal(added.status, 201);
    const again = await postWater(
      new Request("http://localhost/api/bot/water", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ ounces: 8, date: "2026-10-08", time: "16:00" }),
      }),
      ctx,
    );
    assert.equal(again.status, 201);
    const day = await getWater(new Request("http://localhost/api/bot/water?date=2026-10-08", { headers: bot }), ctx);
    const water = await day.json();
    assert.equal(water.totalOz, 24);

    const night = await postSleep(
      new Request("http://localhost/api/bot/sleep", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: "2026-10-08", bedtime: "01:30", wakeTime: "11:00", quality: 4 }),
      }),
      ctx,
    );
    assert.equal(night.status, 201);
    const logged = await night.json();
    assert.equal(logged.durationMinutes, 570);
    assert.equal(logged.wakeDate, "2026-10-08");
    assert.equal(getZonedParts(new Date(logged.bedtime)).date, "2026-10-08");

    const evening = await postSleep(
      new Request("http://localhost/api/bot/sleep", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: "2026-10-07", bedtime: "23:30", wakeTime: "11:00" }),
      }),
      ctx,
    );
    const previous = await evening.json();
    assert.equal(previous.durationMinutes, 690);
    assert.equal(getZonedParts(new Date(previous.bedtime)).date, "2026-10-06");

    const read = await getSleep(new Request("http://localhost/api/bot/sleep?date=2026-10-08", { headers: bot }), ctx);
    const sleep = await read.json();
    assert.equal(sleep.log.durationMinutes, 570);
    assert.equal(sleep.log.quality, 4);
  });

  it("counts a streak and lets an unfinished today stay open", async () => {
    const today = todayDateString();
    const created = await postHabit(
      new Request("http://localhost/api/bot/habits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ name: "Stretch" }),
      }),
      ctx,
    );
    const habit = await created.json();
    for (const offset of [2, 1]) {
      const checked = await postCheck(
        new Request(`http://localhost/api/bot/habits/${habit.id}/check`, {
          method: "POST",
          headers: bot,
          body: JSON.stringify({ date: addCalendarDays(today, -offset), done: true }),
        }),
        { params: Promise.resolve({ id: habit.id }) },
      );
      assert.equal(checked.status, 200);
    }
    const listed = await getHabits(new Request("http://localhost/api/bot/habits", { headers: bot }), ctx);
    const board = await listed.json();
    const stretch = board.habits.find((item: { name: string }) => item.name === "Stretch");
    assert.equal(stretch.currentStreak, 2);
    assert.equal(stretch.bestStreak, 2);
    assert.equal(stretch.done, false);
  });

  it("auto-completes a water habit and keeps a manual skip", async () => {
    const today = todayDateString();
    const created = await postHabit(
      new Request("http://localhost/api/bot/habits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ name: "Hit water goal", auto: "water" }),
      }),
      ctx,
    );
    const habit = await created.json();
    await postWater(
      new Request("http://localhost/api/bot/water", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ ounces: 100, date: today, time: "18:00" }),
      }),
      ctx,
    );
    const listed = await getHabits(new Request(`http://localhost/api/bot/habits?date=${today}`, { headers: bot }), ctx);
    const done = (await listed.json()).habits[0];
    assert.equal(done.done, true);
    assert.equal(done.source, "auto");
    assert.equal(done.currentStreak, 1);

    const skipped = await postCheck(
      new Request(`http://localhost/api/bot/habits/${habit.id}/check`, {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: today, done: false }),
      }),
      { params: Promise.resolve({ id: habit.id }) },
    );
    const after = await skipped.json();
    assert.equal(after.done, false);
    assert.equal(after.source, "skip");
    assert.equal(after.currentStreak, 0);
  });

  it("auto-completes protein from the food log", async () => {
    const today = todayDateString();
    await createFood({ name: "Chicken", meal: "lunch", calories: 600, proteinG: 160, date: today, time: "15:00" });
    await postHabit(
      new Request("http://localhost/api/bot/habits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ name: "Hit protein goal", auto: "protein" }),
      }),
      ctx,
    );
    const listed = await getHabits(new Request("http://localhost/api/bot/habits", { headers: bot }), ctx);
    const habit = (await listed.json()).habits[0];
    assert.equal(habit.done, true);
    assert.equal(habit.source, "auto");
  });

  it("refuses early-morning water nudges and schedules noon instead", async () => {
    assert.throws(() => settingsPatchSchema.parse({ waterReminders: { enabled: true, times: ["08:00"] } }));
    assert.throws(() => settingsPatchSchema.parse({ sleepReminder: { enabled: true, time: "08:00" } }));
    assert.throws(() => settingsPatchSchema.parse({ habitReminder: { enabled: true, time: "09:00" } }));
    settingsPatchSchema.parse({ waterReminders: { enabled: false, times: ["08:00"] } });
    settingsPatchSchema.parse({ sleepReminder: { enabled: true, time: "01:00" } });
    settingsPatchSchema.parse({ habitReminder: { enabled: true, time: "22:00" } });

    await updateSettings({ waterReminders: { enabled: true, times: ["12:00"] } });
    const now = zonedDateTimeToUtc("2026-10-08", "11:00");
    const created = await ensureWellnessReminders(now);
    assert.equal(created, 3);
    const pending = await listReminders();
    const water = pending.upcoming.filter((reminder) => reminder.kind === "water");
    assert.equal(water[0].fireAt, "2026-10-08T16:00:00.000Z");

    await postWater(
      new Request("http://localhost/api/bot/water", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ ounces: 100, date: "2026-10-08", time: "11:30" }),
      }),
      ctx,
    );
    await ensureWellnessReminders(now);
    const later = await listReminders();
    assert.equal(later.upcoming.some((reminder) => reminder.fireAt === "2026-10-08T16:00:00.000Z"), false);
    assert.equal(later.upcoming.some((reminder) => reminder.fireAt === "2026-10-09T16:00:00.000Z"), true);
  });
});

describe("production stays empty", () => {
  it("refuses to seed production unless explicitly allowed", () => {
    assert.throws(() => assertCanSeed({ NODE_ENV: "production" }), /Refusing to seed production/);
    assert.doesNotThrow(() => assertCanSeed({ NODE_ENV: "production", ALLOW_SEED: "1" }));
    assert.doesNotThrow(() => assertCanSeed({ NODE_ENV: "development" }));
  });

  it("does not run the seed script during a Vercel build", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: { "vercel-build": string } };
    assert.equal(pkg.scripts["vercel-build"], "tsx scripts/migrate.ts && next build");
    assert.equal(pkg.scripts["vercel-build"].includes("seed"), false);
    const seed = readFileSync("scripts/seed.ts", "utf8");
    assert.match(seed, /assertCanSeed\(/);
  });
});
