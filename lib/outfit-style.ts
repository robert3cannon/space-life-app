/** Generic outfit styling. Personal details such as age and skin tone come from settings, not from this file. */

import type { Fit } from "./closet-fit";
import type { OutfitSlot, PickItem, StyleTag } from "./outfit-picker";

export type Complexion = "light" | "medium" | "deep";

export type StyleContext = {
  complexion: Complexion;
  occasion: StyleTag;
  streetwear: boolean;
  age: number | null;
};

const NEUTRAL = new Set(["black", "white", "gray", "cream", "navy", "olive", "charcoal", "beige", "denim", "khaki"]);
const EARTH = new Set(["tan", "camel", "brown", "khaki"]);
const BLACK = new Set(["black", "charcoal", "gray"]);
const LIFT = new Set(["white", "cream"]);
const LOUD = new Set(["red", "orange", "yellow", "pink", "purple"]);
const FLATTER = new Set(["white", "cream", "olive", "maroon", "camel", "tan", "khaki", "brown", "green", "blue", "pink"]);

const CLASH = pairSet([
  ["red", "green"],
  ["red", "orange"],
  ["red", "pink"],
  ["red", "yellow"],
  ["red", "purple"],
  ["orange", "pink"],
  ["orange", "purple"],
  ["orange", "yellow"],
  ["orange", "green"],
  ["yellow", "purple"],
  ["yellow", "pink"],
  ["yellow", "green"],
  ["purple", "pink"],
]);

const COMPLEMENT = pairSet([
  ["navy", "cream"],
  ["navy", "white"],
  ["navy", "camel"],
  ["navy", "tan"],
  ["navy", "khaki"],
  ["navy", "maroon"],
  ["olive", "cream"],
  ["olive", "white"],
  ["olive", "camel"],
  ["olive", "tan"],
  ["olive", "khaki"],
  ["olive", "maroon"],
  ["maroon", "cream"],
  ["maroon", "white"],
  ["maroon", "gray"],
  ["blue", "white"],
  ["blue", "cream"],
  ["blue", "camel"],
  ["blue", "tan"],
  ["green", "white"],
  ["green", "cream"],
  ["green", "navy"],
  ["pink", "navy"],
  ["pink", "gray"],
  ["pink", "white"],
  ["pink", "cream"],
]);

const PHRASES: [string, string, string][] = [
  ["navy", "cream", "Navy and cream."],
  ["navy", "maroon", "Navy and burgundy."],
  ["olive", "cream", "Olive and cream."],
  ["olive", "maroon", "Olive and burgundy."],
  ["maroon", "cream", "Burgundy and cream."],
  ["green", "cream", "Emerald and cream."],
  ["blue", "white", "Cobalt and white."],
  ["blue", "cream", "Cobalt and cream."],
];

function pairSet(pairs: [string, string][]) {
  return new Set(pairs.map(([left, right]) => pairKey(left, right)));
}

