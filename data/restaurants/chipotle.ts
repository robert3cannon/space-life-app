import type { RestaurantChain } from "./types";
import { food, listed, serving } from "./format";

/**
 * Chipotle US nutrition facts chart.
 * https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf
 * Verified on 2026-10-08.
 * Ounce portions use the chart weight. Tortillas are "1 ea" with no gram weight,
 * and the two tomatillo salsas are listed in fluid ounces, so those stay count servings.
 * A bowl or burrito is these components logged together.
 */
const NOTE = "Log a bowl or burrito as the components you actually got: tortilla, rice, beans, protein, salsa, and toppings.";

export const chipotle: RestaurantChain = {
  id: "chipotle",
  name: "Chipotle",
  sourceUrl: "https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf",
  verifiedOn: "2026-10-08",
  sourceType: "official",
  chainTokens: ["chipotle"],
  orderNote: NOTE,
  items: [
    food("flour-tortilla-burrito", "Flour Tortilla (Burrito)", [listed("1 tortilla", 320, 9, 50, 8)], ["tortilla", "burrito tortilla"]),
    food("flour-tortilla-taco", "Flour Tortilla (Taco)", [listed("1 tortilla", 80, 2.5, 13, 2)], ["taco tortilla", "soft taco shell"]),
    food("crispy-corn-tortilla", "Crispy Corn Tortilla", [listed("1 tortilla", 70, 3, 10, 1)], ["hard taco shell", "corn tortilla"]),
    food("brown-rice", "Cilantro-Lime Brown Rice", [serving(4, 210, 6, 36, 4)], ["brown rice", "rice"]),
    food("white-rice", "Cilantro-Lime White Rice", [serving(4, 210, 4, 40, 4)], ["white rice", "rice"]),
    food("black-beans", "Black Beans", [serving(4, 130, 1.5, 22, 8)], ["beans"]),
    food("pinto-beans", "Pinto Beans", [serving(4, 130, 1.5, 21, 8)], ["beans"]),
    food("fajita-vegetables", "Fajita Vegetables", [serving(2, 20, 0, 5, 1)], ["fajita veggies", "peppers and onions"]),
    food("chicken", "Chicken", [serving(4, 180, 7, 0, 32)], ["grilled chicken"]),
    food("steak", "Steak", [serving(4, 150, 6, 1, 21)]),
    food("carnitas", "Carnitas", [serving(4, 210, 12, 0, 23)]),
    food("barbacoa", "Barbacoa", [serving(4, 170, 7, 2, 24)]),
    food("sofritas", "Sofritas", [serving(4, 150, 10, 9, 8)]),
    food("tomato-salsa", "Fresh Tomato Salsa", [serving(4, 25, 0, 4, 0)], ["mild salsa", "pico", "salsa"]),
    food("corn-salsa", "Roasted Chili-Corn Salsa", [serving(4, 80, 1.5, 16, 3)], ["corn salsa", "salsa"]),
    food("green-salsa", "Tomatillo-Green Chili Salsa", [listed("2 fl oz", 15, 0, 4, 0)], ["green salsa", "salsa"]),
    food("red-salsa", "Tomatillo-Red Chili Salsa", [listed("2 fl oz", 30, 0, 4, 0)], ["red salsa", "salsa"]),
    food("cheese", "Cheese", [serving(1, 110, 8, 1, 6)]),
    food("sour-cream", "Sour Cream", [serving(2, 110, 9, 2, 2)]),
    food("guacamole", "Guacamole", [serving(4, 230, 22, 8, 2)], ["guac"]),
    food("queso", "Queso Blanco", [serving(2, 120, 9, 4, 5)], ["queso"]),
    food("lettuce", "Romaine Lettuce", [serving(1, 5, 0, 1, 0)], ["lettuce"]),
    food("chips", "Chips", [serving(4, 540, 25, 73, 7)], ["chips"]),
    food("chips-large", "Chips (Large)", [serving(6, 810, 38, 110, 11)], ["large chips", "chips"]),
  ],
};
