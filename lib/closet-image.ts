import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "./db";

const MAX_BYTES = 1_500_000;
const SIGN_TTL_SECONDS = 15 * 60;

export function imageByteLimit() {
  return MAX_BYTES;
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return value;
}

export function signClosetImage(id: string, origin: string, now = Date.now(), ttl = SIGN_TTL_SECONDS) {
  const exp = Math.floor(now / 1000) + ttl;
  const sig = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");
  return `${origin}/api/closet/items/${id}/image?exp=${exp}&sig=${sig}`;
}

export function closetImageSignatureOk(id: string, expRaw: string | null, sig: string | null, now = Date.now()) {
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function writeItemImage(id: string, bytes: Buffer, contentType: string) {
  if (bytes.length > MAX_BYTES) {
    throw new Error("Image is too large");
  }
  if (blobEnabled()) {
    try {
      const { put } = await import("@vercel/blob");
      const ext = contentType.includes("webp") ? "webp" : "jpg";
      const blob = await put(`closet/${id}.${ext}`, bytes, {
        access: "private",
        contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      const sql = getSql();
      await sql`UPDATE closet_items SET image = NULL, image_type = ${contentType}, blob_pathname = ${blob.pathname}, updated_at = now() WHERE id = ${id}`;
      return;
    } catch (err) {
      console.error("blob_put_failed", err instanceof Error ? err.message : err);
    }
  }
  const sql = getSql();
  await sql`UPDATE closet_items SET image = ${bytes}, image_type = ${contentType}, blob_pathname = NULL, updated_at = now() WHERE id = ${id}`;
}

export async function readItemImage(id: string): Promise<{ bytes: Buffer; type: string } | null> {
  const sql = getSql();
  const rows = await sql<{ image: Buffer | null; image_type: string | null; blob_pathname: string | null }[]>`
    SELECT image, image_type, blob_pathname FROM closet_items WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.blob_pathname && blobEnabled()) {
    const { get } = await import("@vercel/blob");
    const result = await get(row.blob_pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    return { bytes, type: row.image_type || result.blob.contentType || "image/jpeg" };
  }
  if (!row.image) return null;
  return { bytes: row.image, type: row.image_type || "image/jpeg" };
}

export async function deleteItemImage(id: string) {
  const sql = getSql();
  const rows = await sql<{ blob_pathname: string | null }[]>`SELECT blob_pathname FROM closet_items WHERE id = ${id}`;
  const pathname = rows[0]?.blob_pathname;
  if (pathname && blobEnabled()) {
    try {
      const { del } = await import("@vercel/blob");
      await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (err) {
      console.error("blob_del_failed", err instanceof Error ? err.message : err);
    }
  }
}
