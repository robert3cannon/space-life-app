export const CLOSET_SLOTS = ["top", "bottom", "layer", "shoes", "extra"] as const;
export type ClosetSlot = (typeof CLOSET_SLOTS)[number];

export const OUTFIT_SLOTS = ["top", "bottom", "layer", "shoes"] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];

export const STYLE_TAGS = ["casual", "gym", "dressy", "class", "work"] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

export const DEFAULT_CATEGORIES: { name: string; slot: ClosetSlot; position: number }[] = [
  { name: "Shirts/T-shirts", slot: "top", position: 0 },
  { name: "Long sleeves", slot: "top", position: 1 },
  { name: "Pants", slot: "bottom", position: 2 },
  { name: "Shorts", slot: "bottom", position: 3 },
  { name: "Hoodies", slot: "layer", position: 4 },
  { name: "Jackets", slot: "layer", position: 5 },
  { name: "Shoes", slot: "shoes", position: 6 },
  { name: "Accessories", slot: "extra", position: 7 },
];

const NEUTRALS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "navy",
  "beige",
  "khaki",
  "brown",
  "cream",
  "tan",
  "olive",
  "charcoal",
  "denim",
  "blue",
]);

export type PickItem = {
  id: string;
  name: string;
  slot: ClosetSlot;
  category: string;
  colors: string[];
  warmth: number;
  tags: string[];
  inLaundry: boolean;
  /** Last worn date, YYYY-MM-DD, before the day being planned. */
  lastWorn: string | null;
};

export type WeatherSnap = {
  tempF: number;
  code: number;
  label: string;
  /** False when the forecast request failed and the temperature is a mild stand-in. */
  live: boolean;
};

export function weatherLabel(code: number) {
  if (code < 0) return "Mild";
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 95) return "Thunder";
  return "Mixed";
}

export function occasionFor(events: { type: string }[]): StyleTag {
  if (events.some((event) => event.type === "work")) return "work";
  if (events.some((event) => event.type === "class")) return "class";
  if (events.some((event) => event.type === "workout")) return "gym";
  return "casual";
}

export function layerForTemp(tempF: number): "jacket" | "hoodie" | null {
  if (tempF < 50) return "jacket";
  if (tempF <= 62) return "hoodie";
  return null;
}

export function shortsAllowed(tempF: number) {
  return tempF >= 72;
}

function norm(color: string) {
  return color.trim().toLowerCase();
}

export function colorsPair(left: string[], right: string[]) {
  const a = left.map(norm).filter(Boolean);
  const b = right.map(norm).filter(Boolean);
  if (!a.length || !b.length) return true;
  if (a.every((color) => NEUTRALS.has(color)) || b.every((color) => NEUTRALS.has(color))) return true;
  return a.some((color) => b.includes(color));
}

