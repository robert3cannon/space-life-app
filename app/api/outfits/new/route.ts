import { withUser } from "@/lib/api";
import { postNewOutfit } from "@/lib/handlers/closet";

export const POST = withUser(postNewOutfit);
export const dynamic = "force-dynamic";
