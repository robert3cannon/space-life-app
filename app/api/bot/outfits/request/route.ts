import { json, readJson, withBot } from "@/lib/api";
import { outfitItemText } from "@/lib/outfit-prompt";
import { listItems, requestOrigin, requestOutfit } from "@/lib/services/closet";
import { outfitRequestSchema } from "@/lib/validation";

async function postOutfitPrompt(req: Request) {
  const input = outfitRequestSchema.parse(await readJson(req));
  let clipScores = input.clipScores;
  if (!clipScores && input.prompt.trim()) {
    try {
      const { clipScoresForPrompt } = await import("@/lib/clip-text");
      const items = await listItems(null, false);
      clipScores =
        (await clipScoresForPrompt(
          input.prompt,
          items.map((item) => ({ id: item.id, text: outfitItemText(item) })),
        )) ?? undefined;
    } catch (err) {
      console.error("outfit_clip_text_failed", err instanceof Error ? err.message : err);
    }
  }
  const outfit = await requestOutfit(input.date, input.prompt, requestOrigin(req), true, clipScores);
  return json({ outfit });
}

export const POST = withBot(postOutfitPrompt);
export const dynamic = "force-dynamic";
export const maxDuration = 60;
