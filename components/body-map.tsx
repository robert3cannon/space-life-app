"use client";

import { useId, useState } from "react";
import {
  BACK_MUSCLES,
  BACK_OUTLINE,
  BACK_OVER,
  BACK_UNDER,
  BODY_CLIPS,
  BODY_VIEWBOX,
  FRONT_MUSCLES,
  FRONT_OUTLINE,
  FRONT_OVER,
  FRONT_UNDER,
  type FigurePart,
} from "@/lib/body-figure";
import { muscleLabel } from "@/lib/muscles";

type Side = "front" | "back";

function preferredSide(ids: string[]): Side {
  const front = new Set(FRONT_MUSCLES.map((shape) => shape.id));
  const back = new Set(BACK_MUSCLES.map((shape) => shape.id));
  let frontScore = 0;
  let backScore = 0;
  for (const id of ids) {
    if (front.has(id)) frontScore += 1;
    if (back.has(id)) backScore += 1;
  }
  return backScore > frontScore ? "back" : "front";
}

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
  compact = false,
}: {
  primary?: string[];
  secondary?: string[];
  neglected?: string[];
  selected?: string | null;
  onSelect?: (muscle: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const [side, setSide] = useState<Side>(() => preferredSide(primary));
  const uid = useId().replace(/:/g, "");
  const muscles = side === "front" ? FRONT_MUSCLES : BACK_MUSCLES;
  const under = side === "front" ? FRONT_UNDER : BACK_UNDER;
  const over = side === "front" ? FRONT_OVER : BACK_OVER;
  const outline = side === "front" ? FRONT_OUTLINE : BACK_OUTLINE;
  const active = [...primary, ...secondary, ...(selected ? [selected] : [])];
  const tabbed = new Set<string>();

  return (
    <div className={`body-map${compact ? " compact" : ""}`}>
      {compact ? null : (
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
      )}
      <svg viewBox={BODY_VIEWBOX} className="body-figure" role="img" aria-label={label}>
        <defs>
          {BODY_CLIPS.map((clip) => (
            <clipPath id={`${uid}-${clip.id}`} key={clip.id} clipPathUnits="userSpaceOnUse">
              <path d={clip.d} />
            </clipPath>
          ))}
        </defs>
        <FigureParts parts={[{ d: outline }, ...under]} />
        {muscles.map((shape, index) => {
          const role = roleFor(shape.id, primary, secondary, neglected, selected);
          const name = muscleLabel(shape.id);
          const first = !tabbed.has(shape.id);
          tabbed.add(shape.id);
          return (
            <path
              key={`${shape.id}-${index}`}
              className={`muscle ${role}`}
              d={shape.d}
              clipPath={shape.clip ? `url(#${uid}-${shape.clip})` : undefined}
              data-muscle={shape.id}
              data-role={role || "idle"}
              role={onSelect && first ? "button" : undefined}
              tabIndex={onSelect && first ? 0 : undefined}
              aria-label={onSelect && first ? name : undefined}
              aria-hidden={onSelect && !first ? true : undefined}
              onClick={onSelect ? () => onSelect(shape.id) : undefined}
              onKeyDown={
                onSelect && first
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(shape.id);
                      }
                    }
                  : undefined
              }
            >
              <title>{name}</title>
            </path>
          );
        })}
        <FigureParts parts={over} />
      </svg>
      {compact ? null : (
        <div className="map-legend">
          <span><i className="swatch primary" /> Primary</span>
          <span><i className="swatch secondary" /> Secondary</span>
          {neglected ? <span><i className="swatch neglected" /> Not this week</span> : null}
        </div>
      )}
      {!compact && active.length ? (
        <p className="faint map-caption">
          {[...new Set(active)].map(muscleLabel).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function FigureParts({ parts }: { parts: FigurePart[] }) {
  return (
    <g className="figure-layer">
      {parts.map((part, index) => (
        <path key={index} className={`figure ${part.kind ?? ""}`} d={part.d} />
      ))}
    </g>
  );
}
