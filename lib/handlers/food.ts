import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { HttpError } from "../errors";
import { routeId } from "../ids";
import { parseRange, requireDate } from "../query";
import { createFood, deleteFood, foodSummary, getFoodLog, listFood, recentFoods, sumFood, updateFood } from "../services/food";
import { getSettings } from "../services/settings";
import { todayDateString, zonedDayRange } from "../time";
import { foodCreateSchema, foodPatchSchema } from "../validation";

export async function getFood(req: Request) {
  const url = new URL(req.url);
  const today = todayDateString();
  if (url.searchParams.get("from") || url.searchParams.get("to")) {
    const range = parseRange(url);
    const logs = await listFood(range.from, range.to);
    const prefs = await getSettings();
    return json({
      timezone: TIMEZONE,
      today,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      targets: prefs.targets,
      totals: sumFood(logs),
      logs,
    });
  }
  const date = requireDate(url.searchParams.get("date"), today);
  const day = zonedDayRange(date);
  const [logs, prefs, recent] = await Promise.all([listFood(day.from, day.to), getSettings(), recentFoods()]);
  return json({
    timezone: TIMEZONE,
    today,
    date,
    targets: prefs.targets,
    totals: sumFood(logs),
    logs,
    recent,
  });
}

export async function postFood(req: Request) {
  const input = foodCreateSchema.parse(await readJson(req));
  return json(await createFood(input), 201);
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

export async function getFoodSummary(req: Request) {
  const url = new URL(req.url);
  const date = requireDate(url.searchParams.get("date"), todayDateString());
  return json(await foodSummary(date));
}
