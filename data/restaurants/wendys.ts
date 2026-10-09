import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/wendys/menu/premium
 * Wendy's PDFs on wendys.com are the UK table (Dave's Single 524 kcal).
 * fastfoodnutrition.org (updated 2021-12-07) lists Dave's Single at 570 cal and 29 g protein
 * (this row is 580 cal and 29 g protein) and the classic chicken sandwich at 490 cal
 * (this row is 480). The 6-piece nugget row is spelled Cripsy on Nutritionix.
 */
export const wendys: RestaurantChain = {
  id: "wendys",
  name: "Wendy's",
  sourceUrl: "https://www.nutritionix.com/wendys/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["wendys", "wendy"],
  orderNote: "Frosty Small is the Nutritionix row listed as Classic Chocolate Frosty or Vanilla Frosty, between Jr. and Medium.",
  items: [
    food("daves-single", "Dave's Single", [listed("1 sandwich", 580, 36, 35, 29)], ["daves single", "single"], "third-party"),
    food("daves-double", "Dave's Double", [listed("1 sandwich", 850, 57, 35, 49)], ["daves double", "double"], "third-party"),
    food("daves-triple", "Dave's Triple", [listed("1 sandwich", 1150, 81, 36, 71)], ["daves triple", "triple"], "third-party"),
    food("baconator", "Baconator", [listed("1 sandwich", 930, 63, 34, 57)], ["baconator", "baconator double", "double baconator"], "third-party"),
    food("jr-bacon-cheeseburger", "Jr. Bacon Cheeseburger", [listed("1 sandwich", 360, 22, 24, 17)], ["jbc", "junior bacon cheeseburger"], "third-party"),
    food("classic-chicken", "Classic Chicken Sandwich", [listed("1 sandwich", 480, 21, 44, 29)], ["chicken sandwich"], "third-party"),
    food("spicy-chicken", "Spicy Chicken Sandwich", [listed("1 sandwich", 470, 20, 44, 28)], ["spicy chicken"], "third-party"),
    food("nuggets-4", "Crispy Chicken Nuggets (4 pc)", [listed("4 pc", 180, 12, 9, 10)], ["nuggets", "nugget"], "third-party"),
    food("nuggets-6", "Crispy Chicken Nuggets (6 pc)", [listed("6 pc", 270, 17, 14, 15)], ["nuggets", "nugget"], "third-party"),
    food("nuggets-10", "Crispy Chicken Nuggets (10 pc)", [listed("10 pc", 450, 29, 23, 25)], ["nuggets", "nugget"], "third-party"),
    food("fries-small", "Natural-Cut Fries (Small)", [listed("Small", 260, 12, 35, 4)], ["fries", "fry", "small fries"], "third-party"),
    food("fries-medium", "Natural-Cut Fries (Medium)", [listed("Medium", 350, 16, 47, 5)], ["fries", "fry", "medium fries"], "third-party"),
    food("fries-large", "Natural-Cut Fries (Large)", [listed("Large", 470, 21, 63, 7)], ["fries", "fry", "large fries"], "third-party"),
    food("chocolate-frosty-jr", "Classic Chocolate Frosty (Jr.)", [listed("Jr.", 190, 6, 31, 6)], ["frosty", "chocolate frosty"], "third-party"),
    food("chocolate-frosty-small", "Classic Chocolate Frosty (Small)", [listed("Small", 310, 9, 49, 10)], ["frosty", "chocolate frosty", "small frosty"], "third-party"),
    food("chocolate-frosty-medium", "Classic Chocolate Frosty (Medium)", [listed("Medium", 390, 11, 61, 12)], ["frosty", "chocolate frosty"], "third-party"),
    food("chocolate-frosty-large", "Classic Chocolate Frosty (Large)", [listed("Large", 500, 15, 80, 16)], ["frosty", "chocolate frosty"], "third-party"),
    food("vanilla-frosty-jr", "Vanilla Frosty (Jr.)", [listed("Jr.", 190, 6, 31, 6)], ["frosty", "vanilla frosty"], "third-party"),
    food("vanilla-frosty-small", "Vanilla Frosty (Small)", [listed("Small", 310, 9, 49, 10)], ["frosty", "vanilla frosty"], "third-party"),
    food("vanilla-frosty-medium", "Vanilla Frosty (Medium)", [listed("Medium", 390, 11, 62, 12)], ["frosty", "vanilla frosty"], "third-party"),
    food("vanilla-frosty-large", "Vanilla Frosty (Large)", [listed("Large", 510, 15, 81, 16)], ["frosty", "vanilla frosty"], "third-party"),
  ],
};
