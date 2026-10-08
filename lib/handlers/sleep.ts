import { json, readJson } from "../api";
import { TIMEZONE } from "../constants";
import { routeId } from "../ids";
import { requireDate } from "../query";
import { deleteSleep, getSleep, logSleep } from "../services/sleep";
import { todayDateString } from "../time";
import { sleepLogSchema } from "../validation";

export async function getSleepRoute(req: Request) {
  const date = requireDate(new URL(req.url).searchParams.get("date"), todayDateString());
  return json({ timezone: TIMEZONE, today: todayDateString(), ...(await getSleep(date)) });
}

export async function postSleep(req: Request) {
  const input = sleepLogSchema.parse(await readJson(req));
  return json(await logSleep(input), 201);
}

export async function removeSleep(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteSleep(await routeId(ctx)));
}
