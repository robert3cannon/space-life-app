import { asc, eq, inArray } from "drizzle-orm";
import { deleteItemImage, imageByteLimit, readItemImage, signClosetImage, writeItemImage } from "../closet-image";
import { getDb, getSql } from "../db";
import { closetCategories, closetItems, outfitSlots, outfits } from "../db/schema";
import { HttpError } from "../errors";
import {
  DEFAULT_CATEGORIES,
  occasionFor,
  pickOutfit,
  type ClosetSlot,
  type OutfitSlot,
  type PickItem,
  type StyleTag,
  type WeatherSnap,
} from "../outfit-picker";
import { todayDateString, zonedDayRange } from "../time";
import type { ClosetCategoryDto, ClosetItemDto, OutfitDto } from "../types";
import type { ClosetCategoryWrite, ClosetItemPatch, OutfitSet } from "../validation";
import { eastLansingWeather } from "../weather";
import { listEvents } from "./events";

const SLOTS: OutfitSlot[] = ["top", "bottom", "layer", "shoes"];

function cleanList(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export async function ensureCategories() {
  const db = getDb();
  const existing = await db.select().from(closetCategories);
  if (existing.length) return;
  await db.insert(closetCategories).values(DEFAULT_CATEGORIES);
}

export async function listCategories(): Promise<ClosetCategoryDto[]> {
  await ensureCategories();
  const db = getDb();
  const rows = await db.select().from(closetCategories).orderBy(asc(closetCategories.position), asc(closetCategories.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slot: row.slot as ClosetSlot,
    position: row.position,
  }));
}

export async function createCategory(input: ClosetCategoryWrite) {
  await ensureCategories();
  const db = getDb();
  const rows = await db.select().from(closetCategories);
  const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  try {
    const [row] = await db
      .insert(closetCategories)
      .values({ name: input.name.trim(), slot: input.slot, position })
      .returning();
    return { id: row.id, name: row.name, slot: row.slot as ClosetSlot, position: row.position };
  } catch {
    throw new HttpError("That category already exists", 400);
  }
}

export async function updateCategory(id: string, input: Partial<ClosetCategoryWrite>) {
  const db = getDb();
  const [current] = await db.select().from(closetCategories).where(eq(closetCategories.id, id));
  if (!current) throw new HttpError("Category not found", 404);
  try {
    const [row] = await db
      .update(closetCategories)
      .set({
        name: input.name?.trim() ?? current.name,
        slot: input.slot ?? current.slot,
      })
      .where(eq(closetCategories.id, id))
      .returning();
    return { id: row.id, name: row.name, slot: row.slot as ClosetSlot, position: row.position };
  } catch {
    throw new HttpError("That category already exists", 400);
  }
}

export async function deleteCategory(id: string) {
  const db = getDb();
  const [current] = await db.select().from(closetCategories).where(eq(closetCategories.id, id));
  if (!current) throw new HttpError("Category not found", 404);
  const used = await db.select({ id: closetItems.id }).from(closetItems).where(eq(closetItems.categoryId, id)).limit(1);
  if (used.length) throw new HttpError("Move the clothes out of this category first", 400);
  await db.delete(closetCategories).where(eq(closetCategories.id, id));
  return { ok: true };
}

