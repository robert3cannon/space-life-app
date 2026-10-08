import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { HttpError } from "../errors";
import { routeId } from "../ids";
import { parseRange, requireDate } from "../query";
import { lookupBarcode, searchFoods } from "../services/food-catalog";
import { createFood, createMeal, deleteFood, foodSummary, foodWindow, getFoodLog, placeSuggestions, recentFoods, recentMeals, sumFood, updateFood } from "../services/food";
import { getSettings } from "../services/settings";
import { todayDateString, zonedDayRange } from "../time";
import { foodCreateSchema, foodPatchSchema, mealCreateSchema } from "../validation";

function isMealBody(body: unknown) {
  return Boolean(body && typeof body === "object" && "items" in body && Array.isArray((body as { items: unknown }).items));
}

export async function getFood(req: Request) {
  const url = new URL(req.url);
  const today = todayDateString();
  if (url.searchParams.get("from") || url.searchParams.get("to")) {
    const range = parseRange(url);
    const { logs, meals } = await foodWindow(range.from, range.to);
    const prefs = await getSettings();
    return json({
      timezone: TIMEZONE,
      today,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      targets: prefs.targets,
      totals: sumFood(logs),
      logs,
      meals,
    });
  }
  const date = requireDate(url.searchParams.get("date"), today);
  const day = zonedDayRange(date);
  const [{ logs, meals }, prefs, recent, recentMealList, places] = await Promise.all([
    foodWindow(day.from, day.to),
    getSettings(),
    recentFoods(),
    recentMeals(),
    placeSuggestions(),
  ]);
  return json({
    timezone: TIMEZONE,
    today,
    date,
    targets: prefs.targets,
    totals: sumFood(logs),
    logs,
    meals,
    recent,
    recentMeals: recentMealList,
    places,
  });
}

export async function postFood(req: Request) {
  const body = await readJson(req);
  if (isMealBody(body)) return json(await createMeal(mealCreateSchema.parse(body)), 201);
  return json(await createFood(foodCreateSchema.parse(body)), 201);
}

export async function getFoodById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await getFoodLog(await routeId(ctx)));
}

export async function patchFood(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = foodPatchSchema.parse(await readJson(req));
  return json(await updateFood(await routeId(ctx), input));
}

export async function removeFood(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteFood(await routeId(ctx)));
}

export async function getRecentFood(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("limit");
  const limit = raw ? Number(raw) : 12;
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) throw new HttpError("Invalid limit", 400);
  return json({ foods: await recentFoods(limit) });
}

function searchLimit(raw: string | null) {
  if (!raw) return 8;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw new HttpError("Invalid limit", 400);
  return limit;
}

export async function getFoodSearch(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const foods = await searchFoods(query, searchLimit(url.searchParams.get("limit")));
  return json({ query: query.trim(), foods });
}

export async function getFoodBarcode(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return json({ food: await lookupBarcode(code) });
}

export async function getFoodSummary(req: Request) {
  const url = new URL(req.url);
  const date = requireDate(url.searchParams.get("date"), todayDateString());
  return json(await foodSummary(date));
}
