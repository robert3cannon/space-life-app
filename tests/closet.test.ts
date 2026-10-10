import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { POST as login } from "../app/api/auth/login/route";
import { GET as botCloset } from "../app/api/bot/closet/route";
import { GET as botHistory } from "../app/api/bot/outfits/history/route";
import { GET as botOutfit, POST as botSetOutfit } from "../app/api/bot/outfits/route";
import { PATCH as patchCategory } from "../app/api/closet/categories/[id]/route";
import { GET as closetImage } from "../app/api/closet/items/[id]/image/route";
import { POST as newOutfit } from "../app/api/outfits/new/route";
import { POST as woreOutfit } from "../app/api/outfits/wore/route";
import { middleware } from "../middleware";
import { NextRequest } from "next/server";
import { signClosetImage } from "../lib/closet-image";
import { closeDb, getSql } from "../lib/db";
import { pickOutfit, type PickItem } from "../lib/outfit-picker";
import { outfitReminderIsDue } from "../lib/services/reminders";
import { createItem, listCategories, listItems, updateCategory, updateItem } from "../lib/services/closet";
import { createEvent } from "../lib/services/events";
import { todayDateString } from "../lib/time";
import { setWeatherForTests } from "../lib/weather";
import { migrate } from "../scripts/migrate";

const ctx = undefined as never;
const bot = { authorization: "Bearer test-bot-token-value", "content-type": "application/json" };
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function item(partial: Partial<PickItem> & Pick<PickItem, "id" | "name" | "slot" | "category">): PickItem {
  return {
    colors: ["black"],
    warmth: 3,
    tags: ["casual"],
    inLaundry: false,
    lastWorn: null,
    ...partial,
  };
}

async function reset() {
  const sql = getSql();
  await sql`TRUNCATE outfit_slots, outfits, closet_items, closet_categories, events, reminders, settings RESTART IDENTITY CASCADE`;
}

describe("outfit picker", () => {
  const date = "2026-10-10";

  it("picks a jacket under 50F and pants instead of shorts", () => {
    const picked = pickOutfit({
      date,
      tempF: 45,
      occasion: "casual",
      items: [
        item({ id: "jacket", name: "Coat", slot: "layer", category: "Jackets", warmth: 5 }),
        item({ id: "hoodie", name: "Hood", slot: "layer", category: "Hoodies", warmth: 3 }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
        item({ id: "shorts", name: "Gym shorts", slot: "bottom", category: "Shorts" }),
        item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
      ],
    });
    assert.equal(picked.slots.layer, "jacket");
    assert.equal(picked.slots.bottom, "pants");
    assert.match(picked.reason, /45°F in East Lansing/);
  });

  it("picks a hoodie between 50 and 62 and skips a layer when it is warmer", () => {
    const cool = pickOutfit({
      date,
      tempF: 55,
      occasion: "casual",
      items: [
        item({ id: "jacket", name: "Coat", slot: "layer", category: "Jackets" }),
        item({ id: "hoodie", name: "Hood", slot: "layer", category: "Hoodies" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
        item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
      ],
    });
    assert.equal(cool.slots.layer, "hoodie");
    const warm = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "hoodie", name: "Hood", slot: "layer", category: "Hoodies" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
        item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
      ],
    });
    assert.equal(warm.slots.layer, undefined);
  });

  it("allows shorts from 72F up", () => {
    const hot = pickOutfit({
      date,
      tempF: 78,
      occasion: "casual",
      items: [
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
        item({ id: "shorts", name: "Gym shorts", slot: "bottom", category: "Shorts" }),
        item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
      ],
    });
    assert.equal(hot.slots.bottom, "shorts");
  });

  it("skips laundry and recently worn pieces when another option exists", () => {
    const clean = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "dirty", name: "Dirty tee", slot: "top", category: "Shirts/T-shirts", inLaundry: true }),
        item({ id: "clean", name: "Clean tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
      ],
    });
    assert.equal(clean.slots.top, "clean");
    const fresh = pickOutfit({
      date,
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "recent", name: "Recent tee", slot: "top", category: "Shirts/T-shirts", lastWorn: "2026-10-08" }),
        item({ id: "fresh", name: "Fresh tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
      ],
    });
    assert.equal(fresh.slots.top, "fresh");
  });

  it("prefers the class tag on a class day and pairs a shared color", () => {
    const picked = pickOutfit({
      date,
      tempF: 68,
      occasion: "class",
      items: [
        item({ id: "gym", name: "Gym tee", slot: "top", category: "Shirts/T-shirts", tags: ["gym"], colors: ["red"] }),
        item({ id: "classy", name: "Oxford", slot: "top", category: "Shirts/T-shirts", tags: ["class"], colors: ["red"] }),
        item({ id: "green", name: "Green pants", slot: "bottom", category: "Pants", colors: ["green"] }),
        item({ id: "red", name: "Red pants", slot: "bottom", category: "Pants", colors: ["red"] }),
      ],
    });
    assert.equal(picked.slots.top, "classy");
    assert.equal(picked.slots.bottom, "red");
    assert.match(picked.reason, /class day/);
    assert.match(picked.reason, /pairs with/);
  });

  it("says when the weather did not load and when everything is in the laundry", () => {
    const mild = pickOutfit({
      date,
      tempF: 60,
      occasion: "casual",
      weatherLive: false,
      items: [item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts" }), item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" })],
    });
    assert.match(mild.reason, /Weather didn't load/);
    const empty = pickOutfit({
      date,
      tempF: 60,
      occasion: "casual",
      items: [item({ id: "tee", name: "Tee", slot: "top", category: "Shirts/T-shirts", inLaundry: true })],
    });
    assert.match(empty.reason, /Nothing is out of the laundry/);
    assert.equal(empty.slots.top, undefined);
  });

  it("changes the top when the current one is avoided and another exists", () => {
    const items = [
      item({ id: "a", name: "Tee A", slot: "top", category: "Shirts/T-shirts" }),
      item({ id: "b", name: "Tee B", slot: "top", category: "Shirts/T-shirts" }),
      item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
    ];
    const first = pickOutfit({ date, tempF: 70, occasion: "casual", items });
    const second = pickOutfit({ date, tempF: 70, occasion: "casual", items, avoidIds: [first.slots.top!] });
    assert.notEqual(second.slots.top, first.slots.top);
  });

  it("treats a 10:30 outfit nudge as due when the morning cron is within 90 minutes", () => {
    const today = "2026-01-15";
    const fireAt = new Date("2026-01-15T15:30:00.000Z");
    const early = new Date("2026-01-15T15:00:00.000Z");
    const later = new Date("2026-01-15T17:30:00.000Z");
    assert.equal(outfitReminderIsDue(fireAt, early, today, today), true);
    assert.equal(outfitReminderIsDue(fireAt, later, today, today), true);
    assert.equal(outfitReminderIsDue(new Date("2026-01-15T17:30:00.000Z"), early, today, today), false);
    assert.equal(outfitReminderIsDue(fireAt, early, "2026-01-16", today), false);
  });
});

