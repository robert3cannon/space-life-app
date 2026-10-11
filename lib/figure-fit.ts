/** Front-facing athletic figure, 7.5 heads tall, neck about one third of the head. */

export type Pt = { x: number; y: number };

export const FIGURE_VIEW = { w: 320, h: 700 };

export const LAYOUT = {
  crown: 22,
  chin: 110,
  neckBase: 140,
  sole: 682,
  center: 160,
};

/** Shared with the sleeve mesh so the sleeve is sewn to the shoulder. */
export const SHOULDER_L: Pt = { x: 104, y: 146 };
export const ARMPIT_L: Pt = { x: 100, y: 204 };

export function headHeight() {
  return LAYOUT.chin - LAYOUT.crown;
}

export function neckLength() {
  return LAYOUT.neckBase - LAYOUT.chin;
}

export function figureHeads() {
  return (LAYOUT.sole - LAYOUT.crown) / headHeight();
}

export function mirror(rows: Pt[][]): Pt[][] {
  return rows.map((row) => row.map((pt) => ({ x: FIGURE_VIEW.w - pt.x, y: pt.y })));
}

export function widen(rows: Pt[][], scale: number): Pt[][] {
  const mid = LAYOUT.center;
  return rows.map((row) => row.map((pt) => ({ x: mid + (pt.x - mid) * scale, y: pt.y })));
}

/** Horizontal scale for a silhouette. 1 is a straight athletic fit. */
export function fitWidth(fit: string) {
  if (fit === "slim") return 0.88;
  if (fit === "relaxed") return 1.08;
  if (fit === "oversized") return 1.24;
  return 1;
}

/**
 * Torso mesh: 4 rows (shoulder, chest, waist, hem) by 5 columns.
 * The collar dips under the neck, the chest is wider than the waist, and the hem eases over the hips.
 */
export function torsoMesh(fit: string): Pt[][] {
  const hemDrop = fit === "cropped" ? -48 : fit === "hip-length" ? 42 : fit === "oversized" ? 16 : 0;
  const rows: Pt[][] = [
    [
      { ...SHOULDER_L },
      { x: 132, y: 150 },
      { x: 160, y: 156 },
      { x: 188, y: 150 },
      { x: 216, y: 146 },
    ],
    [
      { ...ARMPIT_L },
      { x: 124, y: 200 },
      { x: 160, y: 198 },
      { x: 196, y: 200 },
      { x: 220, y: 204 },
    ],
    [
      { x: 122, y: 272 },
      { x: 140, y: 278 },
      { x: 160, y: 282 },
      { x: 180, y: 278 },
      { x: 198, y: 272 },
    ],
    [
      { x: 108, y: 346 + hemDrop },
      { x: 134, y: 358 + hemDrop },
      { x: 160, y: 364 + hemDrop },
      { x: 186, y: 358 + hemDrop },
      { x: 212, y: 346 + hemDrop },
    ],
  ];
  return widen(rows, fitWidth(fit));
}

/** Fractions of a flat-lay top, staying on the body panel rather than the sleeves. */
export const TORSO_U = [0.32, 0.41, 0.5, 0.59, 0.68];
export const TORSO_V = [0.14, 0.4, 0.68, 0.98];

/** Sleeve mesh shares the shoulder and armpit with the torso. */
export function sleeveMesh(side: "l" | "r", length: "short" | "long", fit = "straight"): Pt[][] {
  const short: Pt[][] = [
    [
      { x: 74, y: 138 },
      { ...SHOULDER_L },
    ],
    [
      { x: 66, y: 188 },
      { ...ARMPIT_L },
    ],
    [
      { x: 62, y: 232 },
      { x: 96, y: 244 },
    ],
  ];
  const long: Pt[][] = [
    short[0],
    short[1],
    [
      { x: 60, y: 318 },
      { x: 94, y: 326 },
    ],
    [
      { x: 72, y: 396 },
      { x: 108, y: 408 },
    ],
  ];
  const fitted = widen(length === "long" ? long : short, fitWidth(fit));
  return side === "r" ? mirror(fitted) : fitted;
}

export function sleeveUV(length: "short" | "long") {
  const rows = length === "long" ? [0.3, 0.2, 0.1, 0.02] : [0.24, 0.14, 0.03];
  return { u: rows, v: [0.04, 0.28] };
}

/** Two leg panels, wider than the skin underneath, overlapping at the crotch. */
export function legMesh(side: "l" | "r", shorts: boolean): Pt[][] {
  const full: Pt[][] = [
    [
      { x: 92, y: 338 },
      { x: 168, y: 370 },
    ],
    [
      { x: 98, y: 492 },
      { x: 163, y: 506 },
    ],
    [
      { x: 112, y: 592 },
      { x: 158, y: 606 },
    ],
  ];
  const brief: Pt[][] = [
    full[0],
    [
      { x: 96, y: 452 },
      { x: 156, y: 466 },
    ],
  ];
  const rows = shorts ? brief : full;
  return side === "r" ? mirror(rows) : rows;
}

export function legUV(side: "l" | "r", shorts: boolean) {
  const outer = side === "l" ? 0.08 : 0.92;
  const inner = side === "l" ? 0.42 : 0.58;
  const v = shorts ? [0.06, 0.46] : [0.04, 0.5, 0.97];
  return { u: [outer, inner], v };
}

/** Front-view sneaker: ankle opening under the cuff, toe angled out and below the hem. */
export function shoeMesh(side: "l" | "r"): Pt[][] {
  const left: Pt[][] = [
    [
      { x: 114, y: 600 },
      { x: 136, y: 608 },
      { x: 156, y: 618 },
    ],
    [
      { x: 64, y: 652 },
      { x: 108, y: 672 },
      { x: 148, y: 690 },
    ],
  ];
  return side === "r" ? mirror(left) : left;
}

/** Cap crown to brim. The brim sits above the eyes. */
export function capMesh(): Pt[][] {
  return [
    [
      { x: 136, y: 6 },
      { x: 160, y: 0 },
      { x: 184, y: 6 },
    ],
    [
      { x: 122, y: 30 },
      { x: 160, y: 26 },
      { x: 198, y: 30 },
    ],
    [
      { x: 98, y: 52 },
      { x: 160, y: 64 },
      { x: 222, y: 52 },
    ],
  ];
}

export function uvGrid(width: number, height: number, u: number[], v: number[]): Pt[][] {
  return v.map((row) => u.map((col) => ({ x: col * width, y: row * height })));
}

export function boxGrid(box: { x: number; y: number; w: number; h: number }, u: number[], v: number[]): Pt[][] {
  return v.map((row) => u.map((col) => ({ x: box.x + col * box.w, y: box.y + row * box.h })));
}

/** Sleeve UVs run along the arm (rows) and across the sleeve (columns). */
export function sleeveSource(
  width: number,
  height: number,
  side: "l" | "r",
  length: "short" | "long",
  box?: { x: number; y: number; w: number; h: number },
): Pt[][] {
  const { u, v } = sleeveUV(length);
  const along = side === "l" ? u : u.map((value) => 1 - value);
  const frame = box ?? { x: 0, y: 0, w: width, h: height };
  return along.map((ue) => v.map((ve) => ({ x: frame.x + ue * frame.w, y: frame.y + ve * frame.h })));
}