function daysBefore(date: string, earlier: string) {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${earlier}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

function recent(item: PickItem, date: string) {
  if (!item.lastWorn) return false;
  const gap = daysBefore(date, item.lastWorn);
  return gap > 0 && gap <= 4;
}

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

function categoryKind(category: string) {
  const name = category.toLowerCase();
  if (name.includes("jacket")) return "jacket";
  if (name.includes("hoodie")) return "hoodie";
  if (name.includes("short")) return "shorts";
  if (name.includes("pant")) return "pants";
  if (name.includes("long")) return "long";
  if (name.includes("shirt") || name.includes("tee") || name.includes("t-shirt")) return "shirt";
  return "other";
}

function scoreItem(item: PickItem, tempF: number, occasion: StyleTag, partner: PickItem | null) {
  let score = 0;
  if (item.tags.includes(occasion)) score += 8;
  else if (item.tags.includes("casual") || item.tags.length === 0) score += occasion === "casual" ? 3 : 1;
  else score -= 3;

  const kind = categoryKind(item.category);
  if (item.slot === "top") {
    if (tempF < 55) score += item.warmth * 2 + (kind === "long" ? 5 : 0);
    else if (tempF >= 72) score += (6 - item.warmth) * 2 + (kind === "shirt" ? 4 : 0);
    else score += 4 - Math.abs(item.warmth - 3);
  }
  if (item.slot === "bottom") {
    if (tempF >= 72 && kind === "shorts") score += 8;
    if (tempF < 72 && kind === "shorts") score -= 40;
    if (tempF < 72 && kind === "pants") score += 6;
  }
  if (item.slot === "layer") {
    const want = layerForTemp(tempF);
    if (!want) score -= 50;
    else if (want === "jacket") score += kind === "jacket" ? 12 + item.warmth : kind === "hoodie" ? 4 : 0;
    else score += kind === "hoodie" ? 12 : kind === "jacket" ? 3 : 0;
  }
  if (item.slot === "shoes") score += 2;
  if (partner && item.slot !== "top") score += colorsPair(partner.colors, item.colors) ? 6 : -5;
  return score;
}

type Scored = { item: PickItem; score: number };

function pickOne(scored: Scored[], date: string, slot: string, salt: number, avoid: Set<string>): PickItem | null {
  const fresh = scored.filter((row) => !avoid.has(row.item.id));
  const pool = fresh.length ? fresh : scored;
  if (!pool.length) return null;
  const best = Math.max(...pool.map((row) => row.score));
  const tied = pool.filter((row) => row.score === best).sort((a, b) => (a.item.id < b.item.id ? -1 : 1));
  const index = hash(`${date}:${slot}:${salt}`) % tied.length;
  return tied[index].item;
}

export function pickOutfit(input: {
  items: PickItem[];
  tempF: number;
  occasion: StyleTag;
  date: string;
  salt?: number;
  avoidIds?: string[];
  locked?: Partial<Record<OutfitSlot, string>>;
  swapSlot?: OutfitSlot;
  weatherLive?: boolean;
}): { slots: Partial<Record<OutfitSlot, string>>; reason: string } {
  const salt = input.salt ?? 0;
  const avoid = new Set(input.avoidIds ?? []);
  const available = input.items.filter((item) => !item.inLaundry);
  const relaxed = available.filter((item) => !recent(item, input.date));
  const pool = relaxed.length ? relaxed : available;
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const chosen: Partial<Record<OutfitSlot, PickItem>> = {};

  for (const slot of OUTFIT_SLOTS) {
    const lockedId = input.locked?.[slot];
    if (lockedId && input.swapSlot !== slot) {
      const locked = byId.get(lockedId);
      if (locked && !locked.inLaundry && locked.slot === slot) {
        chosen[slot] = locked;
        continue;
      }
    }
    if (slot === "layer" && !layerForTemp(input.tempF)) continue;
    if (slot === "bottom") {
      const hot = shortsAllowed(input.tempF);
      const candidates = pool.filter((item) => item.slot === "bottom" && (hot || categoryKind(item.category) !== "shorts"));
      const scored = (candidates.length ? candidates : pool.filter((item) => item.slot === "bottom")).map((item) => ({
        item,
        score: scoreItem(item, input.tempF, input.occasion, chosen.top ?? null),
      }));
      const pick = pickOne(scored, input.date, slot, salt, avoid);
      if (pick) chosen.bottom = pick;
      continue;
    }
    const candidates = pool.filter((item) => item.slot === slot);
    const scored = candidates.map((item) => ({
      item,
      score: scoreItem(item, input.tempF, input.occasion, chosen.top ?? null),
    }));
    const pick = pickOne(scored, input.date, slot, salt, avoid);
    if (pick) chosen[slot] = pick;
  }

  const slots: Partial<Record<OutfitSlot, string>> = {};
  for (const slot of OUTFIT_SLOTS) {
    if (chosen[slot]) slots[slot] = chosen[slot]!.id;
  }
  return { slots, reason: describeOutfit(chosen, input.tempF, input.occasion, input.weatherLive !== false) };
}

function describeOutfit(
  chosen: Partial<Record<OutfitSlot, PickItem>>,
  tempF: number,
  occasion: StyleTag,
  live: boolean,
) {
  const temp = `${Math.round(tempF)}°F in East Lansing`;
  const day =
    occasion === "class"
      ? "a class day"
      : occasion === "work"
        ? "a work day"
        : occasion === "gym"
          ? "a gym day"
          : "a casual day";
  const lead = live ? `${temp} on ${day}` : `Weather didn't load, so this is a mild outfit for ${day}`;
  const names = OUTFIT_SLOTS.map((slot) => chosen[slot]?.name).filter(Boolean);
  if (!names.length) return `${lead}. Nothing is out of the laundry yet.`;
  let reason = `${lead}. ${names.join(", ")}.`;
  const top = chosen.top;
  const bottom = chosen.bottom;
  if (top && bottom && colorsPair(top.colors, bottom.colors) && top.colors[0]) {
    reason += ` ${top.colors[0]} pairs with the ${bottom.name.toLowerCase()}.`;
  }
  return reason;
}
