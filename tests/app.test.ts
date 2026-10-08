import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { POST as login } from "../app/api/auth/login/route";
import { GET as cron } from "../app/api/cron/dispatch/route";
import { GET as getEventsRoute, POST as postEventRoute } from "../app/api/bot/events/route";
import { POST as notify } from "../app/api/bot/notify/route";
import { POST as postFeed } from "../app/api/bot/feed/route";
import { GET as uiEvents } from "../app/api/events/route";
import { middleware } from "../middleware";
import { closeDb, getSql } from "../lib/db";
import { createEvent, deleteEvent } from "../lib/services/events";
import { createFood, foodSummary, recentFoods } from "../lib/services/food";
import { createReminder, dispatchReminders, ensureMealReminders, listReminders } from "../lib/services/reminders";
import { getSettings, updateSettings } from "../lib/services/settings";
import { appendWorkoutExercise, createWorkout, getWorkout, muscleCoverage, updateWorkout } from "../lib/services/workouts";
import { saveSubscription, setPushSender, subscriptionCount } from "../lib/push";
import { migrate } from "../scripts/migrate";
import { zonedDateTimeToUtc } from "../lib/time";

const ctx = undefined as never;

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

describe("orbit data and bot API", () => {
  before(async () => {
    await migrate();
    await migrate();
    await reset();
  });

  after(async () => {
    setPushSender(null);
    await closeDb();
  });

  it("rejects the UI and accepts a passcode", async () => {
    const hidden = await uiEvents(new Request("http://localhost/api/events"), ctx);
    assert.equal(hidden.status, 401);

    const wrong = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "nope" }),
      }),
    );
    assert.equal(wrong.status, 401);

    const right = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-passcode" }),
      }),
    );
    assert.equal(right.status, 200);
    const cookie = right.headers.get("set-cookie") ?? "";
    assert.match(cookie, /orbit_session=/);

    const blocked = await middleware(new NextRequest("http://localhost/schedule"));
    assert.equal(blocked.status, 307);
    assert.match(blocked.headers.get("location") ?? "", /\/login/);

    const token = cookie.split(";")[0].split("=")[1];
    const allowed = await middleware(
      new NextRequest("http://localhost/schedule", { headers: { cookie: `orbit_session=${token}` } }),
    );
    assert.equal(allowed.status, 200);

    const botOpen = await middleware(new NextRequest("http://localhost/api/bot/today"));
    assert.equal(botOpen.status, 200);
  });

  it("requires the bot bearer token and then creates an event", async () => {
    const denied = await postEventRoute(
      new Request("http://localhost/api/bot/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Nope", type: "other", date: "2026-10-09", startTime: "16:00", endTime: "17:00" }),
      }),
      ctx,
    );
    assert.equal(denied.status, 401);

    const created = await postEventRoute(
      new Request("http://localhost/api/bot/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-bot-token-value",
        },
        body: JSON.stringify({
          title: "Bot study block",
          type: "study",
          date: "2026-10-09",
          startTime: "16:00",
          endTime: "17:30",
          location: "Library",
          reminderMinutesBefore: 20,
        }),
      }),
      ctx,
    );
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.title, "Bot study block");
    assert.equal(body.startsAt, "2026-10-09T20:00:00.000Z");

    const listed = await getEventsRoute(
      new Request("http://localhost/api/bot/events?date=2026-10-09", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    const listBody = await listed.json();
    assert.equal(listBody.events.some((event: { id: string }) => event.id === body.id), true);
  });

  it("syncs and removes an event reminder", async () => {
    const starts = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const event = await createEvent({
      title: "Lab",
      type: "class",
      startsAt: starts.toISOString(),
      endsAt: new Date(starts.getTime() + 60 * 60 * 1000).toISOString(),
      reminderMinutesBefore: 30,
    });
    const pending = await listReminders();
    assert.equal(pending.upcoming.some((reminder) => reminder.title === "Lab"), true);
    await deleteEvent(event.id);
    const afterDelete = await listReminders();
    assert.equal(afterDelete.upcoming.some((reminder) => reminder.relatedId === event.id), false);
  });

  it("totals food and keeps one recent entry per name", async () => {
    await createFood({ name: "Greek yogurt and granola", meal: "breakfast", calories: 420, proteinG: 28, carbsG: 48, fatG: 12, date: "2026-10-08", time: "11:40" });
    await createFood({ name: "Greek yogurt and granola", meal: "snack", calories: 200, proteinG: 15, carbsG: 20, fatG: 6, date: "2026-10-08", time: "16:00" });
    await createFood({ name: "Chicken wrap", meal: "lunch", calories: 680, proteinG: 42, carbsG: 60, fatG: 24, date: "2026-10-08", time: "15:00" });
    const summary = await foodSummary("2026-10-08");
    const day = summary.days.find((item) => item.date === "2026-10-08");
    assert.ok(day);
    assert.equal(day.calories, 1300);
    assert.equal(summary.days.length, 7);
    const recent = await recentFoods();
    assert.equal(recent.filter((food) => food.name === "Greek yogurt and granola").length, 1);
  });

  it("checks off sets and completes a workout", async () => {
    const workout = await createWorkout({
      title: "Push",
      date: "2026-10-10",
      time: "18:00",
      reminderMinutesBefore: 30,
      exercises: [
        { name: "Bench press", sets: [{ reps: 8, weight: 95, weightUnit: "lb" }, { reps: 8, weight: 95, weightUnit: "lb" }] },
        { name: "Plank", sets: [{ durationSeconds: 40 }] },
      ],
    });
    const setId = workout.exercises[0].sets[0].id;
    const toggled = await updateWorkout(workout.id, { setCompleted: { setId, completed: true } });
    assert.equal(toggled.exercises[0].sets[0].completed, true);
    assert.equal(toggled.exercises[0].sets[1].completed, false);
    const done = await updateWorkout(workout.id, { status: "done" });
    assert.equal(done.status, "done");
    assert.equal(done.exercises.every((exercise) => exercise.sets.every((set) => set.completed)), true);
    const reminders = await listReminders();
    assert.equal(reminders.upcoming.some((reminder) => reminder.relatedId === workout.id), false);
    assert.ok(await getWorkout(workout.id));
  });

  it("appends a library exercise without replacing the session", async () => {
    const workout = await createWorkout({
      title: "Core",
      date: "2026-10-06",
      time: "18:00",
      exercises: [{ name: "Bench press", sets: [{ reps: 8, weight: 95, weightUnit: "lb" }] }],
    });
    const setId = workout.exercises[0].sets[0].id;
    const added = await appendWorkoutExercise(workout.id, { libraryId: "Plank" });
    assert.equal(added.exercises.length, 2);
    assert.equal(added.exercises[0].sets[0].id, setId);
    assert.equal(added.exercises[1].name, "Plank");
    assert.equal(added.exercises[1].libraryId, "Plank");
    assert.equal(added.exercises[1].sets[0].durationSeconds, 30);
    assert.equal(added.exercises[0].catalogId, "Barbell_Bench_Press_-_Medium_Grip");
    assert.ok(added.muscles.primary.includes("mid_chest"));
    const done = await updateWorkout(added.id, { status: "done" });
    assert.equal(done.exercises[1].sets.every((set) => set.completed), true);
    const week = await muscleCoverage("2026-10-08");
    assert.ok(week.primary.includes("mid_chest"));
    assert.ok(week.primary.includes("lower_abs"));
    assert.ok(week.neglected.includes("quads"));
  });

  it("materializes meal reminders and dispatches only what is due", async () => {
    await reset();
    await getSettings();
    const now = zonedDateTimeToUtc("2026-10-08", "11:00");
    const created = await ensureMealReminders(now);
    assert.equal(created, 9);
    const again = await ensureMealReminders(now);
    assert.equal(again, 0);

    await createReminder({
      title: "Pack the gym bag",
      body: "Shoes and a lock.",
      fireAt: new Date(now.getTime() - 60_000).toISOString(),
    });
    await createReminder({
      title: "Later",
      body: "Not yet.",
      fireAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const sent: string[] = [];
    setPushSender(async (_sub, payload) => {
      sent.push(payload.title);
    });
    await saveSubscription({
      endpoint: "https://push.example.test/device-1",
      p256dh: "key",
      auth: "auth",
      userAgent: "test",
    });
    const result = await dispatchReminders(now);
    assert.equal(result.ok, true);
    assert.deepEqual(sent, ["Pack the gym bag"]);
    assert.equal(result.sent, 1);

    setPushSender(async () => {
      const error = new Error("gone") as Error & { statusCode?: number };
      error.statusCode = 410;
      throw error;
    });
    await createReminder({ title: "Expired device", body: "Hi", fireAt: new Date(now.getTime() - 1000).toISOString() });
    const second = await dispatchReminders(now);
    assert.equal(second.removed, 1);
    assert.equal(await subscriptionCount(), 0);

    setPushSender(async () => {
      throw new Error("network");
    });
    await saveSubscription({
      endpoint: "https://push.example.test/device-2",
      p256dh: "key",
      auth: "auth",
      userAgent: "test",
    });
    await createReminder({ title: "Retry me", body: "Still due", fireAt: new Date(now.getTime() - 1000).toISOString() });
    const held = await dispatchReminders(now);
    assert.equal(held.held, 1);
    const pending = await listReminders();
    assert.equal(pending.upcoming.some((reminder) => reminder.title === "Retry me"), true);
    setPushSender(null);
  });

  it("posts a feed note and a push from the bot API", async () => {
    const titles: string[] = [];
    setPushSender(async (_sub, payload) => {
      titles.push(payload.title);
    });
    const note = await postFeed(
      new Request("http://localhost/api/bot/feed", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer test-bot-token-value" },
        body: JSON.stringify({ message: "Moved Thursday study to 7pm.", author: "Scheduler" }),
      }),
      ctx,
    );
    assert.equal(note.status, 201);

    const pushed = await notify(
      new Request("http://localhost/api/bot/notify", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer test-bot-token-value" },
        body: JSON.stringify({ title: "Coach", body: "Push day in 30 minutes", url: "/workouts" }),
      }),
      ctx,
    );
    assert.equal(pushed.status, 200);
    const body = await pushed.json();
    assert.equal(body.delivered, 1);
    assert.deepEqual(titles, ["Coach"]);
    setPushSender(null);
  });

  it("updates targets and protects the cron route", async () => {
    setPushSender(async () => {});
    const next = await updateSettings({ targets: { calories: 2300, proteinG: 140, carbsG: 250, fatG: 70 } });
    assert.equal(next.targets.calories, 2300);
    assert.equal(next.timezone, "America/Detroit");
    const denied = await cron(new Request("http://localhost/api/cron/dispatch"));
    assert.equal(denied.status, 401);
    const allowed = await cron(
      new Request("http://localhost/api/cron/dispatch", { headers: { authorization: "Bearer test-cron-secret-value" } }),
    );
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.ok, true);
    setPushSender(null);
  });
});
