"use client";

import { useId } from "react";
import type { OutfitDto, OutfitItemDto } from "@/lib/types";

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

const ZONE: Record<string, string> = {
  shoes: "zone-shoes",
  bottom: "zone-bottom",
  shorts: "zone-shorts",
  top: "zone-top",
  hoodie: "zone-hoodie",
  jacket: "zone-jacket",
  hat: "zone-hat",
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

export function OutfitModel({ outfit, compact = false }: { outfit: OutfitDto; compact?: boolean }) {
  const rawId = useId().replace(/:/g, "");
  const fill = `model-fill-${rawId}`;
  const pieces = [...outfit.items].sort((a, b) => ORDER.indexOf(zoneFor(a)) - ORDER.indexOf(zoneFor(b)));
  const label = pieces.map((item) => item.name).join(", ");
  return (
    <figure className={`mannequin${compact ? " compact" : ""}`} data-testid="outfit-model" aria-label={label ? `On model: ${label}` : "On model"}>
      <svg viewBox="0 0 200 360" aria-hidden="true">
        <defs>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7b0ee" />
            <stop offset="45%" stopColor="#6a62a8" />
            <stop offset="100%" stopColor="#241f4a" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="48" r="1.2" fill="#fff" opacity="0.75" />
        <circle cx="168" cy="36" r="1" fill="#7aefff" opacity="0.8" />
        <circle cx="176" cy="92" r="1.3" fill="#fff" opacity="0.55" />
        <circle cx="22" cy="120" r="0.9" fill="#ffc56d" opacity="0.7" />
        <path d="M66 112C40 136 34 176 48 204" fill="none" stroke={`url(#${fill})`} strokeWidth="13" strokeLinecap="round" />
        <path d="M134 112C160 136 166 176 152 204" fill="none" stroke={`url(#${fill})`} strokeWidth="13" strokeLinecap="round" />
        <path d="M86 188C78 236 72 286 68 312" fill="none" stroke="#5a538c" strokeWidth="18" strokeLinecap="round" />
        <path d="M114 188C122 236 128 286 132 312" fill="none" stroke="#5a538c" strokeWidth="18" strokeLinecap="round" />
        <ellipse cx="100" cy="48" rx="22" ry="26" fill={`url(#${fill})`} stroke="#d9d0ff" strokeWidth="1.6" />
        <path d="M84 48h32" stroke="#7aefff" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
        <rect x="93" y="70" width="14" height="16" rx="4" fill="#3c356c" />
        <path d="M62 104c-6 28-2 64 16 82h44c18-18 22-54 16-82-14 14-62 14-76 0z" fill={`url(#${fill})`} stroke="#d9d0ff" strokeWidth="1.5" />
        <ellipse cx="66" cy="318" rx="16" ry="7" fill="#2a2454" stroke="#d9d0ff" strokeWidth="1.1" />
        <ellipse cx="136" cy="318" rx="16" ry="7" fill="#2a2454" stroke="#d9d0ff" strokeWidth="1.1" />
      </svg>
      {pieces.map((item) => {
        const zone = zoneFor(item);
        const src = item.cutoutUrl || "";
        if (src) return <img key={item.id} className={`mannequin-piece ${ZONE[zone]}`} src={src} alt="" />;
        return <span key={item.id} className={`mannequin-piece mannequin-swatch ${ZONE[zone]}`} style={{ background: ink(item.colors) }} />;
      })}
    </figure>
  );
}
