import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Dairy Queen US food and treats nutrition tables.
 * https://www.dairyqueen.com/en-us/nutrition/food-treats/
 * Verified on 2026-10-08. The treats table on that page is current as of March 30, 2026.
 * The table does not print gram weights. Texas toast is not listed on its own, so a
 * strip basket can be logged as the basket row or as strips, fries, and gravy.
 * The Parmesan Garlic basket row in the fetched table is misaligned, so it is omitted.
 */
const NOTE = "A chicken strip basket can be logged as the basket, or as strips plus fries and country gravy. Texas toast is not a separate row on the US table.";

function blizzard(flavor: string, id: string, sizes: Array<[string, number, number, number, number]>, aliases: string[]) {
  return sizes.map(([size, calories, fat, carbs, protein]) => food(
    `${id}-${size.toLowerCase()}`,
    `${flavor} Blizzard (${size})`,
    [listed(size, calories, fat, carbs, protein)],
    ["blizzard", flavor.toLowerCase(), ...aliases],
  ));
}

export const dairyQueen: RestaurantChain = {
  id: "dairy-queen",
  name: "Dairy Queen",
  sourceUrl: "https://www.dairyqueen.com/en-us/nutrition/food-treats/",
  verifiedOn: "2026-10-08",
  sourceType: "official",
  chainTokens: ["dairy", "queen", "dq", "dairyqueen"],
  orderNote: NOTE,
  items: [
    food("hamburger", "Hamburger", [listed("Single", 320, 13, 36, 15)], ["burger"]),
    food("hamburger-double", "Hamburger (Double)", [listed("Double", 460, 25, 36, 24)], ["burger", "double hamburger"]),
    food("hamburger-triple", "Hamburger (Triple)", [listed("Triple", 610, 37, 36, 33)], ["burger"]),
    food("cheeseburger", "Original Cheeseburger", [listed("Single", 370, 18, 37, 17)], ["cheeseburger", "cheese burger"]),
    food("cheeseburger-double", "Original Cheeseburger (Double)", [listed("Double", 570, 34, 38, 29)], ["cheeseburger"]),
    food("cheeseburger-triple", "Original Cheeseburger (Triple)", [listed("Triple", 760, 50, 39, 40)], ["cheeseburger"]),
    food("two-cheese-deluxe-double", "Two Cheese Deluxe Burger (Double)", [listed("Double", 620, 39, 39, 29)], ["deluxe burger"]),
    food("bacon-two-cheese-double", "Bacon Two Cheese Deluxe Burger (Double)", [listed("Double", 720, 47, 39, 37)], ["bacon cheeseburger"]),
    food("strips-3", "Chicken Strips (3 pc)", [listed("3 pieces", 430, 20, 41, 19)], ["chicken strips", "strips", "tenders"]),
    food("strips-2", "Chicken Strips (2 pc)", [listed("2 pieces", 280, 13, 28, 13)], ["chicken strips", "strips"]),
    food("strip-basket-4", "Chicken Strip Basket (4 pc)", [listed("4 pc basket", 1020, 48, 111, 35)], ["chicken strip basket", "basket"]),
    food("strip-basket-6", "Chicken Strip Basket (6 pc)", [listed("6 pc basket", 1300, 61, 139, 48)], ["chicken strip basket", "basket"]),
    food("fries-regular", "Fries (Regular)", [listed("Regular", 280, 13, 36, 5)], ["fries", "fry"]),
    food("fries-large", "Fries (Large)", [listed("Large", 450, 21, 59, 8)], ["fries", "fry", "large fries"]),
    food("fries-kids", "Fries (Kids)", [listed("Kids", 170, 8, 23, 3)], ["fries", "fry"]),
    food("country-gravy", "Country Gravy", [listed("1 cup", 70, 4.5, 6, 0)], ["gravy"]),
    ...blizzard("Oreo", "oreo", [
      ["Mini", 330, 12, 48, 7],
      ["Small", 600, 22, 89, 13],
      ["Medium", 820, 30, 121, 17],
      ["Large", 1050, 39, 156, 22],
    ], ["oreo"]),
    ...blizzard("Reese's Peanut Butter Cups", "reeses", [
      ["Mini", 360, 14, 50, 9],
      ["Small", 610, 24, 84, 16],
      ["Medium", 820, 34, 113, 21],
      ["Large", 1080, 45, 148, 28],
    ], ["reeses", "peanut butter cup"]),
    ...blizzard("Butterfinger", "butterfinger", [
      ["Mini", 350, 12, 52, 9],
      ["Small", 590, 21, 87, 15],
      ["Medium", 800, 28, 118, 20],
      ["Large", 1060, 37, 155, 27],
    ], ["butterfinger"]),
    ...blizzard("Chocolate Chip Cookie Dough", "cookie-dough", [
      ["Mini", 410, 16, 60, 8],
      ["Small", 710, 27, 104, 13],
      ["Medium", 1030, 40, 151, 18],
      ["Large", 1370, 54, 201, 23],
    ], ["cookie dough"]),
    ...blizzard("Snickers", "snickers", [
      ["Mini", 350, 12, 53, 8],
      ["Small", 610, 20, 92, 14],
      ["Medium", 800, 28, 120, 19],
      ["Large", 1060, 36, 162, 24],
    ], ["snickers"]),
    ...blizzard("M&M's", "mms", [
      ["Mini", 370, 12, 58, 8],
      ["Small", 660, 21, 103, 14],
      ["Medium", 880, 29, 135, 18],
      ["Large", 1160, 38, 183, 23],
    ], ["m&m", "mms"]),
    ...blizzard("Heath", "heath", [
      ["Mini", 360, 14, 52, 8],
      ["Small", 640, 26, 91, 13],
      ["Medium", 880, 37, 124, 17],
      ["Large", 1190, 49, 168, 23],
    ], ["heath"]),
  ],
};
