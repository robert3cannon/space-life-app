export type FoodNutrients = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FoodServing = {
  label: string;
  grams: number | null;
};

export type FoodHit = {
  id: string;
  source: "usda" | "openfoodfacts" | "restaurant";
  name: string;
  brand: string | null;
  per100g: FoodNutrients;
  servings: FoodServing[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  generic?: boolean;
  note?: string;
};

export type UsdaSearchFood = {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  gtinUpc?: string;
  foodNutrients?: Array<{ nutrientId?: number; nutrientName?: string; value?: number }>;
  foodMeasures?: Array<{ disseminationText?: string; gramWeight?: number; rank?: number }>;
};

export type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
};

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function scaleFood(per100g: FoodNutrients, grams: number, quantity: number): FoodNutrients {
  const factor = (grams * quantity) / 100;
  return {
    calories: Math.max(0, Math.round(per100g.calories * factor)),
    proteinG: Math.max(0, round1(per100g.proteinG * factor)),
    carbsG: Math.max(0, round1(per100g.carbsG * factor)),
    fatG: Math.max(0, round1(per100g.fatG * factor)),
  };
}

/** Count servings have no gram weight. Scale the listed serving by quantity. */
export function scaleListedFood(
  hit: Pick<FoodHit, "per100g" | "calories" | "proteinG" | "carbsG" | "fatG">,
  grams: number | null,
  quantity: number,
): FoodNutrients {
  if (grams && grams > 0) return scaleFood(hit.per100g, grams, quantity);
  return {
    calories: Math.max(0, Math.round(hit.calories * quantity)),
    proteinG: Math.max(0, round1(hit.proteinG * quantity)),
    carbsG: Math.max(0, round1(hit.carbsG * quantity)),
    fatG: Math.max(0, round1(hit.fatG * quantity)),
  };
}

export function foodHitLabel(hit: Pick<FoodHit, "name" | "brand">) {
  const brand = hit.brand?.trim();
  const name = hit.name.trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${name} · ${brand}`.slice(0, 120);
  }
  return name.slice(0, 120);
}

export function tidyFoodName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > 2 && trimmed === trimmed.toUpperCase()) {
    return trimmed.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
  return trimmed;
}

function nutrientValue(food: UsdaSearchFood, ids: number[]) {
  for (const id of ids) {
    const found = food.foodNutrients?.find((item) => item.nutrientId === id && typeof item.value === "number");
    if (found && Number.isFinite(found.value)) return found.value as number;
  }
  return null;
}

function gramsFromUnit(amount: number, unit: string) {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "g" || normalized === "gr" || normalized === "gram" || normalized === "grams") return amount;
  if (normalized === "ml" || normalized === "milliliter" || normalized === "milliliters") return amount;
  if (normalized === "oz" || normalized === "ounce" || normalized === "ounces") return amount * 28.3495;
  return null;
}

function gramsFromText(text: string) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function addServing(servings: FoodServing[], label: string, grams: number) {
  const clean = label.trim().replace(/\s+/g, " ");
  if (!clean || !Number.isFinite(grams) || grams <= 0 || grams > 2000) return;
  const rounded = Math.round(grams);
  if (servings.some((serving) => serving.label.toLowerCase() === clean.toLowerCase())) return;
  servings.push({ label: clean, grams: rounded });
}

export function usdaServings(food: UsdaSearchFood): FoodServing[] {
  const servings: FoodServing[] = [];
  const measures = [...(food.foodMeasures ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  for (const measure of measures) {
    const label = measure.disseminationText?.trim() ?? "";
    if (!label || /not specified/i.test(label)) continue;
    if (typeof measure.gramWeight === "number") addServing(servings, label, measure.gramWeight);
  }
  if (typeof food.servingSize === "number" && food.servingSize > 0) {
    const grams = gramsFromUnit(food.servingSize, food.servingSizeUnit || "g");
    const household = food.householdServingFullText?.trim();
    const label = household || `${round1(food.servingSize)} ${food.servingSizeUnit || "g"}`;
    if (grams) addServing(servings, label, grams);
  }
  addServing(servings, "100 g", 100);
  return servings.length ? servings : [{ label: "100 g", grams: 100 }];
}

export function usdaToHit(food: UsdaSearchFood): FoodHit | null {
  const calories = nutrientValue(food, [1008, 2047, 2048]);
  if (calories == null || !food.description || !food.fdcId) return null;
  const per100g: FoodNutrients = {
    calories: Math.max(0, Math.round(calories)),
    proteinG: Math.max(0, round1(nutrientValue(food, [1003]) ?? 0)),
    carbsG: Math.max(0, round1(nutrientValue(food, [1005]) ?? 0)),
    fatG: Math.max(0, round1(nutrientValue(food, [1004]) ?? 0)),
  };
  const servings = usdaServings(food);
  const scaled = scaleFood(per100g, servings[0].grams ?? 100, 1);
  const brand = tidyFoodName(food.brandName || food.brandOwner || "") || null;
  return {
    id: `usda:${food.fdcId}`,
    source: "usda",
    name: tidyFoodName(food.description).slice(0, 120),
    brand: brand ? brand.slice(0, 80) : null,
    per100g,
    servings,
    generic: food.dataType !== "Branded",
    ...scaled,
  };
}

function offNumber(nutriments: Record<string, unknown>, key: string) {
  const value = nutriments[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function offToHit(product: OffProduct): FoodHit | null {
  const name = product.product_name?.trim();
  const code = product.code?.replace(/\D/g, "");
  const nutriments = product.nutriments ?? {};
  const calories = offNumber(nutriments, "energy-kcal_100g") ?? offNumber(nutriments, "energy-kcal");
  if (!name || !code || calories == null) return null;
  const per100g: FoodNutrients = {
    calories: Math.max(0, Math.round(calories)),
    proteinG: Math.max(0, round1(offNumber(nutriments, "proteins_100g") ?? 0)),
    carbsG: Math.max(0, round1(offNumber(nutriments, "carbohydrates_100g") ?? 0)),
    fatG: Math.max(0, round1(offNumber(nutriments, "fat_100g") ?? 0)),
  };
  const servings: FoodServing[] = [];
  const servingText = product.serving_size?.trim();
  const servingGrams = servingText ? gramsFromText(servingText) : null;
  if (servingText && servingGrams) addServing(servings, servingText, servingGrams);
  addServing(servings, "100 g", 100);
  const scaled = scaleFood(per100g, servings[0].grams ?? 100, 1);
  const brand = product.brands?.split(",")[0]?.trim() || null;
  return {
    id: `off:${code}`,
    source: "openfoodfacts",
    name: tidyFoodName(name).slice(0, 120),
    brand: brand ? tidyFoodName(brand).slice(0, 80) : null,
    per100g,
    servings,
    ...scaled,
  };
}

export function rankFoodHit(hit: FoodHit, query: string) {
  const q = query.toLowerCase().trim();
  const name = hit.name.toLowerCase();
  const brand = (hit.brand ?? "").toLowerCase();
  const tokens = q.split(/\s+/).filter((token) => token.length > 1);
  let score = 0;
  if (name === q) score += hit.generic ? 120 : 36;
  if (name.startsWith(q)) score += hit.generic ? 48 : 12;
  if (brand && (brand === q || q.includes(brand))) score += 30;
  for (const token of tokens) {
    if (name.includes(token)) score += 16;
    else score -= 8;
    if (brand.includes(token)) score += 14;
  }
  if (hit.generic) score += 8;
  return score;
}
