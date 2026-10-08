import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { HttpError } from "../errors";
import { routeId, routeMealItem } from "../ids";
import { parseRange, requireDate } from "../query";
import {
  addMealItem,
  createMeal,
  deleteMeal,
  deleteMealItem,
  foodWindow,
  getMeal,
  placeSuggestions,
  recentMeals,
  sumFood,
  updateMeal,
  updateMealItem,
} from "../services/food";
import { todayDateString, zonedDayRange } from "../time";
import { mealCreateSchema, mealItemPatchSchema, mealItemWriteSchema, mealPatchSchema } from "../validation";

export async function getMeals(req: Request) {
  const url = new URL(req.url);
  const today = todayDateString();
  if (url.searchParams.get("from") || url.searchParams.get("to")) {
    const range = parseRange(url);
    const { meals, logs } = await foodWindow(range.from, range.to);
    return json({
      timezone: TIMEZONE,
      today,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totals: sumFood(logs),
      meals,
    });
  }
  const date = requireDate(url.searchParams.get("date"), today);
  const day = zonedDayRange(date);
  const [{ meals, logs }, recent, places] = await Promise.all([foodWindow(day.from, day.to), recentMeals(), placeSuggestions()]);
  return json({
    timezone: TIMEZONE,
    today,
    date,
    totals: sumFood(logs),
    meals,
    recentMeals: recent,
    places,
  });
}

export async function postMeal(req: Request) {
  const input = mealCreateSchema.parse(await readJson(req));
  return json(await createMeal(input), 201);
}

export async function getMealById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await getMeal(await routeId(ctx)));
}

export async function patchMeal(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = mealPatchSchema.parse(await readJson(req));
  return json(await updateMeal(await routeId(ctx), input));
}

export async function removeMeal(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteMeal(await routeId(ctx)));
}

export async function postMealItem(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = mealItemWriteSchema.parse(await readJson(req));
  return json(await addMealItem(await routeId(ctx), input), 201);
}

export async function patchMealItem(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await routeMealItem(ctx);
  const input = mealItemPatchSchema.parse(await readJson(req));
  if (!Object.keys(input).length) throw new HttpError("Nothing to update", 400);
  return json(await updateMealItem(id, itemId, input));
}

export async function removeMealItem(_req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await routeMealItem(ctx);
  const meal = await deleteMealItem(id, itemId);
  return json(meal ?? { ok: true, meal: null });
}
