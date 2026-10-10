import { withUser } from "@/lib/api";
import { postOutfitRequest } from "@/lib/handlers/closet";

export const POST = withUser(postOutfitRequest);
export const dynamic = "force-dynamic";
