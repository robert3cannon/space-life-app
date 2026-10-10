/** Fine clothing labels, mapped onto the closet categories. */
export const FINE_LABELS: { label: string; category: string; slot: "top" | "bottom" | "layer" | "shoes" | "hat" | "extra"; warmth: number }[] = [
  { label: "t-shirt", category: "Shirts/T-shirts", slot: "top", warmth: 2 },
  { label: "tank top", category: "Shirts/T-shirts", slot: "top", warmth: 1 },
  { label: "polo", category: "Shirts/T-shirts", slot: "top", warmth: 2 },
  { label: "long-sleeve shirt", category: "Long sleeves", slot: "top", warmth: 3 },
  { label: "button-up shirt", category: "Long sleeves", slot: "top", warmth: 3 },
  { label: "zip hoodie", category: "Hoodies", slot: "layer", warmth: 4 },
  { label: "hoodie", category: "Hoodies", slot: "layer", warmth: 4 },
  { label: "sweatshirt", category: "Hoodies", slot: "layer", warmth: 4 },
  { label: "jacket", category: "Jackets", slot: "layer", warmth: 4 },
  { label: "coat", category: "Jackets", slot: "layer", warmth: 5 },
  { label: "jeans", category: "Pants", slot: "bottom", warmth: 3 },
  { label: "sweatpants", category: "Pants", slot: "bottom", warmth: 4 },
  { label: "joggers", category: "Pants", slot: "bottom", warmth: 3 },
  { label: "shorts", category: "Shorts", slot: "bottom", warmth: 1 },
  { label: "sneakers", category: "Shoes", slot: "shoes", warmth: 2 },
  { label: "boots", category: "Shoes", slot: "shoes", warmth: 4 },
  { label: "baseball cap", category: "Caps / Hats", slot: "hat", warmth: 2 },
  { label: "snapback", category: "Caps / Hats", slot: "hat", warmth: 2 },
  { label: "bucket hat", category: "Caps / Hats", slot: "hat", warmth: 2 },
  { label: "beanie", category: "Caps / Hats", slot: "hat", warmth: 4 },
  { label: "hat", category: "Caps / Hats", slot: "hat", warmth: 2 },
];

export const CLIP_LABELS = FINE_LABELS.map((row) => row.label);
export const CLIP_HYPOTHESIS = "a photo of a {}";

/** Separate from clothing labels so a worn photo cannot win the category. */
export const PERSON_LABEL = "a person wearing clothes";
export const FLAT_LABEL = "clothing laid flat";
export const PRESENTATION_LABELS = [PERSON_LABEL, FLAT_LABEL];
export const PRESENTATION_HYPOTHESIS = "a photo of {}";

const NAMED_COLORS: { name: string; r: number; g: number; b: number }[] = [
  { name: "black", r: 18, g: 18, b: 18 },
  { name: "charcoal", r: 58, g: 58, b: 62 },
  { name: "gray", r: 148, g: 148, b: 152 },
  { name: "white", r: 244, g: 244, b: 242 },
  { name: "cream", r: 242, g: 232, b: 210 },
  { name: "beige", r: 214, g: 196, b: 166 },
  { name: "khaki", r: 186, g: 170, b: 122 },
  { name: "tan", r: 186, g: 146, b: 98 },
  { name: "brown", r: 110, g: 72, b: 42 },
  { name: "navy", r: 22, g: 40, b: 86 },
  { name: "denim", r: 55, g: 86, b: 138 },
  { name: "blue", r: 48, g: 104, b: 198 },
  { name: "olive", r: 92, g: 100, b: 48 },
  { name: "green", r: 46, g: 138, b: 72 },
  { name: "red", r: 176, g: 42, b: 42 },
  { name: "maroon", r: 112, g: 28, b: 40 },
  { name: "orange", r: 214, g: 118, b: 36 },
  { name: "yellow", r: 224, g: 196, b: 48 },
  { name: "purple", r: 118, g: 64, b: 158 },
  { name: "pink", r: 224, g: 150, b: 170 },
];

const DARK = new Set(["black", "navy", "charcoal", "brown"]);
const LIGHT = new Set(["white", "cream", "beige"]);

export type LabelScore = { label: string; score: number };

export type ClothingGuess = {
  label: string;
  category: string;
  slot: (typeof FINE_LABELS)[number]["slot"];
  score: number;
  second: number;
  lowConfidence: boolean;
  warmth: number;
  name: string;
  colors: string[];
  tags: string[];
};

type Lab = { L: number; a: number; b: number };
type Sample = { r: number; g: number; b: number; a: number; L: number; aLab: number; bLab: number };

