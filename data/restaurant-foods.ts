import { scaleFood, type FoodHit, type FoodNutrients, type FoodServing } from "../lib/food-catalog";

/**
 * Curated restaurant menus. Search these before USDA and Open Food Facts.
 *
 * Panda Express numbers are from the official nutrition table:
 * https://www.pandaexpress.com/nutritioninformation
 * Verified on 2026-10-08.
 *
 * Beijing Beef on that table is 5.60 oz, 470 cal, 27 g fat, 46 g carbs, 14 g protein.
 * An older Panda PDF listed 26 g fat and 13 g protein; the live table is the one stored here.
 *
 * Black Pepper Angus Steak is not on the current table, so it is not included.
 * The steak that is listed is Black Pepper Sirloin Steak.
 *
 * Grams are Math.round(ounces * 28.3495). 5.44 oz is 154 g.
 * Bowl, plate, and bigger plate copy is from https://www.pandaexpress.com/
 * (Bowl is 1 side and 1 entree, Plate is 1 side and 2 entrees, Bigger Plate is 1 side and 3).
 */

export type RestaurantServing = {
  label: string;
  ounces: number;
  grams: number;
  calories: number;
  fatG: number;
  carbsG: number;
  proteinG: number;
};

export type RestaurantItem = {
  id: string;
  name: string;
  aliases?: string[];
  servings: RestaurantServing[];
};

export type RestaurantChain = {
  id: string;
  name: string;
  sourceUrl: string;
  verifiedOn: string;
  chainTokens: string[];
  orderNote?: string;
  items: RestaurantItem[];
};

const PANDA_NOTE = "Bowl: 1 side + 1 entree. Plate: 1 side + 2 entrees. Bigger Plate: 1 side + 3 entrees.";

