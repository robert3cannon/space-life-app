import { json, withUser } from "@/lib/api";
import { imageByteLimit } from "@/lib/closet-image";
import { classifyClothingImage } from "@/lib/clothing-classifier";
import { HttpError } from "@/lib/errors";

async function postDetect(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError("Choose a photo", 400);
  if (file.size > imageByteLimit()) throw new HttpError("Image is too large. Keep it under 1.5 MB.", 400);
  const type = file.type || "image/jpeg";
  if (!["image/jpeg", "image/jpg", "image/webp", "image/png"].includes(type)) {
    throw new HttpError("Use a JPEG, WebP, or PNG", 400);
  }
  try {
    const scores = await classifyClothingImage(new Uint8Array(await file.arrayBuffer()), type === "image/jpg" ? "image/jpeg" : type);
    return json({ scores });
  } catch (err) {
    console.error("closet_detect_failed", err instanceof Error ? err.message : err);
    throw new HttpError("Detection is unavailable right now", 503);
  }
}

export const POST = withUser(postDetect);
export const dynamic = "force-dynamic";
export const maxDuration = 60;
