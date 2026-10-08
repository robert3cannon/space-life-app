import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "../db";
import {
  foodLogs,
  healthDays,
  healthExports,
  healthSync,
  healthTokens,
  healthWeights,
  sleepLogs,
  waterLogs,
  workoutExercises,
  workoutSets,
  workouts,
} from "../db/schema";
import { healthActivityExercise } from "../health-activity";
import { parseHealthPayload, type HealthDayMetrics, type ParsedWorkout } from "../health-parse";
import { TIMEZONE } from "../constants";
import { round1 } from "../format";
import { todayDateString, zonedDayRange } from "../time";
import { reconcileAutoHabits } from "./habits";

export type HealthSyncSummary = {
  days: number;
  workouts: number;
  sleepNights: number;
  sleepSkippedManual: number;
  weights: number;
  latestDate: string | null;
  steps: number | null;
  activeKcal: number | null;
  restingKcal: number | null;
  exerciseMinutes: number | null;
  restingHr: number | null;
  dietaryWaterOz: number | null;
};

function notesFor(workout: ParsedWorkout) {
  const bits = ["Apple Health"];
  if (workout.calories != null) bits.push(`${Math.round(workout.calories)} kcal`);
  if (workout.distance) bits.push(workout.distance);
  return bits.join(" · ");
}

function dayPatch(day: HealthDayMetrics) {
  const patch: {
    steps?: number | null;
    activeKcal?: number | null;
    restingKcal?: number | null;
    exerciseMinutes?: number | null;
    restingHr?: number | null;
    dietaryWaterOz?: number | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (day.present.steps) patch.steps = day.steps;
  if (day.present.activeKcal) patch.activeKcal = day.activeKcal;
  if (day.present.restingKcal) patch.restingKcal = day.restingKcal;
  if (day.present.exerciseMinutes) patch.exerciseMinutes = day.exerciseMinutes;
  if (day.present.restingHr) patch.restingHr = day.restingHr;
  if (day.present.dietaryWaterOz) patch.dietaryWaterOz = day.dietaryWaterOz;
  return patch;
}

async function writeExercise(
  tx: Pick<ReturnType<typeof getDb>, "insert">,
  workoutId: string,
  workout: ParsedWorkout,
) {
  const mapped = healthActivityExercise(workout.type);
  const [exercise] = await tx
    .insert(workoutExercises)
    .values({
      workoutId,
      name: mapped.name,
      libraryId: mapped.libraryId,
      position: 0,
    })
    .returning();
  if (workout.durationMinutes <= 0) return;
  await tx.insert(workoutSets).values({
    exerciseId: exercise.id,
    position: 0,
    durationSeconds: Math.max(1, Math.round(workout.durationMinutes * 60)),
    completed: true,
    weightUnit: "lb",
  });
}

export async function importHealth(input: unknown, now = new Date()) {
  const parsed = parseHealthPayload(input, now);
  const db = getDb();
  let sleepNights = 0;
  let sleepSkippedManual = 0;

  await db.transaction(async (tx) => {
    for (const day of parsed.days) {
      const patch = dayPatch(day);
      const [existing] = await tx.select().from(healthDays).where(eq(healthDays.date, day.date));
      if (!existing) await tx.insert(healthDays).values({ date: day.date, ...patch });
      else await tx.update(healthDays).set(patch).where(eq(healthDays.date, day.date));
    }

    for (const workout of parsed.workouts) {
      const values = {
        title: workout.type,
        scheduledAt: workout.start,
        completedAt: workout.end,
        status: "done",
        notes: notesFor(workout),
        reminderMinutesBefore: null,
        healthKey: workout.key,
        updatedAt: new Date(),
      };
      const [existing] = await tx.select().from(workouts).where(eq(workouts.healthKey, workout.key));
      let workoutId = existing?.id;
      if (!existing) {
        const [created] = await tx.insert(workouts).values(values).returning();
        workoutId = created.id;
      } else {
        await tx.update(workouts).set(values).where(eq(workouts.id, existing.id));
        await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, existing.id));
      }
      if (workoutId) await writeExercise(tx, workoutId, workout);
    }

    for (const night of parsed.nights) {
      const [existing] = await tx.select().from(sleepLogs).where(eq(sleepLogs.wakeDate, night.wakeDate));
      if (existing?.source === "manual") {
        sleepSkippedManual += 1;
        continue;
      }
      const values = {
        wakeDate: night.wakeDate,
        bedtime: night.bedtime,
        wakeAt: night.wakeAt,
        durationMinutes: night.durationMinutes,
        quality: existing?.quality ?? null,
        notes: existing?.source === "health" && existing.notes && existing.notes !== "Apple Health" ? existing.notes : "Apple Health",
        source: "health",
        updatedAt: new Date(),
      };
      if (!existing) await tx.insert(sleepLogs).values(values);
      else await tx.update(sleepLogs).set(values).where(eq(sleepLogs.id, existing.id));
      sleepNights += 1;
    }

    for (const weight of parsed.weights) {
      await tx
        .insert(healthWeights)
        .values({ measuredAt: weight.measuredAt, pounds: weight.pounds })
        .onConflictDoUpdate({
          target: healthWeights.measuredAt,
          set: { pounds: weight.pounds },
        });
    }
  });

  const latest = [...parsed.days].sort((a, b) => b.date.localeCompare(a.date))[0];
  const summary: HealthSyncSummary = {
    days: parsed.days.length,
    workouts: parsed.workouts.length,
    sleepNights,
    sleepSkippedManual,
    weights: parsed.weights.length,
    latestDate: latest?.date ?? null,
    steps: latest?.present.steps ? latest.steps : null,
    activeKcal: latest?.present.activeKcal ? latest.activeKcal : null,
    restingKcal: latest?.present.restingKcal ? latest.restingKcal : null,
    exerciseMinutes: latest?.present.exerciseMinutes ? latest.exerciseMinutes : null,
    restingHr: latest?.present.restingHr ? latest.restingHr : null,
    dietaryWaterOz: latest?.present.dietaryWaterOz ? latest.dietaryWaterOz : null,
  };
  await db
    .insert(healthSync)
    .values({ id: "latest", syncedAt: now, summary })
    .onConflictDoUpdate({
      target: healthSync.id,
      set: { syncedAt: now, summary },
    });
  await reconcileAutoHabits(todayDateString(now));
  return { ok: true as const, ...summary };
}

