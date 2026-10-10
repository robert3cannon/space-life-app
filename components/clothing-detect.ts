"use client";

import { CLIP_HYPOTHESIS, CLIP_LABELS, dominantColors, type LabelScore } from "@/lib/closet-detect";

type WorkerResponse = { id: string; scores?: LabelScore[]; error?: string };

let worker: Worker | null = null;
let browserFailed = false;
let chain: Promise<void> = Promise.resolve();
let nextId = 0;
const pending = new Map<string, { resolve: (scores: LabelScore[]) => void; reject: (err: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./closet-detect.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.error || !event.data.scores) job.reject(new Error(event.data.error || "Detection failed"));
      else job.resolve(event.data.scores);
    };
    worker.onerror = () => {
      browserFailed = true;
      for (const job of pending.values()) job.reject(new Error("Detection failed"));
      pending.clear();
    };
  }
  return worker;
}

function classifyInBrowser(file: File) {
  const run = chain.then(async () => {
    const buffer = await file.arrayBuffer();
    const id = String(++nextId);
    const scores = await new Promise<LabelScore[]>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error("Detection timed out"));
      }, 90000);
      pending.set(id, {
        resolve: (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          window.clearTimeout(timer);
          reject(err);
        },
      });
      getWorker().postMessage({ id, buffer, mime: file.type || "image/jpeg", labels: CLIP_LABELS, hypothesis: CLIP_HYPOTHESIS }, [buffer]);
    });
    return scores;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function classifyOnServer(file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/closet/detect", { method: "POST", body, credentials: "same-origin" });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!response.ok) throw new Error("Detection is unavailable right now");
  const data = (await response.json()) as { scores?: LabelScore[] };
  if (!data.scores?.length) throw new Error("Detection is unavailable right now");
  return data.scores;
}

export async function colorsInPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const edge = 64;
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return [];
  }
  ctx.drawImage(bitmap, 0, 0, edge, edge);
  bitmap.close();
  return dominantColors(ctx.getImageData(0, 0, edge, edge).data, edge, edge);
}

/** CLIP in the browser, including iPhone. If that model cannot load, the photo goes to Orbit's own server and nowhere else. */
export async function classifyPhoto(file: File) {
  if (!browserFailed && typeof Worker !== "undefined") {
    try {
      return await classifyInBrowser(file);
    } catch {
      browserFailed = true;
    }
  }
  return classifyOnServer(file);
}
