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
      "Raising Cane's": 17,
      "Wendy's": 21,
      Subway: 60,
      "Taco Bell": 17,
      "Burger King": 17,
      Popeyes: 14,
      Starbucks: 47,
    });
    for (const chain of RESTAURANT_CHAINS) {
      assert.match(chain.sourceUrl, /^https:\/\//);
      assert.match(chain.verifiedOn, /^2026-10-0[89]$/);
      assert.ok(chain.items.length > 0);
      assert.ok(chain.items.every((item) => item.sourceType === chain.sourceType));
      const hits = searchRestaurantFoods(chain.name);
      assert.equal(hits.length, chain.items.length);
      assert.ok(hits.every((hit) => hit.brand === chain.name && hit.sourceType === chain.sourceType && restaurantServingMatchesLabel(hit)));
    }
    const official = RESTAURANT_CHAINS.filter((chain) => chain.sourceType === "official").map((chain) => chain.name);
    const estimated = RESTAURANT_CHAINS.filter((chain) => chain.sourceType === "third-party").map((chain) => chain.name);
    assert.deepEqual(estimated, ["Raising Cane's", "Wendy's", "Subway", "Taco Bell", "Burger King", "Popeyes", "Starbucks"]);
    assert.ok(official.includes("Panda Express") && official.includes("McDonald's"));
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

  it("stores third-party menus and ranks official items ahead of them", () => {
    const finger = searchRestaurantFoods("canes chicken finger")[0];
    assert.equal(finger.brand, "Raising Cane's");
    assert.equal(finger.sourceType, "third-party");
    assert.equal(finger.calories, 130);
    assert.equal(finger.proteinG, 13);
    assert.equal(finger.servings[0].grams, 55);
    assert.equal(searchRestaurantFoods("canes sauce")[0].calories, 190);

    const fries = searchRestaurantFoods("fries", "Wendy's");
    assert.equal(fries[0].brand, "Wendy's");
    assert.equal(fries[0].name, "Natural-Cut Fries (Small)");
    assert.equal(fries[0].calories, 260);
    assert.equal(fries[0].sourceType, "third-party");
    const unscoped = searchRestaurantFoods("fries");
    assert.equal(unscoped[0].sourceType, "official");
    assert.ok(unscoped.some((hit) => hit.brand === "Wendy's"));

    const turkey = searchRestaurantFoods("subway oven roasted turkey");
    assert.equal(turkey[0].name, "Oven-Roasted Turkey (6 inch)");
    assert.equal(turkey[0].calories, 480);
    assert.equal(turkey.find((hit) => hit.name === "Oven-Roasted Turkey (Footlong)")?.calories, 960);

    assert.equal(searchRestaurantFoods("baconator double")[0].name, "Baconator");
    assert.equal(searchRestaurantFoods("crunchwrap")[0].calories, 530);
    assert.equal(searchRestaurantFoods("whopper")[0].calories, 710);
    assert.equal(searchRestaurantFoods("popeyes chicken sandwich")[0].calories, 700);
    const latte = searchRestaurantFoods("starbucks latte grande")[0];
    assert.equal(latte.name, "Caffè Latte (2% milk) (Grande)");
    assert.equal(latte.calories, 190);
    const plainLatte = searchRestaurantFoods("caffe latte")[0];
    assert.equal(plainLatte.brand, "Starbucks");
    assert.equal(plainLatte.name, "Caffè Latte (2% milk) (Tall)");
    assert.equal(plainLatte.sourceType, "third-party");
    assert.equal(searchRestaurantFoods("panda orange chicken")[0].sourceType, "official");
  });
});