function itemDto(row: typeof closetItems.$inferSelect, category: ClosetCategoryDto, origin: string | null, signed: boolean): ClosetItemDto {
  const hasImage = Boolean(row.imageType || row.blobPathname);
  let imageUrl: string | null = null;
  if (hasImage) {
    imageUrl = signed && origin ? signClosetImage(row.id, origin) : `/api/closet/items/${row.id}/image`;
  }
  return {
    id: row.id,
    name: row.name,
    categoryId: category.id,
    category: category.name,
    slot: category.slot,
    colors: row.colors ?? [],
    warmth: row.warmth,
    tags: row.tags ?? [],
    inLaundry: row.inLaundry,
    imageUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function categoryMap() {
  const categories = await listCategories();
  return new Map(categories.map((category) => [category.id, category]));
}

export async function listItems(origin: string | null, signed: boolean): Promise<ClosetItemDto[]> {
  const db = getDb();
  const categories = await categoryMap();
  const rows = await db.select().from(closetItems).orderBy(asc(closetItems.createdAt));
  return rows.map((row) => {
    const category = categories.get(row.categoryId);
    if (!category) throw new HttpError("Category missing", 500);
    return itemDto(row, category, origin, signed);
  });
}

export async function getItem(id: string, origin: string | null, signed: boolean) {
  const db = getDb();
  const [row] = await db.select().from(closetItems).where(eq(closetItems.id, id));
  if (!row) throw new HttpError("Item not found", 404);
  const categories = await categoryMap();
  const category = categories.get(row.categoryId);
  if (!category) throw new HttpError("Category missing", 500);
  return itemDto(row, category, origin, signed);
}

function defaultName(filename: string | undefined) {
  const base = (filename ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  if (!base || /^img\s*\d*$/i.test(base)) return "New item";
  return base.slice(0, 80);
}

export async function createItem(input: {
  name?: string;
  filename?: string;
  categoryId?: string;
  colors?: string[];
  warmth?: number;
  tags?: string[];
  inLaundry?: boolean;
  image?: { bytes: Buffer; type: string } | null;
}) {
  if (input.image && input.image.bytes.length > imageByteLimit()) {
    throw new HttpError("Image is too large. Keep it under 1.5 MB.", 400);
  }
  const categories = await listCategories();
  const category = categories.find((row) => row.id === input.categoryId) ?? categories.find((row) => row.slot === "top") ?? categories[0];
  if (!category) throw new HttpError("Add a category first", 400);
  const db = getDb();
  const [row] = await db
    .insert(closetItems)
    .values({
      name: (input.name?.trim() || defaultName(input.filename)).slice(0, 80),
      categoryId: category.id,
      colors: cleanList(input.colors ?? []),
      warmth: input.warmth ?? 3,
      tags: cleanList(input.tags ?? ["casual"]),
      inLaundry: input.inLaundry ?? false,
    })
    .returning();
  if (input.image) await writeItemImage(row.id, input.image.bytes, input.image.type);
  return getItem(row.id, null, false);
}

export async function updateItem(id: string, patch: ClosetItemPatch) {
  const db = getDb();
  const [current] = await db.select().from(closetItems).where(eq(closetItems.id, id));
  if (!current) throw new HttpError("Item not found", 404);
  if (patch.categoryId) {
    const categories = await categoryMap();
    if (!categories.has(patch.categoryId)) throw new HttpError("Category not found", 400);
  }
  await db
    .update(closetItems)
    .set({
      name: patch.name?.trim() ?? current.name,
      categoryId: patch.categoryId ?? current.categoryId,
      colors: patch.colors ? cleanList(patch.colors) : current.colors,
      warmth: patch.warmth ?? current.warmth,
      tags: patch.tags ? cleanList(patch.tags) : current.tags,
      inLaundry: patch.inLaundry ?? current.inLaundry,
      updatedAt: new Date(),
    })
    .where(eq(closetItems.id, id));
  return getItem(id, null, false);
}

export async function deleteItem(id: string) {
  const db = getDb();
  const [current] = await db.select().from(closetItems).where(eq(closetItems.id, id));
  if (!current) throw new HttpError("Item not found", 404);
  await deleteItemImage(id);
  await db.delete(closetItems).where(eq(closetItems.id, id));
  return { ok: true };
}

export async function itemImage(id: string) {
  const image = await readItemImage(id);
  if (!image) throw new HttpError("No photo", 404);
  return image;
}

async function lastWornBefore(date: string) {
  const sql = getSql();
  const rows = await sql<{ item_id: string; last: string }[]>`
    SELECT s.item_id, max(o.wear_date) AS last
    FROM outfit_slots s
    JOIN outfits o ON o.id = s.outfit_id
    WHERE o.worn_at IS NOT NULL AND o.wear_date < ${date}
    GROUP BY s.item_id
  `;
  return new Map(rows.map((row) => [row.item_id, row.last]));
}

async function eventsOn(date: string) {
  const range = zonedDayRange(date);
  const rows = await listEvents(range.from, range.to);
  return rows.map((row) => ({ type: row.type }));
}

async function pickInputs(date: string): Promise<PickItem[]> {
  const items = await listItems(null, false);
  const worn = await lastWornBefore(date);
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    slot: item.slot,
    category: item.category,
    colors: item.colors,
    warmth: item.warmth,
    tags: item.tags,
    inLaundry: item.inLaundry,
    lastWorn: worn.get(item.id) ?? null,
  }));
}

