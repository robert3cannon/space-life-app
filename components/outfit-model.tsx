"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LAY_ASPECT,
  contentClip,
  fitContent,
  layNotes,
  maskRows,
  shoeShouldMirror,
  styledTargets,
  withoutHanger,
  type CutoutMeasure,
  type Slot,
  type Target,
} from "@/lib/outfit-lay";
import type { OutfitDto, OutfitItemDto } from "@/lib/types";

const SLOTS: Slot[] = ["hat", "top", "layer", "bottom", "shoes"];

function asSlot(slot: string): Slot | null {
  return SLOTS.includes(slot as Slot) ? (slot as Slot) : null;
}

function measureImage(image: HTMLImageElement): CutoutMeasure | null {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || image.naturalWidth < 2) return null;
  ctx.drawImage(image, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }
  const rows = maskRows(data, canvas.width, canvas.height, 4);
  const box = withoutHanger(rows);
  if (!box) return null;
  const step = 3;
  let opaque = 0;
  let seen = 0;
  let edgeOpaque = 0;
  let edge = 0;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      seen += 1;
      const onEdge = x < 3 || y < 3 || x > canvas.width - 4 || y > canvas.height - 4;
      if (onEdge) {
        edge += 1;
        if (alpha > 24) edgeOpaque += 1;
      }
      if (alpha > 24) opaque += 1;
    }
  }
  const minX = box.x;
  const minY = box.y;
  const maxX = box.x + box.w;
  const maxY = box.y + box.h;
  const midLeft = minX + (maxX - minX) * 0.42;
  const midRight = minX + (maxX - minX) * 0.58;
  let gap = 0;
  let gapSeen = 0;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = midLeft; x <= midRight; x += step) {
      gapSeen += 1;
      if (data[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3] <= 24) gap += 1;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    opaqueRatio: opaque / Math.max(1, seen),
    edgeTouch: edgeOpaque / Math.max(1, edge),
    gapRatio: gap / Math.max(1, gapSeen),
    box,
  };
}

function useMeasures(urls: string[]) {
  const key = urls.join("|");
  const [measures, setMeasures] = useState<Record<string, CutoutMeasure | "bad">>({});
  useEffect(() => {
    let cancel = false;
    const unique = [...new Set(key ? key.split("|").filter(Boolean) : [])];
    for (const url of unique) {
      const image = new Image();
      image.onload = () => {
        const measured = measureImage(image);
        if (!cancel) setMeasures((prev) => ({ ...prev, [url]: measured ?? "bad" }));
      };
      image.onerror = () => {
        if (!cancel) setMeasures((prev) => ({ ...prev, [url]: "bad" }));
      };
      image.src = url;
    }
    return () => {
      cancel = true;
    };
  }, [key]);
  return measures;
}

function pieceUrl(item: OutfitItemDto) {
  return item.cutoutUrl || "";
}

function Garments({
  items,
  targets,
  measures,
  aspect,
  className,
}: {
  items: OutfitItemDto[];
  targets: Target[];
  measures: Record<string, CutoutMeasure | "bad">;
  aspect: number;
  className: string;
}) {
  const bySlot = new Map(items.map((item) => [item.slot, item]));
  return (
    <>
      {targets.map((target, index) => {
        const item = bySlot.get(target.slot);
        const url = item ? pieceUrl(item) : "";
        const measured = url ? measures[url] : undefined;
        if (!item || !url || !measured || measured === "bad") return null;
        const image = { w: measured.width, h: measured.height };
        const placed = fitContent(target, image, measured.box, aspect);
        return (
          <img
            key={`${item.id}-${index}`}
            src={url}
            alt=""
            className={className}
            style={{
              left: `${placed.left}%`,
              top: `${placed.top}%`,
              width: `${placed.width}%`,
              zIndex: target.z,
              clipPath: contentClip(image, measured.box),
              transformOrigin: `${((measured.box.x + measured.box.w / 2) / image.w) * 100}% ${((measured.box.y + measured.box.h / 2) / image.h) * 100}%`,
              transform: `rotate(${target.rotate}deg) scaleX(${target.mirror ? -1 : 1})`,
            }}
          />
        );
      })}
    </>
  );
}

function readySlots(items: OutfitItemDto[]) {
  return items
    .map((item) => asSlot(item.slot))
    .filter((slot): slot is Slot => Boolean(slot))
    .filter((slot, index, all) => all.indexOf(slot) === index);
}

export function OutfitModel({
  outfit,
  compact = false,
}: {
  outfit: OutfitDto;
  compact?: boolean;
}) {
  const items = useMemo(
    () => outfit.items.filter((item) => asSlot(item.slot) && pieceUrl(item)),
    [outfit.items],
  );
  const measures = useMeasures(items.map(pieceUrl));
  const slots = readySlots(items);
  const aspects: Partial<Record<Slot, number>> = {};
  for (const item of items) {
    const slot = asSlot(item.slot);
    const measured = slot ? measures[pieceUrl(item)] : undefined;
    if (!slot || !measured || measured === "bad" || measured.box.h < 1) continue;
    aspects[slot] = measured.box.w / measured.box.h;
  }
  const label = items.map((item) => item.name).join(", ");
  const idFor = (slot: Slot) => items.find((item) => item.slot === slot)?.id ?? slot;
  const shoe = items.find((item) => item.slot === "shoes");
  const shoeMeasure = shoe ? measures[pieceUrl(shoe)] : undefined;
  const mirrorShoes = !shoeMeasure || shoeMeasure === "bad" ? true : shoeShouldMirror(shoeMeasure);
  const styled = styledTargets(slots, idFor, aspects).filter((target) => mirrorShoes || !target.mirror);
  const owned = outfit.items.map((item) => item.slot);
  const notes = layNotes(owned);
  const missingTop = owned.includes("layer") && !owned.includes("top");
  const missingShoes = !owned.includes("shoes");

  return (
    <>
      <figure
        className={`styled-lay${compact ? " compact" : ""}`}
        data-testid="outfit-model"
        data-view="styled"
        aria-label={label ? `Styled outfit: ${label}` : "Styled outfit"}
      >
        {missingTop ? <span className="lay-ghost top" /> : null}
        {missingShoes ? <span className="lay-ghost shoes" /> : null}
        <Garments items={items} targets={styled} measures={measures} aspect={LAY_ASPECT} className="lay-piece" />
      </figure>
      {notes.length ? (
        <p className={`lay-gap${compact ? " compact" : ""}`} data-testid="outfit-gap">
          {notes.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
