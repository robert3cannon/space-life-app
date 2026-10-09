import type { RestaurantChain } from "./types";
import { food, listed } from "./format";

/**
 * Third-party. Nutritionix restaurant menu, checked 2026-10-09.
 * https://www.nutritionix.com/starbucks/menu/premium
 * Drinks are Tall, Grande, and Venti with Starbucks' default 2% milk.
 * Mocha and white chocolate mocha include whip. Americano, Pike Place, and cold brew are unsweetened.
 * fastfoodnutrition.org lists the butter croissant at 260 calories (updated 2020-08-23); this row is 250.
 * The Starbucks product page did not return a drink nutrition table.
 */
export const starbucks: RestaurantChain = {
  id: "starbucks",
  name: "Starbucks",
  sourceUrl: "https://www.nutritionix.com/starbucks/menu/premium",
  verifiedOn: "2026-10-09",
  sourceType: "third-party",
  chainTokens: ["starbucks", "sbux"],
  orderNote: "Handcrafted drinks use 2% milk unless the name says otherwise.",
  items: [
    food("latte-tall", "Caffè Latte (2% milk) (Tall)", [listed("Tall", 150, 6.0, 15.0, 10.0)], ["latte", "tall"], "third-party"),
    food("latte-grande", "Caffè Latte (2% milk) (Grande)", [listed("Grande", 190, 7.0, 19.0, 13.0)], ["latte", "grande"], "third-party"),
    food("latte-venti", "Caffè Latte (2% milk) (Venti)", [listed("Venti", 250, 9.0, 24.0, 16.0)], ["latte", "venti"], "third-party"),
    food("cappuccino-tall", "Cappuccino (2% milk) (Tall)", [listed("Tall", 90, 3.5, 9.0, 6.0)], ["cappuccino", "tall"], "third-party"),
    food("cappuccino-grande", "Cappuccino (2% milk) (Grande)", [listed("Grande", 120, 4.0, 12.0, 8.0)], ["cappuccino", "grande"], "third-party"),
    food("cappuccino-venti", "Cappuccino (2% milk) (Venti)", [listed("Venti", 150, 6.0, 16.0, 10.0)], ["cappuccino", "venti"], "third-party"),
    food("americano-tall", "Caffè Americano (Tall)", [listed("Tall", 10, 0.0, 2.0, 1.0)], ["americano", "tall"], "third-party"),
    food("americano-grande", "Caffè Americano (Grande)", [listed("Grande", 15, 0.0, 3.0, 1.0)], ["americano", "grande"], "third-party"),
    food("americano-venti", "Caffè Americano (Venti)", [listed("Venti", 25, 0.0, 4.0, 1.0)], ["americano", "venti"], "third-party"),
    food("iced-americano-tall", "Iced Caffè Americano (Tall)", [listed("Tall", 10, 0.0, 2.0, 1.0)], ["iced americano", "americano", "tall"], "third-party"),
    food("iced-americano-grande", "Iced Caffè Americano (Grande)", [listed("Grande", 15, 0.0, 3.0, 1.0)], ["iced americano", "americano", "grande"], "third-party"),
    food("iced-americano-venti", "Iced Caffè Americano (Venti)", [listed("Venti", 25, 0.0, 4.0, 1.0)], ["iced americano", "americano", "venti"], "third-party"),
    food("iced-latte-tall", "Iced Caffè Latte (2% milk) (Tall)", [listed("Tall", 100, 3.5, 10.0, 6.0)], ["iced latte", "latte", "tall"], "third-party"),
    food("iced-latte-grande", "Iced Caffè Latte (2% milk) (Grande)", [listed("Grande", 130, 4.5, 13.0, 8.0)], ["iced latte", "latte", "grande"], "third-party"),
    food("iced-latte-venti", "Iced Caffè Latte (2% milk) (Venti)", [listed("Venti", 180, 6.0, 18.0, 12.0)], ["iced latte", "latte", "venti"], "third-party"),
    food("mocha-tall", "Caffè Mocha (2% milk, whip) (Tall)", [listed("Tall", 290, 13.0, 34.0, 11.0)], ["mocha", "tall"], "third-party"),
    food("mocha-grande", "Caffè Mocha (2% milk, whip) (Grande)", [listed("Grande", 360, 15.0, 44.0, 13.0)], ["mocha", "grande"], "third-party"),
    food("mocha-venti", "Caffè Mocha (2% milk, whip) (Venti)", [listed("Venti", 450, 18.0, 55.0, 17.0)], ["mocha", "venti"], "third-party"),
    food("caramel-macchiato-tall", "Caramel Macchiato (2% milk) (Tall)", [listed("Tall", 190, 6.0, 26.0, 8.0)], ["caramel macchiato", "macchiato", "tall"], "third-party"),
    food("caramel-macchiato-grande", "Caramel Macchiato (2% milk) (Grande)", [listed("Grande", 250, 7.0, 35.0, 10.0)], ["caramel macchiato", "macchiato", "grande"], "third-party"),
    food("caramel-macchiato-venti", "Caramel Macchiato (2% milk) (Venti)", [listed("Venti", 310, 9.0, 44.0, 13.0)], ["caramel macchiato", "macchiato", "venti"], "third-party"),
    food("vanilla-latte-tall", "Vanilla Latte (2% milk) (Tall)", [listed("Tall", 200, 5.0, 28.0, 9.0)], ["vanilla latte", "latte", "tall"], "third-party"),
    food("vanilla-latte-grande", "Vanilla Latte (2% milk) (Grande)", [listed("Grande", 250, 6.0, 37.0, 12.0)], ["vanilla latte", "latte", "grande"], "third-party"),
    food("vanilla-latte-venti", "Vanilla Latte (2% milk) (Venti)", [listed("Venti", 320, 9.0, 46.0, 15.0)], ["vanilla latte", "latte", "venti"], "third-party"),
    food("white-mocha-tall", "White Chocolate Mocha (2% milk, whip) (Tall)", [listed("Tall", 340, 14.0, 42.0, 11.0)], ["white mocha", "mocha", "tall"], "third-party"),
    food("white-mocha-grande", "White Chocolate Mocha (2% milk, whip) (Grande)", [listed("Grande", 430, 18.0, 55.0, 14.0)], ["white mocha", "mocha", "grande"], "third-party"),
    food("white-mocha-venti", "White Chocolate Mocha (2% milk, whip) (Venti)", [listed("Venti", 530, 21.0, 69.0, 19.0)], ["white mocha", "mocha", "venti"], "third-party"),
    food("chai-tall", "Chai Tea Latte (2% milk) (Tall)", [listed("Tall", 190, 3.5, 34.0, 6.0)], ["chai", "chai latte", "tall"], "third-party"),
    food("chai-grande", "Chai Tea Latte (2% milk) (Grande)", [listed("Grande", 240, 4.5, 45.0, 8.0)], ["chai", "chai latte", "grande"], "third-party"),
    food("chai-venti", "Chai Tea Latte (2% milk) (Venti)", [listed("Venti", 310, 6.0, 56.0, 10.0)], ["chai", "chai latte", "venti"], "third-party"),
    food("pike-tall", "Pike Place Roast (Tall)", [listed("Tall", 5, 0.0, 0.0, 0.0)], ["pike", "coffee", "brewed coffee", "tall"], "third-party"),
    food("pike-grande", "Pike Place Roast (Grande)", [listed("Grande", 5, 0.0, 0.0, 1.0)], ["pike", "coffee", "brewed coffee", "grande"], "third-party"),
    food("pike-venti", "Pike Place Roast (Venti)", [listed("Venti", 5, 0.0, 0.0, 1.0)], ["pike", "coffee", "brewed coffee", "venti"], "third-party"),
    food("cold-brew-tall", "Cold Brew (Tall)", [listed("Tall", 0, 0.0, 0.0, 0.0)], ["cold brew", "tall"], "third-party"),
    food("cold-brew-grande", "Cold Brew (Grande)", [listed("Grande", 5, 0.0, 0.0, 0.0)], ["cold brew", "grande"], "third-party"),
    food("cold-brew-venti", "Cold Brew (Venti)", [listed("Venti", 5, 0.0, 0.0, 0.0)], ["cold brew", "venti"], "third-party"),
    food("vanilla-cold-brew-tall", "Vanilla Sweet Cream Cold Brew (Tall)", [listed("Tall", 100, 6.0, 12.0, 1.0)], ["vanilla sweet cream", "cold brew", "tall"], "third-party"),
    food("vanilla-cold-brew-grande", "Vanilla Sweet Cream Cold Brew (Grande)", [listed("Grande", 110, 6.0, 14.0, 1.0)], ["vanilla sweet cream", "cold brew", "grande"], "third-party"),
    food("vanilla-cold-brew-venti", "Vanilla Sweet Cream Cold Brew (Venti)", [listed("Venti", 200, 11.0, 24.0, 1.0)], ["vanilla sweet cream", "cold brew", "venti"], "third-party"),
    food("nitro-tall", "Nitro Cold Brew (Tall)", [listed("Tall", 5, 0.0, 0.0, 0.0)], ["nitro", "cold brew", "tall"], "third-party"),
    food("nitro-grande", "Nitro Cold Brew (Grande)", [listed("Grande", 5, 0.0, 0.0, 0.0)], ["nitro", "cold brew", "grande"], "third-party"),
    food("bacon-gouda", "Bacon, Gouda & Egg Sandwich", [listed("1 sandwich", 360, 18.0, 35.0, 18.0)], ["bacon gouda", "breakfast sandwich"], "third-party"),
    food("egg-bites-bacon", "Bacon & Gruyère Egg Bites", [listed("1 order", 300, 20.0, 9.0, 19.0)], ["egg bites"], "third-party"),
    food("spinach-feta", "Spinach, Feta & Egg White Wrap", [listed("1 wrap", 290, 8.0, 34.0, 20.0)], ["spinach feta", "wrap"], "third-party"),
    food("butter-croissant", "Butter Croissant", [listed("1 croissant", 250, 14.0, 26.0, 5.0)], ["croissant"], "third-party"),
    food("cheese-danish", "Cheese Danish", [listed("1 danish", 290, 14.0, 33.0, 7.0)], ["danish"], "third-party"),
    food("chocolate-cake-pop", "Chocolate Cake Pop", [listed("1 cake pop", 150, 8.0, 21.0, 2.0)], ["cake pop"], "third-party"),
  ],
};
