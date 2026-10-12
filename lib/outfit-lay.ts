/** Flat-lay placement. Photos stay unwarped: scale, position, and a small rotation only. */

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

/** Board width divided by board height. */
export const LAY_ASPECT = 3 / 4;

/** Pants waist-to-hem, as a percent of the board height. Other pieces scale from this. */
export const PANTS_LENGTH = 46;
/** Pants length divided by top length. Spec is about 1.3–1.4. */
export const PANTS_PER_TOP = 1.35;
/** Jacket or hoodie body width divided by pants length. */
export const JACKET_TO_PANTS = 0.55;
/** Shoe length divided by pants length. */
export const SHOE_TO_PANTS = 0.25;
/** Cap width divided by the top's width. */
export const CAP_TO_TOP = 0.3;

const DEFAULT_ASPECT: Record<Slot, number> = {
  hat: 1.35,
  top: 0.9,
  layer: 1.15,
  bottom: 0.52,
  shoes: 2.1,
};

export type MaskRow = { width: number; minX: number; maxX: number };

/** Alpha plane. `channels` 1 reads the byte itself. `channels` 4 reads the alpha of RGBA. */
export function maskRows(alpha: ArrayLike<number>, width: number, height: number, channels = 1): MaskRow[] {
  const rows: MaskRow[] = Array.from({ length: height }, () => ({ width: 0, minX: width, maxX: -1 }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = channels === 1 ? alpha[y * width + x] : alpha[(y * width + x) * channels + (channels - 1)];
      if (value > 24) {
        const row = rows[y];
        row.width += 1;
        if (x < row.minX) row.minX = x;
        if (x > row.maxX) row.maxX = x;
      }
    }
  }
  return rows;
}

/** Opaque bounds. Empty rows are ignored, which trims transparent margins. */
export function trimBox(rows: MaskRow[]): ImageBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = -1;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (!row || row.width <= 0 || row.maxX < row.minX) continue;
    if (minY < 0) minY = y;
    maxY = y;
    if (row.minX < minX) minX = row.minX;
    if (row.maxX > maxX) maxX = row.maxX;
  }
  if (minY < 0 || maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Drop a thin hook above the garment. A hanger is a few narrow rows, then the body widens abruptly.
 * A tapering collar stays, because it never jumps from a sliver to the full width.
 */
export function withoutHanger(rows: MaskRow[]): ImageBox | null {
  const full = trimBox(rows);
  if (!full) return null;
  let maxW = 1;
  for (const row of rows) if (row.width > maxW) maxW = row.width;
  let y = full.y;
  const hookStart = y;
  const thin = maxW * 0.14;
  while (y < rows.length && rows[y] && rows[y].width > 0 && rows[y].width <= thin) y += 1;
  const hook = y - hookStart;
  const body = rows[y];
  const limit = Math.max(4, Math.round(full.h * 0.32));
  if (hook >= 3 && hook <= limit && body && body.width >= maxW * 0.4) {
    const cropped = rows.map((row, index) => (index < y ? { width: 0, minX: 0, maxX: -1 } : row));
    return trimBox(cropped) ?? full;
  }
  return full;
}

/** Content width as a percent of the board, from real garment proportions rather than the photo frame. */
export function garmentWidths(aspects: Partial<Record<Slot, number>>, boardAspect = LAY_ASPECT): Partial<Record<Slot, number>> {
  const aspect = (slot: Slot) => {
    const value = aspects[slot];
    return value && value > 0.05 ? value : DEFAULT_ASPECT[slot];
  };
  const widths: Partial<Record<Slot, number>> = {};
  const heightToWidth = (heightPct: number, slot: Slot) => (heightPct * aspect(slot)) / boardAspect;
  if (aspects.bottom) widths.bottom = heightToWidth(PANTS_LENGTH, "bottom");
  const topLength = PANTS_LENGTH / PANTS_PER_TOP;
  if (aspects.top) widths.top = heightToWidth(topLength, "top");
  const topWidth = widths.top ?? heightToWidth(topLength, "top");
  if (aspects.layer) widths.layer = (JACKET_TO_PANTS * PANTS_LENGTH) / boardAspect;
  if (aspects.hat) widths.hat = CAP_TO_TOP * topWidth;
  if (aspects.shoes) {
    const shoeLength = SHOE_TO_PANTS * PANTS_LENGTH;
    widths.shoes = aspect("shoes") >= 1 ? shoeLength / boardAspect : heightToWidth(shoeLength, "shoes");
  }
  return widths;
}

export function contentHeight(widthPct: number, aspect: number, boardAspect = LAY_ASPECT) {
  return (widthPct / Math.max(0.05, aspect)) * boardAspect;
}

/** Stable, small rotation so the same piece does not jump between renders. */
export function tiltFor(id: string, base: number, span = 3.5) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  const unit = (hash % 1000) / 999;
  return Math.round((base + (unit - 0.5) * span) * 10) / 10;
}

