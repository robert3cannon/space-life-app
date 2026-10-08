import { json, readJson } from "../api";
import { routeId } from "../ids";
import { createReminder, deleteReminder, getReminder, listReminders, updateReminder } from "../services/reminders";
import { reminderCreateSchema, reminderPatchSchema } from "../validation";

export async function getReminders() {
  return json(await listReminders());
}

export async function postReminder(req: Request) {
  const input = reminderCreateSchema.parse(await readJson(req));
  return json(await createReminder(input), 201);
}

export async function getReminderById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await getReminder(await routeId(ctx)));
}

export async function patchReminder(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = reminderPatchSchema.parse(await readJson(req));
  return json(await updateReminder(await routeId(ctx), input));
}

export async function removeReminder(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteReminder(await routeId(ctx)));
}
