import { getWater, postWater } from "@/lib/handlers/water";
import { withBot } from "@/lib/api";

export const GET = withBot(getWater);
export const POST = withBot(postWater);
export const dynamic = "force-dynamic";
