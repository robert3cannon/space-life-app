export type StyleWish = "casual" | "gym" | "dressy" | "class" | "work";

export type ItemHint = {
  colors: string[];
  kinds: string[];
};

export type OutfitWish = {
  text: string;
  occasion: StyleWish | null;
  comfort: boolean;
  colors: string[];
  allBlack: boolean;
  warmth: "cozy" | "light" | null;
  includes: ItemHint[];
  excludes: ItemHint[];
};

export const VIBE_CHIPS: { label: string; prompt: string }[] = [
  { label: "Comfy", prompt: "comfy" },
  { label: "Class", prompt: "class" },
  { label: "Gym", prompt: "gym" },
  { label: "Dressy", prompt: "dressy" },
  { label: "Date", prompt: "date night" },
  { label: "All black", prompt: "all black" },
  { label: "Cozy", prompt: "cozy" },
];

const COLOR_WORDS = [
  "charcoal",
  "maroon",
  "burgundy",
  "navy",
  "beige",
  "khaki",
  "cream",
  "olive",
  "denim",
  "black",
  "white",
  "gray",
  "grey",
  "brown",
  "tan",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
];

const KIND_WORDS = [
  "sweatshirt",
  "t-shirt",
  "tshirt",
  "sneakers",
  "snapback",
  "hoodie",
  "jacket",
  "beanie",
  "shorts",
  "jeans",
  "pants",
  "shirt",
  "shoes",
  "coat",
  "tee",
  "cap",
  "hat",
];

const EMPTY: OutfitWish = {
  text: "",
  occasion: null,
  comfort: false,
  colors: [],
  allBlack: false,
  warmth: null,
  includes: [],
  excludes: [],
};

export function normalizeColor(color: string) {
  const name = color.trim().toLowerCase();
  if (name === "grey") return "gray";
  if (name === "burgundy") return "maroon";
  return name;
}

export function itemKindList(item: { name: string; category: string }) {
  const blob = `${item.name} ${item.category}`.toLowerCase();
  const kinds: string[] = [];
  if (/hoodie|sweatshirt/.test(blob)) kinds.push("hoodie");
  if (/jacket|\bcoat\b/.test(blob)) kinds.push("jacket");
  if (/jean/.test(blob)) kinds.push("jeans");
  if (/short/.test(blob)) kinds.push("shorts");
  if (/pant|trouser|chino|jean/.test(blob)) kinds.push("pants");
  if (/sneaker|trainer/.test(blob)) kinds.push("sneakers");
  if (/shoe|sneaker|trainer/.test(blob)) kinds.push("shoes");
  if (/beanie|knit/.test(blob)) kinds.push("beanie");
  if (/\bcap\b|snapback|bucket/.test(blob)) kinds.push("cap");
  if (/\bhat\b|beanie|\bcap\b|snapback|bucket/.test(blob)) kinds.push("hat");
  if (/(tee|t-shirt|tshirt|\bshirt\b)/.test(blob) && !/sweatshirt/.test(blob)) kinds.push("shirt");
  return kinds;
}

export function hintMatches(item: { name: string; category: string; colors: string[] }, hint: ItemHint) {
  if (!hint.colors.length && !hint.kinds.length) return false;
  if (hint.colors.length && !hint.colors.some((color) => item.colors.some((own) => normalizeColor(own) === color))) return false;
  if (hint.kinds.length && !hint.kinds.some((kind) => itemKindList(item).includes(kind))) return false;
  return true;
}

export function cosine(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function outfitItemText(item: { name: string; category: string; colors: string[]; tags: string[] }) {
  return [item.name, item.category, item.colors.join(" "), item.tags.join(" ")].filter(Boolean).join(". ");
}

function kindOf(word: string) {
  const name = word.toLowerCase();
  if (name === "sweatshirt" || name === "hoodie") return "hoodie";
  if (name === "jacket" || name === "coat") return "jacket";
  if (name === "jeans") return "jeans";
  if (name === "pants") return "pants";
  if (name === "shorts") return "shorts";
  if (name === "tee" || name === "t-shirt" || name === "tshirt" || name === "shirt") return "shirt";
  if (name === "sneakers") return "sneakers";
  if (name === "shoes") return "shoes";
  if (name === "beanie") return "beanie";
  if (name === "snapback" || name === "cap") return "cap";
  if (name === "hat") return "hat";
  return name;
}

function scanColors(text: string) {
  const found: string[] = [];
  for (const word of COLOR_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      const color = normalizeColor(word);
      if (!found.includes(color)) found.push(color);
    }
  }
  return found;
}

