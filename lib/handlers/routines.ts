import { json, readJson } from "../api";
import { HttpError } from "../errors";
import { routeId } from "../ids";
import {
  createRoutine,
  deleteRoutine,
  getRoutine,
  getSession,
  listRoutines,
  listSessions,
  logSession,
  scheduleRoutine,
  updateRoutine,
} from "../services/routines";
import { routineScheduleSchema, routineWriteSchema, sessionLogSchema } from "../validation";

function readLimit(url: URL) {
  const raw = url.searchParams.get("limit");
  if (!raw) return 30;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError("limit must be 1–100", 400);
  }
  return limit;
}

export async function getRoutines() {
  const routines = await listRoutines();
  return json({ count: routines.length, routines });
}

export async function postRoutine(req: Request) {
  const input = routineWriteSchema.parse(await readJson(req));
  return json(await createRoutine(input), 201);
}

export async function getRoutineById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const routine = await getRoutine(await routeId(ctx));
  if (!routine) throw new HttpError("Workout not found", 404);
  return json(routine);
}

export async function patchRoutine(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = routineWriteSchema.parse(await readJson(req));
  return json(await updateRoutine(await routeId(ctx), input));
}

export async function removeRoutine(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteRoutine(await routeId(ctx)));
}

export async function postRoutineSchedule(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = routineScheduleSchema.parse(await readJson(req));
  return json(await scheduleRoutine(await routeId(ctx), input), 201);
}

export async function getSessions(req: Request) {
  const sessions = await listSessions(readLimit(new URL(req.url)));
  return json({ count: sessions.length, sessions });
}

export async function postSession(req: Request) {
  const input = sessionLogSchema.parse(await readJson(req));
  return json(await logSession(input), 201);
}

export async function getSessionById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession(await routeId(ctx));
  if (!session) throw new HttpError("Workout not found", 404);
  return json(session);
}
