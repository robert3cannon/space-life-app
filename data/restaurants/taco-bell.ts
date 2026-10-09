import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/taco-bell/menu/premium
 * fastfoodnutrition.org lists the crunchy taco at 170 calories (updated 2020-08-03).
 * Baja Blast is the plain fountain drink (0 g fat), not the dirty soda.
 */
export const tacoBell: RestaurantChain = {
  id: "taco-bell",
  name: "Taco Bell",
  sourceUrl: "https://www.nutritionix.com/taco-bell/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["tacobell"],
  items: [
    food("crunchy-taco", "Crunchy Taco", [listed("1 taco", 170, 9, 13, 7)], ["taco", "crunchy taco"], "third-party"),
    food("crunchy-taco-supreme", "Crunchy Taco Supreme", [listed("1 taco", 190, 10, 16, 8)], ["taco", "supreme taco"], "third-party"),
    food("soft-taco", "Soft Taco - Beef", [listed("1 taco", 180, 8, 18, 9)], ["taco", "soft taco"], "third-party"),
    food("soft-taco-supreme", "Soft Taco Supreme - Beef", [listed("1 taco", 200, 9, 21, 9)], ["taco", "soft taco supreme"], "third-party"),
    food("chalupa-beef", "Chalupa Supreme - Beef", [listed("1 chalupa", 350, 20, 32, 12)], ["chalupa"], "third-party"),
    food("gordita", "Cheesy Gordita Crunch", [listed("1 gordita", 480, 26, 44, 20)], ["gordita", "cheesy gordita"], "third-party"),
    food("bean-burrito", "Bean Burrito", [listed("1 burrito", 360, 10, 54, 13)], ["burrito", "bean burrito"], "third-party"),
    food("beefy-5-layer", "Beefy 5-Layer Burrito", [listed("1 burrito", 490, 18, 65, 17)], ["burrito", "5 layer"], "third-party"),
    food("burrito-supreme", "Burrito Supreme - Beef", [listed("1 burrito", 390, 14, 52, 16)], ["burrito", "burrito supreme"], "third-party"),
    food("crunchwrap", "Crunchwrap Supreme", [listed("1 crunchwrap", 530, 20, 74, 15)], ["crunchwrap"], "third-party"),
    food("quesadilla-cheese", "Cheese Quesadilla", [listed("1 quesadilla", 440, 22, 43, 18)], ["quesadilla"], "third-party"),
    food("quesadilla-chicken", "Chicken Quesadilla", [listed("1 quesadilla", 490, 23, 44, 26)], ["quesadilla"], "third-party"),
    food("mexican-pizza", "Mexican Pizza", [listed("1 pizza", 530, 27, 51, 19)], ["mexican pizza"], "third-party"),
    food("nachos-bellgrande", "Nachos BellGrande - Beef", [listed("1 order", 730, 38, 81, 17)], ["nachos", "bellgrande"], "third-party"),
    food("baja-16", "Mtn Dew Baja Blast (16 fl oz)", [listed("16 fl oz", 220, 0, 59, 0)], ["baja blast", "baja"], "third-party"),
    food("baja-20", "Mtn Dew Baja Blast (20 fl oz)", [listed("20 fl oz", 280, 0, 74, 0)], ["baja blast", "baja"], "third-party"),
    food("baja-30", "Mtn Dew Baja Blast (30 fl oz)", [listed("30 fl oz", 420, 0, 111, 0)], ["baja blast", "baja"], "third-party"),
  ],
};
