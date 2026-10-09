import type { RestaurantChain } from "./types";
import { food, servingFromGrams } from "./format";

/**
 * Five Guys US nutrition & allergen guide, September 1, 2026.
 * https://www.fiveguys.com/wp-content/uploads/2026/09/Five-Guys-US-Nutrition-Allergen-Guide-English-September-2026.pdf
 * Verified on 2026-10-08.
 * Burgers are not printed assembled. These are the build components and fries.
 * A second Mini fries row (178 g, 413 cal) has no supplier name, so it is omitted.
 * Rows with fat, carbs, or protein printed as <1 g are omitted rather than rounded.
 * Where two suppliers differ, both are kept and named.
 */
const NOTE = "Build a burger from a patty, bun, cheese, and toppings. Fries and the shake base are separate items.";

export const fiveGuys: RestaurantChain = {
  id: "five-guys",
  name: "Five Guys",
  sourceUrl: "https://www.fiveguys.com/wp-content/uploads/2026/09/Five-Guys-US-Nutrition-Allergen-Guide-English-September-2026.pdf",
  verifiedOn: "2026-10-08",
  sourceType: "official",
  chainTokens: ["five", "guys", "fiveguys"],
  orderNote: NOTE,
  items: [
    food("bacon-s", "Bacon (2 pieces, supplier S)", [servingFromGrams(14, 70, 6, 0, 5)], ["bacon"]),
    food("bacon-d", "Bacon (2 pieces, supplier D)", [servingFromGrams(14, 73, 5, 0, 6)], ["bacon"]),
    food("patty", "Hamburger Patty", [servingFromGrams(65, 302, 17, 0, 16)], ["patty", "beef patty"]),
    food("mini-patty", "Mini Patty", [servingFromGrams(35, 163, 9, 0, 9)], ["mini patty"]),
    food("hot-dog-h", "Hot Dog (supplier H)", [servingFromGrams(90, 280, 26, 1, 11)], ["hot dog"]),
    food("hot-dog-k", "Hot Dog (supplier K)", [servingFromGrams(90, 260, 24, 1, 11)], ["hot dog"]),
    food("bun", "Hamburger Bun", [servingFromGrams(77, 240, 8, 35, 7)], ["bun"]),
    food("mini-bun", "Mini Bun", [servingFromGrams(37, 120, 3, 20, 3)], ["bun"]),
    food("hot-dog-bun", "Hot Dog Bun", [servingFromGrams(71, 220, 7, 33, 6)], ["bun"]),
    food("fries-mini", "Fries, Mini", [servingFromGrams(175, 405, 17, 55, 6)], ["fries", "fry"]),
    food("fries-little", "Fries, Little", [servingFromGrams(227, 526, 23, 72, 8)], ["fries", "fry"]),
    food("fries-regular", "Fries, Regular", [servingFromGrams(411, 953, 41, 131, 15)], ["fries", "fry"]),
    food("fries-large", "Fries, Large", [servingFromGrams(567, 1314, 57, 181, 20)], ["fries", "fry"]),
    food("cajun-little", "Cajun Fries, Little", [servingFromGrams(232, 540, 28, 75, 8)], ["cajun fries", "fries"]),
    food("cajun-regular", "Cajun Fries, Regular", [servingFromGrams(416, 967, 41, 134, 15)], ["cajun fries", "fries"]),
    food("cajun-large", "Cajun Fries, Large", [servingFromGrams(572, 1328, 57, 184, 20)], ["cajun fries", "fries"]),
    food("cheese", "Cheese (1 slice, supplier S)", [servingFromGrams(19, 70, 6, 1, 3)], ["cheese"]),
    food("lettuce", "Lettuce", [servingFromGrams(30, 3, 0, 1, 0)], ["lettuce"]),
    food("onions", "Onions", [servingFromGrams(26, 11, 0, 2, 0)], ["onion", "grilled onions"]),
    food("pickles-m", "Pickles (supplier M)", [servingFromGrams(28, 0, 0, 0, 0)], ["pickles"]),
    food("pickles-b", "Pickles (supplier B)", [servingFromGrams(28, 0, 0, 0, 0)], ["pickles"]),
    food("ketchup", "Ketchup", [servingFromGrams(17, 30, 0, 5, 0)], ["ketchup"]),
    food("mustard", "Mustard", [servingFromGrams(5, 0, 0, 0, 0)], ["mustard"]),
    food("mayo-k", "Mayonnaise (supplier K)", [servingFromGrams(14, 111, 11, 0, 0)], ["mayo", "mayonnaise"]),
    food("mayo-s", "Mayonnaise (supplier S)", [servingFromGrams(14, 103, 11, 0, 0)], ["mayo", "mayonnaise"]),
    food("peppers", "Green Peppers", [servingFromGrams(25, 3, 0, 1, 0)], ["peppers"]),
    food("mushrooms", "Grilled Mushrooms", [servingFromGrams(21, 6, 0, 1, 0)], ["mushrooms"]),
    food("hot-sauce", "Hot Sauce", [servingFromGrams(5, 0, 0, 0, 0)], ["hot sauce"]),
    food("a1", "A.1. Sauce", [servingFromGrams(17, 15, 0, 3, 0)], ["a1"]),
    food("relish", "Relish", [servingFromGrams(15, 16, 0, 4, 0)], ["relish"]),
    food("shake", "Vanilla Shake", [servingFromGrams(315, 524, 25, 65, 10)], ["shake", "milkshake"]),
    food("mini-shake", "Mini Vanilla Shake", [servingFromGrams(155, 250, 12, 33, 5)], ["shake", "milkshake"]),
    food("chocolate", "Chocolate Mix-in", [servingFromGrams(50, 133, 2, 30, 2)], ["chocolate"]),
    food("oreo-creme", "Oreo Creme Mix-in", [servingFromGrams(50, 320, 25, 23, 0)], ["oreo"]),
    food("oreo-pieces", "Oreo Cookie Pieces", [servingFromGrams(25, 120, 5, 18, 1)], ["oreo"]),
    food("peanut-butter", "Peanut Butter Mix-in", [servingFromGrams(50, 322, 29, 9, 9)], ["peanut butter"]),
    food("reeses", "Reese's Peanut Butter Cup", [servingFromGrams(28, 150, 8, 15, 3)], ["reeses"]),
    food("cheese-sauce", "Cheese Sauce", [servingFromGrams(90, 92, 6, 7, 4)], ["cheese sauce"]),
    food("fry-sauce", "Fry Sauce", [servingFromGrams(35, 100, 9, 5, 0)], ["fry sauce"]),
    food("peanuts", "Peanuts (1 oz)", [servingFromGrams(30, 170, 14, 5, 7)], ["peanuts"]),
    food("eggs", "Eggs (2)", [servingFromGrams(105, 160, 11, 1, 13)], ["eggs"]),
    food("chocolate-milk", "Chocolate Milk", [servingFromGrams(245, 150, 2.5, 23, 8)], ["chocolate milk"]),
    food("milk", "Low Fat Milk", [servingFromGrams(213, 90, 2, 10, 7)], ["milk"]),
  ],
};
