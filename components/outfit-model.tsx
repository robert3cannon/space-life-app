"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PersonBody, PersonDefs, PersonHands, PersonHead } from "./person-figure";
import { useLoad } from "./use-load";
import {
  boxGrid,
  capMesh,
  FIGURE_VIEW,
  legMesh,
  legUV,
  shoeMesh,
  sleeveMesh,
  sleeveSource,
  TORSO_U,
  TORSO_V,
  torsoMesh,
  type Pt,
} from "@/lib/figure-fit";
import { fillMesh, warpMesh } from "@/lib/garment-warp";
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

const ORDER = ["bottom", "shorts", "top", "hoodie", "jacket", "shoes", "hat"];

type Box = { x: number; y: number; w: number; h: number };

const boxes = new WeakMap<HTMLImageElement, Box>();

function contentBox(image: HTMLImageElement): Box {
  const cached = boxes.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const full = { x: 0, y: 0, w: image.width, h: image.height };
  if (!ctx || image.width < 2 || image.height < 2) {
    boxes.set(image, full);
    return full;
  }
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  const step = 3;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      if (data[(y * canvas.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box = maxX > minX && maxY > minY ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : full;
  boxes.set(image, box);
  return box;
}

function useImages(urls: string[]) {
  const key = urls.filter(Boolean).join("|");
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let cancel = false;
    const unique = [...new Set(key ? key.split("|") : [])];
    for (const url of unique) {
      const img = new Image();
      img.onload = () => {
        if (!cancel) setImages((prev) => (prev[url] ? prev : { ...prev, [url]: img }));
      };
      img.src = url;
    }
    return () => {
      cancel = true;
    };
  }, [key]);
  return images;
}

function shade(ctx: CanvasRenderingContext2D, mesh: Pt[][]) {
  const xs = mesh.flatMap((row) => row.map((pt) => pt.x));
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...mesh.flatMap((row) => row.map((pt) => pt.y)));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mesh[0][0].x, mesh[0][0].y);
  for (const pt of mesh[0].slice(1)) ctx.lineTo(pt.x, pt.y);
  for (let row = 1; row < mesh.length; row += 1) {
    const pt = mesh[row][mesh[row].length - 1];
    ctx.lineTo(pt.x, pt.y);
  }
  const last = mesh[mesh.length - 1];
  for (let col = last.length - 2; col >= 0; col -= 1) ctx.lineTo(last[col].x, last[col].y);
  for (let row = mesh.length - 2; row >= 1; row -= 1) ctx.lineTo(mesh[row][0].x, mesh[row][0].y);
  ctx.closePath();
  ctx.clip();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.16;
  const grad = ctx.createLinearGradient(left, top, right, top);
  grad.addColorStop(0, "#4a382f");
  grad.addColorStop(0.48, "#ffffff");
  grad.addColorStop(1, "#4a382f");
  ctx.fillStyle = grad;
  ctx.fillRect(left - 4, top - 4, right - left + 8, 800);
  ctx.restore();
}

