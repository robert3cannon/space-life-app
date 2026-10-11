import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMat, triangleTransform } from "../lib/garment-warp";
import { figureHeads, headHeight, legMesh, neckLength, shoeMesh, sleeveMesh, torsoMesh } from "../lib/figure-fit";

describe("garment mesh", () => {
  it("maps each corner of a triangle onto the destination", () => {
    const src = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 0, y: 20 },
    ] as const;
    const dst = [
      { x: 10, y: 30 },
      { x: 70, y: 34 },
      { x: 16, y: 80 },
    ] as const;
    const mat = triangleTransform(src, dst);
    for (let i = 0; i < 3; i += 1) {
      const hit = applyMat(mat, src[i]);
      assert.ok(Math.abs(hit.x - dst[i].x) < 1e-6);
      assert.ok(Math.abs(hit.y - dst[i].y) < 1e-6);
    }
  });

  it("uses a 7.5-head figure and a short neck", () => {
    assert.ok(Math.abs(figureHeads() - 7.5) < 0.08);
    assert.ok(neckLength() / headHeight() < 0.38);
    assert.ok(neckLength() / headHeight() > 0.28);
  });

  it("makes the shoulders wider than the waist and covers each leg", () => {
    const torso = torsoMesh("straight");
    const shoulder = torso[0][torso[0].length - 1].x - torso[0][0].x;
    const waist = torso[2][torso[2].length - 1].x - torso[2][0].x;
    assert.ok(shoulder > waist + 20);
    const left = legMesh("l", false);
    const right = legMesh("r", false);
    assert.ok(left[0][1].x > 150);
    assert.ok(right[0][1].x < 170);
    assert.ok(left[2][0].y > 590);
    const sleeve = sleeveMesh("l", "short", "straight");
    assert.equal(sleeve[0][1].x, torso[0][0].x);
    assert.equal(sleeve[0][1].y, torso[0][0].y);
    const shoe = shoeMesh("l");
    const other = shoeMesh("r");
    assert.ok(shoe[1][0].x < shoe[0][0].x);
    assert.ok(shoe[1][0].y > left[2][0].y);
    assert.ok(other[1][0].x > shoe[1][2].x);
  });
});
