import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESTAURANT_CHAINS, restaurantServingMatchesLabel, searchRestaurantFoods } from "../data/restaurant-foods";

describe("restaurant menus", () => {
  it("keeps a verified US source on every chain and a round-trip serving", () => {
    const counts = Object.fromEntries(RESTAURANT_CHAINS.map((chain) => [chain.name, chain.items.length]));
    assert.deepEqual(counts, {
      "Panda Express": 17,
      "McDonald's": 18,
      "Chick-fil-A": 31,
      "Dairy Queen": 44,
      Chipotle: 24,
      "Five Guys": 43,
      "Jimmy John's": 72,
      "Culver's": 26,
    });
    for (const chain of RESTAURANT_CHAINS) {
      assert.match(chain.sourceUrl, /^https:\/\//);
      assert.equal(chain.verifiedOn, "2026-10-08");
      assert.ok(chain.items.length > 0);
      const hits = searchRestaurantFoods(chain.name);
      assert.equal(hits.length, chain.items.length);
      assert.ok(hits.every((hit) => hit.brand === chain.name && restaurantServingMatchesLabel(hit)));
    }
  });

  it("stores Chipotle build components, including count tortillas", () => {
    const chicken = searchRestaurantFoods("chipotle chicken")[0];
    assert.equal(chicken.name, "Chicken");
    assert.equal(chicken.calories, 180);
    assert.equal(chicken.proteinG, 32);
    assert.equal(chicken.servings[0].grams, 113);
    const tortilla = searchRestaurantFoods("burrito tortilla")[0];
    assert.equal(tortilla.name, "Flour Tortilla (Burrito)");
    assert.equal(tortilla.calories, 320);
    assert.equal(tortilla.fatG, 9);
    assert.equal(tortilla.carbsG, 50);
    assert.equal(tortilla.proteinG, 8);
    assert.equal(tortilla.servings[0].grams, null);
    const rice = searchRestaurantFoods("chipotle white rice")[0];
    assert.equal(rice.calories, 210);
    assert.equal(rice.fatG, 4);
    assert.equal(searchRestaurantFoods("chipotle guacamole")[0].calories, 230);
    assert.equal(searchRestaurantFoods("queso")[0].calories, 120);
  });

  it("ranks the selected place ahead of other restaurants", () => {
    const plain = searchRestaurantFoods("fries");
    assert.equal(plain[0].brand, "Dairy Queen");
    const chick = searchRestaurantFoods("fries", "Chick-fil-A");
    assert.equal(chick[0].brand, "Chick-fil-A");
    assert.equal(chick[0].name, "Waffle Potato Fries (Small)");
    assert.equal(chick[0].calories, 320);
    assert.ok(chick.some((hit) => hit.brand === "McDonald's"));
    const dairy = searchRestaurantFoods("oreo", "Dairy Queen");
    assert.equal(dairy[0].brand, "Dairy Queen");
    assert.equal(dairy[0].calories, 330);
    const home = searchRestaurantFoods("fries", "Home");
    assert.equal(home[0].brand, plain[0].brand);
  });

  it("keeps checked menu facts from each new chain", () => {
    const sandwich = searchRestaurantFoods("chick-fil-a chicken sandwich")[0];
    assert.equal(sandwich.calories, 420);
    assert.equal(sandwich.proteinG, 29);
    assert.equal(sandwich.servings[0].grams, 183);

    const pepe = searchRestaurantFoods("jimmy johns pepe");
    assert.equal(pepe[0].name, "The Pepe (8 inch)");
    assert.equal(pepe[0].calories, 600);
    assert.equal(pepe[0].fatG, 29);
    assert.equal(pepe[0].carbsG, 50);
    assert.equal(pepe[0].proteinG, 29);
    assert.equal(pepe.find((hit) => hit.name === "The Pepe (16 inch)")?.calories, 1190);

    const patty = searchRestaurantFoods("five guys hamburger patty")[0];
    assert.equal(patty.calories, 302);
    assert.equal(patty.proteinG, 16);
    assert.equal(patty.servings[0].grams, 65);
    assert.equal(searchRestaurantFoods("five guys regular fries")[0].calories, 953);

    const burger = searchRestaurantFoods("culver's butterburger cheese single")[0];
    assert.equal(burger.calories, 460);
    assert.equal(burger.proteinG, 24);
    assert.equal(searchRestaurantFoods("culvers cheese curds")[0].calories, 490);

    const strips = searchRestaurantFoods("dairy queen chicken strips")[0];
    assert.equal(strips.name, "Chicken Strips (3 pc)");
    assert.equal(strips.calories, 430);
    assert.equal(searchRestaurantFoods("dq chicken strip basket")[0].calories, 1020);
  });
});
