import type { NutritionSource, RestaurantItem, RestaurantServing } from "./types";

export function serving(
  ounces: number,
  calories: number,
  fatG: number,
  carbsG: number,
  proteinG: number,
  detail?: string,
): RestaurantServing {
  const grams = Math.round(ounces * 28.3495);
  const size = `${ounces.toFixed(2)} oz (${grams} g)`;
  return {
    label: detail ? `${detail} · ${size}` : size,
    ounces,
    grams,
    calories,
    fatG,
    carbsG,
    proteinG,
  };
}

export function servingFromGrams(
  grams: number,
  calories: number,
  fatG: number,
  carbsG: number,
  proteinG: number,
  detail?: string,
): RestaurantServing {
  const ounces = grams / 28.3495;
  const size = `${ounces.toFixed(2)} oz (${grams} g)`;
  return {
    label: detail ? `${detail} · ${size}` : size,
    ounces,
    grams,
    calories,
    fatG,
    carbsG,
    proteinG,
  };
}

/** A listed each/size with no gram weight on the source. Do not invent one. */
export function listed(
  label: string,
  calories: number,
  fatG: number,
  carbsG: number,
  proteinG: number,
): RestaurantServing {
  return {
    label,
    ounces: null,
    grams: null,
    calories,
    fatG,
    carbsG,
    proteinG,
  };
}

export function food(
  id: string,
  name: string,
  servings: RestaurantServing[],
  aliases?: string[],
  sourceType: NutritionSource = "official",
): RestaurantItem {
  const item: RestaurantItem = { id, name, servings, sourceType };
  if (aliases?.length) item.aliases = aliases;
  return item;
}
