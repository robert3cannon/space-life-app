import { json, readJson } from "../api";
import { requireDate } from "../query";
import {
  ackHealthExport,
  generateHealthToken,
  healthExport,
  healthStatus,
  importHealth,
  revokeHealthToken,
} from "../services/health";
import { todayDateString } from "../time";
import { healthAckSchema, healthTokenSchema } from "../validation";

export async function postHealthImport(req: Request) {
  return json(await importHealth(await readJson(req)));
}

export async function getHealthExport(req: Request) {
  const date = requireDate(new URL(req.url).searchParams.get("date"), todayDateString());
  return json(await healthExport(date));
}

export async function postHealthAck(req: Request) {
  const input = healthAckSchema.parse(await readJson(req));
  return json(await ackHealthExport(input));
}

export async function getHealthStatus() {
  return json(await healthStatus());
}

export async function postHealthToken(req: Request) {
  const input = healthTokenSchema.parse(await readJson(req));
  if (input.action === "revoke") return json(await revokeHealthToken());
  return json(await generateHealthToken());
}
