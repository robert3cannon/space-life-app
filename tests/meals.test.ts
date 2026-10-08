import "./load-env";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { GET as getFood, POST as postFood } from "../app/api/bot/food/route";
import { DELETE as deleteItemRoute } from "../app/api/bot/meals/[id]/items/[itemId]/route";
import { DELETE as deleteMealRoute } from "../app/api/bot/meals/[id]/route";
import { POST as postMealRoute } from "../app/api/bot/meals/route";
import { RESTAURANT_CHAINS, searchRestaurantFoods } from "../data/restaurant-foods";
import { closeDb, getSql } from "../lib/db";
import { HttpError } from "../lib/errors";
import {
  createFood,
  createMeal,
  deleteMealItem,
  foodWindow,
  getMeal,
  listFood,
  mergePlaceSuggestions,
  recentMeals,
  sumFood,
  updateMeal,
  updateMealItem,
} from "../lib/services/food";
import { healthExport } from "../lib/services/health";
import type { MealDto } from "../lib/types";
import { zonedDayRange } from "../lib/time";
import { migrate } from "../scripts/migrate";

const bot = {
  authorization: "Bearer test-bot-token-value",
  "content-type": "application/json",
};

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE activity, push_subscriptions, reminders, workout_sets, workout_exercises, workouts, meal_items, meals, food_logs, water_logs, sleep_logs, habit_checks, habits, health_exports, health_weights, health_days, health_sync, health_tokens, events, settings, food_cache RESTART IDENTITY CASCADE`;
}

describe("meals", () => {
  before(async () => {
    await migrate();
  });

  beforeEach(reset);

  after(async () => {
    await closeDb();
  });

  it("creates, edits, and deletes a meal while keeping the summed total", async () => {
    const meal = await createMeal({
      place: "McDonald's",
      meal: "lunch",
      date: "2026-10-08",
      time: "12:30",
      items: [
        { name: "Cheeseburger", calories: 300, proteinG: 15, carbsG: 32, fatG: 13, quantity: 1 },
        { name: "Strawberry banana smoothie", calories: 250, proteinG: 5, carbsG: 50, fatG: 3, quantity: 1 },
        { name: "Large fry", calories: 480, proteinG: 6, carbsG: 66, fatG: 22, quantity: 1 },
      ],
    });
    assert.equal(meal.place, "McDonald's");
    assert.equal(meal.itemCount, 3);
    assert.equal(meal.totals.calories, 1030);
    assert.equal(meal.totals.proteinG, 26);
    assert.equal(meal.totals.carbsG, 148);
    assert.equal(meal.totals.fatG, 38);

    const fry = meal.items.find((item) => item.name === "Large fry");
    assert.ok(fry);
    const edited = await updateMealItem(meal.id, fry.id, { calories: 500, fatG: 24 });
    assert.equal(edited.totals.calories, 1050);
    assert.equal(edited.totals.fatG, 40);

    const renamed = await updateMeal(meal.id, { place: "McDonald's" });
    assert.equal(renamed.items.find((item) => item.id === fry.id)?.calories, 500);

    const dropped = await deleteMealItem(meal.id, fry.id);
    assert.ok(dropped);
    assert.equal(dropped.itemCount, 2);
    assert.equal(dropped.totals.calories, 550);

    const day = zonedDayRange("2026-10-08");
    const window = await foodWindow(day.from, day.to);
    assert.equal(window.logs.length, 2);
    assert.equal(sumFood(window.logs).calories, 550);
    assert.equal(window.meals.reduce((sum, item) => sum + item.totals.calories, 0), 550);

    const gone = await deleteMealItem(dropped.id, dropped.items[0].id);
    assert.ok(gone);
    assert.equal(gone.itemCount, 1);
    const removed = await deleteMealItem(gone.id, gone.items[0].id);
    assert.equal(removed, null);
    await assert.rejects(() => getMeal(meal.id), (err: unknown) => err instanceof HttpError && err.status === 404);
  });

  it("stores a single food log as a Home meal and copies older food_logs forward", async () => {
    const food = await createFood({
      name: "Scrambled eggs",
      meal: "breakfast",
      calories: 180,
      proteinG: 12,
      carbsG: 2,
      fatG: 13,
      date: "2026-10-08",
      time: "09:00",
    });
    assert.equal(food.place, "Home");
    assert.equal(food.name, "Scrambled eggs");
    const day = zonedDayRange("2026-10-08");
    const window = await foodWindow(day.from, day.to);
    assert.equal(window.meals.length, 1);
    assert.equal(window.meals[0].items.length, 1);
    assert.equal(window.meals[0].items[0].id, food.id);
    assert.equal(sumFood(window.logs).calories, 180);

    const sql = getSql();
    await sql`
      INSERT INTO food_logs (name, meal, calories, protein_g, carbs_g, fat_g, logged_at)
      VALUES ('Legacy oats', 'breakfast', 100, 4, 18, 2, '2026-10-08T15:00:00Z')
    `;
    const logs = await listFood(day.from, day.to);
    const legacy = logs.find((item) => item.name === "Legacy oats");
    assert.ok(legacy);
    assert.equal(legacy.place, "Home");
    assert.equal(legacy.calories, 100);
    const again = await listFood(day.from, day.to);
    assert.equal(again.filter((item) => item.name === "Legacy oats").length, 1);
  });

  it("accepts a grouped bot meal or a single food item and returns both shapes", async () => {
    const grouped = await postFood(
      new Request("http://localhost/api/bot/food", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({
          place: "Panda Express",
          meal: "dinner",
          date: "2026-10-08",
          time: "18:30",
          items: [
            { name: "Broccoli Beef", brand: "Panda Express", calories: 150, proteinG: 15, carbsG: 12, fatG: 6, sourceId: "restaurant:panda-express:broccoli-beef" },
            { name: "Fried Rice", brand: "Panda Express", calories: 620, proteinG: 13, carbsG: 101, fatG: 19 },
          ],
        }),
      }),
      undefined as never,
    );
    assert.equal(grouped.status, 201);
    const meal = (await grouped.json()) as MealDto;
    assert.equal(meal.place, "Panda Express");
    assert.equal(meal.items.length, 2);
    assert.equal(meal.totals.calories, 770);

    const single = await postFood(
      new Request("http://localhost/api/bot/food", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ name: "Chicken wrap", meal: "lunch", calories: 680, proteinG: 42, date: "2026-10-08", time: "13:00" }),
      }),
      undefined as never,
    );
    assert.equal(single.status, 201);
    const one = await single.json();
    assert.equal(one.name, "Chicken wrap");
    assert.equal(one.place, "Home");

    const mcdonalds = await postMealRoute(
      new Request("http://localhost/api/bot/meals", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({
          place: "McDonald's",
          meal: "lunch",
          date: "2026-10-08",
          time: "12:10",
          items: [
            { name: "Cheeseburger", calories: 300, proteinG: 15, carbsG: 32, fatG: 13 },
            { name: "Large fry", calories: 480, proteinG: 6, carbsG: 66, fatG: 22 },
          ],
        }),
      }),
      undefined as never,
    );
    assert.equal(mcdonalds.status, 201);

    const listed = await getFood(new Request("http://localhost/api/bot/food?date=2026-10-08", { headers: bot }), undefined as never);
    assert.equal(listed.status, 200);
    const day = await listed.json();
    assert.equal(day.meals.length, 3);
    assert.equal(day.logs.length, 5);
    assert.equal(day.totals.calories, sumFood(day.logs).calories);
    assert.equal(day.totals.calories, 770 + 680 + 780);
    assert.deepEqual(day.places.slice(0, 2), ["Home", "Panda Express"]);
    assert.ok(day.places.includes("McDonald's"));
    assert.equal(day.places.filter((place: string) => place === "Home").length, 1);

    const exported = await healthExport("2026-10-08");
    assert.equal(exported.food.length, 5);
    assert.equal(exported.meals.length, 3);
    assert.equal(exported.meals.find((item) => item.place === "McDonald's")?.items.length, 2);
    assert.equal(exported.food.reduce((sum: number, item: { calories: number }) => sum + item.calories, 0), day.totals.calories);

    const saved = (await mcdonalds.json()) as MealDto;
    const removed = await deleteItemRoute(
      new Request("http://localhost/api/bot/meals", { method: "DELETE", headers: bot }),
      { params: Promise.resolve({ id: saved.id, itemId: saved.items[0].id }) },
    );
    assert.equal(removed.status, 200);
    const afterItem = (await removed.json()) as MealDto;
    assert.equal(afterItem.itemCount, 1);
    const wiped = await deleteMealRoute(
      new Request("http://localhost/api/bot/meals", { method: "DELETE", headers: bot }),
      { params: Promise.resolve({ id: saved.id }) },
    );
    assert.equal(wiped.status, 200);
    await assert.rejects(() => getMeal(saved.id), (err: unknown) => err instanceof HttpError && err.status === 404);
  });

  it("offers one recent meal per place and item list", async () => {
    const input = {
      place: "McDonald's",
      meal: "lunch" as const,
      date: "2026-10-08",
      time: "12:30",
      items: [
        { name: "Cheeseburger", calories: 300, proteinG: 15, carbsG: 32, fatG: 13 },
        { name: "Large fry", calories: 480, proteinG: 6, carbsG: 66, fatG: 22 },
      ],
    };
    await createMeal(input);
    await createMeal({ ...input, time: "19:00" });
    const recent = await recentMeals();
    assert.equal(recent.length, 1);
    assert.equal(recent[0].place, "McDonald's");
    assert.equal(recent[0].totals.calories, 780);
    const copy = await createMeal({
      place: recent[0].place ?? "Home",
      meal: recent[0].meal,
      date: "2026-10-09",
      time: "12:00",
      items: recent[0].items.map((item) => ({
        name: item.name,
        brand: item.brand,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        grams: item.grams,
        quantity: item.quantity,
        servingLabel: item.servingLabel,
        sourceId: item.sourceId,
      })),
    });
    assert.equal(copy.place, "McDonald's");
    assert.deepEqual(copy.items.map((item) => item.name).sort(), ["Cheeseburger", "Large fry"]);
    assert.equal(copy.totals.calories, 780);
  });

  it("suggests Home, curated restaurants, then recent places", () => {
    const places = mergePlaceSuggestions(["McDonald's", "Home", "Panda Express"], RESTAURANT_CHAINS.map((chain) => chain.name));
    assert.deepEqual(places.slice(0, 9), [
      "Home",
      "Panda Express",
      "McDonald's",
      "Chick-fil-A",
      "Dairy Queen",
      "Chipotle",
      "Five Guys",
      "Jimmy John's",
      "Culver's",
    ]);
    assert.equal(places.filter((place) => place.toLowerCase() === "home").length, 1);
    assert.equal(places.filter((place) => place === "Panda Express").length, 1);
  });

  it("ranks curated restaurant foods ahead of a generic name", () => {
    const hits = searchRestaurantFoods("broccoli beef");
    assert.equal(hits[0]?.name, "Broccoli Beef");
    assert.equal(hits[0]?.brand, "Panda Express");
    assert.equal(hits[0]?.id, "restaurant:panda-express:broccoli-beef");
    assert.equal(hits[0]?.calories, 150);
    const beijing = searchRestaurantFoods("beijing beef");
    assert.equal(beijing[0]?.name, "Beijing Beef");
    assert.equal(beijing[0]?.calories, 470);
  });
});