export function layNotes(slots: string[]) {
  const notes: string[] = [];
  if (slots.includes("layer") && !slots.includes("top")) notes.push("Add a top under the jacket");
  if (!slots.includes("shoes")) notes.push("Add shoes to complete looks");
  return notes;
}

export function contentClip(image: { w: number; h: number }, box: ImageBox) {
  const top = (box.y / image.h) * 100;
  const right = ((image.w - box.x - box.w) / image.w) * 100;
  const bottom = ((image.h - box.y - box.h) / image.h) * 100;
  const left = (box.x / image.w) * 100;
  return `inset(${top.toFixed(2)}% ${right.toFixed(2)}% ${bottom.toFixed(2)}% ${left.toFixed(2)}%)`;
}

export function styledTargets(slots: Slot[], idFor: (slot: Slot) => string, aspects: Partial<Record<Slot, number>> = {}): Target[] {
  const known: Partial<Record<Slot, number>> = {};
  for (const slot of slots) known[slot] = aspects[slot] && aspects[slot]! > 0.05 ? aspects[slot] : DEFAULT_ASPECT[slot];
  const widths = garmentWidths(known);
  const height = (slot: Slot) => contentHeight(widths[slot] ?? 0, known[slot] ?? DEFAULT_ASPECT[slot]);
  const hasTop = slots.includes("top");
  const hasLayer = slots.includes("layer");
  const hasHat = slots.includes("hat");
  const targets: Target[] = [];
  const hatTop = 2;
  const topTop = hasHat ? Math.max(8, hatTop + height("hat") * 0.55) : 6;
  const layerTop = hasTop ? Math.max(3, topTop - 2) : 8;
  const pantsTop = hasTop ? topTop + height("top") * 0.58 : hasLayer ? layerTop + height("layer") * 0.5 : 14;
  const shoeHeight = slots.includes("shoes") ? height("shoes") : 8;
  const shoeTop = Math.min(100 - shoeHeight - 1, slots.includes("bottom") ? pantsTop + height("bottom") * 0.82 : 80);

  if (hasHat) {
    targets.push({ slot: "hat", left: 5, top: hatTop, width: widths.hat ?? 12, rotate: tiltFor(idFor("hat"), -7, 3), z: 5 });
  }
  if (hasTop) {
    const width = widths.top ?? 36;
    targets.push({
      slot: "top",
      left: hasLayer ? 6 : Math.max(4, (100 - width) / 2),
      top: topTop,
      width,
      rotate: tiltFor(idFor("top"), hasLayer ? 2.5 : 1, 2.5),
      z: 2,
    });
  }
  if (hasLayer) {
    const width = widths.layer ?? 34;
    targets.push({
      slot: "layer",
      left: hasTop ? Math.min(58, 100 - width - 4) : Math.max(4, (100 - width) / 2),
      top: layerTop,
      width,
      rotate: tiltFor(idFor("layer"), hasTop ? -5 : -2, 2.5),
      z: 4,
    });
  }
  if (slots.includes("bottom")) {
    const width = widths.bottom ?? 28;
    targets.push({
      slot: "bottom",
      left: Math.max(4, (100 - width) / 2),
      top: pantsTop,
      width,
      rotate: tiltFor(idFor("bottom"), 0.5, 2),
      z: 1,
    });
  }
  if (slots.includes("shoes")) {
    const tilt = tiltFor(idFor("shoes"), -10, 2);
    const width = widths.shoes ?? 16;
    targets.push({ slot: "shoes", left: 6, top: shoeTop, width, rotate: tilt, z: 3 });
    targets.push({ slot: "shoes", left: Math.min(78, 100 - width - 4), top: shoeTop + 1, width, rotate: -tilt * 0.45, z: 3, mirror: true });
  }
  return targets;
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

/** A single shoe is mirrored into a pair. A photo that already has a gap in the middle is placed once. */
export function shoeShouldMirror(measure: Pick<CutoutMeasure, "gapRatio">) {
  return measure.gapRatio < 0.22;
}
