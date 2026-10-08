import { addActivity } from "../lib/services/activity";
import { createEvent } from "../lib/services/events";
import { createFood } from "../lib/services/food";
import { createHabit, setHabitCheck } from "../lib/services/habits";
import { createReminder, ensureMealReminders } from "../lib/services/reminders";
import { logSleep } from "../lib/services/sleep";
import { getSettings } from "../lib/services/settings";
import { createWater } from "../lib/services/water";
import { resolveExercise } from "../lib/exercises";
import { createWorkout, updateWorkout } from "../lib/services/workouts";
import { closeDb, getSql } from "../lib/db";
import { assertCanSeed } from "../lib/seed-guard";
import { addCalendarDays, calendarWeekday, todayDateString, weekStartDate } from "../lib/time";
import type { EventType } from "../lib/types";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

type Block = {
  title: string;
  type: EventType;
  start: string;
  end: string;
  location: string;
  reminder: number;
};

const week: Record<number, Block[]> = {
  1: [
    { title: "CSE 331 · Algorithms", type: "class", start: "14:00", end: "15:20", location: "STEM Building", reminder: 45 },
    { title: "Study block", type: "study", start: "16:00", end: "17:30", location: "Main Library", reminder: 15 },
    { title: "Push", type: "workout", start: "18:00", end: "19:00", location: "IM Circle", reminder: 30 },
  ],
  2: [
    { title: "WRA 101", type: "class", start: "13:00", end: "14:20", location: "Wells Hall", reminder: 40 },
    { title: "Cafe shift", type: "work", start: "17:00", end: "21:00", location: "Campus cafe", reminder: 60 },
  ],
  3: [
    { title: "CSE 331 · Algorithms", type: "class", start: "14:00", end: "15:20", location: "STEM Building", reminder: 45 },
    { title: "Pull", type: "workout", start: "17:00", end: "18:10", location: "IM Circle", reminder: 30 },
    { title: "Study block", type: "study", start: "19:00", end: "21:00", location: "Home", reminder: 15 },
  ],
  4: [
    { title: "WRA 101", type: "class", start: "13:00", end: "14:20", location: "Wells Hall", reminder: 40 },
    { title: "Office hours", type: "study", start: "15:00", end: "16:00", location: "STEM Building", reminder: 20 },
    { title: "Cafe shift", type: "work", start: "17:00", end: "21:00", location: "Campus cafe", reminder: 60 },
  ],
  5: [
    { title: "CSE 331 · Algorithms", type: "class", start: "14:00", end: "15:20", location: "STEM Building", reminder: 45 },
    { title: "Cafe shift", type: "work", start: "16:30", end: "20:30", location: "Campus cafe", reminder: 60 },
  ],
  6: [
    { title: "Cafe shift", type: "work", start: "14:00", end: "18:00", location: "Campus cafe", reminder: 75 },
    { title: "Legs", type: "workout", start: "19:00", end: "20:10", location: "IM Circle", reminder: 30 },
  ],
  0: [
    { title: "Weekly review", type: "study", start: "16:00", end: "18:00", location: "Home", reminder: 15 },
    { title: "Meal prep", type: "meal", start: "18:30", end: "19:30", location: "Home", reminder: 15 },
  ],
};

const plans: Record<string, { name: string; sets: Array<{ reps?: number; weight?: number; durationSeconds?: number }> }[]> = {
  Push: [
    { name: "Bench press", sets: [{ reps: 8, weight: 95 }, { reps: 8, weight: 95 }, { reps: 6, weight: 105 }] },
    { name: "Overhead press", sets: [{ reps: 8, weight: 55 }, { reps: 8, weight: 55 }, { reps: 8, weight: 55 }] },
    { name: "Incline dumbbell press", sets: [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }, { reps: 10, weight: 40 }] },
    { name: "Plank", sets: [{ durationSeconds: 40 }, { durationSeconds: 40 }, { durationSeconds: 40 }] },
  ],
  Pull: [
    { name: "Lat pulldown", sets: [{ reps: 10, weight: 90 }, { reps: 10, weight: 90 }, { reps: 10, weight: 90 }] },
    { name: "Seated row", sets: [{ reps: 10, weight: 70 }, { reps: 10, weight: 70 }, { reps: 10, weight: 70 }] },
    { name: "Face pull", sets: [{ reps: 12, weight: 30 }, { reps: 12, weight: 30 }, { reps: 12, weight: 30 }] },
    { name: "Dumbbell curl", sets: [{ reps: 10, weight: 25 }, { reps: 10, weight: 25 }, { reps: 10, weight: 25 }] },
  ],
  Legs: [
    { name: "Back squat", sets: [{ reps: 6, weight: 135 }, { reps: 6, weight: 135 }, { reps: 6, weight: 135 }] },
    { name: "Romanian deadlift", sets: [{ reps: 8, weight: 115 }, { reps: 8, weight: 115 }, { reps: 8, weight: 115 }] },
    { name: "Walking lunge", sets: [{ reps: 10, weight: 25 }, { reps: 10, weight: 25 }, { reps: 10, weight: 25 }] },
    { name: "Calf raise", sets: [{ reps: 15, weight: 0 }, { reps: 15, weight: 0 }, { reps: 15, weight: 0 }] },
  ],
};

