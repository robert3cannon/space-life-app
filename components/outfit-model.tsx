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
  const glow = `model-glow-${rawId}`;
  const limb = `model-limb-${rawId}`;
  return (
    <figure className={`mannequin${compact ? " compact" : ""}`} data-testid="outfit-model" aria-label={label ? `On model: ${label}` : "On model"}>
      <svg viewBox="0 0 200 400" aria-hidden="true">
        <defs>
          <linearGradient id={fill} x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#f4f0ff" />
            <stop offset="32%" stopColor="#b7aee6" />
            <stop offset="72%" stopColor="#6d64b0" />
            <stop offset="100%" stopColor="#241e4c" />
          </linearGradient>
          <linearGradient id={limb} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d4cbf4" />
            <stop offset="100%" stopColor="#3a346c" />
          </linearGradient>
          <radialGradient id={glow} cx="50%" cy="42%" r="48%">
            <stop offset="0%" stopColor="#d7d0ff" stopOpacity="0.72" />
            <stop offset="48%" stopColor="#8a7cff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8a7cff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="200" rx="86" ry="156" fill={`url(#${glow})`} />
        <circle cx="26" cy="36" r="1.1" fill="#fff" opacity="0.75" />
        <circle cx="174" cy="58" r="1" fill="#9aefff" opacity="0.8" />
        <circle cx="18" cy="96" r="0.8" fill="#ffd59a" opacity="0.7" />
        <path d="M74 208c-16 48-18 110-8 152h28c6-42 8-104 14-152-8 6-26 6-34 0z" fill={`url(#${limb})`} />
        <path d="M126 208c16 48 18 110 8 152h-28c-6-42-8-104-14-152 8 6 26 6 34 0z" fill={`url(#${limb})`} />
        <ellipse cx="78" cy="372" rx="22" ry="10" fill="#2c2758" />
        <ellipse cx="122" cy="372" rx="22" ry="10" fill="#2c2758" />
        <path d="M52 114c-22 28-26 78-18 118 4 22-6 36-8 48 18 8 30-8 32-26 6-36 16-78 34-104 6-10-8-22-40-36z" fill={`url(#${limb})`} />
        <path d="M148 114c22 28 26 78 18 118-4 22 6 36 8 48-18 8-30-8-32-26-6-36-16-78-34-104-6-10 8-22 40-36z" fill={`url(#${limb})`} />
        <path d="M56 112c-16 10-18 42-10 74 8 32 24 52 36 60h36c12-8 28-28 36-60 8-32 6-64-10-74-18 18-70 18-88 0z" fill={`url(#${fill})`} />
        <path d="M88 78h24c4 0 8 6 8 14s-6 16-8 16H88c-2 0-8-8-8-16s4-14 8-14z" fill={`url(#${fill})`} />
        <ellipse cx="100" cy="50" rx="28" ry="32" fill={`url(#${fill})`} />
        <ellipse cx="100" cy="38" rx="16" ry="10" fill="#fff" opacity="0.22" />
      </svg>
      {pieces.map((item) => {
        const zone = zoneFor(item);
        const src = item.cutoutUrl || "";
        return (
          <div key={item.id} className={`mannequin-zone ${ZONE[zone]}`}>
            {src ? <img src={src} alt="" /> : <span className="mannequin-swatch" style={{ background: ink(item.colors) }} />}
          </div>
        );
      })}
    </figure>
  );
}