const NAMED_LAB = NAMED_COLORS.map((color) => ({ name: color.name, ...rgbToLab(color.r, color.g, color.b) }));

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}

function pivot(channel: number) {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const red = pivot(r);
  const green = pivot(g);
  const blue = pivot(b);
  const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787037 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labDistance(left: Lab, right: Lab) {
  const dL = left.L - right.L;
  const da = left.a - right.a;
  const db = left.b - right.b;
  return dL * dL + da * da + db * db;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Skin-like pixels are left out of the garment color. Beige and khaki stay, because their a* is near zero. */
function isSkinTone(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 18 || r < 140 || g < 80 || b < 50 || r <= g || g < b - 5) return false;
  const lab = rgbToLab(r, g, b);
  const chroma = Math.hypot(lab.a, lab.b);
  return lab.L >= 45 && lab.L <= 88 && lab.a >= 8 && lab.a <= 28 && lab.b >= 8 && lab.b <= 32 && chroma >= 16 && chroma <= 40;
}

export function nearestColorName(r: number, g: number, b: number) {
  const red = clampChannel(r);
  const green = clampChannel(g);
  const blue = clampChannel(b);
  const lab = rgbToLab(red, green, blue);
  const chroma = Math.hypot(lab.a, lab.b);
  if (lab.a >= 18 && red > green + 18 && red > blue + 12 && red > 45) return lab.L < 34 ? "maroon" : "red";
  if (lab.L > 30 && lab.L < 58 && lab.b <= -14 && lab.a < 12 && blue > red) return "denim";
  if (lab.L <= 32 && lab.b <= -14 && chroma >= 16 && lab.a < 24) return "navy";
  if (lab.L >= 18 && lab.L <= 42 && lab.b <= -6 && lab.b > -14 && chroma >= 7 && blue >= red + 8 && blue >= green + 8) return "navy";
  if (lab.L >= 90 && chroma <= 9) return "white";
  if (lab.L >= 86 && chroma <= 18 && lab.b >= 6 && lab.a < 6) return "cream";
  if (lab.L >= 72 && lab.L < 88 && lab.b >= 12 && chroma >= 12 && chroma <= 24 && lab.a < 8) return "beige";
  if (lab.L <= 18 && chroma <= 12) return "black";
  if (lab.L <= 32 && chroma <= 8) return lab.L <= 20 ? "black" : "charcoal";
  let best = NAMED_LAB[0];
  let bestD = Infinity;
  for (const color of NAMED_LAB) {
    const score = labDistance(lab, color);
    if (score < bestD) {
      bestD = score;
      best = color;
    }
  }
  return best.name;
}

function kmeans(pixels: Sample[], k: number) {
  if (!pixels.length) return [] as { r: number; g: number; b: number; count: number }[];
  const seeds: { L: number; a: number; b: number; r: number; g: number; bRgb: number }[] = [];
  for (let index = 0; index < k; index += 1) {
    const pixel = pixels[Math.min(pixels.length - 1, Math.floor(((index + 0.5) * pixels.length) / k))];
    seeds.push({ L: pixel.L, a: pixel.aLab, b: pixel.bLab, r: pixel.r, g: pixel.g, bRgb: pixel.b });
  }
  let assign = new Array<number>(pixels.length).fill(0);
  for (let iter = 0; iter < 8; iter += 1) {
    assign = pixels.map((pixel) => {
      let best = 0;
      let bestD = Infinity;
      seeds.forEach((seed, index) => {
        const score = labDistance({ L: pixel.L, a: pixel.aLab, b: pixel.bLab }, seed);
        if (score < bestD) {
          bestD = score;
          best = index;
        }
      });
      return best;
    });
    for (let index = 0; index < seeds.length; index += 1) {
      const group = pixels.filter((_, pixelIndex) => assign[pixelIndex] === index);
      if (!group.length) continue;
      seeds[index] = {
        L: average(group.map((pixel) => pixel.L)),
        a: average(group.map((pixel) => pixel.aLab)),
        b: average(group.map((pixel) => pixel.bLab)),
        r: average(group.map((pixel) => pixel.r)),
        g: average(group.map((pixel) => pixel.g)),
        bRgb: average(group.map((pixel) => pixel.b)),
      };
    }
  }
  return seeds
    .map((seed, index) => ({ r: seed.r, g: seed.g, b: seed.bRgb, count: assign.filter((value) => value === index).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

function sampleAt(data: ArrayLike<number>, index: number): Sample {
  const offset = index * 4;
  const r = data[offset] ?? 0;
  const g = data[offset + 1] ?? 0;
  const b = data[offset + 2] ?? 0;
  const lab = rgbToLab(r, g, b);
  return { r, g, b, a: data[offset + 3] ?? 0, L: lab.L, aLab: lab.a, bLab: lab.b };
}

/** Tight box around pixels clearer than half opacity. */
export function foregroundBounds(data: ArrayLike<number>, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const total = width * height;
  for (let index = 0; index < total; index += 1) {
    if ((data[index * 4 + 3] ?? 0) <= 127) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Dominant garment colors from a background-removed cutout.
 * Only pixels with alpha > 0.5 count. Skin and a soft backdrop halo are left out.
 * Clusters are compared in LAB, then named with cutoffs for white, beige, navy, black, and red.
 */
export function dominantColors(data: ArrayLike<number>, width: number, height: number) {
  const total = Math.max(1, width * height);
  const stride = total > 8000 ? 2 : 1;
  const foreground: Sample[] = [];
  const fringe: Sample[] = [];
  for (let index = 0; index < total; index += stride) {
    const pixel = sampleAt(data, index);
    if (pixel.a > 127) foreground.push(pixel);
    else if (pixel.a > 16) fringe.push(pixel);
  }
  if (!foreground.length) return [];
  const withoutSkin = foreground.filter((pixel) => !isSkinTone(pixel.r, pixel.g, pixel.b));
  let usable = withoutSkin.length >= Math.max(12, foreground.length * 0.35) ? withoutSkin : foreground;
  if (fringe.length >= 8) {
    const backdrop = {
      L: average(fringe.map((pixel) => pixel.L)),
      a: average(fringe.map((pixel) => pixel.aLab)),
      b: average(fringe.map((pixel) => pixel.bLab)),
    };
    const away = usable.filter((pixel) => pixel.a >= 210 || labDistance({ L: pixel.L, a: pixel.aLab, b: pixel.bLab }, backdrop) > 16 * 16);
    if (away.length >= Math.max(12, usable.length * 0.4)) usable = away;
  }
  const clusters = kmeans(usable, Math.min(3, usable.length));
  const counts = new Map<string, number>();
  for (const cluster of clusters) {
    const name = nearestColorName(cluster.r, cluster.g, cluster.b);
    counts.set(name, (counts.get(name) ?? 0) + cluster.count);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const names: string[] = [];
  for (const [name, count] of ranked) {
    if (names.length && count < usable.length * 0.18) continue;
    names.push(name);
    if (names.length === 2) break;
  }
  return names;
}

export function wornByPerson(scores: LabelScore[]) {
  const person = scores.find((row) => row.label === PERSON_LABEL)?.score ?? 0;
  const flat = scores.find((row) => row.label === FLAT_LABEL)?.score ?? 0;
  return person > flat && person > 0;
}

export function capitalizeColor(color: string) {
  if (!color) return "";
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export function suggestName(colors: string[], label: string) {
  const color = capitalizeColor(colors[0] ?? "");
  const text = color ? `${color} ${label}` : label;
  return text.slice(0, 80);
}

export function warmthFor(label: string, colors: string[]) {
  const fine = FINE_LABELS.find((row) => row.label === label);
  let warmth = fine?.warmth ?? 3;
  const lead = colors[0];
  if (lead && DARK.has(lead) && fine?.slot === "layer") warmth += 1;
  if (lead && LIGHT.has(lead) && fine?.slot === "top") warmth -= 1;
  return Math.min(5, Math.max(1, warmth));
}

export function tagsFor(label: string) {
  if (["shorts", "sneakers", "joggers", "sweatpants", "tank top"].includes(label)) return ["gym", "casual"];
  return ["casual"];
}

export function lowConfidence(score: number, second: number) {
  return score < 0.18 || score - second < 0.045;
}

export function detectionFromScores(scores: LabelScore[], colors: string[]): ClothingGuess {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const fine = FINE_LABELS.find((row) => row.label === top?.label) ?? FINE_LABELS[0];
  const second = ranked[1]?.score ?? 0;
  const score = top?.score ?? 0;
  return {
    label: fine.label,
    category: fine.category,
    slot: fine.slot,
    score,
    second,
    lowConfidence: !top || lowConfidence(score, second),
    warmth: warmthFor(fine.label, colors),
    name: suggestName(colors, fine.label),
    colors,
    tags: tagsFor(fine.label),
  };
}

export function matchCategory<T extends { id: string; name: string; slot: string }>(categories: T[], categoryName: string, slot: string) {
  const exact = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  if (exact) return exact;
  const hint = categoryName.toLowerCase();
  const fuzzy = categories.find((category) => category.slot === slot && (category.name.toLowerCase().includes(hint) || hint.includes(category.name.toLowerCase())));
  if (fuzzy) return fuzzy;
  const sameSlot = categories.filter((category) => category.slot === slot);
  return sameSlot[0] ?? categories[0];
}
