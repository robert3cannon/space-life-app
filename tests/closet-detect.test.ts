import "./load-env";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as postDetect } from "../app/api/closet/detect/route";
import {
  detectionFromScores,
  dominantColors,
  FLAT_LABEL,
  foregroundBounds,
  lowConfidence,
  matchCategory,
  nearestColorName,
  PERSON_LABEL,
  suggestName,
  warmthFor,
  wornByPerson,
} from "../lib/closet-detect";

function solid(width: number, height: number, r: number, g: number, b: number, a = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
  }
  return data;
}

function fill(data: Uint8ClampedArray, width: number, x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const offset = (row * width + col) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
}

describe("closet detection", () => {
  it("names a black zip hoodie and raises warmth for a dark layer", () => {
    assert.equal(suggestName(["black"], "zip hoodie"), "Black zip hoodie");
    assert.equal(warmthFor("zip hoodie", ["black"]), 5);
    assert.equal(warmthFor("t-shirt", ["white"]), 1);
    assert.equal(warmthFor("jeans", ["denim"]), 3);
    assert.equal(warmthFor("shorts", ["black"]), 1);
  });

  it("flags a close call and keeps a clear winner", () => {
    assert.equal(lowConfidence(0.12, 0.1), true);
    assert.equal(lowConfidence(0.4, 0.38), true);
    assert.equal(lowConfidence(0.62, 0.08), false);
    const guess = detectionFromScores(
      [
        { label: "zip hoodie", score: 0.71 },
        { label: "sweatshirt", score: 0.12 },
      ],
      ["black"],
    );
    assert.equal(guess.name, "Black zip hoodie");
    assert.equal(guess.category, "Hoodies");
    assert.equal(guess.slot, "layer");
    assert.equal(guess.lowConfidence, false);
    assert.equal(guess.warmth, 5);
    const beanie = detectionFromScores(
      [
        { label: "beanie", score: 0.74 },
        { label: "baseball cap", score: 0.08 },
      ],
      ["black"],
    );
    assert.equal(beanie.name, "Black beanie");
    assert.equal(beanie.category, "Caps / Hats");
    assert.equal(beanie.slot, "hat");
    assert.equal(beanie.warmth, 4);
    const cap = detectionFromScores([{ label: "baseball cap", score: 0.66 }, { label: "hat", score: 0.1 }], ["navy"]);
    assert.equal(cap.name, "Navy baseball cap");
    assert.equal(cap.category, "Caps / Hats");
    assert.equal(cap.warmth, 2);
  });

  it("reads a dominant color from cutout foreground pixels", () => {
    assert.equal(nearestColorName(10, 10, 12), "black");
    assert.equal(nearestColorName(250, 250, 250), "white");
    assert.equal(nearestColorName(236, 230, 220), "white");
    assert.equal(nearestColorName(214, 196, 166), "beige");
    assert.equal(nearestColorName(22, 40, 86), "navy");
    assert.equal(nearestColorName(16, 24, 48), "navy");
    assert.equal(nearestColorName(63, 63, 76), "navy");
    assert.equal(nearestColorName(32, 32, 48), "black");
    assert.equal(nearestColorName(16, 16, 32), "black");
    assert.equal(nearestColorName(58, 58, 62), "charcoal");
    assert.equal(nearestColorName(20, 20, 22), "black");
    assert.equal(nearestColorName(176, 42, 42), "red");
    assert.equal(nearestColorName(55, 86, 138), "denim");
    assert.deepEqual(dominantColors(solid(8, 8, 20, 20, 22), 8, 8), ["black"]);
    const clear = solid(8, 8, 245, 245, 245, 0);
    fill(clear, 8, 2, 2, 4, 4, 22, 36, 90, 255);
    assert.deepEqual(dominantColors(clear, 8, 8), ["navy"]);
    assert.deepEqual(foregroundBounds(clear, 8, 8), { x: 2, y: 2, width: 4, height: 4 });
  });

  it("names red, denim, and white from a cutout and ignores skin, backdrop, and faint pixels", () => {
    const red = solid(16, 16, 12, 12, 14, 40);
    fill(red, 16, 2, 2, 12, 12, 186, 36, 42, 255);
    fill(red, 16, 3, 3, 3, 3, 214, 164, 132, 255);
    assert.deepEqual(dominantColors(red, 16, 16), ["red"]);

    const jeans = solid(16, 16, 8, 8, 10, 0);
    fill(jeans, 16, 3, 1, 10, 14, 52, 84, 140, 255);
    fill(jeans, 16, 7, 1, 2, 14, 16, 16, 18, 255);
    assert.equal(dominantColors(jeans, 16, 16)[0], "denim");

    const shoes = solid(16, 16, 196, 176, 140, 30);
    fill(shoes, 16, 2, 4, 12, 8, 238, 232, 224, 255);
    assert.deepEqual(dominantColors(shoes, 16, 16), ["white"]);

    const navy = solid(12, 12, 0, 0, 0, 0);
    fill(navy, 12, 1, 1, 10, 10, 18, 28, 64, 255);
    assert.deepEqual(dominantColors(navy, 12, 12), ["navy"]);

    const hidden = solid(8, 8, 20, 20, 22, 127);
    fill(hidden, 8, 1, 1, 4, 4, 48, 104, 198, 128);
    assert.deepEqual(dominantColors(hidden, 8, 8), ["blue"]);
    assert.deepEqual(dominantColors(solid(4, 4, 200, 20, 20, 0), 4, 4), []);
  });

  it("flags a person wearing the clothes and keeps a flat lay", () => {
    assert.equal(wornByPerson([{ label: PERSON_LABEL, score: 0.62 }, { label: FLAT_LABEL, score: 0.21 }]), true);
    assert.equal(wornByPerson([{ label: FLAT_LABEL, score: 0.7 }, { label: PERSON_LABEL, score: 0.2 }]), false);
    assert.equal(wornByPerson([{ label: PERSON_LABEL, score: 0.4 }, { label: FLAT_LABEL, score: 0.4 }]), false);
  });

  it("rejects an unsigned detect request", async () => {
    const denied = await postDetect(new Request("http://localhost/api/closet/detect", { method: "POST" }), undefined as never);
    assert.equal(denied.status, 401);
  });

  it("matches a renamed single-slot category and the default hoodie name", () => {
    const categories = [
      { id: "tees", name: "Shirts/T-shirts", slot: "top" },
      { id: "hoodies", name: "Hoodies", slot: "layer" },
      { id: "jackets", name: "Jackets", slot: "layer" },
      { id: "caps", name: "Caps / Hats", slot: "hat" },
    ];
    assert.equal(matchCategory(categories, "Hoodies", "layer")?.id, "hoodies");
    assert.equal(matchCategory(categories, "Caps / Hats", "hat")?.id, "caps");
    assert.equal(matchCategory([{ id: "caps", name: "Caps", slot: "hat" }], "Caps / Hats", "hat")?.id, "caps");
  });
});
