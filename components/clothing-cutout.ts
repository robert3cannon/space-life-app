"use client";

import { foregroundBounds } from "@/lib/closet-detect";

const LIMIT = 1_400_000;

type Remover = (image: Blob, config?: Record<string, unknown>) => Promise<Blob>;

let loading: Promise<Remover> | null = null;

function loadRemover() {
  loading ??= import("@imgly/background-removal").then((mod) => {
    const named = mod.removeBackground;
    if (typeof named === "function") return named as Remover;
    const fallback = mod.default;
    if (typeof fallback === "function") return fallback as Remover;
    throw new Error("Cutout is unavailable");
  });
  return loading;
}

function withTimeout<T>(work: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Cutout timed out")), ms);
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function pngFile(blob: Blob) {
  if (blob.size > LIMIT) return null;
  return new File([blob], "cutout.png", { type: "image/png" });
}

async function shrinkPng(blob: Blob) {
  if (blob.size <= LIMIT && blob.type === "image/png") {
    const bitmap = await createImageBitmap(blob);
    const edge = Math.max(bitmap.width, bitmap.height);
    if (edge <= 800) {
      bitmap.close();
      return pngFile(blob);
    }
    bitmap.close();
  }
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const next = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!next) return null;
  return pngFile(next);
}

/** Plain backdrops become transparent when the segmentation model cannot load. The photo stays on the device. */
async function backdropCutout(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const corner = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
  };
  const corners = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
  const bg = [0, 1, 2].map((channel) => corners.reduce((sum, pixel) => sum + pixel[channel], 0) / corners.length);
  const spread = Math.max(
    ...corners.map((pixel) => Math.hypot(pixel[0] - bg[0], pixel[1] - bg[1], pixel[2] - bg[2])),
  );
  if (spread > 48) return null;
  for (let offset = 0; offset < data.length; offset += 4) {
    const distance = Math.hypot((data[offset] ?? 0) - bg[0], (data[offset + 1] ?? 0) - bg[1], (data[offset + 2] ?? 0) - bg[2]);
    data[offset + 3] = Math.max(0, Math.min(255, Math.round(((distance - 18) / 36) * 255)));
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return pngFile(blob);
}

/** Drop the clear margin so the garment fills its body zone. */
async function trimToGarment(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const bounds = foregroundBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  if (!bounds || bounds.width < 8 || bounds.height < 8) return file;
  if (bounds.x === 0 && bounds.y === 0 && bounds.width === canvas.width && bounds.height === canvas.height) return file;
  const cropped = document.createElement("canvas");
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  const out = cropped.getContext("2d");
  if (!out) return file;
  out.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  const blob = await new Promise<Blob | null>((resolve) => cropped.toBlob(resolve, "image/png"));
  if (!blob) return file;
  return (await pngFile(blob)) ?? file;
}

/** ISNet in the browser. The weights download once from IMG.LY and the photo is not uploaded for segmentation. */
export async function cutOutClothing(file: File) {
  try {
    const removeBackground = await loadRemover();
    const blob = await withTimeout(
      removeBackground(file, {
        model: "isnet_fp16",
        device: "cpu",
        output: { format: "image/png", quality: 0.8 },
      }),
      90000,
    );
    const cutout = await shrinkPng(blob);
    if (cutout) return trimToGarment(cutout);
  } catch {
    // The model can fail on a phone. A local backdrop sample still keeps the photo here.
  }
  const fallback = await backdropCutout(file);
  return fallback ? trimToGarment(fallback) : null;
}
