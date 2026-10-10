import "./load-env";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import { POST as login } from "../app/api/auth/login/route";
import { GET as closetImage } from "../app/api/closet/items/[id]/image/route";
import { POST as orientItemRoute } from "../app/api/closet/items/[id]/orient/route";
import { jpegOrientation, mapPixel, orientedSize } from "../lib/image-orient";
import { closeDb, getSql } from "../lib/db";
import { turnPhotoBytes } from "../lib/photo-turn";
import { createItem, listCategories } from "../lib/services/closet";
import { migrate } from "../scripts/migrate";

function exifJpeg(endian: "II" | "MM", orientation: number) {
  const little = endian === "II";
  const tiff = Buffer.alloc(26);
  tiff.write(endian, 0, "ascii");
  tiff.writeUInt16LE(0x002a, 2);
  if (!little) tiff.writeUInt16BE(0x002a, 2);
  if (little) tiff.writeUInt32LE(8, 4);
  else tiff.writeUInt32BE(8, 4);
  if (little) tiff.writeUInt16LE(1, 8);
  else tiff.writeUInt16BE(1, 8);
  const entry = 10;
  if (little) {
    tiff.writeUInt16LE(0x0112, entry);
    tiff.writeUInt16LE(3, entry + 2);
    tiff.writeUInt32LE(1, entry + 4);
    tiff.writeUInt16LE(orientation, entry + 8);
  } else {
    tiff.writeUInt16BE(0x0112, entry);
    tiff.writeUInt16BE(3, entry + 2);
    tiff.writeUInt32BE(1, entry + 4);
    tiff.writeUInt16BE(orientation, entry + 8);
  }
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), segment, Buffer.from([0xff, 0xd9])]);
}

async function rawPixels(bytes: Buffer) {
  return sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe("jpeg orientation", () => {
  it("reads little-endian orientation 3 and big-endian orientation 6", () => {
    assert.equal(jpegOrientation(exifJpeg("II", 3)), 3);
    assert.equal(jpegOrientation(exifJpeg("MM", 6)), 6);
    assert.equal(jpegOrientation(new Uint8Array([1, 2, 3, 4])), 1);
  });

  it("maps orientation 3 through 180 degrees and swaps axes for orientation 6", () => {
    const turned = mapPixel(0, 0, 4, 2, 3);
    assert.deepEqual(turned, { x: 4, y: 2 });
    assert.deepEqual(orientedSize(4, 2, 6), { width: 2, height: 4 });
    assert.deepEqual(orientedSize(4, 2, 1), { width: 4, height: 2 });
  });
});

describe("server photo turn", () => {
  it("rotates a red-blue strip ninety degrees and flips it", async () => {
    const png = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 2, height: 1, channels: 3 },
    })
      .png()
      .toBuffer();
    const right = await turnPhotoBytes(png, "image/png", "right");
    const rotated = await rawPixels(right.bytes);
    assert.equal(right.type, "image/png");
    assert.equal(rotated.info.width, 1);
    assert.equal(rotated.info.height, 2);
    assert.equal(rotated.data[0], 255);
    assert.equal(rotated.data[1], 0);
    assert.equal(rotated.data[2], 0);
    assert.equal(rotated.data[4], 0);
    assert.equal(rotated.data[5], 0);
    assert.equal(rotated.data[6], 255);
    const flipped = await turnPhotoBytes(png, "image/png", "flip");
    const mirror = await rawPixels(flipped.bytes);
    assert.equal(mirror.info.width, 2);
    assert.equal(mirror.data[0], 0);
    assert.equal(mirror.data[2], 255);
    assert.equal(mirror.data[4], 255);
    assert.equal(mirror.data[6], 0);
  });
});

describe("orient route", () => {
  let cookie = "";

  before(async () => {
    await migrate();
    const sql = getSql();
    await sql`TRUNCATE outfit_slots, outfits, closet_items, closet_categories, events, reminders, settings RESTART IDENTITY CASCADE`;
    const right = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-passcode" }),
      }),
    );
    cookie = (right.headers.get("set-cookie") ?? "").split(";")[0];
  });

  after(async () => {
    const sql = getSql();
    await sql`TRUNCATE outfit_slots, outfits, closet_items, closet_categories, events, reminders, settings RESTART IDENTITY CASCADE`;
    await closeDb();
  });

  it("rejects an unsigned turn and rewrites the stored photo", async () => {
    const categories = await listCategories();
    const tee = categories.find((row) => row.name === "Shirts/T-shirts");
    assert.ok(tee);
    const png = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 2, height: 1, channels: 3 },
    })
      .png()
      .toBuffer();
    const photo = await createItem({
      name: "Strip",
      categoryId: tee.id,
      image: { bytes: png, type: "image/png" },
      cutout: { bytes: png, type: "image/png" },
    });
    assert.match(photo.imageUrl ?? "", /[?&]v=/);
    const denied = await orientItemRoute(
      new Request(`http://localhost/api/closet/items/${photo.id}/orient`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turn: "right" }),
      }),
      { params: Promise.resolve({ id: photo.id }) },
    );
    assert.equal(denied.status, 401);
    const turned = await orientItemRoute(
      new Request(`http://localhost/api/closet/items/${photo.id}/orient`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ turn: "right" }),
      }),
      { params: Promise.resolve({ id: photo.id }) },
    );
    assert.equal(turned.status, 200);
    const body = (await turned.json()) as { imageUrl: string | null; cutoutUrl: string | null };
    assert.notEqual(body.imageUrl, photo.imageUrl);
    assert.match(body.cutoutUrl ?? "", /[?&]v=/);
    const image = await closetImage(new Request(`http://localhost/api/closet/items/${photo.id}/image`, { headers: { cookie } }), {
      params: Promise.resolve({ id: photo.id }),
    });
    assert.equal(image.status, 200);
    const pixels = await rawPixels(Buffer.from(await image.arrayBuffer()));
    assert.equal(pixels.info.width, 1);
    assert.equal(pixels.info.height, 2);
    assert.equal(pixels.data[0], 255);
    assert.equal(pixels.data[6], 255);
  });
});
