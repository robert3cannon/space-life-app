import { scaleFood, scaleListedFood, type FoodHit, type FoodNutrients, type FoodServing } from "../lib/food-catalog";
import { chickFilA } from "./restaurants/chick-fil-a";
import { chipotle } from "./restaurants/chipotle";
import { culvers } from "./restaurants/culvers";
import { dairyQueen } from "./restaurants/dairy-queen";
import { fiveGuys } from "./restaurants/five-guys";
import { jimmyJohns } from "./restaurants/jimmy-johns";
import type { RestaurantChain, RestaurantItem, RestaurantServing } from "./restaurants/types";

export type { RestaurantChain, RestaurantItem, RestaurantServing };

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
 *
 * McDonald's numbers are the US nutrition calculator item facts
 * (https://www.mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html,
 * item details at /dnaapp/itemDetails). Verified on 2026-10-08.
 * Stored calories, fat, carbs, and protein are the displayed nutrient facts.
 * A few item descriptions still quote older calories (Double Cheeseburger 450,
 * McChicken 400, Egg McMuffin 300, small fries 220, large fries 490). Those
 * sentences are not what the calculator shows, so they are not stored.
 * Grams are Math.round of the default component quantities. Each component
 * serving basis is 100 g. Fries do not include the ketchup packet: the packet
 * is listed on the item, and the fry nutrition facts match the potato component alone.
 *
 * Later chains live in data/restaurants. Each file names the chain's own US
 * nutrition page or PDF and the date it was checked. A serving with no gram
 * weight is stored as a count (grams null) instead of an estimated weight.
 */

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

function servingFromGrams(
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
  {
    id: "mcdonalds",
    name: "McDonald's",
    sourceUrl: "https://www.mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html",
    verifiedOn: "2026-10-08",
    chainTokens: ["mcdonalds", "mcdonald", "mcdonald's", "mcd"],
    items: [
      {
        id: "cheeseburger",
        name: "Cheeseburger",
        aliases: ["cheese burger"],
        servings: [servingFromGrams(112, 300, 13, 31, 15)],
      },
      {
        id: "double-cheeseburger",
        name: "Double Cheeseburger",
        aliases: ["double cheese burger"],
        servings: [servingFromGrams(165, 440, 24, 34, 25)],
      },
      {
        id: "mcdouble",
        name: "McDouble",
        aliases: ["mc double"],
        servings: [servingFromGrams(150, 390, 20, 32, 22)],
      },
      {
        id: "big-mac",
        name: "Big Mac",
        aliases: ["bigmac"],
        servings: [servingFromGrams(217, 580, 34, 45, 25)],
      },
      {
        id: "quarter-pounder-with-cheese",
        name: "Quarter Pounder with Cheese",
        aliases: ["quarter pounder", "qpc"],
        servings: [servingFromGrams(201, 520, 26, 42, 30)],
      },
      {
        id: "mcchicken",
        name: "McChicken",
        aliases: ["mc chicken"],
        servings: [servingFromGrams(139, 390, 21, 38, 14)],
      },
      {
        id: "chicken-mcnuggets-4",
        name: "Chicken McNuggets (4 pc)",
        aliases: ["4 piece chicken mcnuggets", "4 pc nuggets", "mcnuggets", "nuggets", "chicken nuggets"],
        servings: [servingFromGrams(61, 170, 10, 10, 9, "4 pc")],
      },
      {
        id: "chicken-mcnuggets-6",
        name: "Chicken McNuggets (6 pc)",
        aliases: ["6 piece chicken mcnuggets", "6 pc nuggets", "mcnuggets", "nuggets", "chicken nuggets"],
        servings: [servingFromGrams(92, 250, 15, 15, 14, "6 pc")],
      },
      {
        id: "chicken-mcnuggets-10",
        name: "Chicken McNuggets (10 pc)",
        aliases: ["10 piece chicken mcnuggets", "10 pc nuggets", "mcnuggets", "nuggets", "chicken nuggets"],
        servings: [servingFromGrams(153, 410, 24, 26, 23, "10 pc")],
      },
      {
        id: "filet-o-fish",
        name: "Filet-O-Fish",
        aliases: ["filet o fish", "fish fillet"],
        servings: [servingFromGrams(140, 380, 19, 38, 16)],
      },
      {
        id: "fries-small",
        name: "World Famous Fries (Small)",
        aliases: ["small fries", "small french fries", "small fry", "fries", "fry", "french fries"],
        servings: [servingFromGrams(78, 230, 11, 31, 3, "Small")],
      },
      {
        id: "fries-medium",
        name: "World Famous Fries (Medium)",
        aliases: ["medium fries", "medium french fries", "medium fry", "fries", "fry", "french fries"],
        servings: [servingFromGrams(109, 320, 15, 43, 5, "Medium")],
      },
      {
        id: "fries-large",
        name: "World Famous Fries (Large)",
        aliases: ["large fries", "large french fries", "large fry", "fries", "fry", "french fries"],
        servings: [servingFromGrams(166, 480, 23, 65, 7, "Large")],
      },
      {
        id: "strawberry-banana-smoothie-small",
        name: "Strawberry Banana Smoothie (Small)",
        aliases: ["small strawberry banana smoothie", "small smoothie", "smoothie"],
        servings: [servingFromGrams(316, 190, 0.5, 44, 2, "Small")],
      },
      {
        id: "strawberry-banana-smoothie-medium",
        name: "Strawberry Banana Smoothie (Medium)",
        aliases: ["medium strawberry banana smoothie", "medium smoothie", "smoothie"],
        servings: [servingFromGrams(396, 240, 1, 55, 3, "Medium")],
      },
      {
        id: "strawberry-banana-smoothie-large",
        name: "Strawberry Banana Smoothie (Large)",
        aliases: ["large strawberry banana smoothie", "large smoothie", "smoothie"],
        servings: [servingFromGrams(541, 330, 1, 76, 4, "Large")],
      },
      {
        id: "egg-mcmuffin",
        name: "Egg McMuffin",
        aliases: ["egg mcmuffin sandwich"],
        servings: [servingFromGrams(138, 310, 13, 30, 17)],
      },
      {
        id: "hash-browns",
        name: "Hash Browns",
        aliases: ["hash brown", "hashbrown"],
        servings: [servingFromGrams(58, 140, 8, 18, 2)],
      },
    ],
  },
  chickFilA,
  dairyQueen,
  chipotle,
  fiveGuys,
  jimmyJohns,
  culvers,
];

