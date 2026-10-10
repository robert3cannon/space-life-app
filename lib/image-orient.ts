export type PhotoTurn = "left" | "right" | "flip";

/** JPEG EXIF Orientation, 1–8. Anything else is treated as upright. */
export function jpegOrientation(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const size = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (size < 2 || offset + 2 + size > bytes.length) break;
    if (marker === 0xe1) {
      const value = orientationInApp1(bytes.subarray(offset + 4, offset + 2 + size));
      if (value) return value;
    }
    offset += 2 + size;
  }
  return 1;
}

function orientationInApp1(segment: Uint8Array) {
  if (segment.length < 14) return 0;
  if (segment[0] !== 0x45 || segment[1] !== 0x78 || segment[2] !== 0x69 || segment[3] !== 0x66 || segment[4] !== 0 || segment[5] !== 0) return 0;
  const view = new DataView(segment.buffer, segment.byteOffset + 6, segment.byteLength - 6);
  const little = view.getUint16(0, false) === 0x4949;
  const big = view.getUint16(0, false) === 0x4d4d;
  if (!little && !big) return 0;
  if (view.getUint16(2, little) !== 0x002a) return 0;
  let ifd = view.getUint32(4, little);
  for (let hop = 0; hop < 4 && ifd + 2 <= view.byteLength; hop += 1) {
    const count = view.getUint16(ifd, little);
    for (let index = 0; index < count; index += 1) {
      const entry = ifd + 2 + index * 12;
      if (entry + 12 > view.byteLength) return 0;
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      if (tag === 0x0112 && type === 3) {
        const value = view.getUint16(entry + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
    const next = ifd + 2 + count * 12;
    if (next + 4 > view.byteLength) return 0;
    ifd = view.getUint32(next, little);
    if (!ifd) break;
  }
  return 0;
}

export function swapsAxes(orientation: number) {
  return orientation >= 5 && orientation <= 8;
}

export function orientedSize(width: number, height: number, orientation: number) {
  return swapsAxes(orientation) ? { width: height, height: width } : { width, height };
}

/** Canvas transform that bakes a JPEG orientation into upright pixels. */
export function orientationTransform(width: number, height: number, orientation: number): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

export function mapPixel(x: number, y: number, width: number, height: number, orientation: number) {
  const [a, b, c, d, e, f] = orientationTransform(width, height, orientation);
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}
