import { withUser } from "@/lib/api";
import { postWearOutfit } from "@/lib/handlers/closet";

export const POST = withUser(postWearOutfit);
export const dynamic = "force-dynamic";
