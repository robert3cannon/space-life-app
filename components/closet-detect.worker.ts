import { env, pipeline, type ZeroShotImageClassificationPipeline } from "@huggingface/transformers";

type RequestMessage = {
  id: string;
  buffer: ArrayBuffer;
  mime: string;
  labels: string[];
  hypothesis: string;
};

let classifier: ZeroShotImageClassificationPipeline | null = null;

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

self.onmessage = async (event: MessageEvent<RequestMessage>) => {
  const { id, buffer, mime, labels, hypothesis } = event.data;
  try {
    if (!classifier) {
      classifier = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "q8" });
    }
    const blob = new Blob([buffer], { type: mime || "image/jpeg" });
    const url = URL.createObjectURL(blob);
    try {
      const scores = await classifier(url, labels, { hypothesis_template: hypothesis });
      const rows = Array.isArray(scores[0]) ? [] : scores;
      self.postMessage({
        id,
        scores: rows.map((row) => ({ label: String(row.label), score: Number(row.score) })),
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : "Detection failed" });
  }
};