function per100g(serving: RestaurantServing): FoodNutrients {
  if (!serving.grams) {
    return {
      calories: serving.calories,
      proteinG: serving.proteinG,
      carbsG: serving.carbsG,
      fatG: serving.fatG,
    };
  }
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

function chainWords(chain: RestaurantChain) {
  return new Set([...chain.chainTokens.flatMap((token) => words(token)), ...words(chain.name)]);
}

function mentionsChain(query: string, chain: RestaurantChain) {
  const q = query.toLowerCase();
  if (q.includes(chain.name.toLowerCase())) return true;
  const tokens = new Set(chain.chainTokens.flatMap((token) => words(token)));
  return words(query).some((word) => tokens.has(word));
}

function foodWords(query: string, chain: RestaurantChain) {
  if (!mentionsChain(query, chain)) return words(query);
  const skip = chainWords(chain);
  return words(query).filter((word) => !skip.has(word));
}

function matches(chain: RestaurantChain, item: RestaurantItem, query: string) {
  const wanted = foodWords(query, chain);
  const hay = haystack(chain, item);
  if (!wanted.length) return mentionsChain(query, chain);
  if (!wanted.every((word) => hay.includes(word))) return false;
  if (wanted.length > 1) return true;
  const word = wanted[0];
  const labels = [item.name, ...(item.aliases ?? [])];
  if (labels.some((value) => {
    const tokens = words(value);
    const content = tokens[0] === "the" ? tokens.slice(1) : tokens;
    return content.length === 1 && content[0] === word;
  })) return true;
  const namesAnotherItem = chain.items.some((other) => words(other.name).length === 1 && words(other.name)[0] === word);
  return namesAnotherItem && words(item.name).includes(word);
}

const PLACE_BOOST = 10000;

function placeMatches(chain: RestaurantChain, place: string) {
  const value = place.trim().toLowerCase();
  if (!value || value === "home") return false;
  if (value === chain.name.toLowerCase()) return true;
  const tokens = chainWords(chain);
  const placeWords = words(value);
  return placeWords.length > 0 && placeWords.every((word) => tokens.has(word));
}

function score(chain: RestaurantChain, item: RestaurantItem, query: string, place?: string) {
  const wanted = foodWords(query, chain).join(" ");
  const name = item.name.toLowerCase();
  let value = 0;
  if (wanted && name === wanted) value += 500;
  else if (wanted && name.startsWith(wanted)) value += 200;
  else if (wanted && name.includes(wanted)) value += 100;
  if (place && placeMatches(chain, place)) value += PLACE_BOOST;
  return value;
}

export function searchRestaurantFoods(query: string, place?: string): FoodHit[] {
  const q = query.trim().replace(/\s+/g, " ");
  const found: { hit: FoodHit; score: number; index: number }[] = [];
  let index = 0;
  for (const chain of RESTAURANT_CHAINS) {
    for (const item of chain.items) {
      if (!matches(chain, item, q)) continue;
      found.push({ hit: toHit(chain, item), score: score(chain, item, q, place), index });
      index += 1;
    }
  }
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  return found.map((item) => item.hit);
}

export function restaurantServingMatchesLabel(hit: FoodHit) {
  const serving = hit.servings[0];
  if (!serving) return false;
  const scaled = serving.grams
    ? scaleFood(hit.per100g, serving.grams, 1)
    : scaleListedFood(hit, null, 1);
  return scaled.calories === hit.calories
    && scaled.proteinG === hit.proteinG
    && scaled.carbsG === hit.carbsG
    && scaled.fatG === hit.fatG;
}
