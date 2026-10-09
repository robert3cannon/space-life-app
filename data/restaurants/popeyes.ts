import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/popeyes/menu/premium
 * fastfoodnutrition.org lists the chicken sandwich at 699 calories, 42 g fat, 50 g carbs, 28 g protein.
 * That site lists a biscuit at 260 calories; this biscuit row is the Nutritionix value, 210.
 */
export const popeyes: RestaurantChain = {
  id: "popeyes",
  name: "Popeyes",
  sourceUrl: "https://www.nutritionix.com/popeyes/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["popeyes", "popeye"],
  orderNote: "Classic and spicy chicken use the same Nutritionix row.",
  items: [
    food("sandwich", "Chicken Sandwich (Classic)", [listed("1 sandwich", 700, 42, 50, 28)], ["chicken sandwich", "sandwich"], "third-party"),
    food("sandwich-spicy", "Chicken Sandwich (Spicy)", [listed("1 sandwich", 700, 42, 50, 28)], ["spicy chicken sandwich", "sandwich"], "third-party"),
    food("breast", "Chicken Breast (Classic or Spicy)", [listed("1 breast", 380, 20, 16, 35)], ["breast"], "third-party"),
    food("thigh", "Chicken Thigh (Classic or Spicy)", [listed("1 thigh", 280, 21, 7, 14)], ["thigh"], "third-party"),
    food("leg", "Chicken Leg (Classic or Spicy)", [listed("1 leg", 160, 9, 5, 14)], ["leg", "drumstick"], "third-party"),
    food("wing", "Chicken Wing (Classic or Spicy)", [listed("1 wing", 210, 14, 8, 13)], ["wing"], "third-party"),
    food("tenders-3", "Tenders (3 pc, Classic or Spicy)", [listed("3 pc", 450, 21, 29, 38)], ["tenders", "tender"], "third-party"),
    food("tenders-5", "Tenders (5 pc, Classic or Spicy)", [listed("5 pc", 740, 34, 48, 63)], ["tenders", "tender"], "third-party"),
    food("biscuit", "Biscuit", [listed("1 biscuit", 210, 13, 20, 3)], ["biscuit"], "third-party"),
    food("fries", "Cajun Fries (Regular)", [listed("Regular", 270, 14, 33, 4)], ["fries", "fry", "cajun fries"], "third-party"),
    food("fries-large", "Cajun Fries (Large)", [listed("Large", 800, 42, 97, 10)], ["fries", "fry", "cajun fries"], "third-party"),
    food("coleslaw", "Coleslaw (Regular)", [listed("Regular", 140, 10, 12, 1)], ["coleslaw", "slaw"], "third-party"),
    food("red-beans", "Red Beans & Rice (Regular)", [listed("Regular", 250, 16, 22, 8)], ["red beans", "beans and rice"], "third-party"),
    food("mashed", "Mashed Potatoes with Cajun Gravy (Regular)", [listed("Regular", 110, 4, 18, 3)], ["mashed potatoes", "mashed"], "third-party"),
  ],
};
