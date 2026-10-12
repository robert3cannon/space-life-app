/** Flat-lay and mannequin placement. Photos stay unwarped: scale, position, and a small rotation only. */

export type Slot = "hat" | "top" | "layer" | "bottom" | "shoes";

export type Target = {
  slot: Slot;
  left: number;
  top: number;
  width: number;
  rotate: number;
  z: number;
  mirror?: boolean;
};

export type ImageBox = { x: number; y: number; w: number; h: number };

export type CutoutMeasure = {
  width: number;
  height: number;
  opaqueRatio: number;
  edgeTouch: number;
  gapRatio: number;
  box: ImageBox;
};

const BOARD = {
  styled: 3 / 4,
  mannequin: 9 / 16,
} as const;

export function boardAspect(kind: keyof typeof BOARD) {
  return BOARD[kind];
}

/** Stable, small rotation so the same piece does not jump between renders. */
export function tiltFor(id: string, base: number, span = 3.5) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const unit = (hash % 1000) / 999;
  return Math.round((base + (unit - 0.5) * span) * 10) / 10;
}

export function styledTargets(slots: Slot[], idFor: (slot: Slot) => string): Target[] {
  const hasTop = slots.includes("top");
  const hasLayer = slots.includes("layer");
  const targets: Target[] = [];
  if (slots.includes("hat")) {
    targets.push({ slot: "hat", left: 6, top: 3, width: 26, rotate: tiltFor(idFor("hat"), -7, 3), z: 5 });
  }
  if (hasTop) {
    targets.push({
      slot: "top",
      left: hasLayer ? 5 : 18,
      top: hasLayer ? 20 : 13,
      width: hasLayer ? 50 : 62,
      rotate: tiltFor(idFor("top"), hasLayer ? 2.5 : 1, 2.5),
      z: 2,
    });
  }
  if (hasLayer) {
    targets.push({
      slot: "layer",
      left: hasTop ? 34 : 15,
      top: hasTop ? 9 : 12,
      width: hasTop ? 58 : 68,
      rotate: tiltFor(idFor("layer"), hasTop ? -5 : -2, 2.5),
      z: 4,
    });
  }
  if (slots.includes("bottom")) {
    targets.push({ slot: "bottom", left: 35, top: 46, width: 28, rotate: tiltFor(idFor("bottom"), 0.5, 2), z: 1 });
  }
  if (slots.includes("shoes")) {
    const tilt = tiltFor(idFor("shoes"), -10, 2);
    targets.push({ slot: "shoes", left: 4, top: 84, width: 32, rotate: tilt, z: 3 });
    targets.push({ slot: "shoes", left: 62, top: 85, width: 32, rotate: -tilt * 0.45, z: 3, mirror: true });
  }
  return targets;
}

export function mannequinTargets(slots: Slot[]): Target[] {
  const targets: Target[] = [];
  if (slots.includes("hat")) targets.push({ slot: "hat", left: 37, top: 0.2, width: 26, rotate: -2, z: 6 });
  if (slots.includes("top")) targets.push({ slot: "top", left: 17, top: 15.5, width: 66, rotate: 0, z: 2 });
  if (slots.includes("layer")) targets.push({ slot: "layer", left: 11, top: 13.5, width: 78, rotate: 0, z: 3 });
  if (slots.includes("bottom")) targets.push({ slot: "bottom", left: 33, top: 43, width: 34, rotate: 0, z: 1 });
  if (slots.includes("shoes")) {
    targets.push({ slot: "shoes", left: 24, top: 84, width: 26, rotate: -8, z: 4 });
    targets.push({ slot: "shoes", left: 50, top: 84, width: 26, rotate: 7, z: 4, mirror: true });
  }
  return targets;
}

/** Hide the mannequin where a garment covers it, so limbs do not show beside the photo. */
export function mannequinHoles(slots: Slot[]) {
  const holes: ImageBox[] = [];
  if (slots.includes("top") || slots.includes("layer")) holes.push({ x: 22, y: 15, w: 56, h: 34 });
  if (slots.includes("layer")) holes.push({ x: 20, y: 40, w: 60, h: 12 });
  if (slots.includes("bottom")) holes.push({ x: 32, y: 48, w: 36, h: 40 });
  if (slots.includes("shoes")) holes.push({ x: 30, y: 84, w: 40, h: 10 });
  return holes;
}

/**
 * Size the file so its opaque content lands on the target. Transparent margins do not shrink the garment.
 * boardAspect is board width / board height.
 */
export function fitContent(
  target: { left: number; top: number; width: number },
  image: { w: number; h: number },
  box: ImageBox,
  boardAspect: number,
) {
  const contentW = Math.max(1, box.w) / image.w;
  const width = target.width / contentW;
  const height = width * (image.h / image.w) * boardAspect;
  return {
    left: target.left - (box.x / image.w) * width,
    top: target.top - (box.y / image.h) * height,
    width,
  };
}

export function cutoutIsClean(measure: CutoutMeasure, slot: Slot) {
  if (measure.opaqueRatio > 0.9 || measure.opaqueRatio < 0.04) return false;
  if (measure.edgeTouch > 0.28) return false;
  const aspect = measure.height / Math.max(1, measure.width);
  if (slot !== "bottom" && aspect > 2.15) return false;
  if (measure.box.w < 8 || measure.box.h < 8) return false;
  return true;
}

/** A single shoe is mirrored into a pair. A photo that already has a gap in the middle is placed once. */
export function shoeShouldMirror(measure: Pick<CutoutMeasure, "gapRatio">) {
  return measure.gapRatio < 0.22;
}
