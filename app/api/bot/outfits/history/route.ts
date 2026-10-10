import { withBot } from "@/lib/api";
import { getOutfitHistory } from "@/lib/handlers/closet";

export const GET = withBot(getOutfitHistory);
export const dynamic = "force-dynamic";
