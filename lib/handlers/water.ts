import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { routeId } from "../ids";
import { requireDate } from "../query";
import { createWater, deleteWater, getWaterDay } from "../services/water";
import { todayDateString } from "../time";
import { waterCreateSchema } from "../validation";

export async function getWater(req: Request) {
  const date = requireDate(new URL(req.url).searchParams.get("date"), todayDateString());
  return json({ timezone: TIMEZONE, today: todayDateString(), ...(await getWaterDay(date)) });
}

export async function postWater(req: Request) {
  const input = waterCreateSchema.parse(await readJson(req));
  return json(await createWater(input), 201);
}

export async function removeWater(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteWater(await routeId(ctx)));
}
