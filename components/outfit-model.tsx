"use client";

import { useEffect, useMemo, useState } from "react";
import {
  boardAspect,
  cutoutIsClean,
  fitContent,
  mannequinTargets,
  shoeShouldMirror,
  styledTargets,
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
  const step = 3;
  let opaque = 0;
  let seen = 0;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
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
      if (alpha > 24) {
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
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
    box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
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
  return item.cutoutUrl || item.imageUrl || "";
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
        const placed = fitContent(target, { w: measured.width, h: measured.height }, measured.box, aspect);
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
  view,
}: {
  outfit: OutfitDto;
  compact?: boolean;
  view: "styled" | "mannequin";
}) {
  const items = useMemo(
    () => outfit.items.filter((item) => asSlot(item.slot) && pieceUrl(item)),
    [outfit.items],
  );
  const measures = useMeasures(items.map(pieceUrl));
  const slots = readySlots(items);
  const label = items.map((item) => item.name).join(", ");
  const idFor = (slot: Slot) => items.find((item) => item.slot === slot)?.id ?? slot;
  const shoe = items.find((item) => item.slot === "shoes");
  const shoeMeasure = shoe ? measures[pieceUrl(shoe)] : undefined;
  const mirrorShoes = !shoeMeasure || shoeMeasure === "bad" ? true : shoeShouldMirror(shoeMeasure);
  const pending = items.some((item) => !measures[pieceUrl(item)]);
  const mannequinClean =
    !pending &&
    items.length > 0 &&
    items.every((item) => {
      const slot = asSlot(item.slot);
      const measured = measures[pieceUrl(item)];
      return Boolean(item.cutoutUrl && slot && measured && measured !== "bad" && cutoutIsClean(measured, slot));
    });
  const showMannequin = view === "mannequin" && (pending || mannequinClean);
  const styled = styledTargets(slots, idFor).filter((target) => mirrorShoes || !target.mirror);
  const dressed = mannequinTargets(slots).filter((target) => mirrorShoes || !target.mirror);

  if (!showMannequin) {
    return (
      <figure
        className={`styled-lay${compact ? " compact" : ""}`}
        data-testid="outfit-model"
        data-view="styled"
        aria-label={label ? `Styled outfit: ${label}` : "Styled outfit"}
      >
        {view === "mannequin" && !pending ? <p className="lay-note">Showing the flat lay. A piece needs a clean cutout.</p> : null}
        <Garments items={items} targets={styled} measures={measures} aspect={boardAspect("styled")} className="lay-piece" />
      </figure>
    );
  }

  return (
    <figure className={`photo-mann${compact ? " compact" : ""}`} data-testid="outfit-model" data-view="mannequin" aria-label={label ? `On mannequin: ${label}` : "On mannequin"}>
      <img src="/mannequin.jpg" alt="" className="mann-base" />
      <Garments items={items} targets={dressed} measures={measures} aspect={boardAspect("mannequin")} className="mann-piece" />
    </figure>
  );
}
