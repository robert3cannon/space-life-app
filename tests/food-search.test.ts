import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET as botBarcode } from "../app/api/bot/food/barcode/route";
import { GET as botSearch } from "../app/api/bot/food/search/route";
import { closeDb, getSql } from "../lib/db";
import { RESTAURANT_CHAINS, restaurantServingMatchesLabel, searchRestaurantFoods } from "../data/restaurant-foods";
import { scaleFood, usdaToHit, type FoodHit, type UsdaSearchFood } from "../lib/food-catalog";
import { lookupBarcode, searchFoods, setFoodCatalogFetch } from "../lib/services/food-catalog";
import { migrate } from "../scripts/migrate";

const ctx = undefined as never;

const banana: UsdaSearchFood = {
  fdcId: 173944,
  description: "Bananas, raw",
  dataType: "Survey (FNDDS)",
  foodNutrients: [
    { nutrientId: 1008, value: 89 },
    { nutrientId: 1003, value: 1.09 },
    { nutrientId: 1005, value: 22.8 },
    { nutrientId: 1004, value: 0.33 },
  ],
  foodMeasures: [{ disseminationText: "1 medium", gramWeight: 118, rank: 1 }],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("food search", () => {
  before(async () => {
    await migrate();
    await getSql()`TRUNCATE food_cache`;
  });

  after(async () => {
    setFoodCatalogFetch(null);
    await closeDb();
  });

  it("scales a USDA serving from per-100g nutrients", () => {
    const hit = usdaToHit({
      fdcId: 1,
      description: "BANANA SPREAD",
      dataType: "Branded",
      brandOwner: "Test Kitchen",
      servingSize: 32,
      servingSizeUnit: "g",
      householdServingFullText: "2 Tbsp",
      foodNutrients: [
        { nutrientId: 1008, value: 312 },
        { nutrientId: 1003, value: 12.5 },
        { nutrientId: 1005, value: 40.6 },
        { nutrientId: 1004, value: 6.25 },
      ],
    });
    assert.ok(hit);
    assert.equal(hit.servings[0].label, "2 Tbsp");
    assert.equal(hit.calories, 100);
    assert.equal(scaleFood(hit.per100g, hit.servings[0].grams ?? 0, 2).calories, 200);
  });

  it("searches through the bot API and caches the upstream calls", async () => {
    const calls: string[] = [];
    setFoodCatalogFetch(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("nal.usda.gov")) return jsonResponse({ foods: [banana] });
      if (url.includes("openfoodfacts.org/cgi/search.pl")) {
        return jsonResponse({
          products: [
            {
              code: "12345678",
              product_name: "Banana chips",
              brands: "Example",
              serving_size: "30 g",
              nutriments: { "energy-kcal_100g": 500, proteins_100g: 2, carbohydrates_100g: 60, fat_100g: 30 },
            },
          ],
        });
      }
      return jsonResponse({ status: 0 });
    });

    const denied = await botSearch(new Request("http://localhost/api/bot/food/search?q=banana"), ctx);
    assert.equal(denied.status, 401);

    const response = await botSearch(
      new Request("http://localhost/api/bot/food/search?q=banana", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { foods: FoodHit[] };
    assert.equal(body.foods[0].name, "Bananas, raw");
    assert.equal(body.foods[0].calories, 105);
    assert.equal(body.foods[0].servings[0].label, "1 medium");
    assert.ok(body.foods.some((food) => food.source === "openfoodfacts"));
    const firstCalls = calls.length;
    assert.ok(firstCalls >= 2);

    const again = await searchFoods("banana", 6);
    assert.equal(again[0].calories, 105);
    assert.equal(calls.length, firstCalls);

    const missing = await botSearch(new Request("http://localhost/api/bot/food/search?q=a"), ctx);
    assert.equal(missing.status, 401);
    const bad = await botSearch(
      new Request("http://localhost/api/bot/food/search?q=a", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    assert.equal(bad.status, 400);
  });

  it("returns curated Panda Express items ahead of USDA and Open Food Facts", async () => {
    const panda = RESTAURANT_CHAINS.find((chain) => chain.id === "panda-express");
    assert.ok(panda);
    assert.equal(panda.sourceUrl, "https://www.pandaexpress.com/nutritioninformation");
    assert.equal(panda.verifiedOn, "2026-10-08");
    const catalog = searchRestaurantFoods("panda express");
    assert.equal(catalog.length, panda.items.length);
    assert.ok(catalog.every((hit) => hit.source === "restaurant" && hit.brand === "Panda Express" && restaurantServingMatchesLabel(hit)));
    assert.equal(catalog.some((hit) => /angus/i.test(hit.name)), false);

    setFoodCatalogFetch(async (input) => {
      const url = String(input);
      if (url.includes("openfoodfacts.org/cgi/search.pl")) {
        return jsonResponse({
          products: [
            {
              code: "999111222",
              product_name: "Panda broccoli beef bowl",
              brands: "Open Food Facts",
              serving_size: "159 g",
              nutriments: { "energy-kcal_100g": 184, proteins_100g: 8, carbohydrates_100g: 16, fat_100g: 10 },
            },
          ],
        });
      }
      if (url.includes("nal.usda.gov")) {
        return jsonResponse({
          foods: [
            {
              fdcId: 42,
              description: "Beef, broccoli, restaurant",
              dataType: "Survey (FNDDS)",
              foodNutrients: [
                { nutrientId: 1008, value: 151 },
                { nutrientId: 1003, value: 9 },
                { nutrientId: 1005, value: 8 },
                { nutrientId: 1004, value: 9 },
              ],
              foodMeasures: [{ disseminationText: "1 cup", gramWeight: 170, rank: 1 }],
            },
          ],
        });
      }
      return jsonResponse({ foods: [] });
    });

    async function search(q: string) {
      const response = await botSearch(
        new Request(`http://localhost/api/bot/food/search?q=${encodeURIComponent(q)}`, {
          headers: { authorization: "Bearer test-bot-token-value" },
        }),
        ctx,
      );
      assert.equal(response.status, 200);
      return (await response.json()) as { foods: FoodHit[] };
    }

    const named = await search("panda express broccoli beef");
    assert.equal(named.foods[0].id, "restaurant:panda-express:broccoli-beef");
    assert.equal(named.foods[0].source, "restaurant");
    assert.equal(named.foods[0].brand, "Panda Express");
    assert.ok(named.foods.some((food) => food.source === "openfoodfacts"));

    const broccoli = await search("broccoli beef");
    assert.equal(broccoli.foods[0].name, "Broccoli Beef");
    assert.equal(broccoli.foods[0].calories, 150);
    assert.equal(broccoli.foods[0].fatG, 6);
    assert.equal(broccoli.foods[0].carbsG, 12);
    assert.equal(broccoli.foods[0].proteinG, 15);
    assert.equal(broccoli.foods[0].servings[0].grams, 154);
    assert.match(broccoli.foods[0].servings[0].label, /5\.44 oz/);
    const cub = broccoli.foods.find((food) => food.name === "Broccoli Beef Cub Meal");
    assert.ok(cub);
    assert.equal(cub.calories, 110);
    assert.equal(cub.fatG, 5);
    assert.equal(cub.carbsG, 9);
    assert.equal(cub.proteinG, 11);
    assert.equal(cub.servings[0].grams, 116);
    assert.ok(broccoli.foods.findIndex((food) => food.source !== "restaurant") > broccoli.foods.findIndex((food) => food.id === "restaurant:panda-express:broccoli-beef-cub-meal"));

    const beijing = await search("beijing beef");
    assert.equal(beijing.foods[0].name, "Beijing Beef");
    assert.equal(beijing.foods[0].calories, 470);
    assert.equal(beijing.foods[0].fatG, 27);
    assert.equal(beijing.foods[0].carbsG, 46);
    assert.equal(beijing.foods[0].proteinG, 14);
    assert.equal(beijing.foods[0].servings[0].grams, 159);

    const orange = catalog.find((hit) => hit.name === "Orange Chicken");
    const chow = catalog.find((hit) => hit.name === "Chow Mein");
    const rice = catalog.find((hit) => hit.name === "Fried Rice");
    const white = catalog.find((hit) => hit.name === "White Steamed Rice");
    const greens = catalog.find((hit) => hit.name === "Super Greens");
    const kung = catalog.find((hit) => hit.name === "Kung Pao Chicken");
    const beans = catalog.find((hit) => hit.name === "String Bean Chicken Breast");
    const teriyaki = catalog.find((hit) => hit.name === "Grilled Teriyaki Chicken");
    const shrimp = catalog.find((hit) => hit.name === "Honey Walnut Shrimp");
    const steak = catalog.find((hit) => hit.name === "Black Pepper Sirloin Steak");
    const mushroom = catalog.find((hit) => hit.name === "Mushroom Chicken");
    const sesame = catalog.find((hit) => hit.name === "Honey Sesame Chicken Breast");
    const roll = catalog.find((hit) => hit.name === "Chicken Egg Roll");
    const rangoon = catalog.find((hit) => hit.name === "Cream Cheese Rangoon");
    assert.ok(orange && chow && rice && white && greens && kung && beans && teriyaki && shrimp && steak && mushroom && sesame && roll && rangoon);
    assert.equal(orange.calories, 510);
    assert.equal(chow.calories, 600);
    assert.equal(rice.calories, 620);
    assert.equal(white.calories, 520);
    assert.equal(greens.calories, 130);
    assert.equal(kung.calories, 320);
    assert.equal(beans.calories, 210);
    assert.equal(teriyaki.calories, 275);
    assert.equal(shrimp.calories, 430);
    assert.equal(steak.calories, 180);
    assert.equal(mushroom.calories, 220);
    assert.equal(sesame.calories, 340);
    assert.equal(roll.calories, 200);
    assert.equal(rangoon.calories, 190);
    assert.match(orange.note ?? "", /Plate: 1 side \+ 2 entrees/);
  });

  it("returns curated McDonald's items from the US nutrition calculator", () => {
    const mcdonalds = RESTAURANT_CHAINS.find((chain) => chain.id === "mcdonalds");
    assert.ok(mcdonalds);
    assert.equal(mcdonalds.sourceUrl, "https://www.mcdonalds.com/us/en-us/about-our-food/nutrition-calculator.html");
    assert.equal(mcdonalds.verifiedOn, "2026-10-08");
    const catalog = searchRestaurantFoods("mcdonalds");
    assert.equal(catalog.length, mcdonalds.items.length);
    assert.ok(catalog.every((hit) => hit.brand === "McDonald's" && restaurantServingMatchesLabel(hit)));

    const cheese = searchRestaurantFoods("cheeseburger");
    assert.equal(cheese[0].name, "Cheeseburger");
    assert.equal(cheese[0].calories, 300);
    assert.equal(cheese[0].fatG, 13);
    assert.equal(cheese[0].carbsG, 31);
    assert.equal(cheese[0].proteinG, 15);
    assert.equal(cheese[0].servings[0].grams, 112);
    const double = cheese.find((hit) => hit.name === "Double Cheeseburger");
    assert.ok(double);
    assert.equal(double.calories, 440);
    assert.equal(double.fatG, 24);
    assert.equal(double.carbsG, 34);
    assert.equal(double.proteinG, 25);
    assert.equal(double.servings[0].grams, 165);

    const bigMac = searchRestaurantFoods("big mac")[0];
    assert.equal(bigMac.name, "Big Mac");
    assert.equal(bigMac.calories, 580);
    assert.equal(bigMac.fatG, 34);
    assert.equal(bigMac.carbsG, 45);
    assert.equal(bigMac.proteinG, 25);
    assert.equal(bigMac.servings[0].grams, 217);

    const quarter = searchRestaurantFoods("quarter pounder with cheese")[0];
    assert.equal(quarter.calories, 520);
    assert.equal(quarter.fatG, 26);
    assert.equal(quarter.carbsG, 42);
    assert.equal(quarter.proteinG, 30);

    const mcchicken = searchRestaurantFoods("mcchicken")[0];
    assert.equal(mcchicken.calories, 390);
    assert.equal(mcchicken.proteinG, 14);

    const nuggets = searchRestaurantFoods("chicken mcnuggets");
    assert.deepEqual(nuggets.map((hit) => hit.calories), [170, 250, 410]);
    assert.equal(searchRestaurantFoods("10 piece chicken mcnuggets")[0].name, "Chicken McNuggets (10 pc)");

    const filet = searchRestaurantFoods("filet o fish")[0];
    assert.equal(filet.calories, 380);
    assert.equal(filet.proteinG, 16);

    assert.equal(searchRestaurantFoods("large fries")[0].calories, 480);
    assert.equal(searchRestaurantFoods("medium fry")[0].calories, 320);
    assert.equal(searchRestaurantFoods("small fries")[0].calories, 230);
    assert.equal(searchRestaurantFoods("small fries")[0].servings[0].grams, 78);

    const smoothies = searchRestaurantFoods("strawberry banana smoothie");
    assert.deepEqual(smoothies.map((hit) => [hit.calories, hit.fatG, hit.carbsG, hit.proteinG]), [
      [190, 0.5, 44, 2],
      [240, 1, 55, 3],
      [330, 1, 76, 4],
    ]);

    const egg = searchRestaurantFoods("egg mcmuffin")[0];
    assert.equal(egg.calories, 310);
    assert.equal(egg.fatG, 13);
    assert.equal(egg.carbsG, 30);
    assert.equal(egg.proteinG, 17);
    assert.equal(egg.servings[0].grams, 138);

    const hash = searchRestaurantFoods("hash browns")[0];
    assert.equal(hash.calories, 140);
    assert.equal(hash.fatG, 8);
    assert.equal(hash.carbsG, 18);
    assert.equal(hash.proteinG, 2);
    assert.equal(hash.servings[0].grams, 58);
  });

  it("looks up a barcode from Open Food Facts and remembers a miss", async () => {
    setFoodCatalogFetch(async (input) => {
      const url = String(input);
      if (url.includes("/product/3017620422003")) {
        return jsonResponse({
          status: 1,
          product: {
            code: "3017620422003",
            product_name: "Nutella",
            brands: "Ferrero",
            serving_size: "15 g",
            nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
          },
        });
      }
      if (url.includes("/product/00000000")) return jsonResponse({ status: 0 });
      if (url.includes("nal.usda.gov")) return jsonResponse({ foods: [] });
      return jsonResponse({ status: 0 });
    });

    const response = await botBarcode(
      new Request("http://localhost/api/bot/food/barcode?code=3017620422003", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { food: FoodHit };
    assert.equal(body.food.name, "Nutella");
    assert.equal(body.food.servings[0].grams, 15);
    assert.equal(body.food.calories, 81);

    const miss = await lookupBarcode("00000000").then(
      () => null,
      (err: unknown) => err,
    );
    assert.ok(miss instanceof Error);
    assert.equal((miss as { status?: number }).status, 404);
  });

  it("returns a curated item with sourceType for every chain", async () => {
    const probes: Array<[string, string, string, "official" | "third-party"]> = [
      ["Panda Express", "broccoli beef", "Broccoli Beef", "official"],
      ["McDonald's", "big mac", "Big Mac", "official"],
      ["Chick-fil-A", "chick-fil-a chicken sandwich", "Chick-fil-A Chicken Sandwich", "official"],
      ["Dairy Queen", "dairy queen chicken strips", "Chicken Strips (3 pc)", "official"],
      ["Chipotle", "chipotle chicken", "Chicken", "official"],
      ["Five Guys", "five guys hamburger patty", "Hamburger Patty", "official"],
      ["Jimmy John's", "jimmy johns pepe", "The Pepe (8 inch)", "official"],
      ["Culver's", "culver's butterburger cheese single", "ButterBurger Cheese (Single)", "official"],
      ["Raising Cane's", "raising cane's chicken finger", "Chicken Finger", "third-party"],
      ["Wendy's", "baconator double", "Baconator", "third-party"],
      ["Subway", "subway oven roasted turkey", "Oven-Roasted Turkey (6 inch)", "third-party"],
      ["Taco Bell", "crunchwrap", "Crunchwrap Supreme", "third-party"],
      ["Burger King", "whopper", "Whopper", "third-party"],
      ["Popeyes", "popeyes chicken sandwich", "Chicken Sandwich (Classic)", "third-party"],
      ["Starbucks", "starbucks latte grande", "Caffè Latte (2% milk) (Grande)", "third-party"],
    ];
    assert.equal(new Set(probes.map((probe) => probe[0])).size, RESTAURANT_CHAINS.length);
    setFoodCatalogFetch(async (input) => {
      const url = String(input);
      if (url.includes("nal.usda.gov")) {
        return jsonResponse({
          foods: [{
            fdcId: 99,
            description: "Generic restaurant beef",
            dataType: "Survey (FNDDS)",
            foodNutrients: [
              { nutrientId: 1008, value: 200 },
              { nutrientId: 1003, value: 10 },
              { nutrientId: 1005, value: 10 },
              { nutrientId: 1004, value: 10 },
            ],
            foodMeasures: [{ disseminationText: "1 serving", gramWeight: 100, rank: 1 }],
          }],
        });
      }
      return jsonResponse({ products: [] });
    });

    for (const [brand, query, name, sourceType] of probes) {
      const response = await botSearch(
        new Request(`http://localhost/api/bot/food/search?q=${encodeURIComponent(query)}`, {
          headers: { authorization: "Bearer test-bot-token-value" },
        }),
        ctx,
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as { foods: FoodHit[] };
      const first = body.foods[0];
      assert.equal(first.brand, brand, query);
      assert.equal(first.name, name, query);
      assert.equal(first.source, "restaurant", query);
      assert.equal(first.sourceType, sourceType, query);
      const keys = Object.keys(JSON.parse(JSON.stringify(first)) as object);
      assert.ok(keys.includes("sourceType"), query);
    }

    const staleQueries = ["caniac", "frosty", "chicken finger cane", "wendy's baconator"];
    for (const query of staleQueries) {
      const response = await botSearch(
        new Request(`http://localhost/api/bot/food/search?q=${encodeURIComponent(query)}`, {
          headers: { authorization: "Bearer test-bot-token-value" },
        }),
        ctx,
      );
      const body = (await response.json()) as { foods: FoodHit[] };
      assert.equal(body.foods[0].source, "restaurant", query);
      assert.ok(body.foods[0].sourceType, query);
    }

    await getSql()`
      update food_cache
      set payload = jsonb_build_array((payload -> 0) - 'sourceType')
      where cache_key like '%caniac%'
    `;
    setFoodCatalogFetch(async () => jsonResponse({ foods: [], products: [] }));
    const refreshed = await botSearch(
      new Request("http://localhost/api/bot/food/search?q=caniac", {
        headers: { authorization: "Bearer test-bot-token-value" },
      }),
      ctx,
    );
    const again = (await refreshed.json()) as { foods: FoodHit[] };
    assert.equal(again.foods[0].name, "Caniac Combo");
    assert.equal(again.foods[0].sourceType, "third-party");
  });
});