function asWeather(value: unknown): WeatherSnap | null {
  if (!value || typeof value !== "object") return null;
  const row = value as WeatherSnap;
  if (typeof row.tempF !== "number") return null;
  return row;
}

async function readOutfit(date: string, origin: string | null, signed: boolean): Promise<OutfitDto | null> {
  const db = getDb();
  const [outfit] = await db.select().from(outfits).where(eq(outfits.wearDate, date));
  if (!outfit) return null;
  const slots = await db.select().from(outfitSlots).where(eq(outfitSlots.outfitId, outfit.id));
  const ids = slots.map((slot) => slot.itemId);
  const itemRows = ids.length ? await db.select().from(closetItems).where(inArray(closetItems.id, ids)) : [];
  const categories = await categoryMap();
  const items = new Map(itemRows.map((row) => [row.id, row]));
  const weather = asWeather(outfit.weather);
  return {
    id: outfit.id,
    date: outfit.wearDate,
    reason: outfit.reason,
    source: outfit.source === "bot" ? "bot" : "rules",
    wornAt: outfit.wornAt ? outfit.wornAt.toISOString() : null,
    weather: weather
      ? { tempF: Math.round(weather.tempF), label: weather.label, place: "East Lansing", live: weather.live !== false }
      : null,
    items: SLOTS.flatMap((slot) => {
      const link = slots.find((row) => row.slot === slot);
      if (!link) return [];
      const row = items.get(link.itemId);
      if (!row) return [];
      const category = categories.get(row.categoryId);
      if (!category) return [];
      const dto = itemDto(row, category, origin, signed);
      return [{ ...dto, slot }];
    }),
  };
}

