import { json, readJson } from "../api";
import { HttpError } from "../errors";
import { deliverPush, isPushConfigured } from "../push";
import { notifySchema } from "../validation";

export async function postNotify(req: Request) {
  if (!isPushConfigured()) throw new HttpError("Push is not configured", 503);
  const input = notifySchema.parse(await readJson(req));
  const result = await deliverPush({
    title: input.title,
    body: input.body,
    url: input.url ?? "/",
    tag: `bot-${Date.now()}`,
  });
  return json(result);
}
