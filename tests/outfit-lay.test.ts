import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cutoutIsClean,
  fitContent,
  mannequinHoles,
  mannequinTargets,
  shoeShouldMirror,
  styledTargets,
  type CutoutMeasure,
} from "../lib/outfit-lay";

const clean = (over: Partial<CutoutMeasure> = {}): CutoutMeasure => ({
  width: 800,
  height: 900,
  opaqueRatio: 0.42,
  edgeTouch: 0.02,
  gapRatio: 0.05,
  box: { x: 40, y: 30, w: 700, h: 820 },
  ...over,
});

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

  it("places mannequin clothes on the shoulders, waist, and feet and masks the limbs", () => {
    const placed = mannequinTargets(["top", "bottom", "shoes", "hat"]);
    const top = placed.find((piece) => piece.slot === "top");
    const pants = placed.find((piece) => piece.slot === "bottom");
    const shoes = placed.filter((piece) => piece.slot === "shoes");
    assert.ok(top && pants);
    assert.ok(top.top < 20);
    assert.ok(pants.top > top.top);
    assert.ok(shoes[0].top > pants.top);
    const holes = mannequinHoles(["top", "bottom", "shoes"]);
    assert.ok(holes.some((hole) => hole.y < 30 && hole.w > 40));
    assert.ok(holes.some((hole) => hole.y > 70));
  });

  it("rejects a full-bleed photo and a person-shaped crop", () => {
    assert.equal(cutoutIsClean(clean(), "top"), true);
    assert.equal(cutoutIsClean(clean({ opaqueRatio: 0.97 }), "top"), false);
    assert.equal(cutoutIsClean(clean({ opaqueRatio: 0.02 }), "shoes"), false);
    assert.equal(cutoutIsClean(clean({ edgeTouch: 0.5 }), "top"), false);
    assert.equal(cutoutIsClean(clean({ width: 400, height: 1100 }), "top"), false);
    assert.equal(cutoutIsClean(clean({ width: 400, height: 1100 }), "bottom"), true);
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
