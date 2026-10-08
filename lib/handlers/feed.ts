import { json, readJson } from "../api";
import { limitParam } from "../query";
import { addActivity, listActivity } from "../services/activity";
import { displayName } from "../profile";
import { feedSchema } from "../validation";
import type { ActivityDto } from "../types";

export async function getFeed(req: Request) {
  const limit = limitParam(new URL(req.url), 40, 200);
  return json({ activity: await listActivity(limit) });
}

export function postFeed(source: ActivityDto["source"]) {
  return async (req: Request) => {
    const input = feedSchema.parse(await readJson(req));
    const author = input.author ?? (source === "bot" ? "Bot" : displayName());
    return json(await addActivity({ source, author, message: input.message }), 201);
  };
}