async function savePick(date: string, slots: Partial<Record<OutfitSlot, string>>, reason: string, source: "rules" | "bot", weather: WeatherSnap | null, generation: number) {
  const db = getDb();
  const [existing] = await db.select().from(outfits).where(eq(outfits.wearDate, date));
  const row = existing
    ? (
        await db
          .update(outfits)
          .set({
            reason,
            source,
            weather,
            generation,
            wornAt: null,
            updatedAt: new Date(),
          })
          .where(eq(outfits.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(outfits)
          .values({ wearDate: date, reason, source, weather, generation })
          .returning()
      )[0];
  await db.delete(outfitSlots).where(eq(outfitSlots.outfitId, row.id));
  const links = SLOTS.flatMap((slot) => (slots[slot] ? [{ outfitId: row.id, slot, itemId: slots[slot]! }] : []));
  if (links.length) await db.insert(outfitSlots).values(links);
}

export async function ensureOutfit(date: string, origin: string | null, signed: boolean, options?: { force?: boolean; salt?: number; avoidIds?: string[]; swapSlot?: OutfitSlot }) {
  const current = await readOutfit(date, origin, signed);
  if (current && !options?.force && !options?.swapSlot) return current;
  const closet = await pickInputs(date);
  if (!closet.some((item) => !item.inLaundry && (item.slot === "top" || item.slot === "bottom"))) {
    return current;
  }
  const weather = current?.weather
    ? { tempF: current.weather.tempF, code: 0, label: current.weather.label, live: current.weather.live }
    : await eastLansingWeather();
  const occasion = occasionFor(await eventsOn(date)) as StyleTag;
  const db = getDb();
  const [stored] = await db.select().from(outfits).where(eq(outfits.wearDate, date));
  const generation = (stored?.generation ?? 0) + (options?.force || options?.swapSlot ? 1 : 0);
  const locked: Partial<Record<OutfitSlot, string>> = {};
  if (options?.swapSlot && current) {
    for (const item of current.items) {
      if (item.slot !== options.swapSlot) locked[item.slot] = item.id;
    }
  }
  const picked = pickOutfit({
    items: closet,
    tempF: weather.tempF,
    occasion,
    date,
    salt: options?.salt ?? generation,
    avoidIds: options?.avoidIds ?? (options?.swapSlot && current ? current.items.filter((item) => item.slot === options.swapSlot).map((item) => item.id) : []),
    locked,
    swapSlot: options?.swapSlot,
    weatherLive: weather.live,
  });
  if (!picked.slots.top && !picked.slots.bottom) return current;
  await savePick(date, picked.slots, picked.reason, "rules", weather, generation);
  return readOutfit(date, origin, signed);
}

export async function outfitForDate(date: string, origin: string | null, signed: boolean, create: boolean) {
  if (!create) return readOutfit(date, origin, signed);
  return ensureOutfit(date, origin, signed);
}

export async function refreshOutfit(date: string, origin: string | null, signed: boolean) {
  const current = await readOutfit(date, origin, signed);
  return ensureOutfit(date, origin, signed, {
    force: true,
    avoidIds: current?.items.map((item) => item.id) ?? [],
  });
}

export async function swapOutfitSlot(date: string, slot: OutfitSlot, origin: string | null, signed: boolean) {
  const current = await ensureOutfit(date, origin, signed);
  if (!current) throw new HttpError("Add a top and a bottom first", 400);
  return ensureOutfit(date, origin, signed, { swapSlot: slot });
}

export async function wearOutfit(date: string, origin: string | null, signed: boolean) {
  const current = await ensureOutfit(date, origin, signed);
  if (!current) throw new HttpError("There's no outfit to log", 400);
  const db = getDb();
  await db.update(outfits).set({ wornAt: new Date(), updatedAt: new Date() }).where(eq(outfits.wearDate, date));
  return readOutfit(date, origin, signed);
}

export async function setOutfit(input: OutfitSet, origin: string | null, signed: boolean) {
  const db = getDb();
  const rows = await db.select().from(closetItems).where(inArray(closetItems.id, input.itemIds));
  if (rows.length !== input.itemIds.length) throw new HttpError("One of those clothes is missing", 400);
  const categories = await categoryMap();
  const slots: Partial<Record<OutfitSlot, string>> = {};
  for (const row of rows) {
    const category = categories.get(row.categoryId);
    if (!category || category.slot === "extra") continue;
    if (slots[category.slot]) throw new HttpError(`Two ${category.slot} items in one outfit`, 400);
    slots[category.slot] = row.id;
  }
  if (!Object.keys(slots).length) throw new HttpError("Pick at least one wearable item", 400);
  const [existing] = await db.select().from(outfits).where(eq(outfits.wearDate, input.date));
  const weather = asWeather(existing?.weather) ?? (await eastLansingWeather());
  await savePick(input.date, slots, input.reason.trim(), "bot", weather, (existing?.generation ?? 0) + 1);
  return readOutfit(input.date, origin, signed);
}

export async function outfitHistory(limit: number, origin: string | null, signed: boolean) {
  const db = getDb();
  const rows = await db.select().from(outfits).orderBy(asc(outfits.wearDate));
  const recent = rows.slice(-limit).reverse();
  const result: OutfitDto[] = [];
  for (const row of recent) {
    const outfit = await readOutfit(row.wearDate, origin, signed);
    if (outfit) result.push(outfit);
  }
  return result;
}

export async function outfitNudge(now = new Date()) {
  const date = todayDateString(now);
  const outfit = await ensureOutfit(date, null, false);
  if (!outfit || !outfit.items.length) return null;
  const names = outfit.items.map((item) => item.name).join(", ");
  const temp = outfit.weather ? `${outfit.weather.tempF}°F. ` : "";
  return {
    title: "Today's outfit",
    body: `${temp}${names}`.slice(0, 220),
  };
}

export function requestOrigin(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
