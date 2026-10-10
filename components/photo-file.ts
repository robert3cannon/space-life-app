"use client";

import { jpegOrientation, orientationTransform, orientedSize, type PhotoTurn } from "@/lib/image-orient";

function blobOf(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** 2×1 JPEG whose EXIF orientation is 6. Raw pixels stay wide; an oriented decode is tall. */
const ORIENTATION_PROBE =
  "data:image/jpeg;base64,/9j/4QC8RXhpZgAASUkqAAgAAAAGABIBAwABAAAABgAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAZgAAAAAAAABIAAAAAQAAAEgAAAABAAAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAQAAQAAAAIAAAADoAQAAQAAAAEAAAAAAAAA/9sAQwAQCwwODAoQDg0OEhEQExgoGhgWFhgxIyUdKDozPTw5Mzg3QEhcTkBEV0U3OFBtUVdfYmdoZz5NcXlwZHhcZWdj/9sAQwEREhIYFRgvGhovY0I4QmNjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2Nj/8AAEQgAAQACAwEiAAIRAQMRAf/EABUAAQEAAAAAAAAAAAAAAAAAAAAF/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABUBAQEAAAAAAAAAAAAAAAAAAAUG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AigC14//Z";

let exifAppliedByBrowser: Promise<boolean> | null = null;

/**
 * Chrome accepts imageOrientation "none" and still applies EXIF, so a second canvas turn would flip the photo again.
 * A tall decode of the wide probe means the browser already oriented it.
 */
function browserOrientsPhotos() {
  exifAppliedByBrowser ??= (async () => {
    try {
      const blob = await (await fetch(ORIENTATION_PROBE)).blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: "none" }).catch(() => createImageBitmap(blob));
      const applied = bitmap.height > bitmap.width;
      bitmap.close();
      return applied;
    } catch {
      return false;
    }
  })();
  return exifAppliedByBrowser;
}

async function sourceBitmap(file: Blob, honorExif: boolean) {
  if (!honorExif) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return createImageBitmap(file);
    }
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "none" });
  } catch {
    return createImageBitmap(file);
  }
}

/** Bake EXIF into upright pixels, then scale the long edge to 800. iPhone photos stay right-side up. */
export async function compressClothingPhoto(file: File) {
  const header = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const orientation = jpegOrientation(header);
  const honorExif = !(await browserOrientsPhotos());
  const bitmap = await sourceBitmap(file, honorExif);
  const orient = honorExif ? orientation : 1;
  const size = orientedSize(bitmap.width, bitmap.height, orient);
  const scale = Math.min(1, 800 / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't read that photo");
  }
  const [a, b, c, d, e, f] = orientationTransform(bitmap.width, bitmap.height, orient);
  ctx.setTransform(a * scale, b * scale, c * scale, d * scale, e * scale, f * scale);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const webp = await blobOf(canvas, "image/webp", 0.72);
  const blob = webp && webp.type === "image/webp" ? webp : await blobOf(canvas, "image/jpeg", 0.72);
  if (!blob) throw new Error("Couldn't compress that photo");
  const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  const base = file.name.replace(/\.[a-z0-9]+$/i, "").trim() || "photo";
  return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
}

/** Rotate or mirror a photo or cutout that is already upright. */
export async function turnPhotoFile(file: File, turn: PhotoTurn) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const width = turn === "flip" ? bitmap.width : bitmap.height;
  const height = turn === "flip" ? bitmap.height : bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Couldn't turn that photo");
  }
  if (turn === "right") {
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (turn === "left") {
    ctx.translate(0, height);
    ctx.rotate(-Math.PI / 2);
  } else {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = file.type === "image/png";
  const blob = await blobOf(canvas, png ? "image/png" : "image/jpeg", png ? undefined : 0.82);
  if (!blob) throw new Error("Couldn't turn that photo");
  const type = png ? "image/png" : "image/jpeg";
  const name = png ? "cutout.png" : file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return new File([blob], name, { type });
}
