import { withUser } from "@/lib/api";
import { postSwapOutfit } from "@/lib/handlers/closet";

export const POST = withUser(postSwapOutfit);
export const dynamic = "force-dynamic";
