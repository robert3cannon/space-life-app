import { withUser } from "@/lib/api";
import { getOutfitHistory } from "@/lib/handlers/closet";

export const GET = withUser(getOutfitHistory);
export const dynamic = "force-dynamic";
