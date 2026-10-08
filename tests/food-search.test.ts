import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { GET as botBarcode } from "../app/api/bot/food/barcode/route";
import { GET as botSearch } from "../app/api/bot/food/search/route";
import { closeDb, getSql } from "../lib/db";
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
    assert.equal(scaleFood(hit.per100g, hit.servings[0].grams, 2).calories, 200);
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
});
