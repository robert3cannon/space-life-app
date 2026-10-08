import { json, readJson } from "../api";
import { circuitDetail, listCircuits } from "../circuits";
import { equipmentSummary } from "../equipment";
import { HttpError } from "../errors";
import { completeCircuit, scheduleCircuit } from "../services/circuits";
import { getSettings } from "../services/settings";
import { circuitCompleteSchema, circuitScheduleSchema } from "../validation";

export async function getCircuits(req: Request) {
  const equipment = (await getSettings()).equipment;
  const muscle = new URL(req.url).searchParams.get("muscle") || undefined;
  const circuits = listCircuits(muscle, equipment);
  return json({ count: circuits.length, equipment, equipmentLabel: equipmentSummary(equipment), circuits });
}

export async function getCircuitById(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const equipment = (await getSettings()).equipment;
  const { id } = await ctx.params;
  return json(circuitDetail(decodeURIComponent(id), equipment));
}

export async function postCircuitSchedule(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const input = circuitScheduleSchema.parse(await readJson(req));
  return json(await scheduleCircuit(decodeURIComponent(id), input), 201);
}

export async function postCircuitComplete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError("Expected a JSON body", 400);
    }
  }
  const input = circuitCompleteSchema.parse(body);
  return json(await completeCircuit(decodeURIComponent(id), input), 201);
}
