import { and, asc, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { RESTAURANT_CHAINS } from "../../data/restaurant-foods";
import { getDb, getSql } from "../db";
import { mealItems, meals } from "../db/schema";
import { HttpError } from "../errors";
import { round1 } from "../format";
import { getZonedParts, todayDateString, zonedDateTimeToUtc, zonedWeekRange } from "../time";
import { blankToNull } from "../text";
import type { FoodDto, MealDto, MealType, Targets } from "../types";
import type { FoodCreate, FoodPatch, MealCreate, MealItemPatch, MealItemWrite, MealPatch } from "../validation";
import { serializeFood, serializeMealItem } from "./dto";
import { getSettings } from "./settings";

type Joined = {
  item: typeof mealItems.$inferSelect;
  meal: typeof meals.$inferSelect;
};

function emptyTotals(): Targets {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

export function sumFood(logs: Array<Pick<FoodDto, "calories" | "proteinG" | "carbsG" | "fatG">>): Targets {
  return logs.reduce<Targets>((totals, log) => {
    totals.calories += log.calories;
    totals.proteinG = round1(totals.proteinG + log.proteinG);
    totals.carbsG = round1(totals.carbsG + log.carbsG);
    totals.fatG = round1(totals.fatG + log.fatG);
    return totals;
  }, emptyTotals());
}

export function mergePlaceSuggestions(recent: string[], chains: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };
  add("Home");
  for (const chain of chains) add(chain);
  for (const place of recent) add(place);
  return out;
}

function resolveLoggedAt(input: { loggedAt?: string; date?: string; time?: string }, fallback?: Date) {
  if (input.date || input.time) {
    const now = new Date();
    const date = input.date ?? (fallback ? getZonedParts(fallback).date : todayDateString(now));
    const time = input.time ?? (fallback ? getZonedParts(fallback).time : getZonedParts(now).time);
    return zonedDateTimeToUtc(date, time);
  }
  if (input.loggedAt) {
    const date = new Date(input.loggedAt);
    if (Number.isNaN(date.getTime())) throw new HttpError("Invalid loggedAt", 400);
    return date;
  }
  return fallback ?? new Date();
}

export async function ensureMeals() {
  const sql = getSql();
  await sql`
    INSERT INTO meals (id, place, meal, logged_at, notes, created_at)
    SELECT f.id, 'Home', f.meal, f.logged_at, f.notes, f.created_at
    FROM food_logs f
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO meal_items (
      id, meal_id, name, calories, protein_g, carbs_g, fat_g, quantity, position, created_at
    )
    SELECT f.id, f.id, f.name, f.calories, f.protein_g, f.carbs_g, f.fat_g, 1, 0, f.created_at
    FROM food_logs f
    ON CONFLICT (id) DO NOTHING
  `;
}

function selectJoined(where?: SQL) {
  const db = getDb();
  return db
    .select({ item: mealItems, meal: meals })
    .from(mealItems)
    .innerJoin(meals, eq(mealItems.mealId, meals.id))
    .where(where)
    .orderBy(asc(meals.loggedAt), asc(mealItems.position), asc(mealItems.createdAt));
}

function groupMeals(rows: Joined[]): MealDto[] {
  const map = new Map<string, MealDto>();
  const order: string[] = [];
  for (const row of rows) {
    let meal = map.get(row.meal.id);
    if (!meal) {
      meal = {
        id: row.meal.id,
        place: row.meal.place,
        meal: row.meal.meal as MealType,
        loggedAt: row.meal.loggedAt.toISOString(),
        notes: row.meal.notes,
        createdAt: row.meal.createdAt.toISOString(),
        itemCount: 0,
        totals: emptyTotals(),
        items: [],
      };
      map.set(row.meal.id, meal);
      order.push(row.meal.id);
    }
    meal.items.push(serializeMealItem(row.item));
  }
  for (const meal of map.values()) {
    meal.itemCount = meal.items.length;
    meal.totals = sumFood(meal.items);
  }
  return order.map((id) => map.get(id)!);
}

function itemInsert(mealId: string, item: MealItemWrite, position: number) {
  return {
    mealId,
    name: item.name.trim(),
    brand: blankToNull(item.brand),
    calories: item.calories,
    proteinG: item.proteinG ?? 0,
    carbsG: item.carbsG ?? 0,
    fatG: item.fatG ?? 0,
    grams: item.grams ?? null,
    quantity: item.quantity ?? 1,
    servingLabel: blankToNull(item.servingLabel),
    sourceId: blankToNull(item.sourceId),
    position,
  };
}

async function findItem(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ item: mealItems, meal: meals })
    .from(mealItems)
    .innerJoin(meals, eq(mealItems.mealId, meals.id))
    .where(eq(mealItems.id, id));
  return row ?? null;
}

