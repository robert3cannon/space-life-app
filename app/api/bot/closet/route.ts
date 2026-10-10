import { withBot } from "@/lib/api";
import { getCloset } from "@/lib/handlers/closet";

export const GET = withBot(getCloset);
export const dynamic = "force-dynamic";
