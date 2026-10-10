import { withUser } from "@/lib/api";
import { getCloset, postClosetItem } from "@/lib/handlers/closet";

export const GET = withUser(getCloset);
export const POST = withUser(postClosetItem);
export const dynamic = "force-dynamic";