export async function foodWindow(from: Date, to: Date) {
  await ensureMeals();
  const rows = await selectJoined(and(gte(meals.loggedAt, from), lt(meals.loggedAt, to)));
  return {
    logs: rows.map((row) => serializeFood(row.item, row.meal)),
    meals: groupMeals(rows),
  };
}

export async function listFood(from: Date, to: Date) {
  return (await foodWindow(from, to)).logs;
}

export async function listMeals(from: Date, to: Date) {
  return (await foodWindow(from, to)).meals;
}

export async function recentFoods(limit = 12) {
  await ensureMeals();
  const db = getDb();
  const rows = await db
    .select({ item: mealItems, meal: meals })
    .from(mealItems)
    .innerJoin(meals, eq(mealItems.mealId, meals.id))
    .orderBy(desc(meals.loggedAt), desc(mealItems.createdAt))
    .limit(80);
  const seen = new Set<string>();
  const recent: FoodDto[] = [];
  for (const row of rows) {
    const key = row.item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(serializeFood(row.item, row.meal));
    if (recent.length >= limit) break;
  }
  return recent;
}

function mealSignature(meal: MealDto) {
  const names = meal.items.map((item) => item.name.trim().toLowerCase()).sort().join("|");
  return `${(meal.place ?? "").trim().toLowerCase()}::${names}`;
}

export async function recentMeals(limit = 8) {
  await ensureMeals();
  const db = getDb();
  const latest = await db.select({ id: meals.id }).from(meals).orderBy(desc(meals.loggedAt)).limit(40);
  if (!latest.length) return [];
  const ids = latest.map((row) => row.id);
  const grouped = groupMeals(await selectJoined(inArray(meals.id, ids)));
  const byId = new Map(grouped.map((meal) => [meal.id, meal]));
  const seen = new Set<string>();
  const recent: MealDto[] = [];
  for (const id of ids) {
    const meal = byId.get(id);
    if (!meal) continue;
    const key = mealSignature(meal);
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(meal);
    if (recent.length >= limit) break;
  }
  return recent;
}

export async function recentPlaces(limit = 8) {
  await ensureMeals();
  const db = getDb();
  const rows = await db.select({ place: meals.place }).from(meals).orderBy(desc(meals.loggedAt)).limit(40);
  const places: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const place = row.place?.trim();
    if (!place) continue;
    const key = place.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(place);
    if (places.length >= limit) break;
  }
  return places;
}

export async function placeSuggestions() {
  const recent = await recentPlaces();
  return mergePlaceSuggestions(
    recent,
    RESTAURANT_CHAINS.map((chain) => chain.name),
  );
}

export async function getMeal(id: string) {
  await ensureMeals();
  const [meal] = groupMeals(await selectJoined(eq(meals.id, id)));
  if (!meal) throw new HttpError("Meal not found", 404);
  return meal;
}

export async function getFoodLog(id: string) {
  await ensureMeals();
  const row = await findItem(id);
  if (!row) throw new HttpError("Food log not found", 404);
  return serializeFood(row.item, row.meal);
}

export async function createMeal(input: MealCreate) {
  await ensureMeals();
  const db = getDb();
  const [meal] = await db
    .insert(meals)
    .values({
      place: input.place.trim(),
      meal: input.meal ?? "snack",
      loggedAt: resolveLoggedAt(input),
      notes: blankToNull(input.notes),
    })
    .returning();
  if (!meal) throw new HttpError("Couldn't save that meal", 500);
  await db.insert(mealItems).values(input.items.map((item, position) => itemInsert(meal.id, item, position)));
  return getMeal(meal.id);
}

export async function createFood(input: FoodCreate) {
  const meal = await createMeal({
    place: "Home",
    meal: input.meal,
    loggedAt: input.loggedAt,
    date: input.date,
    time: input.time,
    notes: input.notes,
    items: [
      {
        name: input.name,
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
      },
    ],
  });
  const item = meal.items[0];
  if (!item) throw new HttpError("Couldn't save that food", 500);
  return getFoodLog(item.id);
}

export async function updateMeal(id: string, patch: MealPatch) {
  await ensureMeals();
  const existing = await getMeal(id);
  const db = getDb();
  await db
    .update(meals)
    .set({
      place: patch.place?.trim() ?? existing.place,
      meal: patch.meal ?? existing.meal,
      loggedAt: patch.loggedAt || patch.date || patch.time ? resolveLoggedAt(patch, new Date(existing.loggedAt)) : new Date(existing.loggedAt),
      notes: "notes" in patch ? blankToNull(patch.notes) : existing.notes,
    })
    .where(eq(meals.id, id));
  if (patch.items) {
    const currentIds = existing.items.map((item) => item.id);
    const keep = new Set(patch.items.flatMap((item) => (item.id && currentIds.includes(item.id) ? [item.id] : [])));
    const remove = currentIds.filter((itemId) => !keep.has(itemId));
    if (remove.length) {
      await db.delete(mealItems).where(and(eq(mealItems.mealId, id), inArray(mealItems.id, remove)));
    }
    for (const [position, item] of patch.items.entries()) {
      if (item.id && keep.has(item.id)) {
        await db
          .update(mealItems)
          .set({ ...itemInsert(id, item, position) })
          .where(and(eq(mealItems.id, item.id), eq(mealItems.mealId, id)));
      } else {
        await db.insert(mealItems).values(itemInsert(id, item, position));
      }
    }
  }
  return getMeal(id);
}

