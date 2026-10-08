import { TIMEZONE } from "../constants";
import { json } from "../api";
import { routeId } from "../ids";
import { parseRange } from "../query";
import { readJson } from "../api";
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from "../services/events";
import { serializeEvent } from "../services/dto";
import { HttpError } from "../errors";
import { eventCreateSchema, eventPatchSchema } from "../validation";

export async function getEvents(req: Request) {
  const parsed = parseRange(new URL(req.url));
  const items = await listEvents(parsed.from, parsed.to);
  return json({
    timezone: TIMEZONE,
    today: parsed.today,
    from: parsed.from.toISOString(),
    to: parsed.to.toISOString(),
    startDate: "startDate" in parsed ? parsed.startDate : null,
    dates: "dates" in parsed ? parsed.dates : [],
    events: items,
  });
}

export async function postEvent(req: Request) {
  const input = eventCreateSchema.parse(await readJson(req));
  return json(await createEvent(input), 201);
}

export async function getEventById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx);
  const row = await getEvent(id);
  if (!row) throw new HttpError("Event not found", 404);
  return json(serializeEvent(row));
}

export async function patchEvent(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx);
  const input = eventPatchSchema.parse(await readJson(req));
  return json(await updateEvent(id, input));
}

export async function removeEvent(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx);
  return json(await deleteEvent(id));
}
