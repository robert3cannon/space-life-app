import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAP_TO_TOP,
  JACKET_TO_PANTS,
  LAY_ASPECT,
  PANTS_LENGTH,
  PANTS_PER_TOP,
  SHOE_TO_PANTS,
  contentHeight,
  fitContent,
  garmentWidths,
  layNotes,
  maskRows,
  shoeShouldMirror,
  styledTargets,
  withoutHanger,
} from "../lib/outfit-lay";

describe("outfit lay", () => {
  it("stacks a styled flat lay from cap to shoes", () => {
    const slots = ["hat", "top", "layer", "bottom", "shoes"] as const;
    const aspects = { hat: 1.4, top: 0.9, layer: 1.3, bottom: 0.5, shoes: 2.2 };
    const laid = styledTargets([...slots], (slot) => slot, aspects);
    const hat = laid.find((piece) => piece.slot === "hat");
    const top = laid.find((piece) => piece.slot === "top");
    const layer = laid.find((piece) => piece.slot === "layer");
    const pants = laid.find((piece) => piece.slot === "bottom");
    const shoes = laid.filter((piece) => piece.slot === "shoes");
    assert.ok(hat && top && layer && pants);
    assert.ok(hat.left < 20);
    assert.ok(hat.top < top.top);
    assert.ok(hat.width < top.width);
    assert.ok(Math.abs(hat.width / top.width - CAP_TO_TOP) < 0.02);
    assert.ok(layer.left > top.left);
    assert.ok(pants.top > top.top);
    assert.ok(pants.top < top.top + 40);
    const pantsLength = contentHeight(pants.width, aspects.bottom);
    const topLength = contentHeight(top.width, aspects.top);
    assert.ok(Math.abs(pantsLength / topLength - PANTS_PER_TOP) < 0.02);
    assert.ok(Math.abs((layer.width / pantsLength) * LAY_ASPECT - JACKET_TO_PANTS) < 0.02);
    assert.ok(Math.abs((shoes[0].width / pantsLength) * LAY_ASPECT - SHOE_TO_PANTS) < 0.02);
    assert.equal(shoes.length, 2);
    assert.ok(shoes[0].top > pants.top);
    assert.equal(shoes[1].mirror, true);
    assert.ok(Math.abs(shoes[0].rotate) > 8);
    assert.ok(Math.abs(pantsLength - PANTS_LENGTH) < 0.05);
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

  it("keeps real proportions when the jacket photo is full-width and the pants are a small box", () => {
    const aspects = { layer: 900 / 380, bottom: 80 / 220, top: 180 / 240 };
    const widths = garmentWidths(aspects);
    const jacket = fitContent({ left: 0, top: 0, width: widths.layer ?? 0 }, { w: 900, h: 380 }, { x: 0, y: 0, w: 900, h: 380 }, LAY_ASPECT);
    const pants = fitContent({ left: 0, top: 0, width: widths.bottom ?? 0 }, { w: 1400, h: 1400 }, { x: 900, y: 200, w: 80, h: 220 }, LAY_ASPECT);
    const tight = fitContent({ left: 0, top: 0, width: widths.bottom ?? 0 }, { w: 80, h: 220 }, { x: 0, y: 0, w: 80, h: 220 }, LAY_ASPECT);
    const jacketWidth = jacket.width * (900 / 900);
    const pantsHeight = pants.width * (1400 / 1400) * LAY_ASPECT * (220 / 1400);
    const tightHeight = tight.width * (220 / 80) * LAY_ASPECT;
    assert.ok(Math.abs(pantsHeight - PANTS_LENGTH) < 0.05);
    assert.ok(Math.abs(tightHeight - pantsHeight) < 0.05);
    assert.ok(Math.abs((jacketWidth / pantsHeight) * LAY_ASPECT - JACKET_TO_PANTS) < 0.02);
    const topWidth = widths.top ?? 0;
    const topLength = contentHeight(topWidth, aspects.top);
    assert.ok(pantsHeight / topLength >= 1.3 && pantsHeight / topLength <= 1.4);
  });

  it("crops a thin hanger hook and leaves a plain garment", () => {
    const width = 40;
    const height = 56;
    const alpha = new Uint8Array(width * height);
    for (let y = 0; y < 12; y += 1) {
      alpha[y * width + 18] = 255;
      alpha[y * width + 19] = 255;
    }
    for (let y = 12; y < 50; y += 1) {
      for (let x = 4; x < 36; x += 1) alpha[y * width + x] = 255;
    }
    const cropped = withoutHanger(maskRows(alpha, width, height));
    assert.ok(cropped);
    assert.ok(cropped.y >= 12);
    assert.ok(cropped.h <= 40);
    assert.ok(cropped.w >= 30);
    const plain = new Uint8Array(width * height);
    for (let y = 4; y < 40; y += 1) {
      for (let x = 6; x < 34; x += 1) plain[y * width + x] = 255;
    }
    const kept = withoutHanger(maskRows(plain, width, height));
    assert.ok(kept);
    assert.equal(kept.y, 4);
    assert.equal(kept.h, 36);
  });

  it("keeps pants length visible under an open jacket", () => {
    const aspects = { layer: 0.85, bottom: 0.52 };
    const laid = styledTargets(["layer", "bottom"], () => "jacket", aspects);
    const layer = laid.find((piece) => piece.slot === "layer");
    const pants = laid.find((piece) => piece.slot === "bottom");
    assert.ok(layer && pants);
    const layerHeight = contentHeight(layer.width, aspects.layer);
    const pantsLength = contentHeight(pants.width, aspects.bottom);
    assert.ok(pants.top > layer.top + layerHeight * 0.75);
    assert.ok(pants.top < layer.top + layerHeight);
    assert.ok(pants.top + pantsLength < 98);
    assert.ok(Math.abs((layer.width / pantsLength) * LAY_ASPECT - JACKET_TO_PANTS) < 0.02);
  });

  it("notes a missing top under a jacket and missing shoes", () => {
    assert.deepEqual(layNotes(["layer", "bottom"]), ["Add a top under the jacket", "Add shoes to complete looks"]);
    assert.deepEqual(layNotes(["top", "bottom", "layer", "shoes"]), []);
    assert.deepEqual(layNotes(["top", "bottom"]), ["Add shoes to complete looks"]);
  });
});
