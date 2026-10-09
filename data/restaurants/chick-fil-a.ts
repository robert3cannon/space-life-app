import type { RestaurantChain } from "./types";
import { food, servingFromGrams } from "./format";

/**
 * Chick-fil-A US nutrition & allergens page.
 * https://www.chick-fil-a.com/nutrition-allergens
 * Verified on 2026-10-08.
 * Grams are the serving size on that page. The first row of a size group is the
 * standard item (8-count nuggets, 3-count strips, medium fries, medium mac and cheese).
 */
export const chickFilA: RestaurantChain = {
  id: "chick-fil-a",
  name: "Chick-fil-A",
  sourceUrl: "https://www.chick-fil-a.com/nutrition-allergens",
  verifiedOn: "2026-10-08",
  sourceType: "official",
  chainTokens: ["chick-fil-a", "chickfila", "cfa", "chick"],
  items: [
    food("chicken-sandwich", "Chick-fil-A Chicken Sandwich", [servingFromGrams(183, 420, 16, 41, 29)], ["chicken sandwich", "original chicken sandwich"]),
    food("spicy-chicken-sandwich", "Spicy Chicken Sandwich", [servingFromGrams(188, 450, 18, 44, 28)], ["spicy sandwich"]),
    food("deluxe-sandwich", "Chick-fil-A Deluxe Sandwich", [servingFromGrams(247, 490, 21, 43, 32)], ["deluxe sandwich", "chicken deluxe"]),
    food("spicy-deluxe-sandwich", "Spicy Deluxe Sandwich", [servingFromGrams(259, 540, 24, 46, 34)], ["spicy deluxe"]),
    food("grilled-chicken-sandwich", "Grilled Chicken Sandwich", [servingFromGrams(206, 390, 11, 45, 28)], ["grilled sandwich"]),
    food("grilled-chicken-club", "Grilled Chicken Club Sandwich", [servingFromGrams(237, 520, 22, 45, 37)], ["grilled club"]),
    food("cool-wrap", "Chick-fil-A Cool Wrap", [servingFromGrams(231, 660, 45, 32, 43)], ["cool wrap"]),
    food("nuggets-8", "Chick-fil-A Nuggets (8 ct)", [servingFromGrams(113, 250, 11, 11, 27, "8 ct")], ["nuggets", "chicken nuggets", "8 count nuggets"]),
    food("nuggets-12", "Chick-fil-A Nuggets (12 ct)", [servingFromGrams(170, 380, 17, 16, 40, "12 ct")], ["12 count nuggets", "nuggets"]),
    food("nuggets-30", "Chick-fil-A Nuggets (30 ct)", [servingFromGrams(425, 950, 43, 41, 100, "30 ct")], ["30 count nuggets", "nuggets"]),
    food("grilled-nuggets-8", "Grilled Nuggets (8 ct)", [servingFromGrams(95, 130, 3, 1, 25, "8 ct")], ["grilled nuggets"]),
    food("grilled-nuggets-12", "Grilled Nuggets (12 ct)", [servingFromGrams(142, 200, 4.5, 2, 38, "12 ct")], ["grilled nuggets"]),
    food("strips-3", "Chick-n-Strips (3 ct)", [servingFromGrams(136, 310, 14, 16, 29, "3 ct")], ["strips", "chicken strips"]),
    food("strips-4", "Chick-n-Strips (4 ct)", [servingFromGrams(181, 410, 19, 22, 39, "4 ct")], ["strips", "chicken strips"]),
    food("fries-small", "Waffle Potato Fries (Small)", [servingFromGrams(96, 320, 19, 35, 4, "Small")], ["fries", "fry", "waffle fries", "small fries"]),
    food("fries-medium", "Waffle Potato Fries (Medium)", [servingFromGrams(125, 420, 24, 45, 5, "Medium")], ["fries", "fry", "waffle fries", "medium fries"]),
    food("fries-large", "Waffle Potato Fries (Large)", [servingFromGrams(179, 600, 35, 65, 7, "Large")], ["fries", "fry", "waffle fries", "large fries"]),
    food("mac-small", "Mac & Cheese (Small)", [servingFromGrams(136, 270, 17, 17, 12, "Small")], ["mac and cheese", "mac"]),
    food("mac-medium", "Mac & Cheese (Medium)", [servingFromGrams(227, 450, 29, 28, 20, "Medium")], ["mac and cheese", "mac"]),
    food("chicken-biscuit", "Chick-fil-A Chicken Biscuit", [servingFromGrams(153, 460, 23, 45, 19)], ["chicken biscuit"]),
    food("spicy-chicken-biscuit", "Spicy Chicken Biscuit", [servingFromGrams(153, 450, 22, 44, 19)], ["spicy biscuit"]),
    food("chick-n-minis", "Chick-n-Minis (4 ct)", [servingFromGrams(127, 360, 13, 41, 20, "4 ct")], ["chick n minis", "minis"]),
    food("hash-browns", "Hash Browns", [servingFromGrams(77, 270, 18, 23, 3)], ["hash brown"]),
    food("fruit-cup", "Fruit Cup", [servingFromGrams(125, 70, 0, 16, 1)], ["fruit"]),
    food("cfa-sauce", "Chick-fil-A Sauce", [servingFromGrams(28, 140, 13, 6, 0)], ["sauce", "cfa sauce"]),
    food("polynesian-sauce", "Polynesian Sauce", [servingFromGrams(28, 110, 6, 14, 0)], ["polynesian"]),
    food("garden-herb-ranch", "Garden Herb Ranch Sauce", [servingFromGrams(21, 100, 11, 1, 0)], ["ranch"]),
    food("honey-mustard-sauce", "Honey Mustard Sauce", [servingFromGrams(28, 50, 0, 11, 0)], ["honey mustard"]),
    food("barbeque-sauce", "Barbeque Sauce", [servingFromGrams(28, 45, 0, 11, 0)], ["bbq sauce", "barbecue sauce"]),
    food("zesty-buffalo-sauce", "Zesty Buffalo Sauce", [servingFromGrams(21, 25, 2.5, 1, 0)], ["buffalo sauce"]),
    food("sriracha-sauce", "Sweet & Spicy Sriracha Sauce", [servingFromGrams(28, 45, 0, 11, 0)], ["sriracha"]),
  ],
};