function pairKey(left: string, right: string) {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

export function styleColor(color: string) {
  const name = color.trim().toLowerCase();
  if (name === "grey") return "gray";
  if (name === "burgundy") return "maroon";
  if (name === "emerald") return "green";
  if (name === "cobalt") return "blue";
  return name;
}

export function complexionFor(skinTone: string | null | undefined): Complexion {
  if (skinTone === "brown" || skinTone === "deep") return "deep";
  if (skinTone === "olive" || skinTone === "tan") return "medium";
  return "light";
}

export function wantsStreetwear(prompt: string | null | undefined) {
  return /\b(street\s*wear|streetwear|baggy)\b/i.test(prompt ?? "");
}

function pieceColors(item: PickItem) {
  return item.colors.map(styleColor).filter(Boolean);
}

function unique(colors: string[]) {
  return [...new Set(colors)];
}

function baggy(fit: Fit | undefined) {
  return fit === "oversized" || fit === "relaxed";
}

function shorts(item: PickItem) {
  const text = `${item.name} ${item.category}`.toLowerCase();
  return text.includes("short");
}

export function isWhiteSneaker(item: PickItem) {
  if (item.slot !== "shoes") return false;
  const colors = pieceColors(item);
  if (!colors.includes("white")) return false;
  if (colors.some((color) => color === "brown" || color === "tan" || LOUD.has(color))) return false;
  const name = `${item.name} ${item.category}`.toLowerCase();
  if (/\bboots?\b/.test(name)) return false;
  return true;
}

function shares(left: PickItem, right: PickItem) {
  const colors = new Set(pieceColors(left));
  return pieceColors(right).some((color) => colors.has(color));
}

function bySlot(pieces: PickItem[]) {
  const found = new Map<OutfitSlot, PickItem>();
  for (const piece of pieces) {
    if (piece.slot === "extra") continue;
    found.set(piece.slot, piece);
  }
  return found;
}

export function harmonyScore(pieces: PickItem[], ctx: StyleContext) {
  const slots = bySlot(pieces);
  const present = [...slots.values()];
  if (!present.length) return 0;
  const top = slots.get("top");
  const bottom = slots.get("bottom");
  const layer = slots.get("layer");
  const shoes = slots.get("shoes");
  const hat = slots.get("hat");
  const body = [top, bottom, layer].filter((piece): piece is PickItem => Boolean(piece));
  const palette = unique(present.flatMap(pieceColors));
  const accents = palette.filter((color) => !NEUTRAL.has(color) && !EARTH.has(color));
  let score = 0;
  if (accents.length === 0) score += 3;
  else if (accents.length === 1) score += 4;
  else if (accents.length >= 3) score -= 8;

  const bodyColors = unique(body.flatMap(pieceColors));
  const blackBody = body.length > 0 && bodyColors.every((color) => BLACK.has(color));
  const quietEnds = [shoes, hat].every((piece) => !piece || pieceColors(piece).every((color) => BLACK.has(color) || LIFT.has(color)));
  const mono = blackBody && quietEnds && accents.length === 0;
  if (mono) score += 3;
  const shades = palette.filter((color) => BLACK.has(color));
  if (mono && shades.length >= 2) score += 3;
  const lifted = Boolean((hat && pieceColors(hat).some((color) => LIFT.has(color))) || (shoes && isWhiteSneaker(shoes)));
  if (mono && lifted) score += 2;

  if (top && bottom) {
    const shared = pieceColors(top).filter((color) => pieceColors(bottom).includes(color) && !NEUTRAL.has(color) && !EARTH.has(color));
    if (shared.length) score += 5;
  }

  let complements = 0;
  let clashes = 0;
  for (let i = 0; i < palette.length; i += 1) {
    for (let j = i + 1; j < palette.length; j += 1) {
      const key = pairKey(palette[i], palette[j]);
      if (COMPLEMENT.has(key)) complements += 3;
      if (CLASH.has(key)) clashes += 12;
    }
  }
  score += Math.min(6, complements);
  score -= clashes;

  if (shoes) {
    const shoeColors = pieceColors(shoes);
    const rest = unique(present.filter((piece) => piece.slot !== "shoes").flatMap(pieceColors));
    if (shoeColors.includes("brown") && rest.includes("black")) score -= 12;
    if (shoeColors.some((color) => BLACK.has(color)) && rest.includes("brown")) score -= 12;
    if (isWhiteSneaker(shoes)) score += 4;
    const partners = [top, bottom, hat].filter((piece): piece is PickItem => Boolean(piece));
    if (partners.some((piece) => shares(shoes, piece))) score += 5;
  }

  if (hat && (top || shoes)) {
    const matches = Boolean((top && shares(hat, top)) || (shoes && shares(hat, shoes)));
    const liftCap = pieceColors(hat).some((color) => LIFT.has(color));
    if (matches) score += 6;
    else if (!liftCap) score -= 3;
  }

  if (top && bottom && !shorts(bottom)) {
    const topBaggy = baggy(top.fit);
    const bottomBaggy = baggy(bottom.fit);
    if (topBaggy && !bottomBaggy) score += 8;
    else if (!topBaggy && bottomBaggy) score += 4;
    else if (topBaggy && bottomBaggy) score += ctx.streetwear ? 20 : -10;
    if (ctx.occasion === "dressy" && bottomBaggy && !ctx.streetwear) score -= 4;
    const sharp = !bottomBaggy;
    if (ctx.age != null && ctx.age >= 18 && ctx.age <= 25 && sharp && !ctx.streetwear) score += 2;
  }

  const flatterBonus = ctx.complexion === "deep" ? 3 : ctx.complexion === "medium" ? 1 : 0;
  if (flatterBonus) {
    const flattering = palette.filter((color) => FLATTER.has(color));
    score += Math.min(6, flattering.length * flatterBonus);
  }
  if (ctx.complexion !== "light" && top && pieceColors(top).includes("beige") && !pieceColors(top).some((color) => LIFT.has(color))) {
    score -= ctx.complexion === "deep" ? 8 : 3;
  }
  if (ctx.occasion === "dressy" && accents.length <= 1) score += 2;
  return score;
}

export function styleDelta(item: PickItem, chosen: Partial<Record<OutfitSlot, PickItem | undefined>>, ctx: StyleContext) {
  const before = (Object.values(chosen) as (PickItem | undefined)[]).filter((piece): piece is PickItem => piece != null && piece.slot !== item.slot);
  return harmonyScore([...before, item], ctx) - harmonyScore(before, ctx);
}

function accentLabel(color: string) {
  return color === "maroon" ? "burgundy" : color;
}

function title(color: string) {
  const name = accentLabel(color);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function styleLine(chosen: Partial<Record<OutfitSlot, PickItem | undefined>>, ctx: StyleContext) {
  const pieces = (Object.values(chosen) as (PickItem | undefined)[]).filter((piece): piece is PickItem => Boolean(piece));
  if (!pieces.length) return "";
  const slots = bySlot(pieces);
  const top = slots.get("top");
  const bottom = slots.get("bottom");
  const shoes = slots.get("shoes");
  const hat = slots.get("hat");
  const palette = unique(pieces.flatMap(pieceColors));
  const accents = palette.filter((color) => !NEUTRAL.has(color) && !EARTH.has(color));
  const body = [top, slots.get("layer"), bottom].filter((piece): piece is PickItem => Boolean(piece));
  const bodyColors = unique(body.flatMap(pieceColors));
  const blackBody = body.length > 0 && bodyColors.every((color) => BLACK.has(color));
  const quietEnds = [shoes, hat].every((piece) => !piece || pieceColors(piece).every((color) => BLACK.has(color) || LIFT.has(color)));
  const mono = blackBody && quietEnds && accents.length === 0;

  if (ctx.streetwear && top && bottom && baggy(top.fit) && baggy(bottom.fit) && !shorts(bottom)) {
    return "Relaxed proportions for the streetwear ask.";
  }
  if (mono) {
    const hatColors = hat ? pieceColors(hat) : [];
    const creamCap = hatColors.includes("cream");
    const whiteCap = !creamCap && hatColors.includes("white");
    const sneakers = Boolean(shoes && isWhiteSneaker(shoes));
    const cap = creamCap ? "a cream cap" : whiteCap ? "a white cap" : "";
    if (cap && sneakers) return `Monochrome black with ${cap} and white sneakers to lift the look.`;
    if (cap) return `Monochrome black with ${cap} to lift the look.`;
    if (sneakers) return "Monochrome black with white sneakers to lift the look.";
    if (palette.filter((color) => BLACK.has(color)).length >= 2) return "Monochrome black, with shade variation.";
    return "Monochrome black.";
  }
  for (const [left, right, line] of PHRASES) {
    if (palette.includes(left) && palette.includes(right) && accents.length <= 1) return line;
  }
  if (accents.length === 1) {
    const neutrals = palette.filter((color) => NEUTRAL.has(color));
    if (!neutrals.length) return `Tonal ${accentLabel(accents[0])}.`;
    const base = neutrals.includes("black") ? "black" : neutrals[0];
    return `${title(base)} base with one ${accentLabel(accents[0])} accent.`;
  }
  if (top && bottom && baggy(top.fit) && !baggy(bottom.fit) && !shorts(bottom)) {
    return `Oversized top balanced with ${bottom.fit === "slim" ? "slim" : "straight"} pants.`;
  }
  return "Neutrals, kept simple.";
}
