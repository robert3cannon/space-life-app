"use client";

import { useState } from "react";
import { muscleLabel } from "@/lib/muscles";

type Side = "front" | "back";

const FRONT: { id: string; d: string }[] = [
  { id: "traps", d: "M70 52 C84 44 100 48 100 56 L100 78 C86 72 74 70 66 62 Z" },
  { id: "side_delts", d: "M34 62 C24 80 30 104 48 108 C60 96 60 74 46 58 Z" },
  { id: "front_delts", d: "M48 66 C40 88 46 112 66 116 C80 104 80 80 66 62 Z" },
  { id: "upper_chest", d: "M64 84 C80 74 100 80 100 84 L100 110 C82 118 66 110 60 98 Z" },
  { id: "mid_chest", d: "M60 112 C80 122 100 114 100 112 L100 140 C80 150 62 140 56 126 Z" },
  { id: "lower_chest", d: "M62 142 C80 152 100 144 100 142 L100 162 C80 170 64 162 62 152 Z" },
  { id: "biceps", d: "M42 112 C32 136 38 164 54 170 C68 156 70 128 56 108 Z" },
  { id: "forearms", d: "M38 172 C26 198 34 226 50 230 C62 212 62 186 50 170 Z" },
  { id: "obliques", d: "M56 164 C68 158 78 166 80 176 L76 220 C64 214 52 196 50 176 Z" },
  { id: "upper_abs", d: "M80 164 L100 160 L100 196 L80 200 Z" },
  { id: "lower_abs", d: "M78 200 L100 196 L100 236 L76 232 Z" },
  { id: "hip_flexors", d: "M72 236 C86 230 100 234 100 240 L100 258 C84 264 68 254 68 242 Z" },
  { id: "abductors", d: "M48 248 C36 282 44 318 62 320 C72 296 74 264 62 246 Z" },
  { id: "quads", d: "M64 252 C56 292 64 330 84 336 L100 300 L100 256 C86 246 74 248 64 252 Z" },
  { id: "adductors", d: "M84 268 L100 256 L100 322 C90 314 80 292 84 268 Z" },
  { id: "calves", d: "M68 328 C58 344 66 356 82 354 C92 342 90 330 78 326 Z" },
];

const BACK: { id: string; d: string }[] = [
  { id: "traps", d: "M64 54 C80 42 100 52 100 60 L100 112 C84 102 70 84 62 66 Z" },
  { id: "side_delts", d: "M32 64 C24 82 32 104 46 102 C54 88 52 70 42 60 Z" },
  { id: "rear_delts", d: "M46 66 C36 86 44 112 64 114 C76 100 76 78 62 62 Z" },
  { id: "triceps", d: "M42 112 C32 138 40 166 56 170 C68 152 70 126 56 108 Z" },
  { id: "forearms", d: "M38 172 C26 200 34 226 50 230 C62 212 62 186 50 170 Z" },
  { id: "lats", d: "M54 108 C66 122 76 146 76 180 L66 210 C54 190 46 150 48 116 Z" },
  { id: "mid_back", d: "M76 100 L100 94 L100 162 L76 158 Z" },
  { id: "lower_back", d: "M70 164 L100 158 L100 214 L70 208 Z" },
  { id: "glutes", d: "M60 214 C56 246 74 274 100 266 L100 216 C84 204 70 206 60 214 Z" },
  { id: "hamstrings", d: "M64 270 C56 304 66 336 84 340 L100 308 L100 268 C86 260 74 262 64 270 Z" },
  { id: "adductors", d: "M86 284 L100 272 L100 324 C90 316 82 300 86 284 Z" },
  { id: "calves", d: "M66 328 C56 346 66 356 84 354 C94 340 90 328 78 326 Z" },
];

function roleFor(
  id: string,
  primary: string[],
  secondary: string[],
  neglected: string[] | undefined,
  selected?: string | null,
) {
  if (selected && selected === id) return "selected";
  if (primary.includes(id)) return "primary";
  if (secondary.includes(id)) return "secondary";
  if (neglected?.includes(id)) return "neglected";
  return "";
}

export function BodyMap({
  primary = [],
  secondary = [],
  neglected,
  selected,
  onSelect,
  label = "Body map",
}: {
  primary?: string[];
  secondary?: string[];
  neglected?: string[];
  selected?: string | null;
  onSelect?: (muscle: string) => void;
  label?: string;
}) {
  const [side, setSide] = useState<Side>("front");
  const regions = side === "front" ? FRONT : BACK;
  const active = [...primary, ...secondary, ...(selected ? [selected] : [])];

  return (
    <div className="body-map">
      <div className="chips" role="tablist" aria-label="Body view">
        {(["front", "back"] as Side[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${side === value ? "on" : ""}`}
            role="tab"
            aria-selected={side === value}
            onClick={() => setSide(value)}
          >
            {value === "front" ? "Front" : "Back"}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 200 360" className="body-figure" role="img" aria-label={label}>
        <Silhouette />
        {(["left", "right"] as const).map((half) => (
          <g key={half} transform={half === "right" ? "translate(200 0) scale(-1 1)" : undefined}>
            {regions.map((region) => {
              const role = roleFor(region.id, primary, secondary, neglected, selected);
              const name = muscleLabel(region.id);
              return (
                <path
                  key={`${half}-${region.id}`}
                  className={`muscle ${role}`}
                  d={region.d}
                  data-muscle={region.id}
                  data-role={role || "idle"}
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={onSelect ? name : undefined}
                  onClick={onSelect ? () => onSelect(region.id) : undefined}
                  onKeyDown={
                    onSelect
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelect(region.id);
                          }
                        }
                      : undefined
                  }
                >
                  <title>{name}</title>
                </path>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="map-legend">
        <span><i className="swatch primary" /> Primary</span>
        <span><i className="swatch secondary" /> Secondary</span>
        {neglected ? <span><i className="swatch neglected" /> Not this week</span> : null}
      </div>
      {active.length ? (
        <p className="faint map-caption">
          {[...new Set(active)].map(muscleLabel).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function Silhouette() {
  return (
    <g className="figure">
      <ellipse cx="100" cy="28" rx="18" ry="20" />
      <path d="M88 46h24l2 12H86z" />
      <path d="M58 72c8-18 24-26 42-26s34 8 42 26c4 20 8 52 2 84-4 16-14 28-26 32l-2 16h-32l-2-16c-12-4-22-16-26-32-6-32-2-64 2-84z" />
      <path d="M58 78c-18 8-28 34-30 66-1 22 4 42 12 50 6 4 12-2 12-12 0-24 6-46 14-66 2-10-2-28-8-38z" />
      <path d="M142 78c18 8 28 34 30 66 1 22-4 42-12 50-6 4-12-2-12-12 0-24-6-46-14-66-2-10 2-28 8-38z" />
      <path d="M76 196c-12 24-16 70-8 130 2 14 8 22 16 22h10c4 0 8-6 8-16V206c-8-2-18-6-26-10z" />
      <path d="M124 196c12 24 16 70 8 130-2 14-8 22-16 22h-10c-4 0-8-6-8-16V206c8-2 18-6 26-10z" />
    </g>
  );
}
