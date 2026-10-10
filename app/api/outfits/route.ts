import { withUser } from "@/lib/api";
import { getOutfit } from "@/lib/handlers/closet";

export const GET = withUser(getOutfit);
export const dynamic = "force-dynamic";