export async function deviceHealthToken() {
  const db = getDb();
  const [row] = await db.select().from(healthTokens).where(eq(healthTokens.id, "device"));
  return row?.token ?? null;
}

export async function generateHealthToken() {
  const token = randomBytes(24).toString("base64url");
  const createdAt = new Date();
  const db = getDb();
  await db
    .insert(healthTokens)
    .values({ id: "device", token, createdAt })
    .onConflictDoUpdate({
      target: healthTokens.id,
      set: { token, createdAt },
    });
  return { token, createdAt: createdAt.toISOString() };
}

export async function revokeHealthToken() {
  const db = getDb();
  await db.delete(healthTokens).where(eq(healthTokens.id, "device"));
  return { ok: true as const, token: null };
}

export async function healthForDate(date: string) {
  const db = getDb();
  const [row] = await db.select().from(healthDays).where(eq(healthDays.date, date));
  if (!row) return null;
  const snapshot = {
    steps: row.steps,
    activeKcal: row.activeKcal == null ? null : round1(row.activeKcal),
    exerciseMinutes: row.exerciseMinutes == null ? null : round1(row.exerciseMinutes),
    dietaryWaterOz: row.dietaryWaterOz == null ? null : round1(row.dietaryWaterOz),
  };
  if (snapshot.steps == null && snapshot.activeKcal == null && snapshot.exerciseMinutes == null && snapshot.dietaryWaterOz == null) {
    return null;
  }
  return snapshot;
}

