import type { Pt } from "./figure-fit";

export type Mat = { a: number; b: number; c: number; d: number; e: number; f: number };

/** Affine map that sends the source triangle onto the destination triangle. */
export function triangleTransform(src: [Pt, Pt, Pt], dst: [Pt, Pt, Pt]): Mat {
  const [s0, s1, s2] = src;
  const [d0, d1, d2] = dst;
  const det = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  const sx = (x0: number, x1: number, x2: number) => (x0 * (s1.y - s2.y) + x1 * (s2.y - s0.y) + x2 * (s0.y - s1.y)) / det;
  const sy = (x0: number, x1: number, x2: number) => (x0 * (s2.x - s1.x) + x1 * (s0.x - s2.x) + x2 * (s1.x - s0.x)) / det;
  const st = (x0: number, x1: number, x2: number) =>
    (x0 * (s1.x * s2.y - s2.x * s1.y) + x1 * (s2.x * s0.y - s0.x * s2.y) + x2 * (s0.x * s1.y - s1.x * s0.y)) / det;
  return {
    a: sx(d0.x, d1.x, d2.x),
    b: sx(d0.y, d1.y, d2.y),
    c: sy(d0.x, d1.x, d2.x),
    d: sy(d0.y, d1.y, d2.y),
    e: st(d0.x, d1.x, d2.x),
    f: st(d0.y, d1.y, d2.y),
  };
}

export function applyMat(m: Mat, pt: Pt): Pt {
  return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f };
}

function expand(tri: [Pt, Pt, Pt], scale: number): [Pt, Pt, Pt] {
  const c = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, y: (tri[0].y + tri[1].y + tri[2].y) / 3 };
  return tri.map((pt) => ({ x: c.x + (pt.x - c.x) * scale, y: c.y + (pt.y - c.y) * scale })) as [Pt, Pt, Pt];
}

export function gridTriangles(src: Pt[][], dst: Pt[][]) {
  const tris: Array<{ src: [Pt, Pt, Pt]; dst: [Pt, Pt, Pt] }> = [];
  for (let row = 0; row < dst.length - 1; row += 1) {
    for (let col = 0; col < dst[row].length - 1; col += 1) {
      tris.push({
        src: [src[row][col], src[row][col + 1], src[row + 1][col + 1]],
        dst: [dst[row][col], dst[row][col + 1], dst[row + 1][col + 1]],
      });
      tris.push({
        src: [src[row][col], src[row + 1][col + 1], src[row + 1][col]],
        dst: [dst[row][col], dst[row + 1][col + 1], dst[row + 1][col]],
      });
    }
  }
  return tris;
}

type WarpCtx = Pick<CanvasRenderingContext2D, "save" | "beginPath" | "moveTo" | "lineTo" | "closePath" | "clip" | "transform" | "drawImage" | "restore">;

/** Draw an image through a triangle mesh. Destination triangles overlap slightly so seams do not show. */
export function warpMesh(ctx: WarpCtx, image: CanvasImageSource, src: Pt[][], dst: Pt[][]) {
  for (const tri of gridTriangles(src, dst)) {
    const dest = expand(tri.dst, 1.035);
    const mat = triangleTransform(tri.src, dest);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dest[0].x, dest[0].y);
    ctx.lineTo(dest[1].x, dest[1].y);
    ctx.lineTo(dest[2].x, dest[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(mat.a, mat.b, mat.c, mat.d, mat.e, mat.f);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}

export function fillMesh(ctx: CanvasRenderingContext2D, dst: Pt[][], color: string) {
  ctx.save();
  ctx.beginPath();
  const top = dst[0];
  const bottom = dst[dst.length - 1];
  ctx.moveTo(top[0].x, top[0].y);
  for (const pt of top.slice(1)) ctx.lineTo(pt.x, pt.y);
  for (let row = 1; row < dst.length; row += 1) {
    const pt = dst[row][dst[row].length - 1];
    ctx.lineTo(pt.x, pt.y);
  }
  for (let col = bottom.length - 2; col >= 0; col -= 1) ctx.lineTo(bottom[col].x, bottom[col].y);
  for (let row = dst.length - 2; row >= 1; row -= 1) ctx.lineTo(dst[row][0].x, dst[row][0].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
