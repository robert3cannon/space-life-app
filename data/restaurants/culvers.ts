import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Culver's nutrition & allergen guide PDF.
 * https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf
 * Verified on 2026-10-08. The guide is © 2025 and does not print gram weights.
 * ButterBurger numbers are the main ButterBurgers table. The kids' meal row for
 * ButterBurger Cheese, Single lists 23 g protein; the main table lists 24 g, which is stored.
 */
export const culvers: RestaurantChain = {
  id: "culvers",
  name: "Culver's",
  sourceUrl: "https://cdn.culvers.com/menu/docs/guide-nutrition-allergen.pdf",
  verifiedOn: "2026-10-08",
  sourceType: "official",
  chainTokens: ["culvers", "culver's", "culver"],
  items: [
    food("butterburger-single", "ButterBurger (Single)", [listed("Single", 390, 17, 38, 20)], ["butterburger", "burger"]),
    food("butterburger-double", "ButterBurger (Double)", [listed("Double", 560, 30, 38, 34)], ["butterburger", "burger"]),
    food("butterburger-triple", "ButterBurger (Triple)", [listed("Triple", 730, 43, 38, 48)], ["butterburger", "burger"]),
    food("butterburger-cheese-single", "ButterBurger Cheese (Single)", [listed("Single", 460, 23, 39, 24)], ["cheeseburger", "butterburger"]),
    food("butterburger-cheese-double", "ButterBurger Cheese (Double)", [listed("Double", 700, 42, 40, 41)], ["cheeseburger", "butterburger"]),
    food("butterburger-cheese-triple", "ButterBurger Cheese (Triple)", [listed("Triple", 940, 61, 41, 59)], ["cheeseburger", "butterburger"]),
    food("deluxe-single", "The Culver's Deluxe (Single)", [listed("Single", 580, 34, 41, 24)], ["deluxe"]),
    food("grilled-chicken-sandwich", "Grilled Chicken Sandwich", [listed("1 sandwich", 480, 19, 40, 36)], ["grilled chicken"]),
    food("crispy-chicken-sandwich", "Crispy Chicken Sandwich", [listed("1 sandwich", 690, 35, 65, 28)], ["crispy chicken"]),
    food("spicy-crispy-chicken", "Spicy Crispy Chicken Sandwich", [listed("1 sandwich", 680, 33, 65, 32)], ["spicy chicken"]),
    food("tenders-1", "Chicken Tenders (1 pc)", [listed("1 piece", 130, 6, 10, 10)], ["tender", "chicken tender"]),
    food("tenders-2", "Chicken Tenders (2 pc)", [listed("2 pieces", 260, 11, 21, 19)], ["tenders", "chicken tenders"]),
    food("tenders-4", "Chicken Tenders (4 pc)", [listed("4 pieces", 520, 23, 41, 39)], ["tenders", "chicken tenders"]),
    food("fries-small", "Crinkle Cut Fries (Small)", [listed("Small", 220, 9, 32, 3)], ["fries", "fry"]),
    food("fries-medium", "Crinkle Cut Fries (Medium)", [listed("Medium", 350, 14, 50, 4)], ["fries", "fry"]),
    food("fries-large", "Crinkle Cut Fries (Large)", [listed("Large", 430, 18, 62, 5)], ["fries", "fry"]),
    food("coleslaw", "Coleslaw (Medium)", [listed("Medium", 200, 16, 15, 1)], ["coleslaw", "slaw"]),
    food("cheese-curds", "Wisconsin Cheese Curds (Medium)", [listed("Medium", 490, 27, 46, 17)], ["cheese curds", "curds"]),
    food("vanilla-mixer-mini", "Vanilla Concrete Mixer (Mini)", [listed("Mini", 380, 22, 38, 7)], ["concrete mixer", "custard", "vanilla"]),
    food("vanilla-mixer-small", "Vanilla Concrete Mixer (Small)", [listed("Small", 630, 37, 63, 11)], ["concrete mixer", "custard"]),
    food("vanilla-mixer-medium", "Vanilla Concrete Mixer (Medium)", [listed("Medium", 820, 48, 82, 15)], ["concrete mixer", "custard"]),
    food("vanilla-mixer-large", "Vanilla Concrete Mixer (Large)", [listed("Large", 940, 56, 94, 17)], ["concrete mixer", "custard"]),
    food("chocolate-mixer-mini", "Chocolate Concrete Mixer (Mini)", [listed("Mini", 340, 17, 43, 7)], ["concrete mixer", "custard", "chocolate"]),
    food("chocolate-mixer-small", "Chocolate Concrete Mixer (Small)", [listed("Small", 570, 29, 71, 11)], ["concrete mixer", "custard"]),
    food("chocolate-mixer-medium", "Chocolate Concrete Mixer (Medium)", [listed("Medium", 740, 37, 93, 15)], ["concrete mixer", "custard"]),
    food("chocolate-mixer-large", "Chocolate Concrete Mixer (Large)", [listed("Large", 860, 43, 107, 18)], ["concrete mixer", "custard"]),
  ],
};
