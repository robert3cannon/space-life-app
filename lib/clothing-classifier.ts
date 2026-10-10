import { CLIP_HYPOTHESIS, CLIP_LABELS, type LabelScore } from "./closet-detect";

let loading: Promise<(blob: Blob) => Promise<LabelScore[]>> | null = null;

async function load() {
  const { env, pipeline, RawImage } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.cacheDir = "/tmp/orbit-clip";
  const classifier = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", {
    dtype: "q8",
    cache_dir: "/tmp/orbit-clip",
  });
  return async (blob: Blob, labels: string[], hypothesis: string) => {
    const image = await RawImage.fromBlob(blob);
    const scores = await classifier(image, labels, { hypothesis_template: hypothesis });
    const rows = Array.isArray(scores[0]) ? [] : scores;
    return rows.map((row) => ({ label: String(row.label), score: Number(row.score) }));
  };
}

/** Runs CLIP in this Node process. The photo is not sent to a vision API. */
export async function classifyClothingImage(bytes: Uint8Array, mime: string, labels = CLIP_LABELS, hypothesis = CLIP_HYPOTHESIS) {
  loading ??= load();
  const classify = await loading;
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: mime || "image/jpeg" });
  return classify(blob, labels, hypothesis);
}
