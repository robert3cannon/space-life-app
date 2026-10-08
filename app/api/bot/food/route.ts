import { getFood, postFood } from "@/lib/handlers/food";
import { withBot } from "@/lib/api";

export const GET = withBot(getFood);
export const POST = withBot(postFood);

export const dynamic = "force-dynamic";
