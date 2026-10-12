import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitContent, shoeShouldMirror, styledTargets } from "../lib/outfit-lay";

describe("outfit lay", () => {
  it("stacks a styled flat lay from cap to shoes", () => {
    const slots = ["hat", "top", "layer", "bottom", "shoes"] as const;
    const laid = styledTargets([...slots], (slot) => slot);
    const hat = laid.find((piece) => piece.slot === "hat");
    const top = laid.find((piece) => piece.slot === "top");
    const layer = laid.find((piece) => piece.slot === "layer");
    const pants = laid.find((piece) => piece.slot === "bottom");
    const shoes = laid.filter((piece) => piece.slot === "shoes");
    assert.ok(hat && top && layer && pants);
    assert.ok(hat.left < 20);
    assert.ok(hat.top < top.top);
    assert.ok(hat.width < top.width);
    assert.ok(layer.width > top.width);
    assert.ok(layer.left > top.left);
    assert.ok(pants.top > top.top);
    assert.ok(pants.top < top.top + 40);
    assert.equal(shoes.length, 2);
    assert.ok(shoes[0].top > pants.top);
    assert.equal(shoes[1].mirror, true);
    assert.ok(Math.abs(shoes[0].rotate) > 8);
  });

  it("mirrors one shoe and keeps a photo that is already a pair", () => {
    assert.equal(shoeShouldMirror({ gapRatio: 0.05 }), true);
    assert.equal(shoeShouldMirror({ gapRatio: 0.45 }), false);
  });

  it("scales to the opaque garment instead of the transparent margin", () => {
    const placed = fitContent({ left: 20, top: 10, width: 40 }, { w: 200, h: 100 }, { x: 50, y: 10, w: 100, h: 80 }, 0.75);
    assert.ok(Math.abs(placed.width - 80) < 0.01);
    assert.ok(placed.left < 20);
    assert.ok(placed.top < 10);
  });
});
