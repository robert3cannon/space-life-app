import { getRecentFood } from "@/lib/handlers/food";
import { withBot } from "@/lib/api";

export const GET = withBot(getRecentFood);

export const dynamic = "force-dynamic";