export async function healthStatus() {
  const db = getDb();
  const [token, sync, weights] = await Promise.all([
    db.select().from(healthTokens).where(eq(healthTokens.id, "device")),
    db.select().from(healthSync).where(eq(healthSync.id, "latest")),
    db.select().from(healthWeights).orderBy(desc(healthWeights.measuredAt)).limit(30),
  ]);
  const summary = (sync[0]?.summary ?? null) as HealthSyncSummary | null;
  return {
    token: token[0]?.token ?? null,
    tokenCreatedAt: token[0] ? token[0].createdAt.toISOString() : null,
    envTokenConfigured: Boolean(process.env.HEALTH_SYNC_TOKEN),
    lastSync: sync[0] && summary ? { syncedAt: sync[0].syncedAt.toISOString(), summary } : null,
    weights: weights
      .reverse()
      .map((row) => ({ measuredAt: row.measuredAt.toISOString(), pounds: round1(row.pounds) })),
  };
}

function foodExport(row: typeof foodLogs.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    meal: row.meal,
    calories: row.calories,
    proteinG: round1(row.proteinG),
    carbsG: round1(row.carbsG),
    fatG: round1(row.fatG),
    loggedAt: row.loggedAt.toISOString(),
  };
}

function waterExport(row: typeof waterLogs.$inferSelect) {
  return {
    id: row.id,
    ounces: round1(row.ounces),
    loggedAt: row.loggedAt.toISOString(),
  };
}

export async function healthExport(date = todayDateString()) {
  const day = zonedDayRange(date);
  const db = getDb();
  const [foodRows, waterRows] = await Promise.all([
    db
      .select()
      .from(foodLogs)
      .where(and(gte(foodLogs.loggedAt, day.from), lt(foodLogs.loggedAt, day.to)))
      .orderBy(asc(foodLogs.loggedAt)),
    db
      .select()
      .from(waterLogs)
      .where(and(gte(waterLogs.loggedAt, day.from), lt(waterLogs.loggedAt, day.to)))
      .orderBy(asc(waterLogs.loggedAt)),
  ]);
  const foodIds = foodRows.map((row) => row.id);
  const waterIds = waterRows.map((row) => row.id);
  const [ackedFood, ackedWater] = await Promise.all([
    foodIds.length
      ? db
          .select({ sourceId: healthExports.sourceId })
          .from(healthExports)
          .where(and(eq(healthExports.kind, "food"), inArray(healthExports.sourceId, foodIds)))
      : Promise.resolve([]),
    waterIds.length
      ? db
          .select({ sourceId: healthExports.sourceId })
          .from(healthExports)
          .where(and(eq(healthExports.kind, "water"), inArray(healthExports.sourceId, waterIds)))
      : Promise.resolve([]),
  ]);
  const foodDone = new Set(ackedFood.map((row) => row.sourceId));
  const waterDone = new Set(ackedWater.map((row) => row.sourceId));
  return {
    date,
    timezone: TIMEZONE,
    food: foodRows.filter((row) => !foodDone.has(row.id)).map(foodExport),
    water: waterRows.filter((row) => !waterDone.has(row.id)).map(waterExport),
  };
}

export async function ackHealthExport(input: { food?: string[]; water?: string[] }) {
  const rows = [
    ...(input.food ?? []).map((sourceId) => ({ kind: "food", sourceId })),
    ...(input.water ?? []).map((sourceId) => ({ kind: "water", sourceId })),
  ];
  if (!rows.length) return { ok: true as const, acked: 0 };
  const db = getDb();
  await db.insert(healthExports).values(rows).onConflictDoNothing({
    target: [healthExports.kind, healthExports.sourceId],
  });
  return { ok: true as const, acked: rows.length };
}
