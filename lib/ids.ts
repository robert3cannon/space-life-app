import { HttpError } from "./errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function routeId(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || !UUID_RE.test(id)) throw new HttpError("Not found", 404);
  return id;
}

export async function routeMealItem(ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await ctx.params;
  if (!id || !itemId || !UUID_RE.test(id) || !UUID_RE.test(itemId)) throw new HttpError("Not found", 404);
  return { id, itemId };
}