describe("closet bot API", () => {
  let cookie = "";

  before(async () => {
    await migrate();
    await reset();
    setWeatherForTests({ tempF: 45, code: 0, label: "Clear", live: true });
    const right = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-passcode" }),
      }),
    );
    cookie = (right.headers.get("set-cookie") ?? "").split(";")[0];
  });

  after(async () => {
    setWeatherForTests(undefined);
    await reset();
    await closeDb();
  });

  it("rejects a missing bot token and an unsigned photo", async () => {
    const denied = await botCloset(new Request("http://localhost/api/bot/closet"), ctx);
    assert.equal(denied.status, 401);
    const categories = await listCategories();
    const tee = categories.find((row) => row.name === "Shirts/T-shirts");
    assert.ok(tee);
    const photo = await createItem({
      name: "Photo tee",
      categoryId: tee.id,
      colors: ["white"],
      tags: ["casual"],
      image: { bytes: jpeg, type: "image/jpeg" },
    });
    const hidden = await closetImage(new Request(`http://localhost/api/closet/items/${photo.id}/image`), {
      params: Promise.resolve({ id: photo.id }),
    });
    assert.equal(hidden.status, 401);
    const authed = await closetImage(new Request(`http://localhost/api/closet/items/${photo.id}/image`, { headers: { cookie } }), {
      params: Promise.resolve({ id: photo.id }),
    });
    assert.equal(authed.status, 200);
    assert.equal(authed.headers.get("content-type"), "image/jpeg");
    assert.equal(Buffer.from(await authed.arrayBuffer()).length, jpeg.length);
    const open = await middleware(new NextRequest(`http://localhost/api/closet/items/${photo.id}/image`));
    assert.equal(open.status, 200);
  });

  it("picks from the weather, then keeps a bot override", async () => {
    const storedPhoto = (await listItems(null, false)).find((row) => row.name === "Photo tee");
    if (storedPhoto) await updateItem(storedPhoto.id, { inLaundry: true });
    const categories = await listCategories();
    const idOf = (name: string) => {
      const row = categories.find((category) => category.name === name);
      assert.ok(row);
      return row.id;
    };
    const sleeve = await createItem({ name: "Navy long sleeve", categoryId: idOf("Long sleeves"), colors: ["navy"], warmth: 4, tags: ["class"] });
    const backup = await createItem({ name: "Backup tee", categoryId: idOf("Shirts/T-shirts"), colors: ["white"], warmth: 2, tags: ["casual"] });
    await createItem({ name: "Black pants", categoryId: idOf("Pants"), colors: ["black"], warmth: 3, tags: ["casual"] });
    await createItem({ name: "Red shorts", categoryId: idOf("Shorts"), colors: ["red"], warmth: 1, tags: ["gym"] });
    const jacket = await createItem({ name: "Navy jacket", categoryId: idOf("Jackets"), colors: ["navy"], warmth: 5, tags: ["casual"] });
    await createItem({ name: "Gray hoodie", categoryId: idOf("Hoodies"), colors: ["gray"], warmth: 3, tags: ["casual"] });
    await createItem({ name: "Black shoes", categoryId: idOf("Shoes"), colors: ["black"], warmth: 2, tags: ["casual"] });
    const today = todayDateString();
    await createEvent({ title: "Lecture", type: "class", date: today, startTime: "14:00", endTime: "15:00" });

    const emptyPast = await botOutfit(new Request("http://localhost/api/bot/outfits?date=2020-01-01", { headers: bot }), ctx);
    assert.equal(emptyPast.status, 200);
    assert.equal(((await emptyPast.json()) as { outfit: unknown }).outfit, null);

    const created = await botOutfit(new Request("http://localhost/api/bot/outfits", { headers: bot }), ctx);
    assert.equal(created.status, 200);
    const first = (await created.json()) as { outfit: { source: string; reason: string; items: { slot: string; name: string; id: string; imageUrl: string | null }[] } };
    const names = Object.fromEntries(first.outfit.items.map((row) => [row.slot, row.name]));
    assert.equal(first.outfit.source, "rules");
    assert.equal(names.layer, "Navy jacket");
    assert.equal(names.bottom, "Black pants");
    assert.equal(names.top, "Navy long sleeve");
    assert.match(first.outfit.reason, /class day/);

    const refreshed = await newOutfit(new Request("http://localhost/api/outfits/new", { method: "POST", headers: { cookie } }), ctx);
    assert.equal(refreshed.status, 200);
    const next = (await refreshed.json()) as { outfit: { source: string; items: { slot: string; name: string }[] } };
    assert.equal(next.outfit.source, "rules");
    assert.equal(next.outfit.items.find((row) => row.slot === "top")?.name, "Backup tee");

    const listed = await botCloset(new Request("http://localhost/api/bot/closet", { headers: bot }), ctx);
    const closet = (await listed.json()) as { items: { name: string; imageUrl: string | null }[] };
    const photo = closet.items.find((row) => row.name === "Photo tee");
    assert.ok(photo?.imageUrl);
    const signed = await closetImage(new Request(photo.imageUrl), { params: Promise.resolve({ id: photo.imageUrl.split("/items/")[1].split("/")[0] }) });
    assert.equal(signed.status, 200);
    const forged = signClosetImage(jacket.id, "http://localhost", Date.now() - 60 * 60 * 1000, 60);
    const expired = await closetImage(new Request(forged), { params: Promise.resolve({ id: jacket.id }) });
    assert.equal(expired.status, 401);
    const bearer = await closetImage(new Request(`http://localhost/api/closet/items/${jacket.id}/image`, { headers: bot }), {
      params: Promise.resolve({ id: jacket.id }),
    });
    assert.equal(bearer.status, 404);

    const override = await botSetOutfit(
      new Request("http://localhost/api/bot/outfits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: today, itemIds: [jacket.id], reason: "Just the jacket today." }),
      }),
      ctx,
    );
    assert.equal(override.status, 200);
    const botPick = (await override.json()) as { outfit: { source: string; reason: string; items: { id: string }[] } };
    assert.equal(botPick.outfit.source, "bot");
    assert.equal(botPick.outfit.reason, "Just the jacket today.");
    assert.deepEqual(botPick.outfit.items.map((row) => row.id), [jacket.id]);

    const again = await botOutfit(new Request("http://localhost/api/bot/outfits", { headers: bot }), ctx);
    const kept = (await again.json()) as { outfit: { source: string } };
    assert.equal(kept.outfit.source, "bot");

    const clash = await botSetOutfit(
      new Request("http://localhost/api/bot/outfits", {
        method: "POST",
        headers: bot,
        body: JSON.stringify({ date: today, itemIds: [sleeve.id, backup.id], reason: "Two tops" }),
      }),
      ctx,
    );
    assert.equal(clash.status, 400);

    const worn = await woreOutfit(new Request("http://localhost/api/outfits/wore", { method: "POST", headers: { cookie } }), ctx);
    assert.equal(worn.status, 200);
    const wornBody = (await worn.json()) as { outfit: { wornAt: string | null } };
    assert.ok(wornBody.outfit.wornAt);

    const history = await botHistory(new Request("http://localhost/api/bot/outfits/history", { headers: bot }), ctx);
    const historyBody = (await history.json()) as { count: number; outfits: { date: string }[] };
    assert.ok(historyBody.count >= 1);
    assert.equal(historyBody.outfits[0].date, today);

    const shirts = categories.find((row) => row.name === "Shirts/T-shirts");
    assert.ok(shirts);
    const renamed = await updateCategory(shirts.id, { name: "Tees" });
    assert.equal(renamed.name, "Tees");
    const viaRoute = await patchCategory(
      new Request(`http://localhost/api/closet/categories/${shirts.id}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "Shirts/T-shirts" }),
      }),
      { params: Promise.resolve({ id: shirts.id }) },
    );
    assert.equal(viaRoute.status, 200);
  });
});
