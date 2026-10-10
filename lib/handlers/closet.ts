import { isAuthedRequest, isBotRequest } from "../auth";
import { error, json, readJson } from "../api";
import { closetImageSignatureOk, imageByteLimit } from "../closet-image";
import { HttpError } from "../errors";
import { routeId } from "../ids";
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  itemImage,
  listCategories,
  listItems,
  outfitForDate,
  outfitHistory,
  refreshOutfit,
  requestOrigin,
  setOutfit,
  swapOutfitSlot,
  updateCategory,
  updateItem,
  wearOutfit,
} from "../services/closet";
import { todayDateString } from "../time";
import {
  closetCategoryPatchSchema,
  closetCategorySchema,
  closetItemPatchSchema,
  outfitSetSchema,
  outfitSwapSchema,
} from "../validation";

function originOf(req: Request, signed: boolean) {
  return signed ? requestOrigin(req) : null;
}

function dateOf(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return todayDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("date must be YYYY-MM-DD", 400);
  return date;
}

export async function getCloset(req: Request) {
  const signed = isBotRequest(req);
  const items = await listItems(originOf(req, signed), signed);
  const categories = await listCategories();
  return json({ count: items.length, items, categories });
}

export async function postClosetItem(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError("Choose a photo", 400);
  if (file.size > imageByteLimit()) throw new HttpError("Image is too large. Keep it under 1.5 MB.", 400);
  const type = file.type || "image/jpeg";
  if (!["image/jpeg", "image/jpg", "image/webp", "image/png"].includes(type)) {
    throw new HttpError("Use a JPEG, WebP, or PNG", 400);
  }
  const colors = String(form.get("colors") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const tags = String(form.get("tags") ?? "casual")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const warmth = Number(form.get("warmth") ?? 3);
  const item = await createItem({
    name: String(form.get("name") ?? ""),
    filename: file.name,
    categoryId: String(form.get("categoryId") ?? "") || undefined,
    colors,
    warmth: Number.isInteger(warmth) ? warmth : 3,
    tags,
    inLaundry: form.get("inLaundry") === "true",
    image: { bytes: Buffer.from(await file.arrayBuffer()), type: type === "image/jpg" ? "image/jpeg" : type },
  });
  return json(item, 201);
}

export async function patchClosetItem(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx);
  const input = closetItemPatchSchema.parse(await readJson(req));
  return json(await updateItem(id, input));
}

export async function deleteClosetItem(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteItem(await routeId(ctx)));
}

export async function getClosetImage(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = await routeId(ctx);
  const url = new URL(req.url);
  const allowed =
    (await isAuthedRequest(req)) ||
    isBotRequest(req) ||
    closetImageSignatureOk(id, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (!allowed) return error("Unauthorized", 401);
  const image = await itemImage(id);
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.type,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function getCategories() {
  return json({ categories: await listCategories() });
}

export async function postCategory(req: Request) {
  const input = closetCategorySchema.parse(await readJson(req));
  return json(await createCategory(input), 201);
}

export async function patchCategory(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const input = closetCategoryPatchSchema.parse(await readJson(req));
  return json(await updateCategory(await routeId(ctx), input));
}

export async function removeCategory(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return json(await deleteCategory(await routeId(ctx)));
}

export async function getOutfit(req: Request) {
  const signed = isBotRequest(req);
  const date = dateOf(req);
  const create = date === todayDateString();
  const outfit = await outfitForDate(date, originOf(req, signed), signed, create);
  return json({ outfit });
}

export async function postOutfit(req: Request) {
  const signed = isBotRequest(req);
  const input = outfitSetSchema.parse(await readJson(req));
  return json({ outfit: await setOutfit(input, originOf(req, signed), signed) });
}

export async function postNewOutfit(req: Request) {
  const date = dateOf(req);
  return json({ outfit: await refreshOutfit(date, null, false) });
}

export async function postSwapOutfit(req: Request) {
  const input = outfitSwapSchema.parse(await readJson(req));
  const date = input.date ?? todayDateString();
  return json({ outfit: await swapOutfitSlot(date, input.slot, null, false) });
}

export async function postWearOutfit(req: Request) {
  const date = dateOf(req);
  return json({ outfit: await wearOutfit(date, null, false) });
}

export async function getOutfitHistory(req: Request) {
  const signed = isBotRequest(req);
  const raw = new URL(req.url).searchParams.get("limit");
  const limit = raw ? Number(raw) : 30;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError("limit must be 1–100", 400);
  const history = await outfitHistory(limit, originOf(req, signed), signed);
  return json({ count: history.length, outfits: history });
}