const foods = [
  { name: "Greek yogurt and granola", meal: "breakfast" as const, calories: 420, proteinG: 28, carbsG: 48, fatG: 12, time: "11:40" },
  { name: "Chicken wrap", meal: "lunch" as const, calories: 680, proteinG: 42, carbsG: 62, fatG: 24, time: "15:10" },
  { name: "Protein bar", meal: "snack" as const, calories: 210, proteinG: 20, carbsG: 22, fatG: 7, time: "17:40" },
  { name: "Rice bowl", meal: "dinner" as const, calories: 740, proteinG: 38, carbsG: 84, fatG: 22, time: "20:15" },
];

async function main() {
  assertCanSeed();
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
  await getSettings();

  const today = todayDateString();
  const start = weekStartDate(today);
  for (let offset = 0; offset < 10; offset += 1) {
    const date = addCalendarDays(start, offset);
    for (const block of week[calendarWeekday(date)] ?? []) {
      await createEvent({
        title: block.title,
        type: block.type,
        date,
        startTime: block.start,
        endTime: block.end,
        location: block.location,
        reminderMinutesBefore: block.reminder,
      });
      const plan = plans[block.title];
      if (!plan) continue;
      const workout = await createWorkout({
        title: block.title,
        date,
        time: block.start,
        reminderMinutesBefore: 30,
        exercises: plan.map((exercise) => ({
          name: exercise.name,
          libraryId: resolveExercise(null, exercise.name)?.id ?? null,
          sets: exercise.sets.map((set) => ({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: "lb" as const,
            durationSeconds: set.durationSeconds ?? null,
            completed: date < today,
          })),
        })),
      });
      if (date < today) await updateWorkout(workout.id, { status: "done" });
    }
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addCalendarDays(start, offset);
    if (date > today) continue;
    const menu = date === today ? foods.slice(0, 3) : foods;
    for (const item of menu) {
      const wobble = (offset % 3) * 15;
      await createFood({
        name: item.name,
        meal: item.meal,
        calories: item.calories - wobble,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        date,
        time: item.time,
      });
    }
  }

  await createReminder({
    title: "Pack the gym bag",
    body: "Shoes, headphones, and a lock.",
    date: addCalendarDays(today, 1),
    time: "21:00",
  });

  for (let offset = 6; offset >= 0; offset -= 1) {
    const wake = addCalendarDays(today, -offset);
    if (wake > today) continue;
    const afterMidnight = offset % 2 === 0;
    await logSleep({
      date: wake,
      bedtime: afterMidnight ? "01:30" : "23:15",
      wakeTime: "11:00",
      quality: 3 + (offset % 3),
    });
    if (wake === today) {
      await createWater({ ounces: 16, date: wake, time: "12:30" });
      await createWater({ ounces: 16, date: wake, time: "16:00" });
      await createWater({ ounces: 16, date: wake, time: "20:15" });
    } else if (offset < 6) {
      await createWater({ ounces: 80 + offset * 4, date: wake, time: "18:00" });
    }
  }

  const stretch = await createHabit({ name: "Stretch", remind: true });
  const read = await createHabit({ name: "Read 20 min", remind: true });
  await createHabit({ name: "Hit protein goal", auto: "protein" });
  await createHabit({ name: "Hit water goal", auto: "water" });
  await createHabit({ name: "Vitamins", days: [1, 2, 3, 4, 5], remind: true });
  for (let offset = 1; offset <= 4; offset += 1) {
    await setHabitCheck(stretch.id, { date: addCalendarDays(today, -offset), done: true });
  }
  await setHabitCheck(read.id, { date: addCalendarDays(today, -1), done: true });
  await setHabitCheck(read.id, { date: addCalendarDays(today, -2), done: true });

  await ensureMealReminders(new Date());
  await addActivity({
    source: "system",
    author: "Orbit",
    message: "Sample week is loaded. Change anything — classes, shifts, and meals are examples.",
  });
  await addActivity({
    source: "bot",
    author: "Scheduler",
    message: "Friday's cafe shift starts at 4:30 so there's a cushion after CSE 331.",
  });
  await addActivity({
    source: "bot",
    author: "Coach",
    message: "Push day is bench, overhead press, incline dumbbells, and a short plank finisher.",
  });
  console.log(`Seeded example week around ${today} (America/Detroit).`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb();
  process.exit(1);
});
