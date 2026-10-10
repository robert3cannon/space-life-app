/** Fine clothing labels, mapped onto the closet categories. */
export const FINE_LABELS: { label: string; category: string; slot: "top" | "bottom" | "layer" | "shoes" | "extra"; warmth: number }[] = [
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
  { label: "hat", category: "Accessories", slot: "extra", warmth: 2 },
  { label: "beanie", category: "Accessories", slot: "extra", warmth: 4 },
];

export const CLIP_LABELS = FINE_LABELS.map((row) => row.label);
export const CLIP_HYPOTHESIS = "a photo of a {}";

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

type Pixel = { r: number; g: number; b: number };

function dist(a: Pixel, b: Pixel) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function pixelAt(data: ArrayLike<number>, offset: number): Pixel {
  return { r: data[offset] ?? 0, g: data[offset + 1] ?? 0, b: data[offset + 2] ?? 0 };
}

export function nearestColorName(r: number, g: number, b: number) {
  let best = NAMED_COLORS[0];
  let bestD = Infinity;
  for (const color of NAMED_COLORS) {
    const score = dist({ r, g, b }, color);
    if (score < bestD) {
      bestD = score;
      best = color;
    }
  }
  return best.name;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function kmeans(pixels: Pixel[], k: number) {
  if (!pixels.length) return [] as { color: Pixel; count: number }[];
  const seeds: Pixel[] = [];
  for (let index = 0; index < k; index += 1) {
    seeds.push(pixels[Math.min(pixels.length - 1, Math.floor(((index + 0.5) * pixels.length) / k))]);
  }
  let assign = new Array<number>(pixels.length).fill(0);
  for (let iter = 0; iter < 8; iter += 1) {
    assign = pixels.map((pixel) => {
      let best = 0;
      let bestD = Infinity;
      seeds.forEach((seed, index) => {
        const score = dist(pixel, seed);
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
        r: average(group.map((pixel) => pixel.r)),
        g: average(group.map((pixel) => pixel.g)),
        b: average(group.map((pixel) => pixel.b)),
      };
    }
  }
  return seeds
    .map((color, index) => ({ color, count: assign.filter((value) => value === index).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Dominant garment colors from RGBA pixels. A plain backdrop is ignored when the corners agree. */
export function dominantColors(data: ArrayLike<number>, width: number, height: number) {
  const total = Math.max(1, width * height);
  const stride = total > 900 ? 4 : 1;
  const samples: Pixel[] = [];
  for (let index = 0; index < total; index += stride) samples.push(pixelAt(data, index * 4));
  const corners = [
    pixelAt(data, 0),
    pixelAt(data, (width - 1) * 4),
    pixelAt(data, (height - 1) * width * 4),
    pixelAt(data, (total - 1) * 4),
  ];
  const corner = {
    r: average(corners.map((pixel) => pixel.r)),
    g: average(corners.map((pixel) => pixel.g)),
    b: average(corners.map((pixel) => pixel.b)),
  };
  const cornersAgree = corners.every((pixel) => dist(pixel, corner) < 40 * 40);
  const foreground = cornersAgree ? samples.filter((pixel) => dist(pixel, corner) >= 45 * 45) : samples;
  const usable = foreground.length >= Math.max(12, samples.length * 0.12) ? foreground : samples;
  const clusters = kmeans(usable, Math.min(3, usable.length));
  const names: string[] = [];
  for (const cluster of clusters) {
    if (names.length && cluster.count < usable.length * 0.18) continue;
    const name = nearestColorName(cluster.color.r, cluster.color.g, cluster.color.b);
    if (!names.includes(name)) names.push(name);
    if (names.length === 2) break;
  }
  return names;
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