function strokeSole(ctx: CanvasRenderingContext2D, mesh: Pt[][]) {
  const top = mesh[0];
  const toe = mesh[mesh.length - 1];
  const mid = mesh[0].map((pt, index) => ({
    x: pt.x + (toe[index].x - pt.x) * 0.42,
    y: pt.y + (toe[index].y - pt.y) * 0.42,
  }));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(36, 30, 26, 0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(top[1].x, top[1].y + 4);
  ctx.lineTo(mid[1].x, mid[1].y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(32, 26, 22, 0.82)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(toe[0].x, toe[0].y);
  for (const pt of toe) ctx.lineTo(pt.x, pt.y);
  ctx.stroke();
  ctx.restore();
}

function paintGarment(ctx: CanvasRenderingContext2D, item: OutfitItemDto, image: HTMLImageElement | undefined) {
  const zone = zoneFor(item);
  const fit = item.fit || "straight";
  const color = ink(item.colors);
  const box = image ? contentBox(image) : undefined;
  const meshes: Array<{ dst: Pt[][]; src?: Pt[][]; sole?: boolean }> = [];
  if (zone === "shoes") {
    for (const side of ["l", "r"] as const) {
      meshes.push({
        dst: shoeMesh(side),
        src: box ? boxGrid(box, [0.2, 0.5, 0.8], [0.34, 0.62]) : undefined,
        sole: true,
      });
    }
  } else if (zone === "bottom" || zone === "shorts") {
    const shorts = zone === "shorts";
    for (const side of ["l", "r"] as const) {
      const uv = legUV(side, shorts);
      meshes.push({ dst: legMesh(side, shorts), src: box ? boxGrid(box, uv.u, uv.v) : undefined });
    }
  } else if (zone === "hat") {
    meshes.push({
      dst: capMesh(),
      src: box ? boxGrid(box, [0.08, 0.5, 0.92], [0.02, 0.46, 0.98]) : undefined,
    });
  } else {
    const length = zone === "top" ? "short" : "long";
    meshes.push({
      dst: torsoMesh(fit),
      src: box ? boxGrid(box, TORSO_U, TORSO_V) : undefined,
    });
    for (const side of ["l", "r"] as const) {
      meshes.push({
        dst: sleeveMesh(side, length, fit),
        src: image ? sleeveSource(image.width, image.height, side, length, box) : undefined,
      });
    }
  }
  for (const mesh of meshes) {
    if (image && mesh.src) {
      if (mesh.sole) fillMesh(ctx, mesh.dst, color);
      warpMesh(ctx, image, mesh.src, mesh.dst);
      if (!mesh.sole) shade(ctx, mesh.dst);
      if (mesh.sole) strokeSole(ctx, mesh.dst);
    } else {
      fillMesh(ctx, mesh.dst, color);
      if (mesh.sole) strokeSole(ctx, mesh.dst);
    }
  }
}

function WearCanvas({
  items,
  images,
  className,
}: {
  items: OutfitItemDto[];
  images: Record<string, HTMLImageElement>;
  className: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = items.map((item) => `${item.id}:${item.cutoutUrl ?? ""}:${item.fit}`).join("|");
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const paint = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform((dpr * rect.width) / FIGURE_VIEW.w, 0, 0, (dpr * rect.height) / FIGURE_VIEW.h, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, FIGURE_VIEW.w, FIGURE_VIEW.h);
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const pen = off.getContext("2d");
      if (!pen) return;
      const placed = ctx.getTransform();
      for (const item of items) {
        pen.setTransform(placed);
        pen.clearRect(0, 0, FIGURE_VIEW.w, FIGURE_VIEW.h);
        pen.imageSmoothingEnabled = true;
        paintGarment(pen, item, item.cutoutUrl ? images[item.cutoutUrl] : undefined);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.shadowColor = "rgba(16, 12, 32, 0.32)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.drawImage(off, 0, 0);
        ctx.restore();
      }
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [images, items, signature]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export function OutfitModel({ outfit, compact = false }: { outfit: OutfitDto; compact?: boolean }) {
  const marker = useId().replace(/:/g, "");
  const settings = useLoad<AppSettings>("/api/settings");
  const skinId = settings.data?.skinTone ?? "fair";
  const pieces = useMemo(
    () => [...outfit.items].sort((a, b) => ORDER.indexOf(zoneFor(a)) - ORDER.indexOf(zoneFor(b))),
    [outfit.items],
  );
  const images = useImages(pieces.map((item) => item.cutoutUrl || ""));
  const worn = pieces.filter((item) => zoneFor(item) !== "hat");
  const hats = pieces.filter((item) => zoneFor(item) === "hat");
  const label = pieces.map((item) => item.name).join(", ");
  return (
    <figure className={`mannequin${compact ? " compact" : ""}`} data-testid="outfit-model" aria-label={label ? `On model: ${label}` : "On model"}>
      <svg viewBox={`0 0 ${FIGURE_VIEW.w} ${FIGURE_VIEW.h}`} className="figure-body" aria-hidden="true">
        <PersonDefs marker={marker} skinId={skinId} />
        <PersonBody marker={marker} skinId={skinId} />
      </svg>
      <WearCanvas items={worn} images={images} className="wear-canvas" />
      <svg viewBox={`0 0 ${FIGURE_VIEW.w} ${FIGURE_VIEW.h}`} className="figure-front" aria-hidden="true">
        <PersonDefs marker={`${marker}f`} skinId={skinId} />
        <PersonHands skinId={skinId} />
        <PersonHead marker={`${marker}f`} skinId={skinId} />
      </svg>
      <WearCanvas items={hats} images={images} className="hat-canvas" />
    </figure>
  );
}