export async function updateFood(id: string, patch: FoodPatch) {
  await ensureMeals();
  const current = await findItem(id);
  if (!current) throw new HttpError("Food log not found", 404);
  const db = getDb();
  await db
    .update(mealItems)
    .set({
      name: patch.name ?? current.item.name,
      calories: patch.calories ?? current.item.calories,
      proteinG: patch.proteinG ?? current.item.proteinG,
      carbsG: patch.carbsG ?? current.item.carbsG,
      fatG: patch.fatG ?? current.item.fatG,
    })
    .where(eq(mealItems.id, id));
  await db
    .update(meals)
    .set({
      meal: patch.meal ?? current.meal.meal,
      loggedAt: patch.loggedAt || patch.date || patch.time ? resolveLoggedAt(patch, current.meal.loggedAt) : current.meal.loggedAt,
      notes: "notes" in patch ? blankToNull(patch.notes) : current.meal.notes,
    })
    .where(eq(meals.id, current.meal.id));
  return getFoodLog(id);
}

export async function deleteMeal(id: string) {
  await ensureMeals();
  const db = getDb();
  const [current] = await db.select({ id: meals.id }).from(meals).where(eq(meals.id, id));
  if (!current) throw new HttpError("Meal not found", 404);
  await db.delete(meals).where(eq(meals.id, id));
  return { ok: true as const };
}

export async function deleteFood(id: string) {
  await ensureMeals();
  const current = await findItem(id);
  if (!current) throw new HttpError("Food log not found", 404);
  const db = getDb();
  await db.delete(mealItems).where(eq(mealItems.id, id));
  const left = await db.select({ id: mealItems.id }).from(mealItems).where(eq(mealItems.mealId, current.meal.id));
  if (!left.length) await db.delete(meals).where(eq(meals.id, current.meal.id));
  return { ok: true as const };
}

export async function addMealItem(mealId: string, item: MealItemWrite) {
  await ensureMeals();
  const meal = await getMeal(mealId);
  const position = meal.items.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  await getDb().insert(mealItems).values(itemInsert(mealId, item, position));
  return getMeal(mealId);
}

export async function updateMealItem(mealId: string, itemId: string, patch: MealItemPatch) {
  await ensureMeals();
  const current = await findItem(itemId);
  if (!current || current.meal.id !== mealId) throw new HttpError("Meal item not found", 404);
  await getDb()
    .update(mealItems)
    .set({
      name: patch.name ?? current.item.name,
      brand: "brand" in patch ? blankToNull(patch.brand) : current.item.brand,
      calories: patch.calories ?? current.item.calories,
      proteinG: patch.proteinG ?? current.item.proteinG,
      carbsG: patch.carbsG ?? current.item.carbsG,
      fatG: patch.fatG ?? current.item.fatG,
      grams: "grams" in patch ? (patch.grams ?? null) : current.item.grams,
      quantity: patch.quantity ?? current.item.quantity,
      servingLabel: "servingLabel" in patch ? blankToNull(patch.servingLabel) : current.item.servingLabel,
      sourceId: "sourceId" in patch ? blankToNull(patch.sourceId) : current.item.sourceId,
    })
    .where(eq(mealItems.id, itemId));
  return getMeal(mealId);
}

export async function deleteMealItem(mealId: string, itemId: string) {
  await ensureMeals();
  const current = await findItem(itemId);
  if (!current || current.meal.id !== mealId) throw new HttpError("Meal item not found", 404);
  const db = getDb();
  await db.delete(mealItems).where(eq(mealItems.id, itemId));
  const left = await db.select({ id: mealItems.id }).from(mealItems).where(eq(mealItems.mealId, mealId));
  if (!left.length) {
    await db.delete(meals).where(eq(meals.id, mealId));
    return null;
  }
  return getMeal(mealId);
}

export async function foodSummary(date: string) {
  const prefs = await getSettings();
  const week = zonedWeekRange(date);
  const logs = await listFood(week.from, week.to);
  const days = week.dates.map((day) => {
    const totals = sumFood(logs.filter((log) => getZonedParts(new Date(log.loggedAt)).date === day));
    return { date: day, ...totals };
  });
  return {
    timezone: prefs.timezone,
    startDate: week.startDate,
    dates: week.dates,
    targets: prefs.targets,
    days,
    totals: sumFood(logs),
  };
}
