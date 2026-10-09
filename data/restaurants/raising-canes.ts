import type { RestaurantChain } from "./types";
import { food, listed, servingFromGrams } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/raising-canes/menu/premium
 * The same calories and macros are on a July 2025 allergen chart reproduced at
 * https://raisingcanesmenuprices.com/wp-content/uploads/2025/12/Raising-Canes-Nutrition.pdf
 * and https://canesnutritioncalculator.us/Raising%20Cane%27s%20Nutrition%20Facts.pdf.
 * Finger 130, sauce 190, sweet tea 230, and lemonade 290 match the calorie counts
 * on https://www.raisingcanes.com/menu/. The official PDF link on that site did not download.
 * Grams are the serving weights on that chart. Drinks are listed in fluid ounces.
 */
export const raisingCanes: RestaurantChain = {
  id: "raising-canes",
  name: "Raising Cane's",
  sourceUrl: "https://www.nutritionix.com/raising-canes/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["canes", "raising"],
  orderNote: "A Box, 3 Finger, or Caniac is the finger, fries, Texas toast, coleslaw, and Cane's sauce logged together. Combo rows are the whole meal.",
  items: [
    food("chicken-finger", "Chicken Finger", [servingFromGrams(55, 130, 7, 5, 13, "1 finger")], ["finger", "tender", "tenders"], "third-party"),
    food("fries", "Crinkle-Cut Fries", [servingFromGrams(144, 400, 20, 50, 5, "Regular")], ["fries", "fry"], "third-party"),
    food("texas-toast", "Texas Toast", [servingFromGrams(48, 150, 4.5, 23, 4, "1 slice")], ["toast"], "third-party"),
    food("coleslaw", "Coleslaw", [servingFromGrams(87, 100, 6, 10, 1, "Regular")], ["slaw"], "third-party"),
    food("sauce", "Cane's Sauce", [servingFromGrams(43, 190, 18, 6, 0, "1 serving")], ["sauce", "canes sauce"], "third-party"),
    food("combo-3", "3 Finger Combo", [listed("1 combo", 1050, 59, 83, 48)], ["3 finger", "three finger"], "third-party"),
    food("combo-box", "Box Combo", [listed("1 combo", 1290, 72, 98, 62)], ["box"], "third-party"),
    food("combo-caniac", "Caniac Combo", [listed("1 combo", 1840, 108, 125, 90)], ["caniac"], "third-party"),
    food("sweet-tea-kids", "Sweet Tea (Kid's)", [listed("12 fl oz", 130, 0, 33, 0)], ["sweet tea", "tea"], "third-party"),
    food("sweet-tea", "Sweet Tea (Regular)", [listed("22 fl oz", 230, 0, 60, 0)], ["sweet tea", "tea"], "third-party"),
    food("sweet-tea-large", "Sweet Tea (Large)", [listed("32 fl oz", 340, 0, 88, 0)], ["sweet tea", "tea"], "third-party"),
    food("unsweet-tea-kids", "Unsweet Tea (Kid's)", [listed("12 fl oz", 0, 0, 0, 0)], ["unsweet tea", "tea"], "third-party"),
    food("unsweet-tea", "Unsweet Tea (Regular)", [listed("22 fl oz", 0, 0, 0, 0)], ["unsweet tea", "tea"], "third-party"),
    food("unsweet-tea-large", "Unsweet Tea (Large)", [listed("32 fl oz", 0, 0, 0, 0)], ["unsweet tea", "tea"], "third-party"),
    food("lemonade-kids", "Lemonade (Kid's)", [listed("12 fl oz", 160, 0, 41, 0)], ["lemonade"], "third-party"),
    food("lemonade", "Lemonade (Regular)", [listed("22 fl oz", 290, 0, 76, 0)], ["lemonade"], "third-party"),
    food("lemonade-large", "Lemonade (Large)", [listed("32 fl oz", 420, 0, 111, 0)], ["lemonade"], "third-party"),
  ],
};
