import { withUser } from "@/lib/api";
import { postOrientItem } from "@/lib/handlers/closet";

export const POST = withUser(postOrientItem);
export const dynamic = "force-dynamic";
