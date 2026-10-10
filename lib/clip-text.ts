import { cosine } from "./outfit-prompt";

type ScoredItem = { id: string; text: string };

let loading: Promise<(texts: string[]) => Promise<number[][]>> | null = null;

function rowsFrom(embeds: { dims: number[]; data: ArrayLike<number> }) {
  const width = embeds.dims[embeds.dims.length - 1] ?? 0;
  const count = embeds.dims.length > 1 ? embeds.dims[0] : 1;
  const data = embeds.data;
  const vectors: number[][] = [];
  for (let row = 0; row < count; row += 1) {
    const start = row * width;
    const vector: number[] = [];
    for (let col = 0; col < width; col += 1) vector.push(Number(data[start + col] ?? 0));
    vectors.push(vector);
  }
  return vectors;
}

async function load() {
  const { env, AutoTokenizer, CLIPTextModelWithProjection } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.cacheDir = "/tmp/orbit-clip";
  const tokenizer = (await AutoTokenizer.from_pretrained("Xenova/clip-vit-base-patch32")) as unknown as (
    texts: string[],
    options: { padding: boolean; truncation: boolean },
  ) => unknown;
  const loaded = await CLIPTextModelWithProjection.from_pretrained("Xenova/clip-vit-base-patch32", {
    dtype: "q8",
    cache_dir: "/tmp/orbit-clip",
  });
  const model = loaded as unknown as (inputs: unknown) => Promise<{ text_embeds: { dims: number[]; data: ArrayLike<number> } }>;
  return async (texts: string[]) => {
    const vectors: number[][] = [];
    for (let index = 0; index < texts.length; index += 8) {
      const batch = texts.slice(index, index + 8);
      const inputs = tokenizer(batch, { padding: true, truncation: true });
      const output = await model(inputs);
      vectors.push(...rowsFrom(output.text_embeds));
    }
    return vectors;
  };
}

/** CLIP text embeddings in this Node process. Photos and prompts are not sent to a paid API. */
export async function clipScoresForPrompt(prompt: string, items: ScoredItem[]) {
  const text = prompt.trim();
  if (!text || !items.length || process.env.ORBIT_SKIP_CLIP === "1") return null;
  try {
    loading ??= load();
    const embed = await loading;
    const vectors = await embed([text, ...items.map((item) => item.text)]);
    if (vectors.length !== items.length + 1) return null;
    const scores: Record<string, number> = {};
    items.forEach((item, index) => {
      const score = cosine(vectors[0], vectors[index + 1]);
      if (Number.isFinite(score)) scores[item.id] = Math.max(-1, Math.min(1, score));
    });
    return scores;
  } catch (err) {
    loading = null;
    console.error("outfit_clip_text_failed", err instanceof Error ? err.message : err);
    return null;
  }
}
