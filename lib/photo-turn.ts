import sharp from "sharp";
import type { PhotoTurn } from "./image-orient";

const LIMIT = 1_500_000;

function angle(turn: PhotoTurn) {
  if (turn === "left") return 270;
  if (turn === "right") return 90;
  return 0;
}

/** Re-encode a stored photo or cutout. EXIF orientation is baked in before the extra turn. */
export async function turnPhotoBytes(bytes: Buffer, mime: string, turn: PhotoTurn) {
  const png = mime.includes("png");
  const base = () => sharp(bytes, { failOn: "none", animated: false }).rotate();
  const turned = () => (turn === "flip" ? base().flop() : base().rotate(angle(turn)));
  if (png) {
    const output = await turned().png().toBuffer();
    if (output.length > LIMIT) throw new Error("Image is too large");
    return { bytes: output, type: "image/png" as const };
  }
  let quality = 82;
  let output = await turned().jpeg({ quality }).toBuffer();
  while (output.length > LIMIT && quality > 50) {
    quality -= 8;
    output = await turned().jpeg({ quality }).toBuffer();
  }
  if (output.length > LIMIT) throw new Error("Image is too large");
  return { bytes: output, type: "image/jpeg" as const };
}