function serving(
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

export const RESTAURANT_CHAINS: RestaurantChain[] = [
  {
    id: "panda-express",
    name: "Panda Express",
    sourceUrl: "https://www.pandaexpress.com/nutritioninformation",
    verifiedOn: "2026-10-08",
    chainTokens: ["panda", "express"],
    orderNote: PANDA_NOTE,
    items: [
      {
        id: "broccoli-beef",
        name: "Broccoli Beef",
        aliases: ["broccoli and beef"],
        servings: [serving(5.44, 150, 6, 12, 15)],
      },
      {
        id: "broccoli-beef-cub-meal",
        name: "Broccoli Beef Cub Meal",
        aliases: ["broccoli beef cub"],
        servings: [serving(4.1, 110, 5, 9, 11, "Cub meal")],
      },
      {
        id: "beijing-beef",
        name: "Beijing Beef",
        servings: [serving(5.6, 470, 27, 46, 14)],
      },
      {
        id: "orange-chicken",
        name: "Orange Chicken",
        aliases: ["original orange chicken"],
        servings: [serving(5.92, 510, 24, 53, 16)],
      },
      {
        id: "kung-pao-chicken",
        name: "Kung Pao Chicken",
        aliases: ["kung pao"],
        servings: [serving(6.73, 320, 21, 15, 17)],
      },
      {
        id: "string-bean-chicken-breast",
        name: "String Bean Chicken Breast",
        aliases: ["string bean chicken"],
        servings: [serving(5.6, 210, 12, 13, 12)],
      },
      {
        id: "grilled-teriyaki-chicken",
        name: "Grilled Teriyaki Chicken",
        servings: [serving(6, 275, 10, 14, 33)],
      },
      {
        id: "honey-walnut-shrimp",
        name: "Honey Walnut Shrimp",
        aliases: ["walnut shrimp"],
        servings: [serving(4.39, 430, 28, 32, 13)],
      },
      {
        id: "black-pepper-sirloin-steak",
        name: "Black Pepper Sirloin Steak",
        aliases: ["black pepper steak"],
        servings: [serving(5.1, 180, 6, 12, 19)],
      },
      {
        id: "mushroom-chicken",
        name: "Mushroom Chicken",
        servings: [serving(5.7, 220, 14, 10, 13)],
      },
      {
        id: "honey-sesame-chicken-breast",
        name: "Honey Sesame Chicken Breast",
        aliases: ["honey sesame chicken"],
        servings: [serving(5.3, 340, 15, 35, 16)],
      },
      {
        id: "chow-mein",
        name: "Chow Mein",
        aliases: ["chowmein"],
        servings: [serving(11, 600, 23, 94, 15, "Side")],
      },
      {
        id: "fried-rice",
        name: "Fried Rice",
        servings: [serving(11, 620, 19, 101, 13, "Side")],
      },
      {
        id: "white-steamed-rice",
        name: "White Steamed Rice",
        aliases: ["steamed rice", "white rice"],
        servings: [serving(11, 520, 0, 118, 10, "Side")],
      },
      {
        id: "super-greens",
        name: "Super Greens",
        aliases: ["super green"],
        servings: [serving(10, 130, 4, 14, 9, "Side")],
      },
      {
        id: "chicken-egg-roll",
        name: "Chicken Egg Roll",
        aliases: ["egg roll", "egg rolls"],
        servings: [serving(2.75, 200, 10, 20, 6, "1 roll")],
      },
      {
        id: "cream-cheese-rangoon",
        name: "Cream Cheese Rangoon",
        aliases: ["rangoon", "rangoons", "cream cheese rangoons"],
        servings: [serving(2.4, 190, 8, 24, 5, "3 pieces")],
      },
    ],
  },
];

function per100g(serving: RestaurantServing): FoodNutrients {
  const factor = 100 / serving.grams;
  return {
    calories: serving.calories * factor,
    proteinG: serving.proteinG * factor,
    carbsG: serving.carbsG * factor,
    fatG: serving.fatG * factor,
  };
}

function toHit(chain: RestaurantChain, item: RestaurantItem): FoodHit {
  const first = item.servings[0];
  const servings: FoodServing[] = item.servings.map((itemServing) => ({
    label: itemServing.label,
    grams: itemServing.grams,
  }));
  return {
    id: `restaurant:${chain.id}:${item.id}`,
    source: "restaurant",
    name: item.name,
    brand: chain.name,
    per100g: per100g(first),
    servings,
    calories: first.calories,
    proteinG: first.proteinG,
    carbsG: first.carbsG,
    fatG: first.fatG,
    note: chain.orderNote,
  };
}

function words(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

function haystack(chain: RestaurantChain, item: RestaurantItem) {
  return [item.name, ...(item.aliases ?? []), chain.name].join(" ").toLowerCase();
}

function foodWords(query: string, chain: RestaurantChain) {
  const skip = new Set(chain.chainTokens.map((token) => token.toLowerCase()));
  return words(query).filter((word) => !skip.has(word));
}

function matches(chain: RestaurantChain, item: RestaurantItem, query: string) {
  const wanted = foodWords(query, chain);
  const hay = haystack(chain, item);
  if (!wanted.length) return words(query).some((word) => chain.chainTokens.includes(word));
  return wanted.every((word) => hay.includes(word));
}

function score(chain: RestaurantChain, item: RestaurantItem, query: string) {
  const wanted = foodWords(query, chain).join(" ");
  const name = item.name.toLowerCase();
  let value = 0;
  if (wanted && name === wanted) value += 500;
  else if (wanted && name.startsWith(wanted)) value += 200;
  else if (wanted && name.includes(wanted)) value += 100;
  return value;
}

export function searchRestaurantFoods(query: string): FoodHit[] {
  const q = query.trim().replace(/\s+/g, " ");
  const found: { hit: FoodHit; score: number; index: number }[] = [];
  let index = 0;
  for (const chain of RESTAURANT_CHAINS) {
    for (const item of chain.items) {
      if (!matches(chain, item, q)) continue;
      found.push({ hit: toHit(chain, item), score: score(chain, item, q), index });
      index += 1;
    }
  }
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  return found.map((item) => item.hit);
}

export function restaurantServingMatchesLabel(hit: FoodHit) {
  const serving = hit.servings[0];
  if (!serving) return false;
  const scaled = scaleFood(hit.per100g, serving.grams, 1);
  return scaled.calories === hit.calories
    && scaled.proteinG === hit.proteinG
    && scaled.carbsG === hit.carbsG
    && scaled.fatG === hit.fatG;
}
