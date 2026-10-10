import "./load-env";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as postDetect } from "../app/api/closet/detect/route";
import {
  detectionFromScores,
  dominantColors,
  lowConfidence,
  matchCategory,
  nearestColorName,
  suggestName,
  warmthFor,
} from "../lib/closet-detect";

function solid(width: number, height: number, r: number, g: number, b: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
  }
  return data;
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
  });

  it("reads a dominant color and ignores a plain backdrop", () => {
    assert.equal(nearestColorName(10, 10, 12), "black");
    assert.equal(nearestColorName(250, 250, 250), "white");
    assert.deepEqual(dominantColors(solid(8, 8, 20, 20, 22), 8, 8), ["black"]);
    const data = solid(8, 8, 245, 245, 245);
    for (let y = 2; y < 6; y += 1) {
      for (let x = 2; x < 6; x += 1) {
        const offset = (y * 8 + x) * 4;
        data[offset] = 22;
        data[offset + 1] = 36;
        data[offset + 2] = 90;
      }
    }
    assert.deepEqual(dominantColors(data, 8, 8), ["navy"]);
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
      { id: "caps", name: "Caps", slot: "extra" },
    ];
    assert.equal(matchCategory(categories, "Hoodies", "layer")?.id, "hoodies");
    assert.equal(matchCategory(categories, "Hat", "extra")?.id, "caps");
  });
});