function hintsIn(text: string): ItemHint[] {
  const colorAlt = COLOR_WORDS.join("|");
  const kindAlt = KIND_WORDS.join("|");
  const re = new RegExp(`\\b(?:my\\s+)?(?:(${colorAlt})\\s+)?(${kindAlt})\\b`, "gi");
  const hints: ItemHint[] = [];
  for (const match of text.matchAll(re)) {
    const colors = match[1] ? [normalizeColor(match[1])] : [];
    const kinds = [kindOf(match[2])];
    hints.push({ colors, kinds });
  }
  if (hints.length) return hints;
  const colors = scanColors(text);
  return colors.length ? [{ colors, kinds: [] }] : [];
}

function stripExclusions(text: string) {
  const excludes: string[] = [];
  const keep = text.replace(
    /\b(?:without|no|not|don't|dont)(?:\s+want)?\s+(?:a\s+|an\s+|the\s+|my\s+)?([a-z][a-z\s-]{0,40}?)(?=\s*(?:,|\.|$|\band\b|\bfor\b|\bwith\b|\bbut\b))/gi,
    (_all, phrase: string) => {
      excludes.push(phrase.trim());
      return " ";
    },
  );
  return { keep, excludes };
}

export function requestedLayerKind(wish: OutfitWish): "hoodie" | "jacket" | null {
  for (const hint of wish.includes) {
    if (hint.kinds.includes("hoodie")) return "hoodie";
    if (hint.kinds.includes("jacket")) return "jacket";
  }
  return null;
}

export function requestedHatStyle(wish: OutfitWish): "warm" | "light" | "any" | null {
  for (const hint of wish.includes) {
    if (hint.kinds.includes("beanie")) return "warm";
    if (hint.kinds.includes("cap")) return "light";
    if (hint.kinds.includes("hat")) return "any";
  }
  return null;
}

export function parseOutfitPrompt(raw: string): OutfitWish {
  const text = raw.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!text) return { ...EMPTY };
  const lower = text.toLowerCase().replace(/[’']/g, "'");
  const { keep, excludes } = stripExclusions(lower);
  const occasionRule = [
    { tag: "dressy" as const, re: /\b(date night|dressy|formal|date)\b/ },
    { tag: "gym" as const, re: /\b(gym|workout|lifting|working out)\b/ },
    { tag: "class" as const, re: /\b(class|lecture|school|campus)\b/ },
    { tag: "work" as const, re: /\b(office|interview|work)\b/ },
    { tag: "casual" as const, re: /\b(comfy|comfortable|casual|chill|relaxed)\b/ },
  ].find((rule) => rule.re.test(keep));
  const cozyAt = keep.search(/\b(cozy|warm|bundled)\b/);
  const lightAt = keep.search(/\b(light|breezy|breathable|airy)\b/);
  const warmth = cozyAt < 0 && lightAt < 0 ? null : lightAt > cozyAt ? "light" : "cozy";
  const allBlack = /\ball[- ]black\b|\beverything black\b/.test(keep);
  const kindAlt = KIND_WORDS.join("|");
  const colorAlt = COLOR_WORDS.join("|");
  const withoutPieces = keep.replace(new RegExp(`\\b(?:my\\s+)?(?:(?:${colorAlt})\\s+)?(?:${kindAlt})\\b`, "gi"), " ");
  const colors = scanColors(withoutPieces).filter((color) => !(allBlack && color === "black"));
  return {
    text,
    occasion: occasionRule?.tag ?? null,
    comfort: /\b(comfy|comfortable|chill|relaxed)\b/.test(keep),
    colors,
    allBlack,
    warmth,
    includes: hintsIn(keep).filter((hint) => hint.kinds.length > 0),
    excludes: excludes.flatMap((phrase) => hintsIn(phrase)),
  };
}
