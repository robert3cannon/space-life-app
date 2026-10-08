import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BACK_MUSCLES, FRONT_MUSCLES, type BodyShape } from "../lib/body-figure";

const MIDLINE = 724;

type Point = [number, number];

function samplesOf(d: string): Point[] {
  const pts: Point[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cx = 0;
  let cy = 0;
  const add = (px: number, py: number) => pts.push([px, py]);
  function skip() {
    while (i < d.length && /[\s,]/.test(d[i])) i += 1;
  }
  function readNum() {
    skip();
    const match = /^-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/i.exec(d.slice(i));
    if (!match) throw new Error(`Bad path number at ${i}`);
    i += match[0].length;
    return parseFloat(match[0]);
  }
  function readFlag() {
    skip();
    const flag = d[i];
    if (flag !== "0" && flag !== "1") throw new Error(`Bad arc flag at ${i}`);
    i += 1;
    return flag === "1";
  }
  function cubic(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    for (let t = 0; t <= 1.001; t += 0.25) {
      const u = 1 - t;
      add(
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      );
    }
    cx = x2;
    cy = y2;
    x = x3;
    y = y3;
  }
  function quad(x1: number, y1: number, x2: number, y2: number) {
    for (let t = 0; t <= 1.001; t += 0.25) {
      const u = 1 - t;
      add(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2);
    }
    cx = x1;
    cy = y1;
    x = x2;
    y = y2;
  }

  while (i < d.length) {
    skip();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    const rel = cmd === cmd.toLowerCase();
    const kind = cmd.toUpperCase();
    if (kind === "M") {
      x = (rel ? x : 0) + readNum();
      y = (rel ? y : 0) + readNum();
      sx = x;
      sy = y;
      add(x, y);
      cmd = rel ? "l" : "L";
    } else if (kind === "L") {
      x = (rel ? x : 0) + readNum();
      y = (rel ? y : 0) + readNum();
      add(x, y);
    } else if (kind === "H") {
      x = (rel ? x : 0) + readNum();
      add(x, y);
    } else if (kind === "V") {
      y = (rel ? y : 0) + readNum();
      add(x, y);
    } else if (kind === "C") {
      const x1 = (rel ? x : 0) + readNum();
      const y1 = (rel ? y : 0) + readNum();
      const x2 = (rel ? x : 0) + readNum();
      const y2 = (rel ? y : 0) + readNum();
      const x3 = (rel ? x : 0) + readNum();
      const y3 = (rel ? y : 0) + readNum();
      cubic(x1, y1, x2, y2, x3, y3);
    } else if (kind === "S") {
      const x2 = (rel ? x : 0) + readNum();
      const y2 = (rel ? y : 0) + readNum();
      const x3 = (rel ? x : 0) + readNum();
      const y3 = (rel ? y : 0) + readNum();
      cubic(2 * x - cx, 2 * y - cy, x2, y2, x3, y3);
    } else if (kind === "Q") {
      const x1 = (rel ? x : 0) + readNum();
      const y1 = (rel ? y : 0) + readNum();
      const x2 = (rel ? x : 0) + readNum();
      const y2 = (rel ? y : 0) + readNum();
      quad(x1, y1, x2, y2);
    } else if (kind === "T") {
      const x2 = (rel ? x : 0) + readNum();
      const y2 = (rel ? y : 0) + readNum();
      quad(2 * x - cx, 2 * y - cy, x2, y2);
    } else if (kind === "A") {
      readNum();
      readNum();
      readNum();
      readFlag();
      readFlag();
      x = (rel ? x : 0) + readNum();
      y = (rel ? y : 0) + readNum();
      add(x, y);
    } else if (kind === "Z") {
      x = sx;
      y = sy;
      add(x, y);
    } else {
      throw new Error(`Bad path command ${cmd}`);
    }
    if (kind !== "C" && kind !== "S" && kind !== "Q" && kind !== "T") {
      cx = x;
      cy = y;
    }
  }
  return pts;
}

function hausdorff(a: Point[], b: Point[]) {
  function directed(from: Point[], to: Point[]) {
    let worst = 0;
    for (const [x, y] of from) {
      let best = Infinity;
      for (const [u, v] of to) {
        const dist = (x - u) ** 2 + (y - v) ** 2;
        if (dist < best) best = dist;
      }
      if (best > worst) worst = best;
    }
    return Math.sqrt(worst);
  }
  return Math.max(directed(a, b), directed(b, a));
}

function asymmetries(shapes: BodyShape[]) {
  const drawn = shapes.map((shape) => {
    const pts = samplesOf(shape.d);
    return { id: shape.id, pts, mirror: pts.map(([x, y]) => [MIDLINE - x, y] as Point) };
  });
  const problems: string[] = [];
  drawn.forEach((shape, index) => {
    let same = Infinity;
    let other = Infinity;
    let otherId = "";
    drawn.forEach((candidate, candidateIndex) => {
      const dist = hausdorff(shape.mirror, candidate.pts);
      if (candidate.id === shape.id) same = Math.min(same, dist);
      else if (dist < other) {
        other = dist;
        otherId = `${candidate.id}#${candidateIndex}`;
      }
    });
    if (other + 1 < same) {
      problems.push(`${shape.id}#${index} mirrors ${otherId} (${other.toFixed(1)}px) closer than its own group (${same.toFixed(1)}px)`);
    }
  });
  return problems;
}

describe("body map symmetry", () => {
  it("keeps each muscle group mirrored left and right", () => {
    const front = asymmetries(FRONT_MUSCLES);
    const back = asymmetries(BACK_MUSCLES);
    assert.deepEqual(front, []);
    assert.deepEqual(back, []);
  });

  it("assigns both sides of each rectus row to the same group", () => {
    const rows = FRONT_MUSCLES.filter((shape) => shape.id === "upper_abs" || shape.id === "lower_abs").map((shape) => {
      const pts = samplesOf(shape.d);
      const ys = pts.map((point) => point[1]);
      const xs = pts.map((point) => point[0]);
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      return { id: shape.id, cy, cx };
    });
    const bands = new Map<number, string[]>();
    for (const row of rows) {
      const band = Math.round(row.cy / 20) * 20;
      const ids = bands.get(band) ?? [];
      ids.push(row.id);
      bands.set(band, ids);
    }
    for (const [band, ids] of bands) {
      assert.equal(new Set(ids).size, 1, `row near ${band} mixes ${ids.join(", ")}`);
      assert.equal(ids.length, 2, `row near ${band} should have a left and a right segment`);
    }
    const upperBands = [...bands.entries()].filter(([, ids]) => ids[0] === "upper_abs").map(([band]) => band);
    const lowerBands = [...bands.entries()].filter(([, ids]) => ids[0] === "lower_abs").map(([band]) => band);
    assert.ok(Math.max(...upperBands) < Math.min(...lowerBands));
  });
});
