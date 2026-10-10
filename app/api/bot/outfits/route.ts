import { withBot } from "@/lib/api";
import { getOutfit, postOutfit } from "@/lib/handlers/closet";

export const GET = withBot(getOutfit);
export const POST = withBot(postOutfit);
export const dynamic = "force-dynamic";
