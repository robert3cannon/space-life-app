import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/burger-king/menu/premium
 * bk.com/pdfs/nutrition.pdf did not return a nutrition PDF.
 */
export const burgerKing: RestaurantChain = {
  id: "burger-king",
  name: "Burger King",
  sourceUrl: "https://www.nutritionix.com/burger-king/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["bk"],
  items: [
    food("whopper", "Whopper", [listed("1 sandwich", 710, 42, 57, 34)], ["whopper"], "third-party"),
    food("whopper-cheese", "Whopper with Cheese", [listed("1 sandwich", 790, 49, 58, 37)], ["whopper", "whopper cheese"], "third-party"),
    food("double-whopper", "Double Whopper", [listed("1 sandwich", 980, 62, 57, 56)], ["whopper", "double whopper"], "third-party"),
    food("double-whopper-cheese", "Double Whopper with Cheese", [listed("1 sandwich", 1060, 69, 59, 60)], ["whopper", "double whopper"], "third-party"),
    food("triple-whopper", "Triple Whopper", [listed("1 sandwich", 1250, 82, 57, 78)], ["whopper", "triple whopper"], "third-party"),
    food("triple-whopper-cheese", "Triple Whopper with Cheese", [listed("1 sandwich", 1330, 89, 59, 82)], ["whopper", "triple whopper"], "third-party"),
    food("whopper-jr", "Whopper Jr.", [listed("1 sandwich", 340, 19, 30, 15)], ["whopper", "whopper jr"], "third-party"),
    food("whopper-jr-cheese", "Whopper Jr. with Cheese", [listed("1 sandwich", 380, 23, 31, 17)], ["whopper", "whopper jr"], "third-party"),
    food("chicken-fries-4", "Chicken Fries (4 pc)", [listed("4 pc", 110, 6, 8, 7)], ["chicken fries"], "third-party"),
    food("chicken-fries-8", "Chicken Fries (8 pc)", [listed("8 pc", 220, 12, 16, 13)], ["chicken fries"], "third-party"),
    food("chicken-fries-12", "Chicken Fries (12 pc)", [listed("12 pc", 340, 18, 25, 20)], ["chicken fries"], "third-party"),
    food("nuggets-4", "Crown Nuggets (4 pc)", [listed("4 pc", 220, 15, 12, 9)], ["nuggets", "nugget"], "third-party"),
    food("nuggets-8", "Crown Nuggets (8 pc)", [listed("8 pc", 440, 30, 23, 18)], ["nuggets", "nugget"], "third-party"),
    food("nuggets-16", "Crown Nuggets (16 pc)", [listed("16 pc", 870, 61, 46, 35)], ["nuggets", "nugget"], "third-party"),
    food("fries-small", "French Fries (Small)", [listed("Small", 300, 13, 40, 4)], ["fries", "fry"], "third-party"),
    food("fries-medium", "French Fries (Medium)", [listed("Medium", 370, 17, 50, 5)], ["fries", "fry"], "third-party"),
    food("fries-large", "French Fries (Large)", [listed("Large", 440, 20, 60, 6)], ["fries", "fry"], "third-party"),
  ],
};
