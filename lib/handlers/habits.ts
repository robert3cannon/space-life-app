import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { routeId } from "../ids";
import { requireDate } from "../query";
import { createHabit, deleteHabit, habitMonth, listHabits, setHabitCheck, updateHabit } from "../services/habits";
import { todayDateString } from "../time";
import { habitCheckSchema, habitCreateSchema, habitPatchSchema } from "../validation";

export async function getHabits(req: Request) {
  const date = requireDate(new URL(req.url).searchParams.get("date"), todayDateString());
  return json({ timezone: TIMEZONE, ...(await listHabits(date)) });
}

export async function postHabit(req: Request) {
  const input = habitCreateSchema.parse(await readJson(req));
  return json(await createHabit(input), 201);
}

export async function getHabit(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const month = new URL(req.url).searchParams.get("month") ?? todayDateString().slice(0, 7);
  return json({ timezone: TIMEZONE, ...(await habitMonth(await routeId(ctx), month)) });
}

export async function patchHabit(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = habitPatchSchema.parse(await readJson(req));
  return json(await updateHabit(await routeId(ctx), input));
}

export async function removeHabit(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteHabit(await routeId(ctx)));
}

export async function postHabitCheck(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = habitCheckSchema.parse(await readJson(req));
  return json(await setHabitCheck(await routeId(ctx), input));
}
