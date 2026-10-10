import { AutoTokenizer, CLIPTextModelWithProjection, env, pipeline, type ZeroShotImageClassificationPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/clip-vit-base-patch32";

type ClassifyMessage = {
  id: string;
  buffer: ArrayBuffer;
  mime: string;
  labels: string[];
  hypothesis: string;
};

type EmbedMessage = {
  id: string;
  texts: string[];
};

type Embeds = { dims: number[]; data: ArrayLike<number> };

let classifier: ZeroShotImageClassificationPipeline | null = null;
let textModel: {
  tokenizer: (texts: string[], options: { padding: boolean; truncation: boolean }) => unknown;
  model: (inputs: unknown) => Promise<{ text_embeds: Embeds }>;
} | null = null;

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

function vectorsFrom(embeds: Embeds) {
  const width = embeds.dims[embeds.dims.length - 1] ?? 0;
  const count = embeds.dims.length > 1 ? embeds.dims[0] : 1;
  const vectors: number[][] = [];
  for (let row = 0; row < count; row += 1) {
    const start = row * width;
    const vector: number[] = [];
    for (let col = 0; col < width; col += 1) vector.push(Number(embeds.data[start + col] ?? 0));
    vectors.push(vector);
  }
  return vectors;
}

async function embedTexts(texts: string[]) {
  if (!textModel) {
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
    const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "q8" });
    textModel = {
      tokenizer: tokenizer as unknown as (texts: string[], options: { padding: boolean; truncation: boolean }) => unknown,
      model: model as unknown as (inputs: unknown) => Promise<{ text_embeds: Embeds }>,
    };
  }
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += 8) {
    const batch = texts.slice(index, index + 8);
    const inputs = textModel.tokenizer(batch, { padding: true, truncation: true });
    const output = await textModel.model(inputs);
    vectors.push(...vectorsFrom(output.text_embeds as Embeds));
  }
  return vectors;
}

self.onmessage = async (event: MessageEvent<ClassifyMessage | EmbedMessage>) => {
  const message = event.data;
  if ("texts" in message) {
    try {
      const vectors = await embedTexts(message.texts);
      self.postMessage({ id: message.id, vectors });
    } catch (err) {
      self.postMessage({ id: message.id, error: err instanceof Error ? err.message : "Embedding failed" });
    }
    return;
  }
  const { id, buffer, mime, labels, hypothesis } = message;
  try {
    if (!classifier) {
      classifier = await pipeline("zero-shot-image-classification", MODEL, { dtype: "q8" });
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
