import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import { POST as login } from "../app/api/auth/login/route";
import { PATCH as botPatchCloset } from "../app/api/bot/closet/[id]/route";
import { GET as closetBack } from "../app/api/closet/items/[id]/back/route";
import { suggestFit } from "../lib/closet-fit";
import { closeDb, getSql } from "../lib/db";
import { pickOutfit, type PickItem } from "../lib/outfit-picker";
import { parseOutfitPrompt } from "../lib/outfit-prompt";
import { createItem, listCategories } from "../lib/services/closet";
import { migrate } from "../scripts/migrate";

function item(partial: Partial<PickItem> & Pick<PickItem, "id" | "name" | "slot" | "category">): PickItem {
  return {
    colors: ["black"],
    warmth: 3,
    tags: ["casual"],
    inLaundry: false,
    lastWorn: null,
    fit: "straight",
    weatherNotes: "",
    ownership: "owned",
    pairsWith: [],
    avoidWith: [],
    ...partial,
  };
}

describe("closet fit and pairing", () => {
  it("suggests a silhouette from the name", () => {
    assert.equal(suggestFit("Oversized tee"), "oversized");
    assert.equal(suggestFit("Cropped hoodie"), "cropped");
    assert.equal(suggestFit("Hip-length shirt"), "hip-length");
    assert.equal(suggestFit("Slim jeans"), "slim");
    assert.equal(suggestFit("Relaxed oxford"), "relaxed");
    assert.equal(suggestFit("Navy jacket"), "straight");
  });

  it("pairs an oversized top with straight pants and a hip-length top with slim joggers", () => {
    const oversized = pickOutfit({
      date: "2026-10-10",
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "top", name: "Big tee", slot: "top", category: "Shirts/T-shirts", fit: "oversized" }),
        item({ id: "straight", name: "Straight chinos", slot: "bottom", category: "Pants", fit: "straight" }),
        item({ id: "slim", name: "Slim jeans", slot: "bottom", category: "Pants", fit: "slim" }),
      ],
    });
    assert.equal(oversized.slots.bottom, "straight");
    const hip = pickOutfit({
      date: "2026-10-10",
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "top", name: "Long tee", slot: "top", category: "Shirts/T-shirts", fit: "hip-length" }),
        item({ id: "jog", name: "Slim joggers", slot: "bottom", category: "Pants", fit: "slim" }),
        item({ id: "wide", name: "Wide pants", slot: "bottom", category: "Pants", fit: "relaxed" }),
      ],
    });
    assert.equal(hip.slots.bottom, "jog");
  });

  it("skips mesh shoes in the rain and borrowed pieces unless the prompt allows them", () => {
    const rainy = pickOutfit({
      date: "2026-10-10",
      tempF: 60,
      occasion: "casual",
      raining: true,
      items: [
        item({ id: "top", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
        item({ id: "mesh", name: "Mesh runners", slot: "shoes", category: "Shoes", weatherNotes: "fine when dry" }),
        item({ id: "leather", name: "Leather sneakers", slot: "shoes", category: "Shoes" }),
      ],
    });
    assert.equal(rainy.slots.shoes, "leather");
    const noted = pickOutfit({
      date: "2026-10-10",
      tempF: 60,
      occasion: "casual",
      raining: true,
      items: [
        item({ id: "top", name: "Tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "dry", name: "Rain shell", slot: "layer", category: "Jackets", warmth: 4 }),
        item({ id: "coat", name: "Canvas jacket", slot: "layer", category: "Jackets", warmth: 4, weatherNotes: "bad in rain" }),
      ],
    });
    assert.equal(noted.slots.layer, "dry");
    const skipped = pickOutfit({
      date: "2026-10-10",
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "own", name: "Own tee", slot: "top", category: "Shirts/T-shirts" }),
        item({ id: "borrowed", name: "Roommate tee", slot: "top", category: "Shirts/T-shirts", ownership: "borrowed" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
      ],
    });
    assert.equal(skipped.slots.top, "own");
    assert.equal(parseOutfitPrompt("borrowed ok").allowBorrowed, true);
    const allowed = pickOutfit({
      date: "2026-10-10",
      tempF: 70,
      occasion: "casual",
      prompt: "roommate's tee",
      items: [
        item({ id: "borrowed", name: "Roommate tee", slot: "top", category: "Shirts/T-shirts", ownership: "borrowed" }),
        item({ id: "pants", name: "Jeans", slot: "bottom", category: "Pants" }),
      ],
    });
    assert.equal(allowed.slots.top, "borrowed");
  });

  it("avoids a listed pairing", () => {
    const picked = pickOutfit({
      date: "2026-10-10",
      tempF: 70,
      occasion: "casual",
      items: [
        item({ id: "top", name: "Navy tee", slot: "top", category: "Shirts/T-shirts", avoidWith: ["clash"] }),
        item({ id: "clash", name: "Orange pants", slot: "bottom", category: "Pants" }),
        item({ id: "calm", name: "Gray pants", slot: "bottom", category: "Pants" }),
      ],
    });
    assert.equal(picked.slots.bottom, "calm");
  });
});

describe("back photo API", () => {
  let cookie = "";
  const bot = { authorization: "Bearer test-bot-token-value", "content-type": "application/json" };

  before(async () => {
    await migrate();
    const sql = getSql();
    await sql`TRUNCATE outfit_slots, outfits, closet_items, closet_categories, events, reminders, settings RESTART IDENTITY CASCADE`;
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
    const sql = getSql();
    await sql`TRUNCATE outfit_slots, outfits, closet_items, closet_categories, events, reminders, settings RESTART IDENTITY CASCADE`;
    await closeDb();
  });

  it("stores a back photo and accepts a bot fit update", async () => {
    const categories = await listCategories();
    const tee = categories.find((row) => row.name === "Shirts/T-shirts");
    assert.ok(tee);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 80, b: 40 } } }).png().toBuffer();
    const photo = await createItem({
      name: "Green jacket",
      categoryId: tee.id,
      image: { bytes: png, type: "image/png" },
      back: { bytes: png, type: "image/png" },
      backCutout: { bytes: png, type: "image/png" },
      fit: "oversized",
    });
    assert.match(photo.backImageUrl ?? "", /\/back\?v=/);
    assert.match(photo.backCutoutUrl ?? "", /\/back-cutout\?v=/);
    assert.equal(photo.fit, "oversized");
    assert.equal(photo.ownership, "owned");
    const hidden = await closetBack(new Request(`http://localhost/api/closet/items/${photo.id}/back`), { params: Promise.resolve({ id: photo.id }) });
    assert.equal(hidden.status, 401);
    const authed = await closetBack(new Request(`http://localhost/api/closet/items/${photo.id}/back`, { headers: { cookie } }), {
      params: Promise.resolve({ id: photo.id }),
    });
    assert.equal(authed.status, 200);
    assert.equal(authed.headers.get("content-type"), "image/png");
    const patched = await botPatchCloset(
      new Request(`http://localhost/api/bot/closet/${photo.id}`, {
        method: "PATCH",
        headers: bot,
        body: JSON.stringify({ fit: "relaxed", weatherNotes: "bad in rain", ownership: "borrowed", pairsWith: [], avoidWith: [] }),
      }),
      { params: Promise.resolve({ id: photo.id }) },
    );
    assert.equal(patched.status, 200);
    const body = (await patched.json()) as { fit: string; weatherNotes: string; ownership: string };
    assert.equal(body.fit, "relaxed");
    assert.equal(body.weatherNotes, "bad in rain");
    assert.equal(body.ownership, "borrowed");
  });
});
