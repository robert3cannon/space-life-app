import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const icon = (radius: number) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#241648"/>
      <stop offset="1" stop-color="#07060f"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b8cff"/>
      <stop offset="0.5" stop-color="#7aefff"/>
      <stop offset="1" stop-color="#ff8ad4"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="48%" r="48%">
      <stop offset="0" stop-color="#7d6cff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#7d6cff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <circle cx="256" cy="270" r="150" fill="url(#glow)"/>
  <circle cx="256" cy="278" r="78" fill="#120b28" stroke="url(#ring)" stroke-width="12"/>
  <ellipse cx="256" cy="278" rx="138" ry="44" fill="none" stroke="url(#ring)" stroke-width="12" transform="rotate(-18 256 278)"/>
  <circle cx="150" cy="132" r="5" fill="#ffffff"/>
  <circle cx="360" cy="168" r="3.5" fill="#ddd6ff"/>
  <circle cx="332" cy="112" r="2.5" fill="#ffffff"/>
  <circle cx="128" cy="360" r="2.5" fill="#ffffff"/>
</svg>`;

const splash = (width: number, height: number) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1040"/>
      <stop offset="0.5" stop-color="#060514"/>
      <stop offset="1" stop-color="#081428"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b8cff"/>
      <stop offset="0.5" stop-color="#7aefff"/>
      <stop offset="1" stop-color="#ff8ad4"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${width / 2 - 120} ${height / 2 - 180})">
    <circle cx="120" cy="140" r="70" fill="#120b28" stroke="url(#ring)" stroke-width="10"/>
    <ellipse cx="120" cy="140" rx="118" ry="36" fill="none" stroke="url(#ring)" stroke-width="10" transform="rotate(-18 120 140)"/>
    <circle cx="24" cy="24" r="4" fill="#ffffff"/>
    <circle cx="210" cy="48" r="3" fill="#ddd6ff"/>
  </g>
</svg>`;

async function png(svg: string, width: number, height: number, file: string) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(file);
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  mkdirSync("public/splash", { recursive: true });
  mkdirSync("app", { recursive: true });
  await png(icon(0), 192, 192, "public/icons/icon-192.png");
  await png(icon(0), 512, 512, "public/icons/icon-512.png");
  await png(icon(0), 180, 180, "public/icons/apple-touch-icon.png");
  await png(icon(0), 512, 512, "public/icons/icon-maskable-512.png");
  await png(icon(96), 96, 96, "public/icons/badge-96.png");
  await png(splash(1170, 2532), 1170, 2532, "public/splash/iphone-14.png");
  await png(splash(1290, 2796), 1290, 2796, "public/splash/iphone-14-pro-max.png");
  await png(icon(0), 512, 512, "app/icon.png");
  await png(icon(0), 180, 180, "app/apple-icon.png");
  console.log("icons written");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
