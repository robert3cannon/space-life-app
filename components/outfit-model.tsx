"use client";

import { useId } from "react";
import { PersonBody, PersonDefs, PersonHands, PersonHead } from "./person-figure";
import { useLoad } from "./use-load";
import type { AppSettings, OutfitDto, OutfitItemDto } from "@/lib/types";

const INK: Record<string, string> = {
  black: "#16161a",
  charcoal: "#3a3a40",
  gray: "#8d8d94",
  grey: "#8d8d94",
  white: "#f4f4f2",
  cream: "#f3ead4",
  beige: "#d4c2a4",
  khaki: "#b8a878",
  tan: "#b89262",
  brown: "#6e4830",
  navy: "#1c2c58",
  denim: "#3a588c",
  blue: "#2f68c4",
  olive: "#5c6430",
  green: "#2e8a48",
  red: "#b02a2a",
  maroon: "#701c28",
  orange: "#d67624",
  yellow: "#e0c430",
  purple: "#76409e",
  pink: "#e096aa",
};

function zoneFor(item: OutfitItemDto) {
  const text = `${item.category} ${item.name}`.toLowerCase();
  if (item.slot === "hat") return "hat";
  if (item.slot === "shoes") return "shoes";
  if (item.slot === "bottom") return text.includes("short") ? "shorts" : "bottom";
  if (item.slot === "layer") return text.includes("jacket") || text.includes("coat") ? "jacket" : "hoodie";
  return "top";
}

function ink(colors: string[]) {
  for (const color of colors) {
    const hex = INK[color.trim().toLowerCase()];
    if (hex) return hex;
  }
  return "#9b8cff";
}

const ORDER = ["shoes", "bottom", "shorts", "top", "hoodie", "jacket", "hat"];

type Box = { x: number; y: number; w: number; h: number };

function topBox(fit: string): Box {
  if (fit === "slim") return { x: 64, y: 104, w: 72, h: 150 };
  if (fit === "relaxed") return { x: 54, y: 102, w: 92, h: 162 };
  if (fit === "oversized") return { x: 46, y: 100, w: 108, h: 176 };
  if (fit === "cropped") return { x: 58, y: 104, w: 84, h: 112 };
  if (fit === "hip-length") return { x: 56, y: 104, w: 88, h: 198 };
  return { x: 58, y: 104, w: 84, h: 156 };
}

function CropImage({ href, view, box, clip }: { href: string; view: string; box: Box; clip?: string }) {
  return (
    <g clipPath={clip}>
      <svg x={box.x} y={box.y} width={box.w} height={box.h} viewBox={view} preserveAspectRatio="none">
        <image href={href} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
      </svg>
    </g>
  );
}

function Garment({ item, marker }: { item: OutfitItemDto; marker: string }) {
  const zone = zoneFor(item);
  const src = item.cutoutUrl || "";
  const fit = item.fit || "straight";
  const color = ink(item.colors);
  const cloth = `url(#${marker}-cloth)`;
  if (zone === "shoes") {
    const shoe = (key: string) =>
      src ? (
        <image key={key} href={src} x="0" y="0" width="46" height="20" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <rect key={key} x="0" y="0" width="46" height="20" rx="7" fill={color} />
      );
    const foot = (key: string) => (
      <g key={key} transform="rotate(-18 70 484)">
        <g transform="translate(90 472) scale(-1 1)">{shoe(key)}</g>
      </g>
    );
    return (
      <g filter={cloth}>
        {foot("l")}
        <g transform="translate(200 0) scale(-1 1)">{foot("r")}</g>
      </g>
    );
  }
  if (zone === "bottom" || zone === "shorts") {
    const clip = `url(#${marker}-${zone === "shorts" ? "shorts" : "pants"})`;
    const box = zone === "shorts" ? { x: 50, y: 220, w: 100, h: 120 } : { x: 50, y: 220, w: 100, h: 258 };
    return (
      <g filter={cloth}>
        {src ? (
          <image href={src} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="none" clipPath={clip} />
        ) : (
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={color} clipPath={clip} />
        )}
      </g>
    );
  }
  if (zone === "hat") {
    return (
      <g filter={cloth}>
        {src ? (
          <image href={src} x="73" y="-6" width="54" height="46" preserveAspectRatio="xMidYMax meet" />
        ) : (
          <ellipse cx="100" cy="24" rx="24" ry="14" fill={color} />
        )}
      </g>
    );
  }
  const box = zone === "top" ? topBox(fit) : zone === "hoodie" ? { x: 50, y: 98, w: 100, h: 176 } : { x: 46, y: 96, w: 108, h: 190 };
  const long = zone !== "top";
  const left = long ? `${marker}-long-l` : `${marker}-sleeve-l`;
  const right = long ? `${marker}-long-r` : `${marker}-sleeve-r`;
  const sleeveBox = long
    ? { left: { x: 26, y: 108, w: 40, h: 150 }, right: { x: 134, y: 108, w: 40, h: 150 } }
    : { left: { x: 30, y: 108, w: 36, h: 68 }, right: { x: 134, y: 108, w: 36, h: 68 } };
  if (!src) {
    return (
      <g filter={cloth}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="16" fill={color} opacity="0.92" />
      </g>
    );
  }
  return (
    <g filter={cloth}>
      <CropImage href={src} view="2 16 22 26" box={sleeveBox.left} clip={`url(#${left})`} />
      <CropImage href={src} view="76 16 22 26" box={sleeveBox.right} clip={`url(#${right})`} />
      <g clipPath={`url(#${marker}-torso)`}>
        <svg x={box.x} y={box.y} width={box.w} height={box.h} viewBox="28 18 44 78" preserveAspectRatio="none">
          <image href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
        </svg>
      </g>
    </g>
  );
}

export function OutfitModel({ outfit, compact = false }: { outfit: OutfitDto; compact?: boolean }) {
  const marker = useId().replace(/:/g, "");
  const settings = useLoad<AppSettings>("/api/settings");
  const skinId = settings.data?.skinTone ?? "fair";
  const pieces = [...outfit.items].sort((a, b) => ORDER.indexOf(zoneFor(a)) - ORDER.indexOf(zoneFor(b)));
  const label = pieces.map((item) => item.name).join(", ");
  const worn = pieces.filter((item) => zoneFor(item) !== "hat");
  const hats = pieces.filter((item) => zoneFor(item) === "hat");
  return (
    <figure className={`mannequin${compact ? " compact" : ""}`} data-testid="outfit-model" aria-label={label ? `On model: ${label}` : "On model"}>
      <svg viewBox="0 0 200 530" aria-hidden="true">
        <PersonDefs marker={marker} skinId={skinId} />
        <PersonBody marker={marker} skinId={skinId} />
        {worn.map((item) => (
          <Garment key={item.id} item={item} marker={marker} />
        ))}
        <PersonHands skinId={skinId} />
        <PersonHead marker={marker} skinId={skinId} />
        {hats.map((item) => (
          <Garment key={item.id} item={item} marker={marker} />
        ))}
      </svg>
    </figure>
  );
}
